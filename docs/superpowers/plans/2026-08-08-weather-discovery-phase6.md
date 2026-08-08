# Where Not Rain — Phase 6: Weather Discovery 2.0

Date: 2026-08-08
Status: In Progress

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

Status: implemented on branch, awaiting CI.

### Slice B — Interactive discovery query

- New `/discover`, `/zh-cn/discover`, `/zh-hant/discover` routes.
- Exact 1–16 day date range.
- Batch existing weather-read API requests at max 12 cities per request.
- Snapshot consistency check across batches.
- Rain / temperature / wind limits.
- URL-persisted preferences.

Status: implemented on branch, awaiting CI.

### Slice C — Shortlist + comparison

- Up to four cities.
- URL-persisted shortlist.
- Intent score, rain, temperature, wind, UV and daily forecast comparison.
- Ranked list and MapLibre use the same result model.

Status: implemented on branch, awaiting CI.

### Slice D — Multi-city Trip creation

- Even contiguous allocation of selected dates across shortlist order.
- Create new local Trip or append to the existing workspace.
- Preserve existing single-city direct Add-to-Trip behavior.
- No POI generation in Phase 6.

Status: implemented on branch, awaiting CI.

### Slice E — hardening + release

- Complete party/theme context controls.
- EN / zh-CN / zh-Hant UX contract coverage.
- Accessibility/source contracts.
- Dedicated Preview/Production smoke.
- Production status record.

Status: pending.

## Definition of Done

- [ ] Seven intents are deterministic and tested.
- [ ] Exact dates and custom limits are shareable in URL state.
- [ ] Party/theme context influences ranking.
- [ ] Browser calls only the read-only weather service, never a weather provider.
- [ ] Weather requests respect 12-city / 16-day bounds.
- [ ] Multiple batches must use the same weather snapshot.
- [ ] Ranked list and map share one filtered/sorted result set.
- [ ] Up to four cities can be shortlisted.
- [ ] Shortlist comparison includes daily weather.
- [ ] Multi-city shortlist can create or append a Trip Workspace.
- [ ] Existing Discovery -> Trip direct action remains intact.
- [ ] EN / zh-CN / zh-Hant routes and copy complete.
- [ ] Format, lint, typecheck, unit/integration, docs and static export pass.
- [ ] Existing Preview smoke remains green.
- [ ] Dedicated Phase 6 Preview smoke passes.
- [ ] Production Deploy and Phase 6 Production smoke pass.
