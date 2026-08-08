# Where Not Rain — Phase 6: Weather Discovery 2.0

Date: 2026-08-08
Status: Complete

## Outcome

Weather discovery is now the front door of the trip product:

**Exact dates -> weather intent -> optional limits -> ranked destinations + map -> shortlist -> side-by-side comparison -> multi-city Trip Workspace.**

Phase 6 reuses the already delivered direct single-city Discovery -> Trip action rather than rebuilding it.

## Delivered

### Slice A — Intent engine + contracts

- Seven deterministic intents: dry, outdoor, beach, cool escape, warm escape, family comfort and senior comfort.
- Stable reason codes.
- Missing-data confidence handling.
- Custom threshold parsing/serialization.
- Deterministic unit coverage.

### Slice B — Interactive discovery query

- `/discover`, `/zh-cn/discover`, `/zh-hant/discover`.
- Exact 1–16 day date range.
- Existing weather-read API requests batched at max 12 cities per request.
- Cross-batch snapshot consistency check.
- Rain / temperature / wind limits.
- URL-persisted preferences.

### Slice C — Shortlist + comparison

- Up to four cities.
- URL-persisted shortlist.
- Intent score, rain, temperature, wind, UV and daily forecast comparison.
- Ranked list and MapLibre use the same result model.
- Party and trip-theme context deterministically reweights the same weather facts.

### Slice D — Multi-city Trip creation

- Even contiguous allocation of selected dates across shortlist order.
- Create a new local Trip or append to the existing workspace.
- Existing single-city direct Add-to-Trip behavior preserved.
- No POI generation; city/day scaffolding only.

### Slice E — hardening + release

- EN / zh-CN / zh-Hant UX contract coverage.
- English Explorer plus Simplified/Traditional homepage discovery entry points.
- Provider-isolation/source contracts.
- Dedicated Preview and Production smoke.
- Auditable production status record.

## Acceptance evidence

- Product PR #35 squash-merged as `a33caf1a7366e0c01fb2695703fbeff1b8c991ed`.
- Deploy Run 230 passed format, lint, library build, typecheck, unit/integration tests, documentation gate, Next.js static export, Worker builds, pipeline contract tests, immutable artifact, secret scan, Preview Worker/D1/Trip smoke and Pages deployment.
- Dedicated Phase 6 Preview Smoke Run 10 passed.
- Phase 5 Preview Weather Intelligence regression passed after eliminating duplicate concurrent preview sync from Phase 6 smoke.
- Production Deploy Run 232 passed for exact product SHA `a33caf1a7366e0c01fb2695703fbeff1b8c991ed`.
- Production Product Smoke and Collaboration Smoke passed on that product release.
- Dedicated Phase 6 Production acceptance passed and is persisted in `PHASE6_DISCOVERY_SMOKE_STATUS.md`.

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
- [x] Production Deploy and dedicated Phase 6 Production smoke pass with an auditable status record.
