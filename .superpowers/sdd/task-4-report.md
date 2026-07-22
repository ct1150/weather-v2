# Task 4 Report — Product, UX, and SEO authorities

- Date: 2026-07-17
- Status: Complete for Task 4 scope; staging remains intentionally red for later tasks
- Scope: Create Product PRD, UX Bible, and SEO Bible only; do not modify Roadmap or perform Task 5
- Authority state: Draft / Non-authoritative
- Requirement state: Active / Hard
- Git: unavailable by repository constraint; no commit attempted or claimed

## Inputs reviewed

- `.superpowers/sdd/task-4-brief.md`
- `docs/README.md` governance, ownership, Requirement format, release format, Draft/cutover, and conflict rules
- `docs/11-Roadmap.md` exact release records and anchors
- `SPEC.md` product scope, functional requirements, information architecture, UX/design, SEO/content, i18n, and acceptance contracts
- `weather.txt` corresponding product, homepage, map, city, search, articles, SEO, i18n, affiliate, ads, Admin, performance, UI, and appended feature recommendations
- `docs/superpowers/specs/2026-07-17-spec-optimization-design.md` approved lean-scope and authority decisions
- `docs/superpowers/plans/2026-07-17-spec-documentation-refactor.md` Task 4 plan and Task 5 boundary

## Pre-write staging baseline

An initial command-discovery attempt, `pnpm docs:staging`, exited 254 because no such package script exists. The brief-defined validator was then run before creating the documents:

```text
node tooling/docs/validate-docs.mjs --mode staging
exit 1
Documentation validation: 690 error(s), 0 warning(s); 6 requirement(s), 78 release(s), 0 trace(s).
```

The baseline included missing `docs/01-Product-PRD.md`, `docs/02-UX-Bible.md`, and `docs/03-SEO-Bible.md`, all 29 corresponding `UNKNOWN_RELEASE_REQUIREMENT` records, and already-known later-document, trace, Kiro manifest, design metadata, task metadata/evidence, and coverage failures.

## Created files

1. `docs/01-Product-PRD.md`
   - 16 fixed `PRD-FR-001` through `PRD-FR-016` contracts.
   - Applies the approved lean baseline: Compare, Weekend Planner, growth-loop recommendations, read-only Admin, and Articles/RSS resolve to their later Roadmap records; Seasonal Travel and Travel News resolve separately; AI Travel Match and 30-Day Outlook resolve separately.
   - Removes Compare from the baseline discovery scope without deleting its complete future contract.
   - Uses **30-Day Outlook** consistently and requires trend/probability, confidence, and disclaimer behavior.
   - Preserves complete Travel Radar, Explorer, city, country, search, rankings, commercial, Admin, editorial, assisted-content, and long-horizon acceptance behavior.

2. `docs/02-UX-Bible.md`
   - 7 fixed contracts: `UX-IA-001`, `UX-HOME-001`, `UX-DESIGN-001`, `UX-STATE-001`, `UX-A11Y-001`, `UX-I18N-001`, and `UX-I18N-002`.
   - Preserves mobile-first order, map-independent core decisions, progressive map loading, exact token vocabulary, system/light/dark themes, all eight async/degraded states, 44 × 44 CSS px targets, WCAG 2.2 AA, keyboard access, text alternatives, and reduced motion.
   - Core locale contract contains English, Japanese, Korean, Simplified Chinese, and Traditional Chinese. Thai and Vietnamese remain a separate complete contract with the exact later Roadmap record.

3. `docs/03-SEO-Bible.md`
   - 6 fixed contracts: `SEO-PAGE-001`, `SEO-STRUCTURED-001`, `SEO-QUALITY-001`, `SEO-SITEMAP-001`, `SEO-CONTENT-001`, and `SEO-INDEXABILITY-001`.
   - Preserves unique metadata, canonical, locale alternates and `x-default`, visible-content JSON-LD, deterministic quality gates, noindex rules, sitemap partitioning and meaningful `lastmod`, human editorial review, factual source freshness, and official-source/non-emergency rules for safety content.
   - The route table has exactly `Route class`, `Indexability`, and `Required quality outcome`. It contains no rendering mode, revalidation, invalidation, fallback, TTL, or cache-header values.
   - Rendering/cache ownership is linked to `ARCH-RENDER-001` and intentionally not copied. Its target is created only by Task 5.

All three files have `status: Draft`; all 29 requirements have `status: Active`, `kind: Hard`, an explicit exact Requirement anchor, deterministic `roadmap_ref`, exact inline Roadmap anchor link, substantive contract prose, and `#### Acceptance Criteria`.

## Verification

### Prettier write and check

```text
pnpm exec prettier --write docs/01-Product-PRD.md docs/02-UX-Bible.md docs/03-SEO-Bible.md
exit 0

docs/01-Product-PRD.md 179ms (unchanged)
docs/02-UX-Bible.md 63ms
docs/03-SEO-Bible.md 48ms
```

```text
pnpm exec prettier --check docs/01-Product-PRD.md docs/02-UX-Bible.md docs/03-SEO-Bible.md
exit 0
All matched files use Prettier code style!
```

Prettier emitted the repository's existing `MODULE_TYPELESS_PACKAGE_JSON` warning for `prettier.config.js`; package configuration is outside Task 4 and was not changed.

### Docs tests

```text
pnpm docs:test
exit 0
59 tests, 59 pass, 0 fail
```

### Fixed-ID and contract audit

The repository parser was used to compare actual IDs against the fixed lists and verify Draft document status, Active/Hard requirement metadata, explicit anchors, exact Roadmap refs/links, and Acceptance Criteria:

```text
docs/01-Product-PRD.md: 16/16 fixed IDs verified
docs/02-UX-Bible.md: 7/7 fixed IDs verified
docs/03-SEO-Bible.md: 6/6 fixed IDs verified
TOTAL: 29/29 Active Hard requirements with anchors, Roadmap refs/links, and Acceptance Criteria
```

### SEO ownership audit

```text
SEO ownership audit: 9 route rows; exactly Route class + Indexability + Required quality outcome; no rendering/cache values; ARCH-RENDER-001 linked.
```

### Locked historical source and scope evidence

```text
weather_lines=1476
70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d  weather.txt
roadmap_sha256=927dbc9ff85974f6059043bb78a6ad70a022765094c76c1002f661cdbd9a4963
```

The `weather.txt` count and digest match the locked baseline. No write operation targeted `weather.txt`, `docs/11-Roadmap.md`, product code, Kiro files, or Task 5 files.

### Post-write staging validator

```text
node tooling/docs/validate-docs.mjs --mode staging
exit 1
Documentation validation: 774 error(s), 0 warning(s); 35 requirement(s), 78 release(s), 0 trace(s).
```

The requirement count is exactly the six pre-existing Founder requirements plus the 29 Task 4 requirements. The three target `MISSING_DOCUMENT` errors and their 29 `UNKNOWN_RELEASE_REQUIREMENT` errors are gone. The validator reports no malformed marker, duplicate Requirement ID, missing Requirement anchor, invalid `roadmap_ref`, Roadmap mismatch, missing Roadmap link, missing release, duplicate release, placeholder, empty authority section, or legacy SPEC-section error in the new documents.

## Remaining staging error classification

| Code                          | Count | Classification / owner                                                                                                                      |
| ----------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `BROKEN_LINK`                 |     2 | Expected Task 5 forward links from SEO prose to the required `ARCH-RENDER-001` anchor in the not-yet-created System Architecture authority. |
| `MISSING_DOCUMENT`            |     8 | Tasks 5–7: AI Coding, System Architecture, Database, API, Deployment, Engineering, Growth, and Traceability authorities.                    |
| `MISSING_CRITICAL_CONTRACT`   |     9 | Tasks 5–6 critical Architecture, Data, Engineering, and Growth contracts.                                                                   |
| `UNKNOWN_RELEASE_REQUIREMENT` |    43 | Tasks 5–6 Roadmap records whose owning requirement documents are intentionally not yet created.                                             |
| `MISSING_DERIVED_MANIFEST`    |     3 | Task 8 Kiro derivation.                                                                                                                     |
| `DERIVED_COVERAGE_MISSING`    |    75 | Task 8; each of three Kiro manifests must cover the 25 currently known MVP requirements.                                                    |
| `KIRO_REQUIREMENT_MISSING`    |    25 | Task 8 requirements derivation.                                                                                                             |
| `KIRO_COVERAGE_MISSING`       |    50 | Task 8 design and task coverage for 25 current MVP requirements.                                                                            |
| `MISSING_DESIGN_REQUIREMENTS` |    75 | Task 8 design-unit metadata migration.                                                                                                      |
| `MISSING_TASK_REQUIREMENTS`   |   121 | Task 8 task metadata migration.                                                                                                             |
| `MISSING_TASK_VERIFY`         |   121 | Task 8 task verification fields.                                                                                                            |
| `MISSING_TASK_EXPECTED`       |   121 | Task 8 task expected-result fields.                                                                                                         |
| `MISSING_TASK_EVIDENCE`       |   121 | Task 8 task evidence fields.                                                                                                                |

Total: 774 errors, all classified as required forward links or Tasks 5–8 work. The increased total from baseline is expected because 19 new MVP Active Hard requirements now correctly activate Kiro bidirectional coverage checks before Task 8.

## Concerns and boundary notes

1. Staging is intentionally not green. The two target-file errors are the required `ARCH-RENDER-001` forward links; removing them would violate Task 4, while defining their target would improperly perform Task 5.
2. The 43 remaining unknown release requirements, eight missing authority documents, nine critical contracts, trace absence, and all Kiro errors belong to Tasks 5–8 and were not modified.
3. `docs/11-Roadmap.md` was not edited. Release assignment remains solely in the existing registry; the new documents store only `roadmap_ref` and inline links.
4. No product implementation, infrastructure integration, Task 5 authority, Kiro derivation, or release-status cutover was performed.
5. ADR: none — no new architectural decision.

## Review-fix addendum — 2026-07-17

- Status: Task 4 review finding resolved; staging remains intentionally red for later tasks.
- Scope: Modified only `docs/01-Product-PRD.md` and appended this report; no Git operation or commit was attempted.

### Product PRD correction

`PRD-FR-003` now explicitly identifies Theme Park and Mountain as conditional city activity-suitability signals and forward-links [DATA-ACTIVITY-001](../../docs/06-Database.md#DATA-ACTIVITY-001) as their governing data contract. Its acceptance criteria require those signals and affected activity content to remain hidden when trustworthy supporting data is insufficient. The Product PRD does not duplicate the Database-owned weights, freshness, confidence, hazard, or model-version rules.

### Review-fix verification

```text
pnpm exec prettier --write docs/01-Product-PRD.md
exit 0
docs/01-Product-PRD.md 173ms (unchanged)
```

Prettier emitted the previously recorded `MODULE_TYPELESS_PACKAGE_JSON` warning for `prettier.config.js`; package configuration remains outside Task 4 and was not changed.

```text
pnpm docs:test
exit 0
59 tests, 59 pass, 0 fail
```

```text
node tooling/docs/validate-docs.mjs --mode staging
exit 1
Documentation validation: 775 error(s), 0 warning(s); 35 requirement(s), 78 release(s), 0 trace(s).
```

The validator error-code counts remain unchanged except for the required new Product-to-Database forward-link: `BROKEN_LINK` increased from 2 to 3 and the total increased from 774 to 775. The current broken links are:

| Source                    | Count | Classification / owner                                                                                                                                                 |
| ------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/01-Product-PRD.md`  |     1 | Expected Task 5 forward-link to `06-Database.md#DATA-ACTIVITY-001`; the target Database authority is not yet created.                                                  |
| `docs/03-SEO-Bible.md`    |     2 | Expected Task 5 forward-links to `05-System-Architecture.md#ARCH-RENDER-001`; the target System Architecture authority is not yet created.                             |
| **Current `BROKEN_LINK`** | **3** | All are required pre-creation forward-links; removing them would violate their product/SEO ownership contracts, while creating targets here would exceed Task 4 scope. |

All other staging classifications and counts remain as recorded above. Staging is expected to remain non-zero until later authority, traceability, and Kiro-derivation tasks create and connect their owned contracts.
