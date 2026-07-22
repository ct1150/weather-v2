import { createHash } from "node:crypto";

export const ALLOWED_STATUS = new Set(["Active", "Deprecated", "Superseded"]);
export const ALLOWED_KIND = new Set(["Hard", "Guidance"]);
export const ALLOWED_RELEASE = new Set(["MVP", "Beta", "V1", "V2"]);
export const ALLOWED_LIFECYCLE = new Set(["Launch", "Continuous"]);
export const ALLOWED_TRACE_CLASS = new Set(["Hard", "Suggestion", "Example"]);
export const ALLOWED_COVERAGE = new Set(["Covered", "Changed", "Rejected", "Needs Decision"]);

const REQUIRED_REQUIREMENT_KEYS = ["id", "status", "kind", "roadmap_ref", "owner", "verification"];

export function normalizeBlock(text) {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines.at(-1).trim() === "") lines.pop();
  return `${lines.map((line) => line.replace(/[ \t]+$/u, "")).join("\n")}\n`;
}

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function fail(filePath, message) {
  throw new Error(`${filePath}: ${message}`);
}

function parseMetadata(metadataText, filePath) {
  const metadata = new Map();

  for (const rawLine of metadataText.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n")) {
    if (rawLine.trim() === "") continue;

    const match = /^([a-z_]+):[ \t]*(\S(?:.*\S)?)?[ \t]*$/u.exec(rawLine);
    if (!match || match[2] === undefined) {
      fail(filePath, `invalid requirement metadata line: ${rawLine}`);
    }

    const [, key, value] = match;
    if (!REQUIRED_REQUIREMENT_KEYS.includes(key)) {
      fail(filePath, `unknown requirement metadata key: ${key}`);
    }
    if (metadata.has(key)) {
      fail(filePath, `duplicate metadata key: ${key}`);
    }
    metadata.set(key, value);
  }

  for (const key of REQUIRED_REQUIREMENT_KEYS) {
    if (!metadata.has(key)) {
      fail(filePath, `missing metadata key: ${key}`);
    }
  }

  return metadata;
}

function assertAllowed(value, allowed, label, filePath) {
  if (!allowed.has(value)) {
    fail(filePath, `invalid ${label}: ${value}`);
  }
}

export function parseRequirementBlocks(markdown, filePath) {
  const markerStart = /<!-- requirement\b/gu;
  const marker = /<!-- requirement(?:\r\n|\r|\n)([\s\S]*?)-->/gu;
  const starts = [...markdown.matchAll(markerStart)];
  const matches = [...markdown.matchAll(marker)];
  if (
    starts.length !== matches.length ||
    starts.some((start, index) => start.index !== matches[index].index)
  ) {
    fail(filePath, "malformed or unclosed requirement marker");
  }

  const blocks = [];
  const seenIds = new Set();

  for (const [index, match] of matches.entries()) {
    const metadata = parseMetadata(match[1], filePath);
    const id = metadata.get("id");
    const status = metadata.get("status");
    const kind = metadata.get("kind");
    const blockEnd = matches[index + 1]?.index ?? markdown.length;
    const text = normalizeBlock(markdown.slice(match.index, blockEnd));
    const heading = /^###[ \t]+(\S+)(?:[ \t]+—|[ \t]+-)[ \t]+.+$/mu.exec(text);

    assertAllowed(status, ALLOWED_STATUS, "status", filePath);
    assertAllowed(kind, ALLOWED_KIND, "kind", filePath);

    if (!heading || heading[1] !== id) {
      fail(filePath, `heading does not match requirement id ${id}`);
    }
    if (seenIds.has(id)) {
      fail(filePath, `duplicate requirement id: ${id}`);
    }
    seenIds.add(id);

    const hasAcceptanceCriteria = /^####[ \t]+Acceptance Criteria[ \t]*$/mu.test(text);
    if (kind === "Hard" && !hasAcceptanceCriteria) {
      fail(filePath, `Hard requirement ${id} lacks Acceptance Criteria`);
    }

    blocks.push({
      filePath,
      hasAcceptanceCriteria,
      id,
      kind,
      owner: metadata.get("owner"),
      roadmapRef: metadata.get("roadmap_ref"),
      status,
      text,
      verification: metadata.get("verification"),
    });
  }

  return blocks;
}

export function digestRequirementSelection(blocks, ids) {
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const selectedIds = [...new Set(ids)].sort();
  const selectedBlocks = selectedIds.map((id) => {
    const block = blocksById.get(id);
    if (!block) {
      throw new Error(`unknown requirement id: ${id}`);
    }
    return normalizeBlock(block.text);
  });

  return `sha256:${sha256(selectedBlocks.join("\n---\n"))}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseJsonComments(markdown, filePath, type) {
  const startPattern = new RegExp(`<!--\\s*${type}\\b`, "gu");
  const records = [];
  let start;

  while ((start = startPattern.exec(markdown)) !== null) {
    const endIndex = markdown.indexOf("-->", start.index);
    if (endIndex === -1) {
      fail(filePath, `${type} comment must be single-line valid JSON`);
    }

    const comment = markdown.slice(start.index, endIndex + 3);
    startPattern.lastIndex = endIndex + 3;
    if (/[\r\n]/u.test(comment)) {
      fail(filePath, `${type} comment must be single-line valid JSON`);
    }

    const payloadMatch = new RegExp(`^<!--\\s*${type}\\s*:\\s*(.*?)\\s*-->$`, "u").exec(comment);
    if (!payloadMatch) {
      fail(filePath, `invalid ${type} JSON comment`);
    }

    let value;
    try {
      value = JSON.parse(payloadMatch[1]);
    } catch {
      fail(filePath, `invalid ${type} JSON`);
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      fail(filePath, `${type} JSON must be a JSON object`);
    }
    if (type === "derived" && payloadMatch[1] !== canonicalJson(value)) {
      fail(filePath, "derived manifest must use canonical JSON");
    }
    records.push(value);
  }

  return records;
}

function assertExactKeys(record, expectedKeys, type, filePath) {
  const actualKeys = Object.keys(record).sort();
  const sortedExpected = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpected.length ||
    actualKeys.some((key, index) => key !== sortedExpected[index])
  ) {
    fail(filePath, `${type} JSON must contain exactly: ${sortedExpected.join(", ")}`);
  }
}

function assertNonEmptyString(value, label, filePath) {
  if (typeof value !== "string" || value.length === 0) {
    fail(filePath, `${label} must be a non-empty string`);
  }
}

export function parseReleaseRecords(markdown, filePath) {
  return parseJsonComments(markdown, filePath, "release").map((record) => {
    assertExactKeys(
      record,
      ["first_release", "id", "lifecycle", "requirement_id"],
      "release",
      filePath,
    );
    assertAllowed(record.first_release, ALLOWED_RELEASE, "first_release", filePath);
    assertAllowed(record.lifecycle, ALLOWED_LIFECYCLE, "lifecycle", filePath);
    assertNonEmptyString(record.id, "release id", filePath);
    assertNonEmptyString(record.requirement_id, "release requirement_id", filePath);

    return {
      filePath,
      firstRelease: record.first_release,
      id: record.id,
      lifecycle: record.lifecycle,
      requirementId: record.requirement_id,
    };
  });
}

export function parseTraceRecords(markdown, filePath) {
  return parseJsonComments(markdown, filePath, "trace").map((record) => {
    assertExactKeys(
      record,
      [
        "classification",
        "coverage",
        "line_end",
        "line_start",
        "rationale",
        "requirement_id",
        "source_excerpt",
        "source_sha256",
      ],
      "trace",
      filePath,
    );
    assertAllowed(record.classification, ALLOWED_TRACE_CLASS, "classification", filePath);
    assertAllowed(record.coverage, ALLOWED_COVERAGE, "coverage", filePath);
    if (
      !Number.isInteger(record.line_start) ||
      !Number.isInteger(record.line_end) ||
      record.line_start < 1 ||
      record.line_end < record.line_start
    ) {
      fail(filePath, "trace line_start/line_end must be a valid line range");
    }
    assertNonEmptyString(record.rationale, "trace rationale", filePath);
    assertNonEmptyString(record.requirement_id, "trace requirement_id", filePath);
    assertNonEmptyString(record.source_excerpt, "trace source_excerpt", filePath);
    if (!/^[a-f0-9]{64}$/u.test(record.source_sha256)) {
      fail(filePath, "trace source_sha256 must be 64 lowercase hexadecimal characters");
    }

    return {
      classification: record.classification,
      coverage: record.coverage,
      filePath,
      lineEnd: record.line_end,
      lineStart: record.line_start,
      rationale: record.rationale,
      requirementId: record.requirement_id,
      sourceExcerpt: record.source_excerpt,
      sourceSha256: record.source_sha256,
    };
  });
}

function assertStrictlySorted(values, label, filePath) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] >= values[index]) {
      fail(filePath, `${label} must be canonically sorted without duplicates`);
    }
  }
}

export function parseDerivedManifest(markdown, filePath) {
  const manifests = parseJsonComments(markdown, filePath, "derived");
  if (manifests.length === 0) return null;
  if (manifests.length > 1) {
    fail(filePath, "only one derived manifest is allowed");
  }

  const manifest = manifests[0];
  assertExactKeys(manifest, ["generated_at", "schema", "sources"], "derived", filePath);
  assertNonEmptyString(manifest.generated_at, "derived generated_at", filePath);
  if (!Number.isInteger(manifest.schema) || manifest.schema < 1) {
    fail(filePath, "derived schema must be a positive integer");
  }
  if (!Array.isArray(manifest.sources)) {
    fail(filePath, "derived sources must be an array");
  }

  const sources = manifest.sources.map((source) => {
    if (source === null || typeof source !== "object" || Array.isArray(source)) {
      fail(filePath, "derived source must be a JSON object");
    }
    assertExactKeys(source, ["digest", "ids", "path"], "derived source", filePath);
    assertNonEmptyString(source.path, "derived source path", filePath);
    if (!/^sha256:[a-f0-9]{64}$/u.test(source.digest)) {
      fail(
        filePath,
        "derived source digest must be sha256 followed by 64 lowercase hexadecimal characters",
      );
    }
    if (!Array.isArray(source.ids)) {
      fail(filePath, "derived source ids must be an array");
    }
    for (const id of source.ids) {
      assertNonEmptyString(id, "derived source id", filePath);
    }
    assertStrictlySorted(source.ids, "derived source ids", filePath);

    return {
      digest: source.digest,
      ids: [...source.ids],
      path: source.path,
    };
  });

  assertStrictlySorted(
    sources.map((source) => source.path),
    "derived sources",
    filePath,
  );

  return {
    filePath,
    generatedAt: manifest.generated_at,
    schema: manifest.schema,
    sources,
  };
}
