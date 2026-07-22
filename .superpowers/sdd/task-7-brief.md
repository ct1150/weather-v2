# Task 7 Brief

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

### Task 7: Build complete source traceability

**Files:**
- Create: `docs/13-Requirements-Traceability.md`

**Interfaces:**
- Consumes every authority Requirement ID and locked `weather.txt` hash.
- Produces machine-readable `trace` comments and a generated human matrix.

- [ ] **Step 1: Add immutable source metadata**

Record the locked file path, 1,476 line count, SHA-256, audit date, classification rules, and the rule that every Hard source range maps to an Active Requirement while Suggestion/Example may map to Guidance or a rationale-only decision.

- [ ] **Step 2: Trace all original headed sections**

Create at least one trace record for each exact section range: `1–22`, `23–44`, `45–78`, `79–136`, `137–150`, `151–196`, `197–256`, `257–272`, `273–318`, `319–338`, `339–374`, `375–408`, `409–478`, `479–526`, `527–540`, `541–564`, `565–590`, `591–610`, `611–630`, `631–648`, `649–674`, `675–694`, `695–722`, `723–738`, `739–770`, `771–802`, `803–880`, and `881–898`.

Split a range into multiple records whenever different sentences map to different Requirement IDs; do not use one broad record to hide partial coverage.

- [ ] **Step 3: Trace appended recommendation clusters**

Add records for Radar/Explorer enhancements (`899–1011`), Weekend Planner (`1012–1034`), Rankings (`1035–1060`), AI Match (`1061–1103`), Seasonal Travel (`1104–1125`), Compare (`1126–1161`), nearby recommendations (`1162–1179`), timeline (`1180–1196`), Travel News (`1197–1214`), ingestion architecture (`1215–1244`), SEO routes (`1245–1286`), growth loop (`1287–1312`), analytics (`1313–1331`), UI/design/ADR (`1332–1373`), document-system proposal (`1374–1452`), and delivery-form example (`1453–1476`).

Classify “Top 100,” “150–250 pages,” sample prices, example city outputs, and automatic future AI writing as Suggestion/Example rather than Hard. Record Changed rationales for 30-Day Outlook, conditional Pages fallback, authorized price data, and reviewed AI content.

- [ ] **Step 4: Prove zero unresolved decisions**

Run: `node tooling/docs/validate-docs.mjs --mode staging`

Expected: trace hash matches, all Hard source ranges resolve, `Needs Decision` count is 0, and no release value is duplicated in the trace file.
