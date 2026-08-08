# Where Not Rain — Phase 7: Activity / POI Intelligence

Date: 2026-08-08
Status: In Progress

## Outcome

Give the itinerary a structured activity model that weather intelligence can reason about safely:

**Legacy activity text -> Workspace v2 structured activities -> curated POI metadata -> concrete lower-weather-risk Plan B -> Cloud Trip revision visibility.**

Phase 7 does not silently replace itinerary activities. It builds the data and UX foundation required for Phase 8 adaptive replanning.

## Compatibility strategy

- Workspace v1 remains a readable input contract.
- `normalizeWorkspace` upgrades compatible input to Workspace v2.
- `activityItems` is the structured v2 representation.
- `activities: string[]` remains a portable compatibility projection for Markdown/export and legacy editing.
- Editing the legacy textarea clears the structured projection so the next normalization deterministically rebuilds v2 activities from the latest text.
- Cloud Trip validation accepts both v1 and v2 during migration.
- No D1 schema migration is required because trip documents/revisions are immutable JSON documents.

## Slice A — Workspace v2 + migration contract

Delivered on branch:

- structured `TripActivity` model;
- deterministic legacy text -> structured activity conversion;
- time/category/environment/flexibility/reservation inference rules;
- Workspace v2 normalization while retaining v1 input compatibility;
- structured -> legacy text projection;
- local/share/Markdown compatibility tests.

## Slice B — Cloud Trip validation + revision support

Delivered on branch:

- server accepts v1 and structured v2 trip documents;
- increased bounded document limit for the structured representation;
- structured activity validation remains fail-closed;
- revision diff includes `day.activityItems` independently from compatibility `day.activities`;
- tests cover malformed v2 data and structured revision change visibility.

## Slice C — Curated pilot POI catalogue

Delivered base catalogue:

- Tokyo
- Kyoto
- Osaka
- Seoul
- Jeju
- Bangkok
- Phuket

Each curated POI includes:

- stable ID and city ID;
- EN / zh-CN / zh-Hant name;
- coordinates;
- category;
- indoor / outdoor / mixed environment;
- weather sensitivities;
- typical duration;
- reservation level;
- recommended broad time window;
- explicit `curated-v1` provenance.

Current branch ships a high-confidence base catalogue of at least 15 POIs per pilot city. The approved program target remains 50–150 POIs per pilot city before Phase 7 is marked Complete; enrichment must preserve the same provenance and quality rules.

## Slice D — Structured activity editor

Delivered on branch:

- structured editor embedded into Simplified Chinese, English and Traditional Chinese workspaces;
- quick legacy-style activity entry with deterministic upgrade;
- curated POI picker;
- editable start time, environment, flexibility, priority and reservation fields;
- compatibility text kept synchronized;
- Traditional Chinese localization includes structured activity title/notes/alternatives.

## Slice E — Concrete Plan B resolver

Delivered on branch:

- daily forecast checks structured activity weather sensitivities;
- detects rain, wind, heat, cold and UV impact;
- preserves fixed/required-reservation warning state;
- recommends curated indoor alternatives when available;
- user explicitly adds a fallback; no silent replacement;
- missing POI data falls back to existing generic Plan B.

## Slice F — hardening + release

Pending:

- expand curated catalogues toward the approved 50–150/city target;
- contract tests across all workspace surfaces;
- format/lint/typecheck/unit/integration/static-export gates;
- existing Cloud Trip / Weather Intelligence regression smoke;
- dedicated Phase 7 Preview smoke;
- merge + production deployment;
- dedicated Phase 7 Production smoke and auditable status record.

## Definition of Done

- [ ] Workspace v2 schema is versioned and normalization upgrades v1 safely.
- [ ] v1 -> v2 migration is deterministic and lossless for portable activity text.
- [ ] Existing share/import/Markdown workflows remain readable and exportable.
- [ ] Cloud Trip accepts v2 documents while retaining v1 compatibility.
- [ ] Revision diff exposes structured activity changes.
- [ ] Structured activity editor works in EN / zh-CN / zh-Hant.
- [ ] Seven pilot cities have curated POI catalogues with required weather attributes.
- [ ] POI catalogue reaches the approved 50–150 per pilot city scale target or an explicitly documented revision is approved.
- [ ] Fixed/movable/flexible and reservation constraints persist.
- [ ] Weather-sensitive activities can receive concrete indoor Plan B candidates.
- [ ] Fixed/reservation activities are never presented as silently movable.
- [ ] Missing POI data gracefully falls back to the existing generic recommendation.
- [ ] Format, lint, typecheck, unit/integration, docs and static export pass.
- [ ] Existing Preview regression smoke remains green.
- [ ] Dedicated Phase 7 Preview smoke passes.
- [ ] Production Deploy and dedicated Phase 7 Production smoke pass with auditable evidence.
