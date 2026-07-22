# Task 2 Implementation Report

## Status

Task 2 is implemented. No Task 3 authority documents were created, no product code was changed, and no Git operation was attempted (the directory is not a Git repository).

Task 2 changed the four implementation files authorized by the brief:

- Created `tooling/docs/validate-docs.mjs`
- Created `tooling/docs/validate-docs.test.mjs`
- Modified `package.json`
- Modified `prettier.config.js`

This report is the explicitly requested orchestration artifact.

## Implementation

`validateRepository(root, { mode })` now returns the fixed result shape with sorted errors/warnings and requirement/release/trace statistics. It invokes all ten required named checks:

1. `checkDocumentSet`
2. `checkRequirementSchema`
3. `checkReleaseUniqueness`
4. `checkMarkdownLinks`
5. `checkTraceCoverage`
6. `checkDerivedFreshness`
7. `checkKiroBidirectionalCoverage`
8. `checkTaskEvidence`
9. `checkCriticalClauses`
10. `checkCutoverState`

The validator consumes Task 1's parsers and digest helpers, uses only Node.js built-ins, distinguishes staging from active cutover state, validates the fixed document set, requirement/release/trace contracts, internal links and anchors, Kiro MVP coverage and digest freshness, completed task evidence, critical Requirement IDs, and Draft/Needs Decision cutover blockers.

The CLI accepts exactly `--mode staging|active` and implements exit codes:

- `0`: no contract errors
- `1`: documentation contract errors
- `2`: parser, configuration, or internal failures

Root scripts were added without changing the existing `test` script or dependency versions:

- `docs:test`: `node --test tooling/docs/*.test.mjs`
- `docs:check`: `node tooling/docs/validate-docs.mjs --mode active`

`prettier.config.js` now contains the required exact local import:

```js
export { default } from "./tooling/prettier-config/index.js";
```

## TDD Evidence

RED was observed before implementation:

```text
node --test tooling/docs/validate-docs.test.mjs
exit 1
ERR_MODULE_NOT_FOUND: tooling/docs/validate-docs.mjs
```

The fixture suite uses temporary repositories created with `mkdtemp`. It covers:

- A fully valid Active fixture with 9 requirements, 9 unique release records, 9 traces, fresh Kiro manifests, and all MVP IDs represented in requirements/design/tasks
- Duplicate requirement IDs across authority files
- Missing release record
- Stale derived digest
- Broken Markdown target/anchor
- Active-mode `Needs Decision`
- Missing Kiro MVP requirement coverage
- Active/Draft mode mismatch and staging allowance
- Deterministic issue sorting
- CLI exit codes 0, 1, and 2

GREEN evidence:

```text
node --test tooling/docs/validate-docs.test.mjs
10 tests, 10 passed, 0 failed, exit 0
```

Full documentation test evidence:

```text
pnpm docs:test
27 tests, 27 passed, 0 failed, exit 0
```

This includes all 17 Task 1 parser/digest tests and all 10 Task 2 validator/CLI tests.

## Validation Evidence

- `pnpm docs:test && pnpm exec prettier --check tooling/docs package.json`: exit 0; 27/27 tests passed; all matched files use Prettier style.
- `pnpm test`: exit 0 across the workspace; the existing root test script remained `pnpm -r test`.
- `pnpm exec prettier --check tooling/docs/validate-docs.mjs tooling/docs/validate-docs.test.mjs package.json prettier.config.js`: exit 0.
- `pnpm docs:check`: exit 1 with 122 documentation contract errors and validator summary `0 requirement(s), 0 release(s), 0 trace(s)`. This is the expected pre-migration state: authority documents/manifests and migrated Kiro fields do not yet exist. It proves contract-error exit 1 rather than parser/config/internal exit 2.
- `weather.txt`: still 1,476 lines with SHA-256 `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`.

## Self-review

- AST symbol inspection confirmed all ten named checks and `validateRepository` are top-level functions in `validate-docs.mjs`.
- The result shape, issue ordering (`file`, `code`, `message`), mode validation, and CLI exit behavior are exercised by tests.
- Critical clauses are checked through `REQUIRED_CONTRACT_IDS`, not prose matching.
- The implementation does not import third-party packages.
- `package.json` dependency versions and the existing `test` script are unchanged.
- No authority document or Task 3 file was created.

## Concerns

1. The current repository is intentionally unmigrated. `pnpm docs:check` will remain red until Tasks 3–9 create/cut over the authority documents and regenerate the Kiro files.
2. Prettier succeeds but Node emits `MODULE_TYPELESS_PACKAGE_JSON` because the brief requires an ESM export in `prettier.config.js` while the root package has no `"type": "module"`. Adding that package field was outside Task 2 and could affect the monorepo, so it was not changed.
3. No independent reviewer subagent was available in this orchestrated implementation session; the review was performed with fixture/CLI tests, AST symbol inspection, exact file-content checks, and a structured self-review.

## Review Fix Red-Green Evidence (2026-07-17)

### RED

The review regressions were added before validator changes and run with:

```text
node --test tooling/docs/validate-docs.test.mjs
exit 1
31 tests: 10 passed, 21 failed
```

All 10 pre-existing tests stayed green. The 21 new negative fixtures failed because the unchanged validator did not emit the required codes:

1. `TRACE_COVERAGE_GAP` — uncovered source line in the trace union
2. `DUPLICATE_TRACE_MAPPING` — duplicate classification/range/requirement tuple
3. `INVALID_GUIDANCE_TRACE` — Suggestion/Example targeting Active Hard
4. `INDEX_CONTRACT` — requirement marker/Acceptance Criteria copied into an index
5. `INACTIVE_INDEX_LINK` — index link to Draft authority in staging mode
6. `NON_AUTHORITY_INDEX_LINK` — index link to a non-authority repository file
7. `AUTHORITY_PLACEHOLDER` — actual TODO in authority prose
8. `EMPTY_AUTHORITY_SECTION` — heading section with no content
9. `LEGACY_SPEC_REFERENCE` — old `SPEC §N` authority reference
10. `MISSING_DESIGN_REQUIREMENTS` — `###` design unit without `_Requirements:`
11. `INVALID_DESIGN_REQUIREMENTS` — design unit with an invalid/non-MVP ID
12. `INVALID_TASK_REQUIREMENTS` — task block with an invalid/non-MVP ID
13. `INVALID_COMPLETED_TASK_EVIDENCE` — completed evidence without literal `exit 0`
14. `INVALID_COMPLETED_TASK_EVIDENCE` — completed evidence with no summary
15. `INVALID_RELEASE_ID` — release ID not derived from release + requirement ID
16. `INVALID_ROADMAP_REF` — non-`REL-*` requirement reference
17. `MISSING_RELEASE_ANCHOR` — Roadmap record without explicit `<a id="REL-..."></a>`
18. `MISSING_ROADMAP_LINK` — requirement block without its inline Roadmap link
19. `REFERENCE_LINK_DEFINITION` — reference-style link definition
20. `REFERENCE_LINK_USAGE` — reference-style link use
21. `UNAPPROVED_TRACE` — loose approval text or structured prefix without a reason

The observed failures were assertion failures of the form `expected <CODE>, received ...`, proving each regression fixture exercised behavior absent from the pre-fix implementation.

### GREEN

After the minimal validator implementation, the targeted suite was run again:

```text
node --test tooling/docs/validate-docs.test.mjs
exit 0
31 tests, 31 passed, 0 failed
```

The complete documentation suite then passed:

```text
pnpm docs:test
exit 0
48 tests, 48 passed, 0 failed
```

This comprises 17 Task 1 parser/digest tests and 31 Task 2 validator/CLI tests.

### Final validation

```text
pnpm test
exit 0
17 of 18 workspace projects tested; all project test commands completed successfully

pnpm exec prettier --check tooling/docs/validate-docs.mjs tooling/docs/validate-docs.test.mjs package.json prettier.config.js
exit 0
All matched files use Prettier code style!

pnpm docs:check
exit 1
Documentation validation: 441 contract errors, 0 warnings; 0 requirements, 0 releases, 0 traces

wc -l weather.txt && sha256sum weather.txt
exit 0
1476 weather.txt
70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d  weather.txt
```

`pnpm docs:check` remains the expected pre-cutover contract failure and exits 1 rather than parser/config/internal exit 2. The increased error count reflects the newly enforced contracts against the intentionally unmigrated authority/Kiro document set. The root package was not given `type: module`; the existing `MODULE_TYPELESS_PACKAGE_JSON` Prettier warning remains non-blocking as directed.


## Re-review Round 2 Red-Green Evidence (2026-07-17)

### RED

Five positive/negative fixture pairs were added before the validator changes. The first full targeted run produced:

```text
node --test tooling/docs/validate-docs.test.mjs
exit 1
41 tests: 34 passed, 7 failed
```

The seven expected failures proved the missing behavior for both sides of the index allowlist, rationale-only `requirement_id: NONE`, Hard `NONE` rejection, Kiro future-ID scope exclusion, fenced index contracts, and optional-task validation. Existing negative guards for non-Hard-to-Active-Hard traces, MVP-only manifests, real index markers, and valid optional syntax remained green. A separate negative fixture for a bare future ID under `## Out of current scope` failed with `NON_MVP_KIRO_REQUIREMENT` instead of the required `INVALID_OUT_OF_SCOPE_REFERENCE`. The Task 9 ADR-policy navigation refinement also failed before `docs/12-ADR/README.md` was declared for SPEC/docs indexes. A final positive fixture that mentions `` `<!-- requirement` `` in inline governance prose failed before detection was narrowed to complete multiline requirement comments; it passed together with the real-marker rejection after that refinement.

### GREEN

The validator now uses per-index target sets; accepts `NONE` only for Suggestion/Example rationale-only traces; requires Hard traces to resolve to Active Hard requirements; excludes only the explicit Kiro out-of-scope section from prose coverage while requiring future IDs there to be links; keeps manifests MVP-only; strips fenced code before recognizing real requirement markers; permits ordinary `Acceptance Criteria` governance prose; and parses `- [ ]*` / `- [x]*` task blocks identically to ordinary tasks.

```text
node --test tooling/docs/validate-docs.test.mjs
exit 0
42 tests, 42 passed, 0 failed

pnpm docs:test
exit 0
59 tests, 59 passed, 0 failed

pnpm test
exit 0
17 of 18 workspace projects tested; all project test commands completed successfully

pnpm exec prettier --check tooling/docs/validate-docs.mjs tooling/docs/validate-docs.test.mjs package.json prettier.config.js
exit 0
All matched files use Prettier code style!

pnpm docs:check
exit 1
Documentation validation: 585 errors, 0 warnings; 0 requirements, 0 releases, 0 traces

wc -l weather.txt && sha256sum weather.txt
exit 0
1476 weather.txt
70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d  weather.txt
```

The active check remains the expected pre-Task-9 contract failure (exit 1, not internal/config exit 2). The larger pre-migration count reflects validation of optional Kiro tasks that were previously skipped. No Task 1 parser, product source, root package type, dependency version, or Git state was changed.
