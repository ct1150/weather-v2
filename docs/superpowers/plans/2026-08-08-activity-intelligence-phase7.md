# Where Not Rain — Phase 7: Activity / POI Intelligence

Date: 2026-08-08
Status: Complete

## Outcome

Phase 7 gives the itinerary a structured activity model that deterministic weather intelligence can reason about safely:

**Legacy activity text -> Workspace v2 structured activities -> attributed POI metadata -> concrete lower-weather-risk Plan B -> Cloud Trip revision visibility.**

No activity is silently replaced. Fixed and reservation constraints remain explicit user-controlled boundaries for Phase 8 adaptive replanning.

## Delivered

### Workspace v2 + compatibility

- Workspace v1 remains a readable input contract; normalization upgrades compatible input to v2.
- Blank, template and Markdown creation paths create structured `activityItems` immediately.
- `activities: string[]` remains the portable compatibility projection.
- URL shares serialize the lightweight portable projection and deterministically upgrade to v2 when opened.
- Markdown import/export and existing Cloud Trip documents remain compatible.

### Cloud Trip support

- server validation accepts v1/v2 and rejects malformed structured activities fail-closed;
- immutable revision snapshots persist Workspace v2 documents;
- revision diff exposes `day.activityItems` independently from compatibility text.

### Structured activity / POI intelligence

- structured editor shipped in EN / zh-CN / zh-Hant;
- activity fields cover time, category, indoor/outdoor/mixed environment, weather sensitivities, flexibility, reservation, priority, POI identity and alternatives;
- pilot catalogue covers Tokyo, Kyoto, Osaka, Seoul, Jeju, Bangkok and Phuket;
- automated quality gate requires at least 50 POIs per pilot city, valid coordinates, localization, unique IDs and supported provenance;
- committed POI data combines a curated high-confidence base with a reviewed OpenStreetMap-derived immutable snapshot;
- visible `© OpenStreetMap contributors · ODbL` attribution is rendered in the POI experience;
- the Overpass generator is maintenance-only and is not part of runtime/build/deploy.

### Concrete Plan B

- daily weather can identify activity-level rain, wind, heat, cold and UV impact;
- lower-weather-risk indoor alternatives are suggested where curated data exists;
- fixed/required-reservation activities are explicitly protected;
- applying a fallback requires user action;
- missing POI data falls back to the existing generic recommendation.

## Acceptance evidence

### Preview

- Product PR #36 final acceptance head: `fed699c00655157af4566fe897d4be22ee1823e1`.
- Deploy Run 267: format, lint, library build, typecheck, unit/integration, docs, static export, all Worker builds, pipeline contracts, artifact identity, secret scan, Preview D1/Workers/Trip API/Pages and existing Preview smoke all passed.
- Phase 5 Weather Intelligence Preview regression Run 62: success.
- Phase 6 Weather Discovery Preview regression Run 71: success.
- Dedicated Phase 7 Preview Run 27: success, including Workspace v2 Cloud create/update, structured persistence, `day.activityItems` revision diff and malformed-v2 rejection.

### Production

- Product PR #36 squash-merged as release `3345aac2bf2bc97be8ff2697636c97669b190bf1`.
- Production Deploy Run 268: success for the exact release SHA.
- Production D1 migrations/seeding, weather-sync + Cron, protected weather refresh, weather-read, Trip D1/Trip API, Better Auth migration, Trip API production smoke, Pages production deploy, IndexNow and final freshness/Cron smoke: success.
- Production Product Smoke: success for the exact release SHA.
- Phase 5 Weather Intelligence Production Smoke: success for the exact release SHA.
- Dedicated Phase 7 Activity Intelligence Production Smoke: success for the exact release SHA, including Workspace v2 create/update, structured persistence, revision history/diff and malformed-v2 rejection.

## Definition of Done

- [x] Workspace v2 schema is versioned and v1 normalization is safe.
- [x] v1 -> v2 migration is deterministic and lossless for portable activity text.
- [x] Existing share/import/Markdown/cloud trips remain readable.
- [x] All v2 creation paths produce structured activity data.
- [x] Cloud Trip validates and persists Workspace v2.
- [x] Revision diff exposes structured activity changes.
- [x] Structured activity editor works in EN / zh-CN / zh-Hant.
- [x] Seven pilot cities have attributed POI catalogues.
- [x] POI catalogue reaches at least 50 records per pilot city under automated quality gates.
- [x] OpenStreetMap-derived POI data is visibly attributed.
- [x] Fixed/movable/flexible and reservation constraints persist.
- [x] Weather-sensitive activities receive concrete Plan B candidates when data exists.
- [x] Fixed/reservation activities are never silently moved.
- [x] Missing POI data degrades to the generic recommendation.
- [x] Format, lint, typecheck, unit/integration, docs and static export pass.
- [x] Existing Preview regressions remain green.
- [x] Dedicated Phase 7 Preview smoke passes.
- [x] Production Deploy and dedicated Phase 7 Production smoke pass with auditable evidence.
