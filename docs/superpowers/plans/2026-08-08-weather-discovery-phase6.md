# Where Not Rain — Phase 6: Weather Discovery 2.0

Date: 2026-08-08
Status: Production Acceptance

## Outcome

Turn weather discovery into the front door of the trip product:

**Exact dates -> weather intent -> optional limits -> ranked destinations + map -> shortlist -> side-by-side comparison -> multi-city Trip Workspace.**

Phase 6 reuses the already delivered direct single-city Discovery -> Trip action rather than rebuilding it.

## Delivery slices

### Slice A — Intent engine + contracts

- Seven deterministic intents.
- Stable reason codes.
- Missing-data confidence handling.
- Custom threshold parsing/serialization.
- Unit tests.

Status: implemented and CI-verified.

### Slice B — Interactive discovery query

- New `/discover`, `/zh-cn/discover`, `/zh-hant/discover` routes.
- Exact 1–16 day date range.
- Batch existing weather-read API requests at max 12 cities per request.
- Snapshot consistency check across batches.
- Rain / temperature / wind limits.
- URL-persisted preferences.

Status: implemented and Preview-verified.

### Slice C — Shortlist + comparison

- Up to four cities.
- URL-persisted shortlist.
- Intent score, rain, temperature, wind, UV and daily forecast comparison.
- Ranked list and MapLibre use the same result model.

Status: implemented and Preview-verified.

### Slice D — Multi-city Trip creation

- Even contiguous allocation of selected dates across shortlist order.
- Create new local Trip or append to the existing workspace.
- Preserve existing single-city direct Add-to-Trip behavior.
- No POI generation in Phase 6.

Status: implemented and CI-verified.

### Slice E — hardening + release

- Party/theme context controls and deterministic contextual scoring.
- EN / zh-CN / zh-Hant UX contract coverage.
- English Explorer plus Simplified/Traditional homepage discovery entry points.
- Accessibility/source contracts.
- Dedicated Preview/Production smoke.
- Production status record.

Status: Preview complete; dedicated Production Smoke pending final auditable record.

## Acceptance evidence so far

- Product PR #35 squash-merged as `a33caf1a7366e0c01fb2695703fbeff1b8c991ed`.
- Deploy Run 230 passed all repository gates and Preview deploy/regression checks for the product implementation.
- Dedicated Phase 6 Preview Smoke Run 10 passed.
- Phase 5 Preview Weather Intelligence regression passed after eliminating duplicate concurrent preview sync from Phase 6 smoke.
- Production Deploy Run 232 passed for exact product SHA `a33caf1a7366e0c01fb2695703fbeff1b8c991ed`.
- Production Product Smoke and Collaboration Smoke passed on that product release.
- A follow-up no-behavior production acceptance run is intentionally triggered now because the Phase 6 `workflow_run` verifier was first introduced by the same product merge and therefore did not receive that already-started Deploy completion event.

## Definition of Done

- [x] Seven intents are deterministic and tested.
- [x] Exact dates and custom limits are shareable in URL state.
- [x] Party/theme context influences ranking.
- [x] Browser calls only the read-only weather service, never a weather provider.
- [x] Weather requests respect 12-city / 16-day bounds.
- [x] Multiple batches must use the same weather snapshot.
- [x] Ranked list and map share one filtered/sorted result set.
- [x] Up to four cities can be shortlisted.
- [x] Shortlist comparison includes daily weather.
- [x] Multi-city shortlist can create or append a Trip Workspace.
- [x] Existing Discovery -> Trip direct action remains intact.
- [x] EN / zh-CN / zh-Hant routes and copy complete.
- [x] Format, lint, typecheck, unit/integration, docs and static export pass.
- [x] Existing Preview smoke remains green.
- [x] Dedicated Phase 6 Preview smoke passes.
- [ ] Production Deploy and dedicated Phase 6 Production smoke pass with an auditable status record.
