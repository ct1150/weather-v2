# Where Not Rain — Phase 7: Activity / POI Intelligence

Date: 2026-08-08
Status: Preview Acceptance

## Outcome

Give the itinerary a structured activity model that weather intelligence can reason about safely:

**Legacy activity text -> Workspace v2 structured activities -> attributed POI metadata -> concrete lower-weather-risk Plan B -> Cloud Trip revision visibility.**

Phase 7 does not silently replace itinerary activities. It builds the data and UX foundation required for Phase 8 adaptive replanning.

## Compatibility strategy

- Workspace v1 remains a readable input contract.
- `normalizeWorkspace` upgrades compatible input to Workspace v2.
- All v2 creation paths (blank, template, Markdown import) create structured `activityItems` immediately.
- `activityItems` is the structured v2 representation.
- `activities: string[]` remains the portable compatibility projection for Markdown/export and legacy editing.
- URL shares intentionally serialize the lightweight portable projection and deterministically upgrade to v2 when opened, avoiding structured metadata inflation of the existing share-size budget.
- Cloud Trip validation accepts both v1 and v2 during migration.
- No D1 schema migration is required because trip documents/revisions are immutable JSON documents.

## Slice A — Workspace v2 + migration contract

Delivered:

- structured `TripActivity` model;
- deterministic legacy text -> structured activity conversion;
- time/category/environment/flexibility/reservation inference rules;
- Workspace v2 normalization while retaining v1 input compatibility;
- blank/template/Markdown creation paths produce valid v2 activity data;
- structured -> legacy text projection;
- portable URL-share projection with v2 decode/upgrade;
- local/share/Markdown compatibility tests.

## Slice B — Cloud Trip validation + revision support

Delivered:

- server accepts v1 and structured v2 trip documents;
- bounded document limit supports the structured representation;
- structured activity validation remains fail-closed;
- revision diff includes `day.activityItems` independently from compatibility `day.activities`;
- tests cover malformed v2 data and structured revision change visibility.

## Slice C — Pilot POI catalogue

Delivered for:

- Tokyo
- Kyoto
- Osaka
- Seoul
- Jeju
- Bangkok
- Phuket

The catalogue combines a manually curated high-confidence base with an attributed OpenStreetMap-derived snapshot. Every surfaced POI has a stable ID, city ID, coordinates, category, environment, weather sensitivities, typical duration, reservation level, broad recommended time window and explicit provenance. OpenStreetMap-derived records retain their source reference and ODbL attribution.

Automated catalogue tests require **at least 50 POIs for every pilot city**, valid coordinates, unique IDs, supported provenance and localized names. This satisfies the approved 50–150/city Phase 7 scale gate without inventing coordinates or unlabeled source data.

## Slice D — Structured activity editor

Delivered:

- structured editor embedded into Simplified Chinese, English and Traditional Chinese workspaces;
- quick legacy-style entry with deterministic upgrade;
- POI picker;
- editable start time, environment, flexibility, priority and reservation fields;
- compatibility text kept synchronized;
- Traditional Chinese localization includes structured activity title/notes/alternatives and preserves optional-property semantics.

## Slice E — Concrete Plan B resolver

Delivered:

- daily forecast checks structured activity weather sensitivities;
- detects rain, wind, heat, cold and UV impact;
- preserves fixed/required-reservation warning state;
- recommends lower-weather-risk indoor alternatives when available;
- user explicitly adds a fallback; no silent replacement;
- missing POI data falls back to the existing generic Plan B.

## Slice F — hardening + release

Completed before Preview gate:

- Phase 7 component/contract tests;
- v1/v2 Cloud validation tests;
- structured revision-diff tests;
- seven-city >=50 POI quality gate;
- focused Workspace v2 creation + migration tests;
- dedicated Phase 7 Preview/Production smoke workflow and Cloud smoke runner;
- prior Phase 5 Weather Intelligence regression remains independently exercised.

Remaining release gates:

- final full repository CI/static export on the acceptance head;
- Preview D1/Workers/Pages deployment;
- existing Preview regression smoke;
- dedicated Phase 7 Preview smoke;
- squash merge and production deployment;
- dedicated Phase 7 Production smoke and auditable status record.

## Definition of Done

- [x] Workspace v2 schema is versioned and normalization upgrades v1 safely.
- [x] v1 -> v2 migration is deterministic and lossless for portable activity text.
- [x] Existing share/import/Markdown workflows remain readable and exportable.
- [x] Cloud Trip accepts v2 documents while retaining v1 compatibility.
- [x] Revision diff exposes structured activity changes.
- [x] Structured activity editor works in EN / zh-CN / zh-Hant.
- [x] Seven pilot cities have POI catalogues with required weather attributes and provenance.
- [x] POI catalogue reaches at least 50 records per pilot city under an automated quality gate.
- [x] Fixed/movable/flexible and reservation constraints persist.
- [x] Weather-sensitive activities can receive concrete indoor Plan B candidates.
- [x] Fixed/reservation activities are never presented as silently movable.
- [x] Missing POI data gracefully falls back to the existing generic recommendation.
- [ ] Final format, lint, typecheck, unit/integration, docs and static export pass on the acceptance head.
- [ ] Existing Preview regression smoke remains green on the acceptance head.
- [ ] Dedicated Phase 7 Preview smoke passes.
- [ ] Production Deploy and dedicated Phase 7 Production smoke pass with auditable evidence.
