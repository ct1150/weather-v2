# Task 1 Brief

Source: docs/superpowers/plans/2026-07-17-spec-documentation-refactor.md

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-17-spec-optimization-design.md` exactly.
- Do not modify product code under `apps/`, `workers/`, or `packages/`.
- Keep `weather.txt` unchanged; its locked baseline is 1,476 lines with SHA-256 `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`.
- New domain documents remain `Draft / Non-authoritative` until the cutover task.
- During migration, the existing `SPEC.md` remains authoritative and the worktree must not be used to start product implementation.
- `docs/11-Roadmap.md` is the only file that stores `first_release` and `lifecycle`; domain requirements store only `roadmap_ref`.
- Every Active Hard Requirement has acceptance criteria and exactly one release record.
- MVP provides typed static config/kill switches; dynamic segmentation and experimentation Feature Flags begin in V1.
- Lighthouse 100 remains the product target; CI and production thresholds use the approved dual gate.
- No actual affiliate, advertising, analytics, Cloudflare, database, or deployment integration occurs in this documentation change.
- Do not mark existing Kiro implementation tasks complete unless their exact `Verify:` command passes and evidence is recorded.
- The directory is not a Git repository. Do not add commit steps or claim commits; end each task with a validation checkpoint.

### Task 1: Implement deterministic requirement and manifest parsing

**Files:**
- Create: `tooling/docs/requirement-format.mjs`
- Create: `tooling/docs/requirement-format.test.mjs`

**Interfaces:**
- Produces: `normalizeBlock(text): string`
- Produces: `sha256(text): string`
- Produces: `parseRequirementBlocks(markdown, filePath): RequirementBlock[]`
- Produces: `parseReleaseRecords(markdown, filePath): ReleaseRecord[]`
- Produces: `parseTraceRecords(markdown, filePath): TraceRecord[]`
- Produces: `parseDerivedManifest(markdown, filePath): DerivedManifest | null`
- Produces: `digestRequirementSelection(blocks, ids): string`

- [ ] **Step 1: Write parser tests**

Create tests with Node's built-in runner covering line-ending normalization, trailing-space removal, metadata extraction, duplicate keys, canonical ID ordering, stable SHA-256, malformed JSON, release records, trace records, and derived manifests:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  digestRequirementSelection,
  normalizeBlock,
  parseDerivedManifest,
  parseReleaseRecords,
  parseRequirementBlocks,
  parseTraceRecords,
} from "./requirement-format.mjs";

const requirement = `<!-- requirement\nid: ENG-PERF-001\nstatus: Active\nkind: Hard\nroadmap_ref: REL-MVP-ENG_PERF_001\nowner: Engineering\nverification: pnpm docs:check\n-->\n### ENG-PERF-001 — Performance gate\nText.  \n#### Acceptance Criteria\n- Gate passes.\n`;

test("normalizes blocks deterministically", () => {
  assert.equal(normalizeBlock("\r\nA  \r\n\r\n"), "A\n");
});

test("parses requirement metadata and acceptance criteria", () => {
  const [block] = parseRequirementBlocks(requirement, "docs/09-Engineering-Handbook.md");
  assert.equal(block.id, "ENG-PERF-001");
  assert.equal(block.roadmapRef, "REL-MVP-ENG_PERF_001");
  assert.equal(block.hasAcceptanceCriteria, true);
});

test("digests selected blocks in sorted ID order", () => {
  const blocks = parseRequirementBlocks(requirement, "x.md");
  assert.match(digestRequirementSelection(blocks, ["ENG-PERF-001"]), /^sha256:[a-f0-9]{64}$/);
});

test("parses release, trace, and derived JSON comments", () => {
  const release = '<!-- release: {"first_release":"MVP","id":"REL-MVP-ENG_PERF_001","lifecycle":"Continuous","requirement_id":"ENG-PERF-001"} -->';
  const trace = '<!-- trace: {"classification":"Hard","coverage":"Covered","line_end":691,"line_start":675,"rationale":"Direct","requirement_id":"ENG-PERF-001","source_excerpt":"# PERFORMANCE","source_sha256":"70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d"} -->';
  const derived = '<!-- derived: {"generated_at":"2026-07-17","schema":1,"sources":[{"digest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","ids":["ENG-PERF-001"],"path":"docs/09-Engineering-Handbook.md"}]} -->';
  assert.equal(parseReleaseRecords(release, "r.md")[0].requirementId, "ENG-PERF-001");
  assert.equal(parseTraceRecords(trace, "t.md")[0].classification, "Hard");
  assert.equal(parseDerivedManifest(derived, "d.md").schema, 1);
});
```

- [ ] **Step 2: Run the tests and confirm the intended red state**

Run: `node --test tooling/docs/requirement-format.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `requirement-format.mjs`.

- [ ] **Step 3: Implement the parser module**

Implement strict metadata parsing and canonicalization. Use these exact allowed values:

```js
export const ALLOWED_STATUS = new Set(["Active", "Deprecated", "Superseded"]);
export const ALLOWED_KIND = new Set(["Hard", "Guidance"]);
export const ALLOWED_RELEASE = new Set(["MVP", "Beta", "V1", "V2"]);
export const ALLOWED_LIFECYCLE = new Set(["Launch", "Continuous"]);
export const ALLOWED_TRACE_CLASS = new Set(["Hard", "Suggestion", "Example"]);
export const ALLOWED_COVERAGE = new Set(["Covered", "Changed", "Rejected", "Needs Decision"]);

export function normalizeBlock(text) {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines.at(-1).trim() === "") lines.pop();
  return `${lines.map((line) => line.replace(/[ \t]+$/u, "")).join("\n")}\n`;
}
```

`parseRequirementBlocks` must reject duplicate metadata keys, missing `id/status/kind/roadmap_ref/owner/verification`, ID/heading mismatch, and a Hard block without `#### Acceptance Criteria`. `digestRequirementSelection` must sort/deduplicate IDs, join normalized blocks with `\n---\n`, and return `sha256:` followed by exactly 64 lowercase hexadecimal characters. JSON comment parsers must reject comments that are not single-line valid JSON or whose arrays are not canonically sorted.

- [ ] **Step 4: Run focused tests**

Run: `node --test tooling/docs/requirement-format.test.mjs`

Expected: all parser tests PASS, exit code 0.

- [ ] **Step 5: Run formatting**

Run: `pnpm exec prettier --write tooling/docs/requirement-format.mjs tooling/docs/requirement-format.test.mjs`

Expected: exit code 0 and no syntax changes on a second `--check` run.
