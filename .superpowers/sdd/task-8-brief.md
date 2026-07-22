# Task 8 Brief

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

### Task 8: Synchronize the three Kiro-derived specifications

**Files:**
- Modify: `.kiro/specs/where-not-rain/requirements.md`
- Modify: `.kiro/specs/where-not-rain/design.md`
- Modify: `.kiro/specs/where-not-rain/tasks.md`

**Interfaces:**
- Consumes all MVP Active Hard Requirements selected through Roadmap records.
- Produces canonical derived manifests using Task 1's digest algorithm.

- [ ] **Step 1: Regenerate MVP requirements**

Add the exact single-line derived manifest first. Include every MVP Active Hard Requirement exactly once in EARS form. Remove Compare, Weekend Planner, articles, Thai/Vietnamese, custom growth reports, Seasonal, dynamic Feature Flags/experiments, candidate-provider activation, Travel News, AI Match, and 30-Day Outlook from current MVP requirements. Preserve future IDs only in an explicit non-normative “Out of current scope” link to Roadmap, not as requirements.

- [ ] **Step 2: Reconcile design coverage**

Add a derived manifest containing all source IDs referenced by the design. Retain useful implementation diagrams and interfaces, but replace old `SPEC §N` ownership claims with links to authoritative IDs. Add a coverage appendix mapping every MVP Active Hard Requirement to at least one design heading. Remove any design-level `must/shall` statement that has no source ID.

- [ ] **Step 3: Reconcile task coverage and evidence fields**

Remove detailed Beta/V1/V2 tasks. For every remaining task add actual comma-separated IDs, an executable command, and an observable result. Use this concrete field form for a domain task: `_Requirements: DATA-SCORE-001, ENG-TEST-001_`, `Verify: pnpm --filter @wnr/domain test`, `Expected: command exits 0 with all domain tests passing`, and `Evidence: pending — verification has not been executed`. For a different task, use the real package or root command already named in that task; tokens and generic placeholders are forbidden in the resulting `tasks.md`. Keep all current checkboxes unchecked unless the task's full command is run during this task; file existence alone is not evidence. Add a coverage appendix proving every MVP Active Hard Requirement maps to at least one task.

- [ ] **Step 4: Generate canonical manifests and validate**

Use exports from `requirement-format.mjs` in a short Node command or a dedicated `--write-derived-manifest` CLI option; do not hand-calculate digests.

Run: `node tooling/docs/validate-docs.mjs --mode staging`

Expected: Kiro bidirectional coverage and digest checks pass; only Draft/cutover/index errors remain.
