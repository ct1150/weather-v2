# Task 5 Report

## Status

- **Task 5 scope complete.** Created only the four requested Draft / Non-authoritative authorities:
  - `docs/05-System-Architecture.md`
  - `docs/06-Database.md`
  - `docs/07-API-Spec.md`
  - `docs/08-Cloudflare-Deployment.md`
- Defined exactly 25 fixed `Active` / `Hard` requirements: Architecture 8, Database 7, API 5, Deployment 5. Every requirement has the exact deterministic `roadmap_ref`, inline Roadmap link, explicit anchor, and Acceptance Criteria.
- Architecture contains the single route rendering matrix with all seven approved rows and owns provider-only Cron flow, KV → D1 → stale reads, snapshot activation, versioned keys, D1 lock semantics, fallback, cache behavior, and R2 optionality.
- Database contains all D1 schema and score contracts: 24 table definitions, indexes/migration rules, the deterministic general/theme score model, and complete Theme Park/Mountain weather/destination formulas, mappings, maximum hazard rule, 2-hour/90-day/24-hour freshness, `0.8` thresholds, hidden/ranking-exclusion behavior, and model-version/ADR rule.
- API preserves the `/api/v1/compare?cityA=&cityB=&window=` shape while explicitly identifying Compare as a Beta capability. It also defines v1 envelopes, request IDs, ISO dates, stable errors, validation, parameterized D1 access, compact map payloads, internal authentication, CORS, and cache-cardinality controls.
- Deployment defines a Cloudflare-only, free-plan-compatible core; GA4/Plausible as disabled, removable external adapters; Pages-first deployment; Workers fallback only with compatibility evidence, an Accepted ADR, and Product Owner approval; all 15 exact config patterns; preview/production smoke checks; explicit migrations; Cron; rollback; and current-quota review.
- Product and SEO forward links now close: Product → `DATA-ACTIVITY-001` is 1/1; SEO → `ARCH-RENDER-001` is 2/2.
- No Task 6 work, product implementation, infrastructure integration, Roadmap edit, Kiro edit, or Git commit was performed. ADR: none — no new architectural decision.

## Verification

- `pnpm exec prettier --write docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md docs/08-Cloudflare-Deployment.md` — exit 0; all four unchanged on the final run.
- `pnpm exec prettier --check docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md docs/08-Cloudflare-Deployment.md` — exit 0; all matched files use Prettier style.
- `pnpm docs:test` — exit 0; 59 tests, 59 pass, 0 fail.
- Task 5 semantic audit — exit 0:
  - 25/25 exact IDs and Active/Hard metadata.
  - 25/25 unique Roadmap records, exact refs/links, anchors, and Acceptance Criteria.
  - 7/7 approved rendering rows and one rendering matrix.
  - 24/24 expected table schemas in Database and no schema copies in the other Task 5 authorities.
  - General/theme/Theme Park/Mountain formulas and all required freshness, confidence, hazard, hidden-score, and version rules present.
  - Compare shape retained and marked Beta; all 15 deployment config patterns present.
  - Product/SEO forward-link counts and target anchors resolved.
- `node tooling/docs/validate-docs.mjs --mode staging` — expected exit 1: `878 error(s), 0 warning(s); 60 requirement(s), 78 release(s), 0 trace(s)`. Errors targeting the four Task 5 files: **0**.
- Locked source verified unchanged: `weather.txt` is 1,476 lines with SHA-256 `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`. Roadmap SHA-256 remains `927dbc9ff85974f6059043bb78a6ad70a022765094c76c1002f661cdbd9a4963`.

Staging error classification:

| Error code                    |   Count | Classification                                                                               |
| ----------------------------- | ------: | -------------------------------------------------------------------------------------------- |
| `MISSING_DOCUMENT`            |       4 | Later tasks: AI Coding, Engineering, Growth, and Traceability authorities                    |
| `MISSING_CRITICAL_CONTRACT`   |       6 | Task 6 Engineering/Growth audited contracts                                                  |
| `UNKNOWN_RELEASE_REQUIREMENT` |      18 | Task 6 Agent/Engineering/Growth requirements not created yet                                 |
| `MISSING_DERIVED_MANIFEST`    |       3 | Task 8 Kiro derivation                                                                       |
| `DERIVED_COVERAGE_MISSING`    |     144 | Task 8 Kiro manifest coverage                                                                |
| `KIRO_REQUIREMENT_MISSING`    |      48 | Task 8 derived requirements coverage                                                         |
| `KIRO_COVERAGE_MISSING`       |      96 | Task 8 derived design/task coverage                                                          |
| `MISSING_DESIGN_REQUIREMENTS` |      75 | Task 8 Kiro design metadata                                                                  |
| `MISSING_TASK_REQUIREMENTS`   |     121 | Task 8 Kiro task metadata                                                                    |
| `MISSING_TASK_VERIFY`         |     121 | Task 8 Kiro task verification commands                                                       |
| `MISSING_TASK_EXPECTED`       |     121 | Task 8 Kiro task expected results                                                            |
| `MISSING_TASK_EVIDENCE`       |     121 | Task 8 Kiro task evidence                                                                    |
| **Total**                     | **878** | All errors are classified as later Task 6–8 work; none target Task 5 files or forward links. |

## Concerns

- Staging is intentionally not green until Tasks 6–8 create the remaining authorities, traceability, and Kiro-derived materials; this Task must not perform that work.
- Prettier emits the repository's existing `MODULE_TYPELESS_PACKAGE_JSON` warning for `prettier.config.js`. It does not affect formatting or test results, and package configuration is outside Task 5.
- All four authorities remain Draft / Non-authoritative. `SPEC.md` remains the sole implementation authority until controlled cutover; this workspace must not be used to start product implementation.

## Review Fix Addendum — 2026-07-17

### Status and corrected inventory

- Resolved every Critical and Important finding in `task-5-review.md` using the binding decisions supplied for this fix.
- Modified only `docs/05-System-Architecture.md`, `docs/06-Database.md`, and `docs/07-API-Spec.md`; `docs/08-Cloudflare-Deployment.md` required no link change and was not modified.
- This addendum supersedes the earlier report's semantic completeness claim. Database now contains **26** table definitions rather than 24 because the fix adds the authoritative `active_weather_snapshot` singleton pointer and verified `city_theme_attributes` storage.
- No product code, Roadmap, Kiro artifact, deployment authority, infrastructure integration, or Git commit was created or modified.

### Pre-fix red evidence

A one-off static semantic regression check was run before edits. It exited `1` with **0/15** checks passing. The failures covered all review gaps: snapshot-scoped summary/ranking/map keys; KV manifest and publication order; three confidence equations; cross-year season handling; exact volatility formula; exact Other mappings; unknown-parameter HTTP 400 behavior; stable error/status mapping; and endpoint-specific parameter/cache contracts.

### Implemented review fixes

1. **Safe publication and recovery:** every weather-derived summary, forecast, ranking, map, and Compare key now contains `snapshotId`. A fully validated candidate is written to immutable high-entropy keys and checksum-verified before one D1 transaction updates status and the singleton active pointer. Only after commit does the publisher replace the small `v1:manifest:active` pointer. An old manifest remains safe; a manifest or referenced-key miss consults only D1 active data and never probes pending, guessed, or arbitrary old KV keys.
2. **Unique score reproduction:** Database now defines exact weather, destination, and combined confidence equations and both `>= 0.8` gates; year-round/inclusive/14-day/outside/cross-year season precedence; Today, Tomorrow, Weekend, Next Week, and multi-day date sets; complete `08:00..22:00` hourly selection with deterministic daily fallback; population standard deviation and capped volatility; and exact Beach, Photography, Night View, Food Trip, and Shopping Other sources with missing-data hiding.
3. **Contract-testable API:** all nine endpoints list exhaustive allowed parameters, defaults, enums, grammars, and numeric/cardinality bounds. Unknown, duplicate, empty, bracketed, and excessive parameters return `INVALID_PARAMETER`/HTTP 400 before cache or storage. A stable error-to-status table covers 400/401/403/404/405/429/500/503. Every endpoint/result has exact `Cache-Control`, validator, and canonical cache-key behavior; weather cache keys contain resolved `snapshotId`; search, internal/authenticated/preview/personalized, and every error response are exactly `private, no-store` with no `ETag`.

### Post-fix verification

- Identical semantic regression check — exit `0`, **15/15** checks pass.
- `pnpm exec prettier --write docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md` — exit `0`.
- `pnpm exec prettier --check docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md` — exit `0`; all matched files use Prettier style. The pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains outside Task 5 scope.
- `pnpm docs:test` — exit `0`; **59 tests, 59 pass, 0 fail**.
- Independent static audit — exit `0`: **4/4** required KV key families snapshot-scoped, publication order verified, unsafe legacy keys/ambiguous clauses absent, all equations and edge cases present, **9/9** endpoint parameter/cache contracts present, and the corrected **26-table** inventory confirmed.
- Non-Git scope audit — exit `0`: only `docs/05-System-Architecture.md`, `docs/06-Database.md`, and `docs/07-API-Spec.md` changed under `docs` after task start; the deployment authority mtime predates task start.
- `node tooling/docs/validate-docs.mjs --mode staging` — expected exit `1`: **878 errors, 0 warnings; 60 requirements, 78 releases, 0 traces**. Error lines targeting `docs/05-System-Architecture.md`, `docs/06-Database.md`, `docs/07-API-Spec.md`, or `docs/08-Cloudflare-Deployment.md`: **0**. The 878 residual errors remain the already classified Task 6–8 missing-document, traceability, and Kiro-derivation work.

### Remaining constraints

All four authorities remain Draft / Non-authoritative, and `SPEC.md` remains authoritative until controlled cutover. This documentation fix does not authorize product implementation or live integration.

## Re-review Fix Addendum — Round 2 — 2026-07-17

### Scope and pre-fix evidence

- Read `task-5-review.md` including all Re-review findings, `task-5-brief.md`, the existing 05/06/07 authorities, and this report before editing.
- Modified only `docs/05-System-Architecture.md`, `docs/06-Database.md`, and `docs/07-API-Spec.md`; this section is append-only report evidence. No Git operation or commit was performed.
- The pre-edit semantic regression command exited `1` with **0/15** checks passing. It detected every requested gap: ranking/map dual-version identity, manifest binding, maintenance conditional publication, frozen activation coverage, active-pointer constraints, raw-factor formulas, visibility storage, exact combined factors and Beach attributes, banned ambiguity, and nine endpoint-specific success schemas.

### Re-review fixes

1. **Snapshot and ranking publication identity:** ranking and map KV/API cache keys now bind `snapshotId + rankingVersion`; `v1:manifest:active` points to both plus `modelVersion` and `publishedAt`. Sync validates immutable keys before activation. Maintenance generates and checksum-validates a complete new ranking/map generation for the current active snapshot, acquires the D1 publication lock shared with sync, rechecks that the snapshot is still solely active, and atomically replaces only the manifest key. A race cannot restore a superseded snapshot.
2. **Activation coverage and pointer integrity:** the run-start transaction freezes enabled cities and featured membership. Seven-day validity is seven consecutive city-local daily rows beginning at the run-start local date, each able to derive all eight weather factors. Activation requires `|E| > 0`, `100 * |V| >= 95 * |E|`, and `F subset-of V`. Database schema now includes `CHECK (pointer_key = 'weather')`, a partial unique active-status index, three active-pointer/status triggers, and the exact `BEGIN IMMEDIATE` activation transaction/assertion order. `sync_run_city_scope` raises the Database inventory from 26 to **27** table definitions.
3. **Deterministic scoring inputs:** hourly and daily visibility are stored. Rain, temperature, comfort, humidity, wind, UV, cloud, and visibility now have complete clamped piecewise formulas with every inclusive boundary and invalid-input rule. Daily/hourly raw selection and nighttime derivation are exact. Comfort/Humidity, Cloud/Visibility, and Other values are mapped for every theme. Beach water and season, Food Trip, and Shopping values come only from fresh qualified `city_theme_attributes`; a missing/invalid critical non-weather row hides the theme. The authority contains no `optionally`, `either/or`, `二选一`, or `such as` phrase.
4. **Nine exact public success contracts:** Rankings, Country, City, Forecast, Hourly, Map, Search, Compare, and Articles each define a field-level `data` schema with required properties, explicit nullable types, array ordering/cardinality, cursor rules, snapshot/ranking/model identity, freshness, and endpoint invariants. Map markers have one exhaustive compact field set and no hourly/daily payload. The empty success `data` example was removed. Ranking/map validators and canonical shared-cache keys include both immutable versions.

### Verification

- Post-fix semantic regression — exit `0`, **17/17** checks pass; post-format focused audit — exit `0`, **10/10** checks pass.
- `pnpm exec prettier --write docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md` — exit `0`.
- `pnpm exec prettier --check docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md` — exit `0`; all matched files use Prettier style. The existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains outside Task 5 scope.
- `pnpm docs:test` — exit `0`; **59 tests, 59 pass, 0 fail**.
- SQLite execution smoke test over all Database SQL blocks — exit `0`: **8 SQL blocks, 27 tables, 14 explicit indexes, 3 triggers**.
- TypeScript syntax check over all API schema blocks — exit `0`: **11 blocks, 0 syntax errors**.
- `node tooling/docs/validate-docs.mjs --mode staging` — expected exit `1`: **878 errors, 0 warnings; 60 requirements, 78 releases, 0 traces**; error lines targeting 05/06/07: **0**. Classification remains `DERIVED_COVERAGE_MISSING:144`, `KIRO_COVERAGE_MISSING:96`, `KIRO_REQUIREMENT_MISSING:48`, `MISSING_CRITICAL_CONTRACT:6`, `MISSING_DERIVED_MANIFEST:3`, `MISSING_DESIGN_REQUIREMENTS:75`, `MISSING_DOCUMENT:4`, `MISSING_TASK_EVIDENCE:121`, `MISSING_TASK_EXPECTED:121`, `MISSING_TASK_REQUIREMENTS:121`, `MISSING_TASK_VERIFY:121`, and `UNKNOWN_RELEASE_REQUIREMENT:18`; these are the unchanged Task 6–8 gaps.

All four Task 5 authorities remain Draft / Non-authoritative, and `SPEC.md` remains authoritative until controlled cutover.

## Final Re-review Fix Addendum — Round 3 — 2026-07-17

### Scope and red evidence

- Read the complete `task-5-review.md`, including Final re-review findings, `task-5-brief.md`, the full existing 05/06/07 authorities, and this report before editing.
- Modified only `docs/05-System-Architecture.md`, `docs/06-Database.md`, and `docs/07-API-Spec.md`; this report section is append-only. No Git operation or commit was performed.
- The pre-edit semantic regression exited `1` with **0/16** checks passing. It reproduced every final finding: no monotonic publication fence, KV-first uncached identity selection, no stale-holder rejection, unconditional pointer singleton, no score/alert provenance, incomplete map bounds identity, stale-by-TTL/publication semantics, and underspecified request-ID behavior.

### Final re-review fixes

1. **Fenced D1 publication identity:** `sync_locks` now retains a monotonic `fencing_token`; each successful acquisition increments it, release/expiry never resets it, and sync/maintenance activation transactions require the captured holder/token/lease. Every CDN miss first reads D1 active publication identity and the current token high-water mark. `v1:manifest:active` is only a hint and is accepted only on an exact five-field D1 match. Delayed lower-token KV writes from old holders cannot become effective.
2. **Truthful bootstrap pointer invariant:** the fixed-key `weather_publication_state` begins irreversibly at `bootstrapped = 0`, where the pointer count is zero. The sole bootstrap transaction creates the fixed pointer and advances state to `1`; post-bootstrap replacements update that row rather than deleting it. Schema keys/indexes guarantee at-most-one, irreversible/delete-protection triggers protect state, and the unique repository transaction protocol guarantees post-bootstrap exactly-one without claiming arbitrary SQL can enforce every cross-table commit assertion.
3. **Reproducible score hazards:** `city_scores` now persists anchor local date, `as_of`, exact included dates, hourly/daily/mixed source row keys and UTC range, score and hazard model versions, and the alert snapshot. New normalized `weather_alert_snapshots`/`weather_alerts` tables freeze alert inputs. Hourly and city-local-day half-open intervals use the exact strict overlap predicate, with deterministic numeric hazard source rows and maximum-only penalties.
4. **Canonical map identity:** bounds use an exact six-decimal canonical form and SHA-256 hash; Web Mercator tile selection, ordered tile IDs, tile-set hash, and derived `mapRegionKey` are specified. The payload and canonical shared-cache key contain the same bounds/region/tile identity.
5. **Freshness and request IDs:** `stale` is true only when `now - dataUpdatedAt > WEATHER_DATA_MAX_AGE_MINUTES * 60 seconds`; equality is fresh and publication/cache/fallback state does not alter it. `X-Request-ID` propagates only a single valid `8..128` value matching `[A-Za-z0-9_-]+`, otherwise generates UUIDv4, and is returned on every `2xx`/`3xx`/`4xx`/`5xx` response, including bodyless `304`, without entering cache identity.

### Verification

- Identical post-fix semantic regression — exit `0`, **16/16** checks pass; final post-format rerun also **16/16**.
- `pnpm exec prettier --write docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md` — exit `0`.
- `pnpm exec prettier --check docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md` — exit `0`; all matched files use Prettier style. The pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains outside Task 5 scope.
- `pnpm docs:test` — exit `0`; **59 tests, 59 pass, 0 fail**.
- SQLite execution smoke over every Database SQL fence — exit `0`: **8 blocks, 30 tables, 15 explicit indexes, 8 triggers**.
- TypeScript syntax smoke over every API `ts` fence — exit `0`: **11 blocks, 0 syntax errors**.
- `node tooling/docs/validate-docs.mjs --mode staging` — expected exit `1`: **878 errors, 0 warnings; 60 requirements, 78 releases, 0 traces**; error lines targeting 05/06/07: **0**. Residual classifications are unchanged later-task work: `DERIVED_COVERAGE_MISSING:144`, `KIRO_COVERAGE_MISSING:96`, `KIRO_REQUIREMENT_MISSING:48`, `MISSING_CRITICAL_CONTRACT:6`, `MISSING_DERIVED_MANIFEST:3`, `MISSING_DESIGN_REQUIREMENTS:75`, `MISSING_DOCUMENT:4`, `MISSING_TASK_EVIDENCE:121`, `MISSING_TASK_EXPECTED:121`, `MISSING_TASK_REQUIREMENTS:121`, `MISSING_TASK_VERIFY:121`, and `UNKNOWN_RELEASE_REQUIREMENT:18`.

All Task 5 authorities remain Draft / Non-authoritative, and `SPEC.md` remains authoritative until controlled cutover.

## Final Two Findings Fix Addendum — Round 4 — 2026-07-17

### Status and scope

- Resolved the final two findings in `task-5-review.md` in the final 06/07 authority state. Scope remained restricted to `docs/06-Database.md` and `docs/07-API-Spec.md`, plus this append-only report section; no product code, Roadmap, Kiro artifact, deployment document, Git operation, or commit was performed.
- `docs/06-Database.md` already contained the requested complete `activity_scores` provenance in the current retry workspace, so it was verified rather than rewritten: anchor local date, `as_of`, exact included dates, canonical weather source row keys, inclusive/exclusive UTC source range, normalized alert snapshot, activity score model, hazard model, immutable destination identity, binding rules, rejection AC, and full recalculation AC. Prettier reported 06 unchanged.
- `docs/07-API-Spec.md` was the only authority requiring a content edit in this retry.

### Semantic red/green evidence

- Before the 07 edit, the one-off non-persisted semantic regression exited `1` with **4/12** checks passing. All four Database provenance checks passed; all eight API checks failed: immutable CoreData-only internal caching, per-request D1 identity/core parsing, dynamic stale/request metadata assembly, ETag exclusion, universal final no-store, post-core 304 behavior, separated endpoint table columns, and removal of public shared-envelope directives.
- After the edit, the identical contract intent check exited `0` with **12/12** checks passing. The post-format rerun also exited `0` with **12/12**.

### Final fixes

1. **Complete activity-score provenance:** `activity_scores` persists `anchor_local_date`, `as_of`, canonical `included_dates_json`, hourly/daily/mixed source kind, every suitability/numeric-hazard weather row key, the minimum-inclusive/maximum-exclusive UTC range, `alert_snapshot_id`, activity `model_version`, and `hazard_model_version`. Exact same-snapshot alert binding, immutable destination identity, DST-aware range derivation, no source substitution, provenance rejection fixtures, and deterministic recalculation/ranking-eligibility AC are explicit.
2. **Strict two-layer API:** internal KV/Cache API stores only immutable, schema-parsed `CoreData`, never an envelope, headers, request ID, generation time, or any derived stale boolean. Every public request validates inputs, resolves authoritative D1 identity, derives the identity-bound core key, parses and identity-checks the core, and only then computes stale and assembles request-specific wire data/meta.
3. **Stable core-only validators and safe conditional reads:** `ETag` is exactly the weak hash of canonical `{ identity, coreData }`; `requestId`, `generatedAt`, request time, and every `stale` value are excluded. `If-None-Match` runs only after D1 identity validation and successful core parsing. A match returns bodyless `304` with the current request's `X-Request-ID`, matching ETag, `Vary: Accept-Encoding`, and `Cache-Control: private, no-store`.
4. **No shared final envelopes:** every final success envelope, stale or fresh, is `private, no-store`; errors and bodyless responses use the same policy. The endpoint table now separately lists all nine endpoints' internal CoreData TTL, exact `core:v1:*` key (or disabled), response validator, and final HTTP Cache-Control. There is no stale response-cache override and no public `s-maxage` directive.

### Verification

- `pnpm exec prettier --write docs/06-Database.md docs/07-API-Spec.md` — exit `0`; 06 unchanged and 07 formatted. The repository's existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains outside Task 5 scope.
- `pnpm exec prettier --check docs/06-Database.md docs/07-API-Spec.md` — exit `0`; all matched files use Prettier style.
- Final Task5 semantic regression — exit `0`, **12/12** checks pass after formatting.
- `pnpm docs:test` — exit `0`; **59 tests, 59 pass, 0 fail**.
- `node tooling/docs/validate-docs.mjs --mode staging` — expected exit `1`: **878 errors, 0 warnings; 60 requirements, 78 releases, 0 traces**; error lines targeting `docs/06-Database.md` or `docs/07-API-Spec.md`: **0**. Residual failures remain the previously classified Task 6–8 missing authorities, traceability, and Kiro-derived metadata/evidence.

### Concerns

- Staging intentionally remains red until Tasks 6–8; this fix does not expand scope to those artifacts.
- All Task 5 authorities remain Draft / Non-authoritative, and `SPEC.md` remains authoritative until controlled cutover.

### Post-addendum review note

- Final contract review removed one sequencing ambiguity: after D1 identity verification and CoreData parsing, the resolver computes ETag and handles a matching bodyless `304`; only a non-match proceeds to dynamic stale calculation and envelope generation.
- The semantic regression was expanded with this ordering assertion and exited `0` with **13/13** checks passing. Fresh reruns also produced: Prettier check exit `0`, docs tests **59/59**, and the expected staging result of **878 errors / 0 warnings** with **0** errors targeting 06/07.

## Closure Alignment Addendum — Round 5 — 2026-07-17

### Status and scope

- Resolved both Closure alignment findings in `task-5-review.md` after reading the complete review, `docs/05-System-Architecture.md`, `docs/07-API-Spec.md`, and this report.
- Authority edits were restricted to `docs/05-System-Architecture.md` and `docs/07-API-Spec.md`; this section is append-only report evidence. No Database, Deployment, Roadmap, Kiro, product-code, infrastructure, or other authority file was edited.
- No Git operation or commit was performed.

### Closure alignment changes

1. **Explicit CDN boundary:** Architecture now permits a direct CDN hit only for static assets and SSG/ISR HTML. A `/api/v1` request always reaches the application use case; a CDN never directly returns a final API envelope or substitutes a deployed static artifact for one.
2. **Per-request API assembly:** Every API read captures request identity/time, reads D1 authoritative publication/content identity first, derives the identity-bound key, reads and validates worker-populated immutable KV `CoreData` or falls back to D1-active/content-authoritative rows, then computes validators/freshness and dynamically assembles the request-specific envelope. Final envelopes, errors, and bodyless responses remain `private, no-store`.
3. **Worker-only storage mutation:** Authorized background workers alone publish immutable KV `CoreData`. User/API paths never put, delete, repair, or backfill KV and do not use the ephemeral Cache API for CoreData or final API responses. On a miss, requests continue reading D1-authoritative data until worker publication is repaired; they do not enqueue request-path repair.
4. **Worker-owned TTL contract:** API TTL prose and the endpoint table now identify worker-owned KV TTLs and worker-populated immutable keys. `0 (disabled)` means no worker-published endpoint core key and no API internal-KV lookup. The old `optionally store`, `KV/Cache API`, and `two cache layers` request-path storage wording was removed, and Acceptance Criteria separately verify worker publication contents and zero API storage mutation.

### Verification

- `pnpm exec prettier --write docs/05-System-Architecture.md docs/07-API-Spec.md` — exit `0`; both files formatted. The repository's existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains outside Task 5 scope.
- Closure alignment semantic regression — exit `0`, **15/15** checks pass: direct-CDN scope, mandatory per-request API resolution, worker-only immutable KV publication, D1 fallback without backfill, worker-owned TTL terminology, final `private, no-store`, and removal of the three legacy storage phrases.
- `pnpm docs:test` — exit `0`; **59 tests, 59 pass, 0 fail**.
- `node tooling/docs/validate-docs.mjs --mode staging` — expected exit `1`: **878 errors, 0 warnings; 60 requirements, 78 releases, 0 traces**. Error lines targeting `docs/05-System-Architecture.md` or `docs/07-API-Spec.md`: **0**. Residual errors remain the previously classified Task 6–8 missing authorities, audited contracts, traceability, and Kiro-derived manifests/coverage/task metadata.

All Task 5 authorities remain Draft / Non-authoritative, and `SPEC.md` remains authoritative until controlled cutover.
