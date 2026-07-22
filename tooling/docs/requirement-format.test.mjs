import assert from "node:assert/strict";
import test from "node:test";
import {
  digestRequirementSelection,
  normalizeBlock,
  parseDerivedManifest,
  parseReleaseRecords,
  parseRequirementBlocks,
  parseTraceRecords,
  sha256,
} from "./requirement-format.mjs";

const requirement = `<!-- requirement
id: ENG-PERF-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_PERF_001
owner: Engineering
verification: pnpm docs:check
-->
### ENG-PERF-001 — Performance gate
Text.  
#### Acceptance Criteria
- Gate passes.
`;

const secondRequirement = `<!-- requirement
id: PROD-UX-002
status: Active
kind: Guidance
roadmap_ref: REL-V1-PROD_UX_002
owner: Product
verification: pnpm docs:check
-->
### PROD-UX-002 — Discovery guidance
Text.
`;

const release =
  '<!-- release: {"first_release":"MVP","id":"REL-MVP-ENG_PERF_001","lifecycle":"Continuous","requirement_id":"ENG-PERF-001"} -->';
const trace =
  '<!-- trace: {"classification":"Hard","coverage":"Covered","line_end":691,"line_start":675,"rationale":"Direct","requirement_id":"ENG-PERF-001","source_excerpt":"# PERFORMANCE","source_sha256":"70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d"} -->';
const derived =
  '<!-- derived: {"generated_at":"2026-07-17","schema":1,"sources":[{"digest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","ids":["ENG-PERF-001"],"path":"docs/09-Engineering-Handbook.md"}]} -->';

test("normalizes line endings, blank edges, and trailing spaces deterministically", () => {
  assert.equal(normalizeBlock("\r\nA  \r\nB\t\r\n\r\n"), "A\nB\n");
});

test("computes a stable lowercase SHA-256 digest", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("parses requirement metadata and acceptance criteria", () => {
  const [block] = parseRequirementBlocks(requirement, "docs/09-Engineering-Handbook.md");

  assert.deepEqual(
    {
      filePath: block.filePath,
      hasAcceptanceCriteria: block.hasAcceptanceCriteria,
      id: block.id,
      kind: block.kind,
      owner: block.owner,
      roadmapRef: block.roadmapRef,
      status: block.status,
      verification: block.verification,
    },
    {
      filePath: "docs/09-Engineering-Handbook.md",
      hasAcceptanceCriteria: true,
      id: "ENG-PERF-001",
      kind: "Hard",
      owner: "Engineering",
      roadmapRef: "REL-MVP-ENG_PERF_001",
      status: "Active",
      verification: "pnpm docs:check",
    },
  );
});

test("rejects duplicate and missing requirement metadata", () => {
  assert.throws(
    () =>
      parseRequirementBlocks(
        requirement.replace("status: Active", "status: Active\nstatus: Deprecated"),
        "duplicate.md",
      ),
    /duplicate metadata key.*status/iu,
  );
  assert.throws(
    () => parseRequirementBlocks(requirement.replace("owner: Engineering\n", ""), "missing.md"),
    /missing metadata key.*owner/iu,
  );
});

test("rejects heading mismatches and Hard requirements without acceptance criteria", () => {
  assert.throws(
    () =>
      parseRequirementBlocks(
        requirement.replace("### ENG-PERF-001", "### ENG-PERF-999"),
        "mismatch.md",
      ),
    /heading.*ENG-PERF-001/iu,
  );
  assert.throws(
    () =>
      parseRequirementBlocks(
        requirement.replace("#### Acceptance Criteria", "#### Notes"),
        "criteria.md",
      ),
    /Hard.*Acceptance Criteria/iu,
  );
});

test("rejects requirement metadata values outside the allowed sets", () => {
  assert.throws(
    () =>
      parseRequirementBlocks(
        requirement.replace("status: Active", "status: Proposed"),
        "status.md",
      ),
    /invalid status/iu,
  );
  assert.throws(
    () => parseRequirementBlocks(requirement.replace("kind: Hard", "kind: Optional"), "kind.md"),
    /invalid kind/iu,
  );
});

test("digests selected blocks in sorted, deduplicated ID order", () => {
  const blocks = parseRequirementBlocks(`${secondRequirement}\n${requirement}`, "requirements.md");
  const canonical = digestRequirementSelection(blocks, ["ENG-PERF-001", "PROD-UX-002"]);

  assert.match(canonical, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(
    digestRequirementSelection(blocks, ["PROD-UX-002", "ENG-PERF-001", "PROD-UX-002"]),
    canonical,
  );
  assert.throws(
    () => digestRequirementSelection(blocks, ["UNKNOWN-001"]),
    /unknown requirement id.*UNKNOWN-001/iu,
  );
});

test("parses release records", () => {
  assert.deepEqual(parseReleaseRecords(release, "r.md"), [
    {
      filePath: "r.md",
      firstRelease: "MVP",
      id: "REL-MVP-ENG_PERF_001",
      lifecycle: "Continuous",
      requirementId: "ENG-PERF-001",
    },
  ]);
});

test("parses trace records", () => {
  assert.deepEqual(parseTraceRecords(trace, "t.md"), [
    {
      classification: "Hard",
      coverage: "Covered",
      filePath: "t.md",
      lineEnd: 691,
      lineStart: 675,
      rationale: "Direct",
      requirementId: "ENG-PERF-001",
      sourceExcerpt: "# PERFORMANCE",
      sourceSha256: "70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d",
    },
  ]);
});

test("parses a derived manifest and returns null when absent", () => {
  assert.deepEqual(parseDerivedManifest(derived, "d.md"), {
    filePath: "d.md",
    generatedAt: "2026-07-17",
    schema: 1,
    sources: [
      {
        digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ids: ["ENG-PERF-001"],
        path: "docs/09-Engineering-Handbook.md",
      },
    ],
  });
  assert.equal(parseDerivedManifest("# No manifest\n", "none.md"), null);
});

test("rejects malformed or multiline JSON comments", () => {
  assert.throws(
    () => parseReleaseRecords("<!-- release: {broken} -->", "broken.md"),
    /invalid release JSON/iu,
  );
  assert.throws(
    () => parseTraceRecords('<!-- trace: {\n"classification":"Hard"\n} -->', "multiline.md"),
    /single-line/iu,
  );
  assert.throws(() => parseDerivedManifest("<!-- derived: [] -->", "array.md"), /JSON object/iu);
});

test("rejects invalid record values", () => {
  assert.throws(
    () => parseReleaseRecords(release.replace('"MVP"', '"Preview"'), "release.md"),
    /invalid first_release/iu,
  );
  assert.throws(
    () => parseTraceRecords(trace.replace('"Covered"', '"Partial"'), "trace.md"),
    /invalid coverage/iu,
  );
});

test("rejects derived arrays that are not canonically sorted", () => {
  const unsortedIds = derived.replace(
    '"ids":["ENG-PERF-001"]',
    '"ids":["PROD-UX-002","ENG-PERF-001"]',
  );
  const unsortedSources =
    '<!-- derived: {"generated_at":"2026-07-17","schema":1,"sources":[{"digest":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","ids":["PROD-UX-002"],"path":"docs/10-Product.md"},{"digest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","ids":["ENG-PERF-001"],"path":"docs/09-Engineering-Handbook.md"}]} -->';

  assert.throws(() => parseDerivedManifest(unsortedIds, "ids.md"), /canonically sorted/iu);
  assert.throws(() => parseDerivedManifest(unsortedSources, "sources.md"), /canonically sorted/iu);
});

test("rejects derived manifests with non-canonical key order", () => {
  const reversedKeys = derived.replace(
    '{"generated_at":"2026-07-17","schema":1,"sources":',
    '{"schema":1,"generated_at":"2026-07-17","sources":',
  );

  assert.throws(() => parseDerivedManifest(reversedKeys, "reversed.md"), /canonical JSON/iu);
});

test("rejects derived manifests with non-canonical whitespace", () => {
  const extraWhitespace = derived.replace(
    '"generated_at":"2026-07-17"',
    '"generated_at": "2026-07-17"',
  );

  assert.throws(() => parseDerivedManifest(extraWhitespace, "whitespace.md"), /canonical JSON/iu);
});

test("rejects malformed same-line requirement markers", () => {
  const sameLine = "<!-- requirement id: ENG-PERF-001 -->";

  assert.throws(() => parseRequirementBlocks(sameLine, "same-line.md"), /requirement marker/iu);
});

test("rejects unclosed requirement markers", () => {
  const unclosed = requirement.replace("-->", "");

  assert.throws(() => parseRequirementBlocks(unclosed, "unclosed.md"), /requirement marker/iu);
});
