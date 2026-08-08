# Where Not Rain — Weather-first Platform Phase 6–9 Execution Plan

Date: 2026-08-08
Status: Approved / Execution Started

## 1. North-star outcome

Evolve Where Not Rain from a weather-aware trip planner into a **Weather-first Trip Decision & Execution Platform**.

Target user journey:

**Choose travel dates -> discover where conditions best match the trip intent -> compare destinations -> add one or more cities into a trip -> build structured activities -> monitor forecast changes -> generate a concrete replan proposal -> user accepts -> create a revision -> surface contextual commercial actions only after the travel decision is clear.**

The implementation preserves the existing architecture principles established through Phase 5:

- `weather-sync` remains the only weather provider caller.
- user-facing and Trip API paths consume persisted data only;
- deterministic rules own weather risk, safety constraints and replan validity;
- LLMs may later assist with language/POI enrichment, never become the authority for weather safety or fixed constraints;
- no silent itinerary rewrites;
- Cloudflare free-tier-friendly primitives remain the default: Pages, Workers, D1, service bindings and Cron;
- MapLibre + OpenFreeMap remain the map stack; no Mapbox migration is planned;
- Redis and weather tile infrastructure are not prerequisites for the product loop.

## 2. Current baseline

Already delivered before this program:

- weather-ranked Travel Radar and interactive MapLibre destination map;
- bounded city/date weather read APIs backed by immutable D1 weather snapshots;
- local Trip Workspace, templates, Markdown import/export and URL sharing;
- direct Discovery -> Trip insertion from country weather comparison pages;
- optional Cloud Trip sync, role-based collaboration, revision history, activity, comments and decisions;
- Phase 5 deterministic weather-change intelligence, scheduled monitoring and Weather Insight -> Decision conversion;
- provider-neutral affiliate/adapters and analytics contracts, but no full contextual conversion product yet.

Important baseline correction: **Discovery -> Trip is partially complete already.** Phase 6 does not rebuild it; it extends it to weather intents, custom filters, shortlist comparison and multi-city trip creation.

---

# Phase 6 — Weather Discovery 2.0

Status: In Progress
Priority: P0
Product question: **Given my dates and desired conditions, where should I go?**

## P6A — Weather Intent model

Create a deterministic discovery preference contract shared by ranking, list and map projections.

Initial intents:

1. `dry` — Where is it least likely to rain?
2. `outdoor` — Best balanced outdoor conditions.
3. `beach` — Dry, warm, lower-wind beach conditions.
4. `cool_escape` — Comfortable cooler escape / heat avoidance.
5. `warm_escape` — Mild/warm conditions without excessive heat.
6. `family_comfort` — More conservative temperature, rain, wind and UV profile.
7. `senior_comfort` — Strictest comfort profile for heat/cold/wind.

Rules:

- deterministic score `0..100`;
- stable reason codes;
- missing data reduces confidence and never becomes an optimistic score;
- intent scoring remains independent of an LLM;
- all scoring functions are pure and unit-testable.

Deliverables:

- `WeatherDiscoveryIntent` type;
- pure score engine;
- reason-code contract;
- unit tests for each intent and boundary conditions;
- localized copy for EN / zh-CN / zh-Hant.

## P6B — Custom discovery constraints

Add user-selectable constraints:

- date range;
- maximum rain probability;
- min/max preferred temperature;
- maximum sustained wind;
- optional party profile;
- optional trip theme.

Contract:

```text
DiscoveryPreferences
- intent
- from
- to
- rainProbabilityMax?
- temperatureMinC?
- temperatureMaxC?
- windSpeedMaxKph?
- partyProfile?
- theme?
```

Behavior:

- constraints filter or penalize deterministically;
- URL search params serialize the complete state so the discovery view is shareable;
- invalid/out-of-range values fail closed to defaults;
- map and ranked list consume the same read model and cannot diverge.

## P6C — Multi-city shortlist comparison

Allow users to shortlist up to four cities from discovery results.

Comparison fields:

- intent score;
- general weather/travel score where available;
- rain probability;
- min/max temperature;
- wind/gust;
- UV;
- daily forecast strip across the selected date range;
- deterministic reason codes;
- data freshness.

Behavior:

- shortlist state is URL-serializable;
- shortlist never changes weather data fetch bounds beyond existing API limits;
- keyboard-accessible add/remove controls;
- mobile comparison degrades to horizontally scrollable cards/table rather than hiding fields.

## P6D — Discovery -> multi-city Trip

Existing baseline:

- a single discovery destination can already add the selected date range into the local workspace;
- existing trip content is preserved;
- duplicate same-city/same-date days are suppressed.

Phase 6 extension:

- selected shortlist cities can be assigned one or more days;
- user can create a multi-city workspace directly from comparison;
- generated trip preserves chronological order and existing workspace if the user chooses append;
- no POI generation yet; city/day scaffolding only;
- direct action remains available without sign-in.

## P6E — Discovery UX consolidation

Create one coherent discovery surface:

```text
When -> Intent -> Optional constraints -> Ranked results + Map -> Shortlist -> Compare -> Add/Create Trip
```

Do not add weather tile overlays in Phase 6.

## Phase 6 acceptance / DoD

- [ ] ≥7 deterministic weather intents.
- [ ] Intent score and reason codes are unit-tested.
- [ ] Date/rain/temperature/wind constraints work and serialize to URL.
- [ ] Ranked list and MapLibre markers use the same filtered/sorted model.
- [ ] Up to 4 cities can be shortlisted and compared.
- [ ] Comparison includes multi-day weather for the selected range.
- [ ] Single-city existing Add-to-Trip behavior remains intact.
- [ ] Multi-city shortlist can create/append a Trip Workspace.
- [ ] EN / zh-CN / zh-Hant complete.
- [ ] No browser/provider weather calls are introduced.
- [ ] Format, lint, typecheck, unit/integration, docs gate and static export pass.
- [ ] Preview deployment and dedicated Phase 6 smoke pass.
- [ ] Production deploy and dedicated Phase 6 smoke pass.

### Phase 6 implementation slices

1. Slice A — Intent engine + contracts.
2. Slice B — URL preference model + filtering/ranking.
3. Slice C — shortlist + comparison UI.
4. Slice D — multi-city Trip creation/append.
5. Slice E — localization, accessibility, smoke and release.

---

# Phase 7 — Activity / POI Intelligence

Status: Planned
Priority: P0
Product question: **Once I choose a destination, what exactly can the itinerary manipulate safely?**

## P7A — Trip Workspace v2

Replace free-form activity strings as the primary activity representation with structured activities while preserving import/export compatibility.

Proposed activity model:

```text
TripActivity
- id
- title
- cityId
- startTime?
- endTime?
- durationMinutes?
- latitude?
- longitude?
- category: attraction | food | transport | hotel | shopping | leisure
- environment: indoor | outdoor | mixed
- weatherSensitivity[]: rain | heat | cold | wind | uv
- flexibility: fixed | movable | flexible
- reservation: none | recommended | required
- priority: must | preferred | optional
- poiId?
- alternatives[]
- notes?
```

Workspace v2 requirements:

- deterministic v1 -> v2 migration;
- no loss of activity text;
- v1 share/import payloads continue to load;
- Markdown import/export stays available;
- Cloud Trip revision snapshots support the new model;
- revision diff gains activity-level structured changes.

## P7B — Curated POI data model

Start with a deliberately small curated catalogue rather than global POI ingestion.

Pilot cities:

- Tokyo
- Kyoto
- Osaka
- Seoul
- Jeju
- Bangkok
- Phuket

Target: 50–150 high-quality tourism POIs per pilot city.

Required POI attributes:

- localized name;
- coordinates;
- category;
- environment;
- weather sensitivities;
- typical duration;
- recommended time window where known;
- fixed/booking characteristics where relevant;
- deterministic fallback relationships;
- source/provenance metadata.

POI data that is unknown stays unknown; AI-inferred fields must not be presented as authoritative without provenance/confidence.

## P7C — Activity editor

Users can:

- add a POI to a day;
- convert legacy text into a structured activity manually;
- mark fixed/movable/flexible;
- set start time/duration;
- set priority;
- override environment/weather sensitivity;
- preserve free-form notes.

## P7D — Concrete Plan B

Weather Insight recommendations evolve from generic text to explicit candidate activity changes.

Example:

```text
Original: 14:00 Arashiyama Bamboo Grove
Rain: 82%
Proposal A: move Arashiyama to 08:00; move Railway Museum to 14:30
Proposal B: keep morning; replace afternoon with Aquarium
```

Phase 7 does **not** automatically apply proposals.

## Phase 7 acceptance / DoD

- [ ] Workspace v2 schema is finalized and versioned.
- [ ] v1 -> v2 migration is deterministic and lossless.
- [ ] Existing share/import/cloud trips remain readable.
- [ ] Structured activity editor works in EN / zh-CN / zh-Hant.
- [ ] ≥7 pilot cities have curated POI catalogues.
- [ ] POIs include environment and weather sensitivity.
- [ ] Fixed/movable/flexible constraints are persisted.
- [ ] Weather Insight can display at least one concrete Plan B candidate when data exists.
- [ ] Missing POI data gracefully falls back to the current generic recommendation.
- [ ] Preview + production migration/smoke pass.

### Phase 7 implementation slices

1. Slice A — Workspace v2 + migration contract.
2. Slice B — Cloud Trip storage/revision/diff support.
3. Slice C — POI schema + curated pilot dataset.
4. Slice D — Activity editor + POI picker.
5. Slice E — concrete Plan B resolver.
6. Slice F — migration, smoke, release.

---

# Phase 8 — Adaptive Replanning

Status: Planned
Priority: P0
Product question: **The weather changed. What should I move, replace or keep?**

## P8A — Hourly weather snapshot

Extend the persisted weather data path to support hourly forecast windows needed for activity-level decisions.

Architecture remains:

```text
provider -> weather-sync -> Weather D1 -> weather-read -> trip-api
```

Requirements:

- provider access remains sync-only;
- hourly data is bounded by active trip horizons and cost controls;
- D1 storage is versioned by immutable snapshot;
- weather-read exposes bounded activity-window reads;
- daily APIs remain backward compatible.

## P8B — Activity impact scoring

For each structured activity, compute:

- risk score;
- risk level;
- relevant weather reasons;
- affected time window;
- whether moving time can reduce risk;
- whether a fallback POI is available.

Fixed/reservation constraints override weather optimization.

## P8C — Deterministic replan engine

Inputs:

- structured activities;
- hourly weather;
- opening-time data where confidently available;
- fixed/reservation constraints;
- travel distance/time approximation;
- user priority;
- party profile.

Hard constraints:

- fixed tickets are not silently moved;
- required transport is not silently moved;
- impossible/opening-hour-invalid proposals are rejected;
- user-locked activities never change automatically.

Optimization objectives:

1. constraint violations = 0;
2. reduce weather exposure/risk;
3. preserve must-see coverage;
4. minimize additional travel time;
5. minimize unnecessary edits.

## P8D — Proposed Revision

A weather-driven replan is represented as a proposed structured diff:

```text
Before / After
Weather risk reduction
Travel-time delta
Moved activities
Replaced activities
Unchanged fixed constraints
Reason codes
```

User actions:

- Accept all;
- accept selected changes;
- reject;
- create discussion/decision.

Accepting changes creates the normal Cloud Trip revision/activity records.

## P8E — Today / Execution Mode

Focus the current trip day and show:

- next activity;
- latest weather condition;
- active Weather Insights;
- accepted weather-driven changes;
- fixed deadlines;
- contextual "leave/move indoors" reminders where deterministic data supports them.

## Phase 8 acceptance / DoD

- [ ] Hourly weather path is persisted and provider-isolated.
- [ ] Activity-level risk works for rain/heat/cold/wind/UV.
- [ ] Fixed constraints cannot be silently violated.
- [ ] Replan engine returns deterministic proposals for covered cases.
- [ ] Proposed diff explains risk and travel impact.
- [ ] User approval is required before any itinerary mutation.
- [ ] Accepted replan produces a Cloud Trip revision and activity record.
- [ ] Today Mode works for the active trip day.
- [ ] EN / zh-CN / zh-Hant complete.
- [ ] Preview + production smoke cover a real weather-driven proposal and apply flow.

### Phase 8 implementation slices

1. Slice A — Hourly weather storage/read contract.
2. Slice B — activity risk engine.
3. Slice C — deterministic replan solver.
4. Slice D — proposed diff API + permissions.
5. Slice E — review/apply UI + revisions.
6. Slice F — Today Mode + release smoke.

---

# Phase 9 — Conversion & Retention

Status: Planned
Priority: P1
Product question: **How does the completed decision task create sustainable revenue and retention without compromising trust?**

## P9A — Contextual affiliate surfaces

Reuse the existing provider-neutral affiliate infrastructure.

Surfaces appear only after a user-relevant decision context exists:

- destination discovery -> hotel / flight;
- trip day planning -> attraction/activity ticket;
- car-dependent trip -> car rental;
- weather change -> indoor attraction / insurance only when contextually appropriate;
- destination preparation -> SIM/eSIM.

Rules:

- clearly disclosed sponsored/affiliate relationship;
- allowlisted provider host/path only;
- kill-switch controlled;
- no dead/no-fill space;
- outbound click never changes the weather recommendation score;
- commercial ranking is separate from weather/replan ranking.

## P9B — Conversion analytics

Measure the funnel:

```text
weather_discovery_view
-> destination_shortlisted
-> trip_created
-> weather_insight_opened
-> replan_proposed
-> replan_accepted
-> affiliate_impression
-> affiliate_click
```

No sensitive itinerary content is sent in analytics payloads.

## P9C — Notification readiness

Only after Phase 5/8 precision is measurable:

- add user-controlled notification preferences;
- email/PWA channels may surface high-value Weather Insights;
- no notification for low-confidence or minor forecast noise;
- default rate limits and quiet periods;
- unsubscribe/disable always available.

## P9D — Premium boundary

Candidate paid value:

- automatic monitoring across more active trips;
- proactive notifications;
- longer version history;
- advanced multi-city comparisons;
- adaptive replan proposals;
- collaboration limits/features.

Do not implement billing until product analytics prove repeated use of weather monitoring/replanning.

## Phase 9 acceptance / DoD

- [ ] Contextual affiliate surfaces use the existing secure adapter.
- [ ] Commercial surfaces never influence weather/risk scoring.
- [ ] Affiliate impression/click funnel is measurable.
- [ ] No-fill/disabled state produces zero misleading UI.
- [ ] Privacy tests reject itinerary content in analytics.
- [ ] Notification preference model is opt-in and rate-limited before any delivery integration.
- [ ] Premium entitlement boundaries are documented/testable before billing provider integration.

### Phase 9 implementation slices

1. Slice A — contextual conversion resolver.
2. Slice B — discovery/trip/weather surfaces.
3. Slice C — funnel analytics and privacy gates.
4. Slice D — notification preference/readiness model.
5. Slice E — paid-tier entitlement contract (billing deferred unless explicitly approved).
6. Slice F — smoke and conversion release review.

---

# 3. Cross-phase engineering rules

## 3.1 Branch / PR strategy

Each phase uses its own branch and PR:

- `feature/weather-discovery-phase6`
- `feature/activity-intelligence-phase7`
- `feature/adaptive-replanning-phase8`
- `feature/conversion-retention-phase9`

A phase is merged only after its preview acceptance gate passes.

## 3.2 Required CI gates for every phase

1. `pnpm format:check`
2. `pnpm lint`
3. library/package build where required for declarations
4. `pnpm typecheck`
5. `pnpm test`
6. docs validation
7. Next.js static export
8. Worker builds
9. pipeline contract tests
10. secret scan
11. remote Preview migrations when schema changes
12. Preview Worker/Pages deploy
13. existing Product/Trip/Collaboration regression smoke
14. phase-specific Preview smoke
15. merge to `main`
16. production migration/deploy
17. existing production smoke
18. phase-specific Production smoke
19. persist auditable status file
20. update phase plan `Status: Complete` only after all green

## 3.3 Data migration rules

- migrations are append-only;
- every migration has a local SQLite/migration contract test;
- Preview migration must pass before merge;
- Production migration is executed by the trusted deploy workflow;
- old Workspace/share payloads remain readable for at least one major version;
- user data is never rewritten without deterministic migration tests.

## 3.4 Security / Cloudflare rules

- service bindings over public Worker-to-Worker HTTP;
- no request-scoped mutable module globals;
- all promises are awaited/returned or explicitly scheduled;
- Web Crypto for IDs/tokens;
- no secrets in source or public bundles;
- provider calls remain confined to sync ingestion;
- bounded API ranges/collection sizes;
- server-side authorization for every Cloud Trip mutation;
- non-member private trip resources remain 404.

## 3.5 Product safety rules

- weather forecasts are probabilistic, not guarantees;
- severe/official alerts, when later added, stay separate from normal forecast scoring;
- fixed reservations/tickets cannot be automatically moved;
- no weather recommendation may be influenced by affiliate revenue;
- every automatic recommendation is explainable with deterministic reason codes;
- itinerary mutation requires explicit user acceptance.

---

# 4. Explicitly deferred outside Phase 6–9 core

- Weather map raster/tile overlay as a prerequisite;
- Redis or external cache infrastructure;
- global-scale POI ingestion before pilot quality is proven;
- realtime cursors/presence/WebSocket collaboration;
- fully autonomous LLM itinerary agent;
- silent automatic itinerary rewrites;
- billing provider integration before entitlement/product-value validation;
- official severe-weather feeds until a separate trust/source model is approved.

---

# 5. Program-level acceptance

The Phase 6–9 program is complete when a production user can perform this end-to-end journey:

1. choose a date range and weather intent;
2. see ranked/map destinations from persisted weather data;
3. shortlist and compare multiple cities;
4. create a multi-city trip directly from discovery;
5. plan with structured POIs/activities and fixed constraints;
6. receive weather-change monitoring without provider calls from the user path;
7. receive a concrete, constraint-safe replan proposal;
8. explicitly accept the proposal into a revision;
9. optionally follow a clearly disclosed contextual commercial action;
10. all above flows are covered by auditable Preview and Production smoke evidence.

## Execution order

**Phase 6 -> Phase 7 -> Phase 8 -> Phase 9.**

No later phase may bypass an unmet acceptance criterion from the preceding phase unless the plan is explicitly revised and documented.
