import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  digestRequirementSelection,
  parseRequirementBlocks,
  sha256,
} from "./requirement-format.mjs";
import { validateRepository } from "./validate-docs.mjs";

const VALIDATOR_PATH = fileURLToPath(new URL("./validate-docs.mjs", import.meta.url));
const AUTHORITY_FILES = [
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
const REQUIREMENTS = [
  ["ARCH-RENDER-001", "docs/05-System-Architecture.md", "MVP"],
  ["ARCH-FLAG-001", "docs/05-System-Architecture.md", "MVP"],
  ["DATA-ACTIVITY-001", "docs/06-Database.md", "V1"],
  ["ENG-PERF-001", "docs/09-Engineering-Handbook.md", "MVP"],
  ["ENG-BOT-001", "docs/09-Engineering-Handbook.md", "MVP"],
  ["GROW-AFF-001", "docs/10-Growth-Bible.md", "MVP"],
  ["GROW-ADS-001", "docs/10-Growth-Bible.md", "MVP"],
  ["GROW-ANALYTICS-001", "docs/10-Growth-Bible.md", "MVP"],
  ["GROW-REPORT-001", "docs/10-Growth-Bible.md", "Beta"],
];

function releaseId(id, release) {
  return `REL-${release}-${id.replaceAll("-", "_")}`;
}

function requirementBlock(id, release) {
  const roadmapRef = releaseId(id, release);
  return `<!-- requirement
id: ${id}
status: Active
kind: Hard
roadmap_ref: ${roadmapRef}
owner: Test
verification: pnpm docs:check
-->
<a id="${id}"></a>
### ${id} — Contract
The system shall satisfy [${roadmapRef}](11-Roadmap.md#${roadmapRef}).
#### Acceptance Criteria
- The contract passes.
`;
}

function frontMatter(file, status = "Active") {
  const title = path.basename(file, ".md");
  return `---\ntitle: ${title}\nauthority: Test\nstatus: ${status}\nlast_updated: 2026-07-17\n---\n# ${title}\nAuthority overview.\n`;
}

async function writeFiles(root, entries) {
  for (const [relativePath, contents] of Object.entries(entries)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
  }
}

async function mutate(root, relativePath, transform) {
  const absolutePath = path.join(root, relativePath);
  await writeFile(absolutePath, transform(await readFile(absolutePath, "utf8")));
}

function manifestFor(sourceDocuments, selectedIds) {
  const selected = new Set(selectedIds);
  const sources = [...sourceDocuments.entries()]
    .map(([sourcePath, markdown]) => {
      const blocks = parseRequirementBlocks(markdown, sourcePath);
      const ids = blocks
        .map((block) => block.id)
        .filter((id) => selected.has(id))
        .sort();
      return {
        digest: digestRequirementSelection(blocks, ids),
        ids,
        path: sourcePath,
      };
    })
    .filter((source) => source.ids.length > 0)
    .sort((left, right) => left.path.localeCompare(right.path));
  return `<!-- derived: ${JSON.stringify({ generated_at: "2026-07-17", schema: 1, sources })} -->`;
}

async function createValidFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "wnr-docs-"));
  const authority = new Map(AUTHORITY_FILES.map((file) => [file, frontMatter(file)]));

  for (const [id, file, release] of REQUIREMENTS) {
    authority.set(file, `${authority.get(file)}\n${requirementBlock(id, release)}`);
  }

  const releases = REQUIREMENTS.map(([id, , release]) => {
    const idForRelease = releaseId(id, release);
    return `<a id="${idForRelease}"></a>\n<!-- release: ${JSON.stringify({
      first_release: release,
      id: idForRelease,
      lifecycle: "Continuous",
      requirement_id: id,
    })} -->`;
  }).join("\n");
  authority.set("docs/11-Roadmap.md", `${authority.get("docs/11-Roadmap.md")}\n${releases}\n`);

  const weather = "Historical requirement source.\n";
  const traces = REQUIREMENTS.map(
    ([id]) =>
      `<!-- trace: ${JSON.stringify({
        classification: "Hard",
        coverage: "Covered",
        line_end: 1,
        line_start: 1,
        rationale: "Direct approved mapping",
        requirement_id: id,
        source_excerpt: "Historical requirement source.",
        source_sha256: sha256(weather),
      })} -->`,
  ).join("\n");
  authority.set(
    "docs/13-Requirements-Traceability.md",
    `${authority.get("docs/13-Requirements-Traceability.md")}\n${traces}\n`,
  );

  const sourceDocuments = new Map(
    [...authority.entries()].filter(([file]) =>
      REQUIREMENTS.some(([, requirementFile]) => requirementFile === file),
    ),
  );
  const mvpIds = REQUIREMENTS.filter(([, , release]) => release === "MVP").map(([id]) => id);
  const manifest = manifestFor(sourceDocuments, mvpIds);
  const kiroRequirements = `${manifest}\n# Requirements\n${mvpIds
    .map((id) => `## ${id}\nThe system shall satisfy this contract.`)
    .join("\n")}`;
  const kiroDesign = `${manifest}\n# Design\n${mvpIds
    .map((id) => `### Design unit for ${id}\n_Requirements: ${id}_`)
    .join("\n")}`;
  const kiroTasks = `${manifest}\n# Tasks\n${mvpIds
    .map(
      (id) =>
        `- [ ] Implement ${id}\n  _Requirements: ${id}_\n  Verify: pnpm docs:test\n  Expected: command exits 0\n  Evidence: pending — verification has not been executed`,
    )
    .join("\n")}`;

  await writeFiles(root, {
    ...Object.fromEntries(authority),
    ".kiro/specs/where-not-rain/design.md": kiroDesign,
    ".kiro/specs/where-not-rain/requirements.md": kiroRequirements,
    ".kiro/specs/where-not-rain/tasks.md": kiroTasks,
    "docs/12-ADR/README.md": "# Architecture Decision Records\n",
    "README.md": "# Fixture\n\n[Documentation](docs/README.md)\n",
    "SPEC.md": "# Specification\n\n[Documentation](docs/README.md)\n",
    "weather.txt": weather,
  });

  return root;
}

function assertError(result, code) {
  assert(
    result.errors.some((error) => error.code === code),
    `expected ${code}, received ${JSON.stringify(result.errors, null, 2)}`,
  );
}

function runCli(root, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VALIDATOR_PATH, ...args], { cwd: root });
    let stderr = "";
    let stdout = "";
    child.stderr.setEncoding("utf8");
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr, stdout }));
  });
}

test("accepts a complete repository fixture and reports deterministic stats", async () => {
  const root = await createValidFixture();
  const result = await validateRepository(root, { mode: "active" });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.stats, { releases: 9, requirements: 9, traces: 9 });
});

test("rejects duplicate requirement IDs across authority documents", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "docs/01-Product-PRD.md",
    (markdown) => `${markdown}\n${requirementBlock("ENG-PERF-001", "MVP")}`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "DUPLICATE_REQUIREMENT");
});

test("rejects an Active hard requirement without exactly one release", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/11-Roadmap.md", (markdown) =>
    markdown.replace(/^<a id="REL-MVP-ENG_PERF_001".*\n<!-- release: .*ENG-PERF-001.*\n?/mu, ""),
  );

  assertError(await validateRepository(root, { mode: "active" }), "MISSING_RELEASE");
});

test("rejects a stale Kiro source digest", async () => {
  const root = await createValidFixture();
  await mutate(root, ".kiro/specs/where-not-rain/design.md", (markdown) =>
    markdown.replace(/sha256:[a-f0-9]{64}/u, `sha256:${"0".repeat(64)}`),
  );

  assertError(await validateRepository(root, { mode: "active" }), "STALE_DERIVED");
});

test("rejects invalid internal Markdown links", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "docs/09-Engineering-Handbook.md",
    (markdown) => `${markdown}\n[Missing](missing.md#missing-anchor)\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "BROKEN_LINK");
});

test("rejects Needs Decision traces in active mode", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/13-Requirements-Traceability.md", (markdown) =>
    markdown.replace('"coverage":"Covered"', '"coverage":"Needs Decision"'),
  );

  assertError(await validateRepository(root, { mode: "active" }), "NEEDS_DECISION");
});

test("rejects Kiro omissions for MVP Active hard requirements", async () => {
  const root = await createValidFixture();
  await mutate(root, ".kiro/specs/where-not-rain/requirements.md", (markdown) =>
    markdown.replace(/## ARCH-RENDER-001\n[^\n]+\n?/u, ""),
  );

  assertError(await validateRepository(root, { mode: "active" }), "KIRO_REQUIREMENT_MISSING");
});

test("active mode rejects Draft authority while staging mode permits it", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/09-Engineering-Handbook.md", (markdown) =>
    markdown.replace("status: Active", "status: Draft"),
  );

  assertError(await validateRepository(root, { mode: "active" }), "DRAFT_DOCUMENT");
  const staging = await validateRepository(root, { mode: "staging" });
  assert(!staging.errors.some((error) => error.code === "DRAFT_DOCUMENT"));
});

test("sorts issues by file, code, then message", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "docs/09-Engineering-Handbook.md",
    (markdown) => `${markdown}\n[B](z-missing.md)\n[A](a-missing.md)\n`,
  );
  const result = await validateRepository(root, { mode: "active" });
  const sorted = [...result.errors].sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );

  assert.deepEqual(result.errors, sorted);
});

test("CLI exits 0 for valid docs, 1 for contract errors, and 2 for bad configuration", async () => {
  const root = await createValidFixture();
  assert.equal((await runCli(root, ["--mode", "active"])).code, 0);

  await mutate(
    root,
    "docs/09-Engineering-Handbook.md",
    (markdown) => `${markdown}\n[Missing](not-there.md)\n`,
  );
  assert.equal((await runCli(root, ["--mode", "active"])).code, 1);
  assert.equal((await runCli(root, ["--mode", "invalid"])).code, 2);
});

test("rejects trace coverage gaps in the complete source-line union", async () => {
  const root = await createValidFixture();
  const weather = "Historical requirement source.\nUnmapped source line.";
  await writeFile(path.join(root, "weather.txt"), weather);
  await mutate(root, "docs/13-Requirements-Traceability.md", (markdown) =>
    markdown.replaceAll(sha256("Historical requirement source.\n"), sha256(weather)),
  );

  assertError(await validateRepository(root, { mode: "active" }), "TRACE_COVERAGE_GAP");
});

test("rejects exact duplicate trace mappings", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/13-Requirements-Traceability.md", (markdown) => {
    const trace = markdown.match(/<!-- trace: .*? -->/u)?.[0];
    assert(trace);
    return `${markdown}\n${trace}\n`;
  });

  assertError(await validateRepository(root, { mode: "active" }), "DUPLICATE_TRACE_MAPPING");
});

test("rejects Suggestion and Example traces targeting Active Hard requirements", async () => {
  for (const classification of ["Suggestion", "Example"]) {
    const root = await createValidFixture();
    await mutate(root, "docs/13-Requirements-Traceability.md", (markdown) =>
      markdown.replace('"classification":"Hard"', `"classification":"${classification}"`),
    );

    assertError(await validateRepository(root, { mode: "active" }), "INVALID_GUIDANCE_TRACE");
  }
});

test("rejects requirement contracts copied into index files", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "SPEC.md",
    (markdown) =>
      `${markdown}\n<!-- requirement\nid: ENG-COPY-001\n-->\n#### Acceptance Criteria\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "INDEX_CONTRACT");
});

test("rejects index links to Draft authority documents even in staging mode", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/09-Engineering-Handbook.md", (markdown) =>
    markdown.replace("status: Active", "status: Draft"),
  );
  await mutate(
    root,
    "SPEC.md",
    (markdown) => `${markdown}\n[Engineering](docs/09-Engineering-Handbook.md)\n`,
  );

  assertError(await validateRepository(root, { mode: "staging" }), "INACTIVE_INDEX_LINK");
});

test("rejects index links to non-authority repository files", async () => {
  const root = await createValidFixture();
  await mutate(root, "README.md", (markdown) => `${markdown}\n[Source](weather.txt)\n`);

  assertError(await validateRepository(root, { mode: "active" }), "NON_AUTHORITY_INDEX_LINK");
});

test("rejects actual authority placeholders", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "docs/09-Engineering-Handbook.md",
    (markdown) => `${markdown}\nTODO: define the production gate.\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "AUTHORITY_PLACEHOLDER");
});

test("rejects empty authority heading sections", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "docs/09-Engineering-Handbook.md",
    (markdown) => `${markdown}\n## Empty section\n## Populated section\nContent.\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "EMPTY_AUTHORITY_SECTION");
});

test("rejects legacy SPEC section references in authority documents", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "docs/09-Engineering-Handbook.md",
    (markdown) => `${markdown}\nLegacy contract: SPEC §7.\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "LEGACY_SPEC_REFERENCE");
});

test("rejects Kiro design implementation units without Requirements metadata", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    ".kiro/specs/where-not-rain/design.md",
    (markdown) => `${markdown}\n### Orphan implementation unit\nImplementation details.\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "MISSING_DESIGN_REQUIREMENTS");
});

test("rejects invalid Kiro design implementation-unit requirement IDs", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    ".kiro/specs/where-not-rain/design.md",
    (markdown) => `${markdown}\n### Invalid implementation unit\n_Requirements: not-an-id_\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "INVALID_DESIGN_REQUIREMENTS");
});

test("rejects invalid Kiro task-block requirement IDs", async () => {
  const root = await createValidFixture();
  await mutate(root, ".kiro/specs/where-not-rain/tasks.md", (markdown) =>
    markdown.replace(/_Requirements: ARCH-RENDER-001_/u, "_Requirements: not-an-id_"),
  );

  assertError(await validateRepository(root, { mode: "active" }), "INVALID_TASK_REQUIREMENTS");
});

test("rejects completed task evidence without literal exit 0", async () => {
  const root = await createValidFixture();
  await mutate(root, ".kiro/specs/where-not-rain/tasks.md", (markdown) =>
    markdown
      .replace("- [ ] Implement ARCH-RENDER-001", "- [x] Implement ARCH-RENDER-001")
      .replace(
        "Evidence: pending — verification has not been executed",
        "Evidence: 2026-07-17 — all tests passed",
      ),
  );

  assertError(
    await validateRepository(root, { mode: "active" }),
    "INVALID_COMPLETED_TASK_EVIDENCE",
  );
});

test("rejects completed task evidence with an empty summary", async () => {
  const root = await createValidFixture();
  await mutate(root, ".kiro/specs/where-not-rain/tasks.md", (markdown) =>
    markdown
      .replace("- [ ] Implement ARCH-RENDER-001", "- [x] Implement ARCH-RENDER-001")
      .replace(
        "Evidence: pending — verification has not been executed",
        "Evidence: 2026-07-17 — exit 0 —",
      ),
  );

  assertError(
    await validateRepository(root, { mode: "active" }),
    "INVALID_COMPLETED_TASK_EVIDENCE",
  );
});

test("rejects non-deterministic release IDs", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/09-Engineering-Handbook.md", (markdown) =>
    markdown.replaceAll("REL-MVP-ENG_PERF_001", "REL-MVP-CUSTOM"),
  );
  await mutate(root, "docs/11-Roadmap.md", (markdown) =>
    markdown.replaceAll("REL-MVP-ENG_PERF_001", "REL-MVP-CUSTOM"),
  );

  assertError(await validateRepository(root, { mode: "active" }), "INVALID_RELEASE_ID");
});

test("rejects non-REL roadmap_ref values", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/09-Engineering-Handbook.md", (markdown) =>
    markdown.replaceAll("REL-MVP-ENG_PERF_001", "MVP-ENG_PERF_001"),
  );
  await mutate(root, "docs/11-Roadmap.md", (markdown) =>
    markdown.replaceAll("REL-MVP-ENG_PERF_001", "MVP-ENG_PERF_001"),
  );

  assertError(await validateRepository(root, { mode: "active" }), "INVALID_ROADMAP_REF");
});

test("requires explicit Roadmap release anchors", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/11-Roadmap.md", (markdown) =>
    markdown.replace('<a id="REL-MVP-ENG_PERF_001"></a>', "## REL MVP ENG PERF 001"),
  );
  await mutate(root, "docs/09-Engineering-Handbook.md", (markdown) =>
    markdown.replace("11-Roadmap.md#REL-MVP-ENG_PERF_001", "11-Roadmap.md#rel-mvp-eng-perf-001"),
  );

  assertError(await validateRepository(root, { mode: "active" }), "MISSING_RELEASE_ANCHOR");
});

test("requires each requirement block to link its Roadmap anchor inline", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/09-Engineering-Handbook.md", (markdown) =>
    markdown.replace(
      "The system shall satisfy [REL-MVP-ENG_PERF_001](11-Roadmap.md#REL-MVP-ENG_PERF_001).\n",
      "",
    ),
  );

  assertError(await validateRepository(root, { mode: "active" }), "MISSING_ROADMAP_LINK");
});

test("rejects reference-style Markdown link definitions", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "docs/09-Engineering-Handbook.md",
    (markdown) => `${markdown}\n[roadmap]: ../docs/11-Roadmap.md\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "REFERENCE_LINK_DEFINITION");
});

test("rejects reference-style Markdown link uses", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "docs/09-Engineering-Handbook.md",
    (markdown) => `${markdown}\nSee [the roadmap][roadmap].\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "REFERENCE_LINK_USAGE");
});

test("requires structured Product Owner approval and a reason for Changed or Rejected traces", async () => {
  for (const rationale of ["approved informally", "Approved: 2026-07-17 by Product Owner — "]) {
    const root = await createValidFixture();
    await mutate(root, "docs/13-Requirements-Traceability.md", (markdown) =>
      markdown
        .replace('"coverage":"Covered"', '"coverage":"Changed"')
        .replace('"rationale":"Direct approved mapping"', `"rationale":"${rationale}"`),
    );

    assertError(await validateRepository(root, { mode: "active" }), "UNAPPROVED_TRACE");
  }
});

test("applies per-index navigation allowlists", async () => {
  const root = await createValidFixture();
  await writeFile(
    path.join(root, "README.md"),
    `# Fixture

[SPEC](SPEC.md)
[Documentation](docs/README.md)
[Roadmap](docs/11-Roadmap.md)
[Kiro requirements](.kiro/specs/where-not-rain/requirements.md)
[Kiro design](.kiro/specs/where-not-rain/design.md)
[Kiro tasks](.kiro/specs/where-not-rain/tasks.md)
`,
  );
  await mutate(
    root,
    "SPEC.md",
    (markdown) =>
      `${markdown}\n[Root](README.md)\n[Engineering](docs/09-Engineering-Handbook.md)\n[Kiro requirements](.kiro/specs/where-not-rain/requirements.md)\n`,
  );
  await mutate(
    root,
    "docs/README.md",
    (markdown) =>
      `${markdown}\n[Root](../README.md)\n[SPEC](../SPEC.md)\n[Engineering](09-Engineering-Handbook.md)\n[ADR policy](12-ADR/README.md)\n[Kiro requirements](../.kiro/specs/where-not-rain/requirements.md)\n`,
  );

  const result = await validateRepository(root, { mode: "active" });
  assert(!result.errors.some((error) => error.code === "NON_AUTHORITY_INDEX_LINK"));
});

test("rejects domain-detail links from the root README allowlist", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "README.md",
    (markdown) => `${markdown}\n[Engineering detail](docs/09-Engineering-Handbook.md)\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "NON_AUTHORITY_INDEX_LINK");
});

test("accepts rationale-only Suggestion and Example traces with requirement_id NONE", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/13-Requirements-Traceability.md", (markdown) =>
    markdown
      .replace('"classification":"Hard"', '"classification":"Suggestion"')
      .replace('"requirement_id":"ARCH-RENDER-001"', '"requirement_id":"NONE"')
      .replace('"classification":"Hard"', '"classification":"Example"')
      .replace('"requirement_id":"ARCH-FLAG-001"', '"requirement_id":"NONE"'),
  );

  const result = await validateRepository(root, { mode: "active" });
  assert(
    !result.errors.some(
      (error) =>
        error.code === "UNKNOWN_TRACE_REQUIREMENT" || error.code === "INVALID_GUIDANCE_TRACE",
    ),
  );
});

test("rejects Hard traces with requirement_id NONE", async () => {
  const root = await createValidFixture();
  await mutate(root, "docs/13-Requirements-Traceability.md", (markdown) =>
    markdown.replace('"requirement_id":"ARCH-RENDER-001"', '"requirement_id":"NONE"'),
  );

  assertError(await validateRepository(root, { mode: "active" }), "INVALID_HARD_TRACE");
});

test("allows future IDs only after the Kiro Out of current scope heading", async () => {
  const root = await createValidFixture();
  for (const file of [
    ".kiro/specs/where-not-rain/requirements.md",
    ".kiro/specs/where-not-rain/design.md",
    ".kiro/specs/where-not-rain/tasks.md",
  ]) {
    await mutate(
      root,
      file,
      (markdown) =>
        `${markdown}\n\n## Out of current scope\nFuture contract: [DATA-ACTIVITY-001](../../../docs/06-Database.md#DATA-ACTIVITY-001).\n`,
    );
  }

  const result = await validateRepository(root, { mode: "active" });
  assert(!result.errors.some((error) => error.code === "NON_MVP_KIRO_REQUIREMENT"));
});

test("keeps Kiro derived manifests MVP-only despite future prose links", async () => {
  const root = await createValidFixture();
  const sourceDocuments = new Map();
  for (const sourcePath of [
    "docs/05-System-Architecture.md",
    "docs/06-Database.md",
    "docs/09-Engineering-Handbook.md",
    "docs/10-Growth-Bible.md",
  ]) {
    sourceDocuments.set(sourcePath, await readFile(path.join(root, sourcePath), "utf8"));
  }
  const selectedIds = [
    ...REQUIREMENTS.filter(([, , release]) => release === "MVP").map(([id]) => id),
    "DATA-ACTIVITY-001",
  ];
  await mutate(root, ".kiro/specs/where-not-rain/requirements.md", (markdown) =>
    markdown.replace(/^<!-- derived: .*?-->/u, manifestFor(sourceDocuments, selectedIds)),
  );

  assertError(await validateRepository(root, { mode: "active" }), "NON_MVP_DERIVED_ID");
});

test("allows governance prose and fenced requirement examples in indexes", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "SPEC.md",
    (markdown) =>
      `${markdown}\nAcceptance Criteria are owned by authority documents.\nThe token \`<!-- requirement\` introduces machine-readable metadata.\n\n\`\`\`md\n<!-- requirement\nid: EXAMPLE-001\n-->\n#### Acceptance Criteria\n\`\`\`\n`,
  );

  const result = await validateRepository(root, { mode: "active" });
  assert(!result.errors.some((error) => error.code === "INDEX_CONTRACT"));
});

test("rejects real requirement markers outside fenced code in indexes", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    "SPEC.md",
    (markdown) => `${markdown}\n<!-- requirement\nid: ENG-COPY-001\n-->\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "INDEX_CONTRACT");
});

test("validates well-formed optional unchecked and checked Kiro tasks", async () => {
  for (const checked of [false, true]) {
    const root = await createValidFixture();
    await mutate(root, ".kiro/specs/where-not-rain/tasks.md", (markdown) => {
      let changed = markdown.replace(
        "- [ ] Implement ARCH-RENDER-001",
        `- [${checked ? "x" : " "}]* Implement ARCH-RENDER-001`,
      );
      if (checked) {
        changed = changed.replace(
          "Evidence: pending — verification has not been executed",
          "Evidence: 2026-07-17 — exit 0 — targeted task passed",
        );
      }
      return changed;
    });

    const result = await validateRepository(root, { mode: "active" });
    assert(!result.errors.some((error) => error.code.startsWith("MISSING_TASK_")));
    assert(!result.errors.some((error) => error.code === "INVALID_COMPLETED_TASK_EVIDENCE"));
  }
});

test("rejects malformed optional unchecked and checked Kiro tasks", async () => {
  const uncheckedRoot = await createValidFixture();
  await mutate(uncheckedRoot, ".kiro/specs/where-not-rain/tasks.md", (markdown) =>
    markdown
      .replace("- [ ] Implement ARCH-RENDER-001", "- [ ]* Implement ARCH-RENDER-001")
      .replace("  Verify: pnpm docs:test\n", ""),
  );
  assertError(await validateRepository(uncheckedRoot, { mode: "active" }), "MISSING_TASK_VERIFY");

  const checkedRoot = await createValidFixture();
  await mutate(checkedRoot, ".kiro/specs/where-not-rain/tasks.md", (markdown) =>
    markdown.replace("- [ ] Implement ARCH-RENDER-001", "- [x]* Implement ARCH-RENDER-001"),
  );
  assertError(
    await validateRepository(checkedRoot, { mode: "active" }),
    "INVALID_COMPLETED_TASK_EVIDENCE",
  );
});

test("rejects bare future IDs in the Kiro Out of current scope section", async () => {
  const root = await createValidFixture();
  await mutate(
    root,
    ".kiro/specs/where-not-rain/requirements.md",
    (markdown) => `${markdown}\n\n## Out of current scope\nDATA-ACTIVITY-001 remains mandatory.\n`,
  );

  assertError(await validateRepository(root, { mode: "active" }), "INVALID_OUT_OF_SCOPE_REFERENCE");
});
