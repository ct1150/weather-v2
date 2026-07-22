# Task 6 Brief

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

### Task 6: Create Engineering, Growth, and Agent authorities

**Files:**
- Create: `docs/04-AI-Coding-Bible.md`
- Create: `docs/09-Engineering-Handbook.md`
- Create: `docs/10-Growth-Bible.md`

**Interfaces:**
- Completes the authoritative requirement set.
- Supplies validator-critical IDs listed in Task 2.

- [ ] **Step 1: Write Agent and Definition-of-Done contracts**

Create `AGENT-PROTOCOL-001`, `AGENT-BOUNDARY-001`, `AGENT-DOD-001`, and `AGENT-DOCS-001`. Require authority-first reading, one release phase at a time, no pseudocode/unused dependencies/unverified completion, validation evidence, change summaries, known limitations, decision log, and conflict escalation. State that Kiro files are derived and cannot override authority documents.

- [ ] **Step 2: Write engineering quality contracts**

Create `ENG-TYPESCRIPT-001`, `ENG-TEST-001`, `ENG-PERF-001`, `ENG-SECURITY-001`, `ENG-BOT-001`, `ENG-PRIVACY-001`, `ENG-OBSERVABILITY-001`, and `ENG-RELIABILITY-001`. Include:

- CI Lighthouse device/network/sample settings and 95/100/100/100 blocking thresholds.
- Production 28-day p75, 100-sample minimum, LCP <2s, CLS <0.05, INP <200ms, two-window incident rule, optional-script shutdown, attributable rollback.
- L1/L2/L3/L4 Bot limits and actions exactly as approved.
- XSS, SQL injection, CSP, SSRF, open redirect, replay, poisoning, secrets, logging, privacy, and Admin controls.
- Unit/integration/E2E/non-functional suites and explicit required paths.
- Structured logs, sync/cache/error metrics, stale/KV/D1/deployment recovery.

- [ ] **Step 3: Write growth and commercial contracts**

Create:

- `GROW-ANALYTICS-001` — exact event names, common fields, field types, allowlists, version rejection, no raw search terms.
- `GROW-REPORT-001` — Beta `top_pages` and `acquisition_country`, UTC daily aggregation, 7/28/90 windows, metrics, ISO/ZZ handling, privacy threshold 10.
- `GROW-AFF-001` — adapter/disclosure/rel/nonblocking-click/whitelist behavior.
- `GROW-ADS-001` — Homepage, City Page, Article, Sidebar, Between Sections; no-fill/disabled zero CLS.
- `GROW-PROVIDER-001` — V1 candidate registry for Google AdSense, Booking, Agoda, Trip.com, Klook, KKday, Expedia, Rentalcars, Airalo, Travel Insurance; no launch promise.
- `GROW-EXPERIMENT-001` — V1 dynamic flags/A-B hypothesis, primary/guardrail metrics, dates, no indexable variants, no extra PII.

- [ ] **Step 4: Run complete authority-set staging validation**

Run: `pnpm exec prettier --write docs/04-AI-Coding-Bible.md docs/09-Engineering-Handbook.md docs/10-Growth-Bible.md && node tooling/docs/validate-docs.mjs --mode staging`

Expected: all required authority files and critical IDs exist; remaining failures are limited to traceability, Kiro derivation, Draft status, and pre-cutover indexes.
