# Task 5 Brief

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

### Task 5: Create Architecture, Database, API, and Deployment authorities

**Files:**
- Create: `docs/05-System-Architecture.md`
- Create: `docs/06-Database.md`
- Create: `docs/07-API-Spec.md`
- Create: `docs/08-Cloudflare-Deployment.md`

**Interfaces:**
- Produces contracts used by Kiro design and tasks.
- Owns the only rendering matrix and the only data/API definitions.

- [ ] **Step 1: Write architecture requirements**

Create `ARCH-LAYERS-001`, `ARCH-DATAFLOW-001`, `ARCH-PROVIDER-001`, `ARCH-CACHE-001`, `ARCH-RECOVERY-001`, `ARCH-RENDER-001`, `ARCH-FLAG-001` (MVP static config/kill switch), and `ARCH-FLAG-002` (V1 dynamic flags). Include the approved route matrix verbatim, provider-only Cron flow, D1/KV fallback, snapshot activation, versioned cache keys, lock semantics, stale behavior, and R2 optionality.

- [ ] **Step 2: Write database and scoring requirements**

Create `DATA-GEOGRAPHY-001`, `DATA-WEATHER-001`, `DATA-SCORE-001`, `DATA-ACTIVITY-001`, `DATA-RELATIONSHIP-001`, `DATA-OPERATIONS-001`, and `DATA-MIGRATION-001`. Preserve all current tables and deterministic score formula. Add the approved Theme Park/Mountain formulas, exact factor weights, availability/season mappings, hazard maximum rule, two-hour/90-day/24-hour freshness limits, confidence 0.8 threshold, hidden-score behavior, and model-version/ADR rule.

- [ ] **Step 3: Write API requirements**

Create `API-READ-001`, `API-ENVELOPE-001`, `API-VALIDATION-001`, `API-INTERNAL-001`, and `API-CACHE-001`. Keep `/api/v1`, request IDs, ISO dates, stable errors, parameter validation, parameterized D1 queries, compact map payload, cache-cardinality controls, and strong internal authentication. Compare remains a Beta capability even if its endpoint shape is documented now.

- [ ] **Step 4: Write deployment requirements**

Create `DEP-FREE-001`, `DEP-PAGES-001`, `DEP-CONFIG-001`, `DEP-CICD-001`, and `DEP-ROLLBACK-001`. State that core infrastructure is Cloudflare-only and free-plan compatible; GA4/Plausible are removable disabled adapters. Pages is preferred; switching to official Workers deployment requires compatibility evidence, ADR, and product approval. Preserve exact config names, secret handling, preview/production smoke checks, migrations, Cron, rollback, and current-quota revalidation.

- [ ] **Step 5: Validate staging documents**

Run: `pnpm exec prettier --write docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md docs/08-Cloudflare-Deployment.md && node tooling/docs/validate-docs.mjs --mode staging`

Expected: no duplicate owner for rendering, data, API, or release assignment; only remaining missing documents/trace/Kiro errors are allowed.
