# Task 4 Brief

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

### Task 4: Create Product, UX, and SEO authority documents

**Files:**
- Create: `docs/01-Product-PRD.md`
- Create: `docs/02-UX-Bible.md`
- Create: `docs/03-SEO-Bible.md`

**Interfaces:**
- Consumes Roadmap IDs from Task 3.
- Produces product and experience contracts consumed by Kiro requirements/design.

- [ ] **Step 1: Migrate product requirements with fixed IDs**

Create Hard requirement blocks for:

- `PRD-FR-001` Travel Radar
- `PRD-FR-002` Weather Explorer
- `PRD-FR-003` City Page
- `PRD-FR-004` Country Page
- `PRD-FR-005` Fuzzy Search
- `PRD-FR-006` Destination Rankings
- `PRD-FR-007` Compare Cities (Beta)
- `PRD-FR-008` Weekend Planner (Beta)
- `PRD-FR-009` Seasonal Travel (V1)
- `PRD-FR-010` Growth-loop recommendations (Beta)
- `PRD-FR-011` Commercial surfaces and disclosure
- `PRD-FR-012` Protected read-only Admin (Beta)
- `PRD-FR-013` Articles and RSS (Beta)
- `PRD-FR-014` Travel News editorial workflow (V1)
- `PRD-FR-015` AI Travel Match (V2)
- `PRD-FR-016` 30-Day Outlook (V2)

Copy the current valid acceptance criteria, remove Compare from MVP, rename 30-Day Forecast to Outlook, and make every delayed feature's roadmap reference resolve to its approved version.

- [ ] **Step 2: Create UX contracts**

Create `UX-IA-001`, `UX-HOME-001`, `UX-DESIGN-001`, `UX-STATE-001`, `UX-A11Y-001`, `UX-I18N-001` (five MVP locales), and `UX-I18N-002` (Thai/Vietnamese Beta). Preserve mobile-first order, progressive map loading, tokens, dark mode, 44×44 targets, WCAG 2.2 AA, keyboard access, reduced motion, and all async states.

- [ ] **Step 3: Create SEO contracts**

Create `SEO-PAGE-001`, `SEO-STRUCTURED-001`, `SEO-QUALITY-001`, `SEO-SITEMAP-001`, `SEO-CONTENT-001`, and `SEO-INDEXABILITY-001`. Put only indexability/quality columns in the SEO route table; link `ARCH-RENDER-001` for rendering mode and cache behavior. Preserve unique metadata, canonical, hreflang, visible-content JSON-LD, noindex rules, sitemap behavior, editorial review, and safety-source requirements.

- [ ] **Step 4: Format and run focused staging validation**

Run: `pnpm exec prettier --write docs/01-Product-PRD.md docs/02-UX-Bible.md docs/03-SEO-Bible.md && node tooling/docs/validate-docs.mjs --mode staging`

Expected: all three files parse with unique IDs and valid roadmap references; only not-yet-created document/trace/Kiro errors remain.
