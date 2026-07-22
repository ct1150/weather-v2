# Task 3 Brief

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

### Task 3: Create governance, authority, and release documents in Draft state

**Files:**
- Create: `docs/README.md`
- Create: `docs/00-Founder-Vision.md`
- Create: `docs/11-Roadmap.md`
- Modify: `docs/12-ADR/README.md`

**Interfaces:**
- Produces the authority map used by every later document.
- Produces one `REL-*` record for every requirement ID listed in Tasks 3–6.

- [ ] **Step 1: Write Draft front matter and governance rules**

Every new authority document uses `status: Draft` and `last_updated: 2026-07-17`. Use these exact title/authority pairs in front matter:

| File | title | authority |
|---|---|---|
| `docs/README.md` | Documentation Governance | Governance |
| `docs/00-Founder-Vision.md` | Founder Vision | Vision |
| `docs/01-Product-PRD.md` | Product PRD | Product |
| `docs/02-UX-Bible.md` | UX Bible | UX |
| `docs/03-SEO-Bible.md` | SEO Bible | SEO |
| `docs/04-AI-Coding-Bible.md` | AI Coding Bible | Agent Delivery |
| `docs/05-System-Architecture.md` | System Architecture | Architecture |
| `docs/06-Database.md` | Database and Scoring | Data |
| `docs/07-API-Spec.md` | API Specification | API |
| `docs/08-Cloudflare-Deployment.md` | Cloudflare Deployment | Deployment |
| `docs/09-Engineering-Handbook.md` | Engineering Handbook | Engineering |
| `docs/10-Growth-Bible.md` | Growth Bible | Growth |
| `docs/11-Roadmap.md` | Roadmap | Release |
| `docs/13-Requirements-Traceability.md` | Requirements Traceability | Traceability |

`docs/README.md` must state the reading order, unique owner table, Requirement metadata format, release-record JSON format, trace JSON format, Draft/cutover protocol, conflict resolution, and the rule that `weather.txt` is historical input after cutover.

- [ ] **Step 2: Write Founder Vision without release assignments**

Create these IDs with Hard acceptance criteria where applicable: `VISION-POSITION-001`, `VISION-MARKET-001`, `VISION-VALUE-001`, `VISION-METRICS-001`, `VISION-BUSINESS-001`, `VISION-COST-001`. Preserve Where Not Rain, “Find Sunshine. Plan Better.”, the target countries, Travel Decision Engine positioning, SEO/conversion/retention/revenue/performance priorities, and commercial evolution. Define commercial phases as revenue-model narrative only; do not store MVP/Beta/V1/V2 values here.

- [ ] **Step 3: Write the sole Roadmap release table**

`docs/11-Roadmap.md` stores one single-line release JSON comment per Active Hard requirement and renders the same records in a human table. Use this mapping policy:

- MVP: all requirements except the explicit Beta/V1/V2 IDs below.
- Beta: `PRD-FR-007`, `PRD-FR-008`, `PRD-FR-010`, `PRD-FR-012`, `PRD-FR-013`, `UX-I18N-002`, `GROW-REPORT-001`.
- V1: `PRD-FR-009`, `PRD-FR-014`, `ARCH-FLAG-002`, `DATA-ACTIVITY-001`, `GROW-EXPERIMENT-001`, `GROW-PROVIDER-001`.
- V2: `PRD-FR-015`, `PRD-FR-016`.
- Lifecycle Continuous: all `ARCH-*`, `DEP-*`, `ENG-*`, `SEO-*`, `AGENT-*`, analytics/privacy requirements, and data migration requirements; other feature requirements use Launch unless their acceptance criteria explicitly describe ongoing operation.

Release IDs use `REL-${release}-${requirementId.replaceAll("-", "_")}`; for example `ENG-PERF-001` in MVP maps to `REL-MVP-ENG_PERF_001`. Domain metadata must reference that exact ID.

- [ ] **Step 4: Update ADR policy**

Require a phase decision log every phase. Require an ADR only for a new or changed architecture decision. The exact no-ADR output is `ADR: none — no new architectural decision`. State that Accepted ADRs may supersede a contract only when they name the superseded Requirement ID and the authority document is updated in the same cutover.

- [ ] **Step 5: Validate staging structure**

Run: `node tooling/docs/validate-docs.mjs --mode staging`

Expected: no parser errors; missing-document/coverage errors are expected until Tasks 4–7, but there must be no malformed requirement or release record.
