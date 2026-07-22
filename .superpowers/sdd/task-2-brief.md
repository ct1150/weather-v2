# Task 2 Brief

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

### Task 2: Implement repository-level documentation validation

**Files:**
- Create: `tooling/docs/validate-docs.mjs`
- Create: `tooling/docs/validate-docs.test.mjs`
- Modify: `package.json`
- Modify: `prettier.config.js`

**Interfaces:**
- Consumes: Task 1 parser/digest exports.
- Produces: `validateRepository(root, { mode }): Promise<ValidationResult>` where mode is `staging|active`.
- Produces CLI: `node tooling/docs/validate-docs.mjs --mode staging|active`
- Produces scripts: `pnpm docs:test`, `pnpm docs:check`.

- [ ] **Step 1: Write fixture-based failing tests**

Use `mkdtemp`, write minimal documents under the temporary root, and assert error codes for duplicate IDs, missing release records, stale digest, invalid links, `Needs Decision`, Kiro omissions, and Active/Draft mode mismatch. Include one fully valid fixture whose requirement links to one release and appears in all three Kiro derived files.

```js
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validateRepository } from "./validate-docs.mjs";

test("rejects an Active hard requirement without exactly one release", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "wnr-docs-"));
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "09-Engineering-Handbook.md"), "---\nstatus: Active\n---\n<!-- requirement\nid: ENG-PERF-001\nstatus: Active\nkind: Hard\nroadmap_ref: REL-MVP-ENG_PERF_001\nowner: Engineering\nverification: pnpm docs:check\n-->\n### ENG-PERF-001 — Gate\n#### Acceptance Criteria\n- Pass.\n");
  const result = await validateRepository(root, { mode: "active" });
  assert(result.errors.some((error) => error.code === "MISSING_RELEASE"));
});
```

- [ ] **Step 2: Verify the repository validator tests fail**

Run: `node --test tooling/docs/validate-docs.test.mjs`

Expected: FAIL with missing `validate-docs.mjs`.

- [ ] **Step 3: Implement `validateRepository` and the CLI**

The result shape is fixed:

```js
/** @typedef {{code:string,file:string,message:string}} ValidationIssue */
/** @typedef {{errors:ValidationIssue[],warnings:ValidationIssue[],stats:{requirements:number,releases:number,traces:number}}} ValidationResult */
```

Implement these checks as named functions called by `validateRepository`: `checkDocumentSet`, `checkRequirementSchema`, `checkReleaseUniqueness`, `checkMarkdownLinks`, `checkTraceCoverage`, `checkDerivedFreshness`, `checkKiroBidirectionalCoverage`, `checkTaskEvidence`, `checkCriticalClauses`, and `checkCutoverState`. Sort issues by `file`, then `code`, then `message` before output. CLI exit codes are 0 for no errors, 1 for contract errors, and 2 for parser/config/internal failures. `--mode active` must reject Draft authority documents and any `Needs Decision`; `--mode staging` permits Draft authority documents but still runs all structural checks.

Critical-clause checks must identify requirement IDs, not merely search prose:

```js
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
```

- [ ] **Step 4: Add root commands and repair root Prettier resolution**

Replace `prettier.config.js` with the exact local import:

```js
export { default } from "./tooling/prettier-config/index.js";
```

Add these scripts without changing dependency versions:

```json
"docs:test": "node --test tooling/docs/*.test.mjs",
"docs:check": "node tooling/docs/validate-docs.mjs --mode active"
```

Keep the existing `test` script unchanged; the final validation runs both `pnpm docs:test` and `pnpm test` separately.

- [ ] **Step 5: Run validator tests and formatting**

Run: `pnpm docs:test && pnpm exec prettier --check tooling/docs package.json`

Expected: all docs tests PASS and Prettier exits 0.
