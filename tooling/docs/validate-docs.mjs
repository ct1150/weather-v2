import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  digestRequirementSelection,
  parseDerivedManifest,
  parseReleaseRecords,
  parseRequirementBlocks,
  parseTraceRecords,
  sha256,
} from "./requirement-format.mjs";

/** @typedef {{code:string,file:string,message:string}} ValidationIssue */
/** @typedef {{errors:ValidationIssue[],warnings:ValidationIssue[],stats:{requirements:number,releases:number,traces:number}}} ValidationResult */

export const REQUIRED_CONTRACT_IDS = [
  "ARCH-RENDER-001",
  "ARCH-FLAG-001",
  "DATA-ACTIVITY-001",
  "ENG-PERF-001",
  "ENG-BOT-001",
  "GROW-AFF-001",
  "GROW-ADS-001",
  "GROW-ANALYTICS-001",
  "GROW-REPORT-001",
];

export const AUTHORITY_FILES = [
  "docs/README.md",
  "docs/00-Founder-Vision.md",
  "docs/01-Product-PRD.md",
  "docs/02-UX-Bible.md",
  "docs/03-SEO-Bible.md",
  "docs/04-AI-Coding-Bible.md",
  "docs/05-System-Architecture.md",
  "docs/06-Database.md",
  "docs/07-API-Spec.md",
  "docs/08-Cloudflare-Deployment.md",
  "docs/09-Engineering-Handbook.md",
  "docs/10-Growth-Bible.md",
  "docs/11-Roadmap.md",
  "docs/13-Requirements-Traceability.md",
];

const AUTHORITY_FILE_SET = new Set(AUTHORITY_FILES);
const INDEX_FILES = ["README.md", "SPEC.md", "docs/README.md"];
const REQUIREMENT_FILES = AUTHORITY_FILES.filter((file) => /^docs\/(?:0\d|10)-/u.test(file));
const KIRO_FILES = [
  ".kiro/specs/where-not-rain/requirements.md",
  ".kiro/specs/where-not-rain/design.md",
  ".kiro/specs/where-not-rain/tasks.md",
];
const NAVIGATION_TARGETS = new Set([
  "README.md",
  "SPEC.md",
  "docs/README.md",
  "docs/11-Roadmap.md",
  "docs/12-ADR/README.md",
  ...KIRO_FILES,
]);
const INDEX_ALLOWED_TARGETS = new Map([
  ["README.md", new Set(["SPEC.md", "docs/README.md", "docs/11-Roadmap.md", ...KIRO_FILES])],
  ["SPEC.md", new Set([...AUTHORITY_FILES, ...NAVIGATION_TARGETS])],
  ["docs/README.md", new Set([...AUTHORITY_FILES, ...NAVIGATION_TARGETS])],
]);
const REQUIRED_FILES = [
  "README.md",
  "SPEC.md",
  "weather.txt",
  ...AUTHORITY_FILES,
  "docs/12-ADR/README.md",
  ...KIRO_FILES,
];
const FRONT_MATTER_FILES = AUTHORITY_FILES;
const REQUIREMENT_ID_SOURCE =
  "(?:ARCH|DATA|ENG|GROW|VISION|PRD|UX|SEO|AGENT|API|DEP)(?:-[A-Z0-9]+)+-\\d{3}";
const REQUIREMENT_ID_PATTERN = new RegExp(`\\b${REQUIREMENT_ID_SOURCE}\\b`, "gu");
const EXACT_REQUIREMENT_ID_PATTERN = new RegExp(`^${REQUIREMENT_ID_SOURCE}$`, "u");
const DERIVED_COMMENT_PATTERN = /^<!-- derived: .*?-->[ \t]*(?:\r?\n)?/u;
const INLINE_LINK_PATTERN = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/gu;

class ValidatorError extends Error {
  constructor(kind, message, options) {
    super(message, options);
    this.name = "ValidatorError";
    this.kind = kind;
  }
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortIssues(issues) {
  issues.sort(
    (left, right) =>
      compareText(left.file, right.file) ||
      compareText(left.code, right.code) ||
      compareText(left.message, right.message),
  );
}

function addIssue(state, code, file, message, severity = "errors") {
  state[severity].push({ code, file, message });
}

function relativePath(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function pathExists(absolutePath) {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function readKnownFile(state, file) {
  if (state.files.has(file)) return state.files.get(file);
  const absolutePath = path.join(state.root, file);
  if (!(await pathExists(absolutePath))) return null;
  const contents = await readFile(absolutePath, "utf8");
  state.files.set(file, contents);
  return contents;
}

async function readMarkdownFilesRecursively(state, directory) {
  const absoluteDirectory = path.join(state.root, directory);
  if (!(await pathExists(absoluteDirectory))) return;
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const absoluteEntry = path.join(absoluteDirectory, entry.name);
    const file = relativePath(state.root, absoluteEntry);
    if (entry.isDirectory()) {
      await readMarkdownFilesRecursively(state, file);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      state.files.set(file, await readFile(absoluteEntry, "utf8"));
    }
  }
}

function parseWithContext(parser, markdown, file) {
  try {
    return parser(markdown, file);
  } catch (error) {
    throw new ValidatorError("parser", error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }
}

function frontMatterStatus(markdown) {
  const match = /^---(?:\r?\n)([\s\S]*?)(?:\r?\n)---(?:\r?\n|$)/u.exec(markdown);
  if (!match) return null;
  const status = /^status:[ \t]*(.+?)[ \t]*$/mu.exec(match[1]);
  return status?.[1] ?? null;
}

function outsideFencedCode(markdown) {
  let fence = null;
  return markdown
    .split(/\r?\n/u)
    .map((line) => {
      const marker = /^[ \t]*(```|~~~)/u.exec(line)?.[1] ?? null;
      if (marker) {
        if (fence === null) fence = marker;
        else if (marker === fence) fence = null;
        return "";
      }
      return fence === null ? line : "";
    })
    .join("\n");
}

function withoutCommentsPreservingLines(markdown) {
  return markdown.replace(/<!--[\s\S]*?-->/gu, (comment) => comment.replace(/[^\n]/gu, ""));
}

function anchorsIn(markdown) {
  const anchors = new Set();
  for (const match of markdown.matchAll(/<a[ \t]+[^>]*\bid=["']([^"']+)["'][^>]*>/giu)) {
    anchors.add(match[1]);
  }
  for (const match of outsideFencedCode(markdown).matchAll(/^#{1,6}[ \t]+(.+)$/gmu)) {
    const slug = match[1]
      .replace(/<[^>]+>/gu, "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/[\s-]+/gu, "-");
    if (slug) anchors.add(slug);
  }
  return anchors;
}

function hasExplicitAnchor(markdown, id) {
  return new RegExp(`<a[ \\t]+[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*>`, "iu").test(markdown);
}

function extractRequirementIds(markdown) {
  return [...markdown.replace(DERIVED_COMMENT_PATTERN, "").matchAll(REQUIREMENT_ID_PATTERN)].map(
    (match) => match[0],
  );
}

function splitKiroScope(markdown) {
  const heading = /^##[ \t]+Out of current scope[ \t]*$/mu.exec(markdown);
  if (!heading) return { normative: markdown, outOfScope: "" };
  return {
    normative: markdown.slice(0, heading.index),
    outOfScope: markdown.slice(heading.index),
  };
}

function unlinkedRequirementIds(markdown) {
  const linkRanges = [...markdown.matchAll(INLINE_LINK_PATTERN)].map((match) => [
    match.index,
    match.index + match[0].length,
  ]);
  return [...markdown.matchAll(REQUIREMENT_ID_PATTERN)]
    .filter(
      (match) => !linkRanges.some(([start, end]) => match.index >= start && match.index < end),
    )
    .map((match) => match[0]);
}

function manifestIds(manifest) {
  return new Set(manifest?.sources.flatMap((source) => source.ids) ?? []);
}

function mvpRequirementIds(state) {
  return new Set(
    state.requirements
      .filter((requirement) => {
        if (requirement.status !== "Active" || requirement.kind !== "Hard") return false;
        const releases = state.releasesByRequirement.get(requirement.id) ?? [];
        return releases.length === 1 && releases[0].firstRelease === "MVP";
      })
      .map((requirement) => requirement.id),
  );
}

function parseRequirementList(value) {
  if (!value) return null;
  const ids = value.split(",").map((id) => id.trim());
  if (ids.length === 0 || ids.some((id) => !EXACT_REQUIREMENT_ID_PATTERN.test(id))) return null;
  return ids;
}

function validateAuthorityContent(state, file, markdown) {
  const prose = withoutCommentsPreservingLines(outsideFencedCode(markdown)).replace(
    /`[^`\n]*`/gu,
    "",
  );
  if (/\b(?:TBD|TODO|FIXME)\b/iu.test(prose)) {
    addIssue(state, "AUTHORITY_PLACEHOLDER", file, "Authority document contains TBD/TODO/FIXME");
  }
  if (/\bSPEC[ \t]*§[ \t]*\d/iu.test(prose)) {
    addIssue(
      state,
      "LEGACY_SPEC_REFERENCE",
      file,
      "Authority document contains a legacy SPEC §N reference",
    );
  }

  const lines = withoutCommentsPreservingLines(outsideFencedCode(markdown)).split("\n");
  const headings = [];
  for (const [lineIndex, line] of lines.entries()) {
    const heading = /^(#{1,6})[ \t]+(.+?)\s*$/u.exec(line);
    if (heading) headings.push({ level: heading[1].length, lineIndex, title: heading[2] });
  }
  for (const [index, heading] of headings.entries()) {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    const sectionLines = lines.slice(heading.lineIndex + 1, next?.lineIndex ?? lines.length);
    const substantive = sectionLines
      .filter((line) => !/^#{1,6}[ \t]+/u.test(line))
      .join("\n")
      .replace(/<a[ \t]+[^>]*><\/a>/giu, "")
      .trim();
    if (!substantive) {
      addIssue(state, "EMPTY_AUTHORITY_SECTION", file, `Heading has no content: ${heading.title}`);
    }
  }
}

/** Ensure the fixed authority, source, ADR, and Kiro file set exists and authority prose is complete. */
export async function checkDocumentSet(state) {
  for (const file of REQUIRED_FILES) {
    const contents = await readKnownFile(state, file);
    if (contents === null) {
      addIssue(state, "MISSING_DOCUMENT", file, `Required document is missing: ${file}`);
    }
  }
  const adrDirectory = path.join(state.root, "docs/12-ADR");
  if (!(await pathExists(adrDirectory))) {
    addIssue(state, "MISSING_DIRECTORY", "docs/12-ADR", "Required ADR directory is missing");
  } else {
    await readMarkdownFilesRecursively(state, "docs/12-ADR");
  }
  for (const file of AUTHORITY_FILES) {
    const markdown = state.files.get(file);
    if (markdown !== undefined) validateAuthorityContent(state, file, markdown);
  }
  for (const file of INDEX_FILES) {
    const markdown = state.files.get(file);
    if (
      markdown !== undefined &&
      /<!--[ \t]*requirement(?:\r\n|\r|\n)[\s\S]*?-->/iu.test(outsideFencedCode(markdown))
    ) {
      addIssue(state, "INDEX_CONTRACT", file, "Index files may not contain requirement contracts");
    }
  }
}

/** Parse requirement blocks and prove global ID uniqueness, anchors, and Roadmap links. */
export function checkRequirementSchema(state) {
  const byId = new Map();
  for (const file of REQUIREMENT_FILES) {
    const markdown = state.files.get(file);
    if (markdown === undefined) continue;
    const blocks = parseWithContext(parseRequirementBlocks, markdown, file);
    for (const block of blocks) {
      state.requirements.push(block);
      const previous = byId.get(block.id);
      if (previous) {
        addIssue(
          state,
          "DUPLICATE_REQUIREMENT",
          file,
          `${block.id} is also defined in ${previous.filePath}`,
        );
      } else {
        byId.set(block.id, block);
      }
      if (!hasExplicitAnchor(block.text, block.id)) {
        addIssue(
          state,
          "MISSING_REQUIREMENT_ANCHOR",
          file,
          `${block.id} must declare an explicit ID anchor`,
        );
      }
      if (
        typeof block.roadmapRef !== "string" ||
        !/^REL-(?:MVP|Beta|V1|V2)-[A-Z0-9_]+$/u.test(block.roadmapRef)
      ) {
        addIssue(
          state,
          "INVALID_ROADMAP_REF",
          file,
          `${block.id} must declare a REL-* roadmap_ref`,
        );
      } else {
        const destination = `11-Roadmap.md#${block.roadmapRef}`;
        const inlineRoadmapLink = new RegExp(
          `\\[[^\\]\\n]+\\]\\(${escapeRegExp(destination)}(?:[ \\t]+(?:"[^"]*"|'[^']*'))?\\)`,
          "u",
        );
        if (!inlineRoadmapLink.test(block.text)) {
          addIssue(
            state,
            "MISSING_ROADMAP_LINK",
            file,
            `${block.id} must link inline to ${destination}`,
          );
        }
      }
    }
  }
  state.requirementsById = byId;
}

/** Parse the sole Roadmap registry and enforce deterministic, anchored, unique release records. */
export function checkReleaseUniqueness(state) {
  const file = "docs/11-Roadmap.md";
  const markdown = state.files.get(file);
  if (markdown === undefined) return;
  state.releases = parseWithContext(parseReleaseRecords, markdown, file);
  const releasesById = new Map();
  const releasesByRequirement = new Map();

  for (const release of state.releases) {
    if (releasesById.has(release.id)) {
      addIssue(state, "DUPLICATE_RELEASE", file, `Release ID ${release.id} is duplicated`);
    } else {
      releasesById.set(release.id, release);
    }
    const expectedId = `REL-${release.firstRelease}-${release.requirementId.replaceAll("-", "_")}`;
    if (release.id !== expectedId) {
      addIssue(state, "INVALID_RELEASE_ID", file, `${release.id} must equal ${expectedId}`);
    }
    if (!hasExplicitAnchor(markdown, release.id)) {
      addIssue(
        state,
        "MISSING_RELEASE_ANCHOR",
        file,
        `${release.id} lacks an explicit Roadmap anchor`,
      );
    }
    const records = releasesByRequirement.get(release.requirementId) ?? [];
    records.push(release);
    releasesByRequirement.set(release.requirementId, records);
    if (!state.requirementsById.has(release.requirementId)) {
      addIssue(
        state,
        "UNKNOWN_RELEASE_REQUIREMENT",
        file,
        `${release.id} references unknown requirement ${release.requirementId}`,
      );
    }
  }

  for (const requirement of state.requirements) {
    if (requirement.status !== "Active" || requirement.kind !== "Hard") continue;
    const records = releasesByRequirement.get(requirement.id) ?? [];
    if (records.length === 0) {
      addIssue(
        state,
        "MISSING_RELEASE",
        requirement.filePath,
        `${requirement.id} has no release record`,
      );
    } else if (records.length > 1) {
      addIssue(
        state,
        "DUPLICATE_RELEASE",
        file,
        `${requirement.id} has ${records.length} release records`,
      );
    } else if (records[0].id !== requirement.roadmapRef) {
      addIssue(
        state,
        "ROADMAP_REF_MISMATCH",
        requirement.filePath,
        `${requirement.id} points to ${requirement.roadmapRef}, not ${records[0].id}`,
      );
    }
  }
  state.releasesByRequirement = releasesByRequirement;
}

/** Validate inline-only Markdown links, targets/fragments, and index authority boundaries. */
export async function checkMarkdownLinks(state) {
  const markdownFiles = [...state.files.entries()].filter(([file]) => file.endsWith(".md"));
  for (const [file, markdown] of markdownFiles) {
    const controlled = outsideFencedCode(markdown);
    if (/^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*\S+/mu.test(controlled)) {
      addIssue(
        state,
        "REFERENCE_LINK_DEFINITION",
        file,
        "Reference-style link definitions are not allowed",
      );
    }
    if (/!?\[[^\]\n]+\]\[[^\]\n]*\]/u.test(controlled)) {
      addIssue(state, "REFERENCE_LINK_USAGE", file, "Reference-style link uses are not allowed");
    }

    for (const match of controlled.matchAll(INLINE_LINK_PATTERN)) {
      const destination = match[1].replace(/^<|>$/gu, "");
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(destination)) continue;
      let decoded;
      try {
        decoded = decodeURI(destination);
      } catch {
        addIssue(state, "BROKEN_LINK", file, `Invalid URI in Markdown link: ${destination}`);
        continue;
      }
      const hashIndex = decoded.indexOf("#");
      const targetPart = hashIndex === -1 ? decoded : decoded.slice(0, hashIndex);
      const fragment = hashIndex === -1 ? "" : decoded.slice(hashIndex + 1);
      const targetFile = targetPart
        ? path.posix.normalize(path.posix.join(path.posix.dirname(file), targetPart))
        : file;
      if (
        targetFile === ".." ||
        targetFile.startsWith("../") ||
        path.posix.isAbsolute(targetFile)
      ) {
        addIssue(state, "BROKEN_LINK", file, `Link escapes the repository: ${destination}`);
        continue;
      }
      if (INDEX_FILES.includes(file)) {
        const allowedTargets = INDEX_ALLOWED_TARGETS.get(file);
        if (!allowedTargets?.has(targetFile)) {
          addIssue(
            state,
            "NON_AUTHORITY_INDEX_LINK",
            file,
            `Index link target is not allowed: ${destination}`,
          );
        } else if (
          AUTHORITY_FILE_SET.has(targetFile) &&
          frontMatterStatus(state.files.get(targetFile) ?? "") !== "Active"
        ) {
          addIssue(
            state,
            "INACTIVE_INDEX_LINK",
            file,
            `Index link target is not Active: ${destination}`,
          );
        }
      }
      let targetMarkdown = state.files.get(targetFile);
      if (targetMarkdown === undefined) {
        const absoluteTarget = path.join(state.root, targetFile);
        if (!(await pathExists(absoluteTarget))) {
          addIssue(state, "BROKEN_LINK", file, `Link target does not exist: ${destination}`);
          continue;
        }
        if (targetFile.endsWith(".md")) {
          targetMarkdown = await readFile(absoluteTarget, "utf8");
          state.files.set(targetFile, targetMarkdown);
        }
      }
      if (fragment && targetMarkdown !== undefined && !anchorsIn(targetMarkdown).has(fragment)) {
        addIssue(state, "BROKEN_LINK", file, `Link anchor does not exist: ${destination}`);
      }
    }
  }
}

function sourceLines(contents) {
  if (contents.length === 0) return [];
  const lines = contents.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

/** Validate complete trace-set coverage, target kinds, source integrity, uniqueness, and approvals. */
export function checkTraceCoverage(state) {
  const file = "docs/13-Requirements-Traceability.md";
  const markdown = state.files.get(file);
  if (markdown === undefined) return;
  state.traces = parseWithContext(parseTraceRecords, markdown, file);
  const weather = state.files.get("weather.txt");
  const weatherLines = weather === undefined ? null : sourceLines(weather);
  const weatherDigest = weather === undefined ? null : sha256(weather);
  const coveredLines = weatherLines === null ? null : new Uint8Array(weatherLines.length + 1);
  const mappings = new Set();

  for (const trace of state.traces) {
    const mappingKey = `${trace.classification}\u0000${trace.lineStart}\u0000${trace.lineEnd}\u0000${trace.requirementId}`;
    if (mappings.has(mappingKey)) {
      addIssue(
        state,
        "DUPLICATE_TRACE_MAPPING",
        file,
        `Duplicate trace mapping for ${trace.requirementId} at ${trace.lineStart}-${trace.lineEnd}`,
      );
    }
    mappings.add(mappingKey);

    const rationaleOnly = trace.requirementId === "NONE";
    const requirement = rationaleOnly ? null : state.requirementsById.get(trace.requirementId);
    if (trace.classification === "Hard") {
      if (
        rationaleOnly ||
        !requirement ||
        requirement.status !== "Active" ||
        requirement.kind !== "Hard"
      ) {
        addIssue(
          state,
          "INVALID_HARD_TRACE",
          file,
          `Hard trace must map to an Active Hard requirement: ${trace.requirementId}`,
        );
      }
    } else if (!rationaleOnly && !requirement) {
      addIssue(
        state,
        "UNKNOWN_TRACE_REQUIREMENT",
        file,
        `Trace references unknown requirement ${trace.requirementId}`,
      );
    } else if (
      !rationaleOnly &&
      (requirement.status !== "Active" || requirement.kind !== "Guidance")
    ) {
      addIssue(
        state,
        "INVALID_GUIDANCE_TRACE",
        file,
        `${trace.classification} trace must use NONE or map to Active Guidance: ${trace.requirementId}`,
      );
    }

    if (weatherDigest !== null && trace.sourceSha256 !== weatherDigest) {
      addIssue(
        state,
        "TRACE_SOURCE_HASH_MISMATCH",
        file,
        `Trace for ${trace.requirementId} has a stale weather.txt digest`,
      );
    }
    if (weatherLines && trace.lineEnd > weatherLines.length) {
      addIssue(
        state,
        "TRACE_RANGE_INVALID",
        file,
        `Trace for ${trace.requirementId} exceeds weather.txt line count`,
      );
    } else if (weatherLines) {
      for (let line = trace.lineStart; line <= trace.lineEnd; line += 1) coveredLines[line] = 1;
      const selected = weatherLines.slice(trace.lineStart - 1, trace.lineEnd).join("\n");
      if (!selected.includes(trace.sourceExcerpt)) {
        addIssue(
          state,
          "TRACE_EXCERPT_MISMATCH",
          file,
          `Trace excerpt for ${trace.requirementId} does not match its source range`,
        );
      }
    }
    if (
      (trace.coverage === "Changed" || trace.coverage === "Rejected") &&
      !/^Approved: \d{4}-\d{2}-\d{2} by Product Owner — \S.*$/u.test(trace.rationale.trim())
    ) {
      addIssue(
        state,
        "UNAPPROVED_TRACE",
        file,
        `${trace.coverage} trace for ${trace.requirementId} lacks structured approval and rationale`,
      );
    }
  }

  if (weatherLines && weatherLines.some((_, index) => coveredLines[index + 1] === 0)) {
    const firstGap = weatherLines.findIndex((_, index) => coveredLines[index + 1] === 0) + 1;
    addIssue(
      state,
      "TRACE_COVERAGE_GAP",
      file,
      `Trace union does not cover weather.txt line ${firstGap}`,
    );
  }
}

/** Recompute every Kiro manifest source digest from authoritative requirement blocks. */
export function checkDerivedFreshness(state) {
  for (const file of KIRO_FILES) {
    const markdown = state.files.get(file);
    if (markdown === undefined) continue;
    const manifest = parseWithContext(parseDerivedManifest, markdown, file);
    state.manifests.set(file, manifest);
    if (!manifest) {
      addIssue(state, "MISSING_DERIVED_MANIFEST", file, "Kiro file lacks a derived manifest");
      continue;
    }
    const seenIds = new Set();
    for (const source of manifest.sources) {
      const sourceMarkdown = state.files.get(source.path);
      if (sourceMarkdown === undefined) {
        addIssue(
          state,
          "UNKNOWN_DERIVED_SOURCE",
          file,
          `Derived source does not exist: ${source.path}`,
        );
        continue;
      }
      const sourceBlocks = parseWithContext(parseRequirementBlocks, sourceMarkdown, source.path);
      const sourceIds = new Set(sourceBlocks.map((block) => block.id));
      for (const id of source.ids) {
        if (seenIds.has(id))
          addIssue(state, "DUPLICATE_DERIVED_ID", file, `${id} appears in multiple sources`);
        seenIds.add(id);
        if (!sourceIds.has(id))
          addIssue(state, "UNKNOWN_DERIVED_ID", file, `${id} is not defined by ${source.path}`);
      }
      if (source.ids.every((id) => sourceIds.has(id))) {
        const actualDigest = digestRequirementSelection(sourceBlocks, source.ids);
        if (actualDigest !== source.digest) {
          addIssue(
            state,
            "STALE_DERIVED",
            file,
            `${source.path} digest is stale for ${source.ids.join(", ")}`,
          );
        }
      }
    }
  }
}

/** Enforce bidirectional MVP coverage and per-unit Kiro design requirement metadata. */
export function checkKiroBidirectionalCoverage(state) {
  const mvpIds = mvpRequirementIds(state);

  for (const file of KIRO_FILES) {
    const markdown = state.files.get(file);
    if (markdown === undefined) continue;
    const { normative, outOfScope } = splitKiroScope(markdown);
    const ids = extractRequirementIds(normative);
    const counts = new Map();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    const isRequirements = file.endsWith("/requirements.md");
    for (const id of mvpIds) {
      const count = counts.get(id) ?? 0;
      if (count === 0) {
        addIssue(
          state,
          isRequirements ? "KIRO_REQUIREMENT_MISSING" : "KIRO_COVERAGE_MISSING",
          file,
          `${id} is not covered`,
        );
      } else if (isRequirements && count !== 1) {
        addIssue(
          state,
          "KIRO_REQUIREMENT_DUPLICATE",
          file,
          `${id} appears ${count} times; requirements.md requires exactly one mapping`,
        );
      }
    }
    for (const id of counts.keys()) {
      if (!state.requirementsById.has(id))
        addIssue(state, "UNKNOWN_KIRO_REQUIREMENT", file, `Unknown requirement ID ${id}`);
      else if (!mvpIds.has(id))
        addIssue(state, "NON_MVP_KIRO_REQUIREMENT", file, `${id} is not an MVP Active Hard ID`);
    }
    for (const id of unlinkedRequirementIds(outOfScope)) {
      addIssue(
        state,
        "INVALID_OUT_OF_SCOPE_REFERENCE",
        file,
        `${id} must be a non-normative link after Out of current scope`,
      );
    }
    const derivedIds = manifestIds(state.manifests.get(file));
    for (const id of mvpIds) {
      if (!derivedIds.has(id))
        addIssue(state, "DERIVED_COVERAGE_MISSING", file, `Manifest omits MVP requirement ${id}`);
    }
    for (const id of derivedIds) {
      if (!mvpIds.has(id))
        addIssue(state, "NON_MVP_DERIVED_ID", file, `Manifest includes non-MVP requirement ${id}`);
    }
  }

  const designFile = ".kiro/specs/where-not-rain/design.md";
  const design = state.files.get(designFile);
  if (design !== undefined) {
    const headings = [...design.matchAll(/^(#{1,6})[ \t]+(.+)$/gmu)];
    for (const [index, heading] of headings.entries()) {
      if (heading[1].length !== 3) continue;
      const end =
        headings.slice(index + 1).find((candidate) => candidate[1].length <= 3)?.index ??
        design.length;
      const block = design.slice(heading.index, end);
      const value = /^\s*_Requirements:[ \t]*([^_\n]+)_/mu.exec(block)?.[1];
      const ids = parseRequirementList(value);
      if (!value) {
        addIssue(
          state,
          "MISSING_DESIGN_REQUIREMENTS",
          designFile,
          `${heading[2].trim()} lacks _Requirements:_`,
        );
      } else if (!ids || ids.some((id) => !mvpIds.has(id))) {
        addIssue(
          state,
          "INVALID_DESIGN_REQUIREMENTS",
          designFile,
          `${heading[2].trim()} must reference only valid MVP IDs`,
        );
      }
    }
  }
}

/** Validate every Kiro task block and require structured successful evidence for completed tasks. */
export function checkTaskEvidence(state) {
  const file = ".kiro/specs/where-not-rain/tasks.md";
  const markdown = state.files.get(file);
  if (markdown === undefined) return;
  const mvpIds = mvpRequirementIds(state);
  const taskStarts = [...markdown.matchAll(/^[ \t]*- \[([ xX])\]\*?[ \t]+.*$/gmu)];
  for (const [index, start] of taskStarts.entries()) {
    const end = taskStarts[index + 1]?.index ?? markdown.length;
    const block = markdown.slice(start.index, end);
    const label = start[0].replace(/^[ \t]*- \[[ xX]\]\*?[ \t]*/u, "").trim();
    const requirements = /^\s*_Requirements:[ \t]*([^_\n]+)_/mu.exec(block)?.[1];
    const requirementIds = parseRequirementList(requirements);
    const verify = /^\s*Verify:[ \t]*(\S.*)$/mu.exec(block)?.[1];
    const expected = /^\s*Expected:[ \t]*(\S.*)$/mu.exec(block)?.[1];
    const evidence = /^\s*Evidence:[ \t]*(\S.*)$/mu.exec(block)?.[1];
    if (!requirements) {
      addIssue(state, "MISSING_TASK_REQUIREMENTS", file, `${label} lacks _Requirements:_`);
    } else if (!requirementIds || requirementIds.some((id) => !mvpIds.has(id))) {
      addIssue(
        state,
        "INVALID_TASK_REQUIREMENTS",
        file,
        `${label} must reference only valid MVP IDs`,
      );
    }
    if (!verify) addIssue(state, "MISSING_TASK_VERIFY", file, `${label} lacks Verify:`);
    if (!expected) addIssue(state, "MISSING_TASK_EXPECTED", file, `${label} lacks Expected:`);
    if (!evidence) addIssue(state, "MISSING_TASK_EVIDENCE", file, `${label} lacks Evidence:`);
    const completed = start[1].toLowerCase() === "x";
    if (
      completed &&
      (!evidence || !/^\d{4}-\d{2}-\d{2}[ \t]+—[ \t]+exit 0[ \t]+—[ \t]+\S.*$/u.test(evidence))
    ) {
      addIssue(
        state,
        "INVALID_COMPLETED_TASK_EVIDENCE",
        file,
        `${label} must include date — exit 0 — non-empty summary`,
      );
    }
    if (
      [requirements, verify, expected].some(
        (value) => value && /(?:<[^>]+>|\b(?:TODO|TBD)\b)/iu.test(value),
      )
    ) {
      addIssue(state, "TASK_PLACEHOLDER", file, `${label} contains a placeholder field`);
    }
  }
}

/** Prove audited contract clauses through their authoritative Requirement IDs. */
export function checkCriticalClauses(state) {
  for (const id of REQUIRED_CONTRACT_IDS) {
    if (!state.requirementsById.has(id)) {
      addIssue(
        state,
        "MISSING_CRITICAL_CONTRACT",
        "docs",
        `Required audited contract ID is missing: ${id}`,
      );
    }
  }
}

/** Enforce Draft/Active authority state and block unresolved trace decisions at cutover. */
export function checkCutoverState(state) {
  for (const file of FRONT_MATTER_FILES) {
    const markdown = state.files.get(file);
    if (markdown === undefined) continue;
    const status = frontMatterStatus(markdown);
    if (status !== "Active" && status !== "Draft") {
      addIssue(
        state,
        "INVALID_DOCUMENT_STATUS",
        file,
        "Authority front matter status must be Active or Draft",
      );
    } else if (state.mode === "active" && status === "Draft") {
      addIssue(state, "DRAFT_DOCUMENT", file, "Active mode does not permit Draft authority");
    }
  }
  if (state.mode === "active") {
    for (const trace of state.traces) {
      if (trace.coverage === "Needs Decision") {
        addIssue(
          state,
          "NEEDS_DECISION",
          trace.filePath,
          `Unresolved trace decision for ${trace.requirementId}`,
        );
      }
    }
  }
}

/**
 * Validate the repository documentation contract.
 * @param {string} root
 * @param {{mode:"staging"|"active"}} options
 * @returns {Promise<ValidationResult>}
 */
export async function validateRepository(root, { mode } = {}) {
  if (typeof root !== "string" || root.length === 0) {
    throw new ValidatorError("config", "Repository root must be a non-empty path");
  }
  if (mode !== "staging" && mode !== "active") {
    throw new ValidatorError("config", "--mode must be staging or active");
  }
  const state = {
    errors: [],
    files: new Map(),
    manifests: new Map(),
    mode,
    releases: [],
    releasesByRequirement: new Map(),
    requirements: [],
    requirementsById: new Map(),
    root: path.resolve(root),
    traces: [],
    warnings: [],
  };

  await checkDocumentSet(state);
  checkRequirementSchema(state);
  checkReleaseUniqueness(state);
  await checkMarkdownLinks(state);
  checkTraceCoverage(state);
  checkDerivedFreshness(state);
  checkKiroBidirectionalCoverage(state);
  checkTaskEvidence(state);
  checkCriticalClauses(state);
  checkCutoverState(state);

  sortIssues(state.errors);
  sortIssues(state.warnings);
  return {
    errors: state.errors,
    warnings: state.warnings,
    stats: {
      releases: state.releases.length,
      requirements: state.requirements.length,
      traces: state.traces.length,
    },
  };
}

function parseCliArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--mode") {
    throw new ValidatorError(
      "config",
      "Usage: node tooling/docs/validate-docs.mjs --mode staging|active",
    );
  }
  const mode = argv[1];
  if (mode !== "staging" && mode !== "active") {
    throw new ValidatorError("config", "--mode must be staging or active");
  }
  return { mode };
}

async function runCli() {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const result = await validateRepository(process.cwd(), options);
    for (const warning of result.warnings)
      console.warn(`WARNING ${warning.code} ${warning.file}: ${warning.message}`);
    for (const error of result.errors)
      console.error(`ERROR ${error.code} ${error.file}: ${error.message}`);
    console.log(
      `Documentation validation: ${result.errors.length} error(s), ${result.warnings.length} warning(s); ` +
        `${result.stats.requirements} requirement(s), ${result.stats.releases} release(s), ${result.stats.traces} trace(s).`,
    );
    process.exitCode = result.errors.length === 0 ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Validator failure: ${message}`);
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await runCli();
