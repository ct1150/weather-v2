# Where Not Rain — Phase 8: Adaptive Replanning

Date: 2026-08-09
Status: In Progress

## Outcome

Turn Phase 5 weather change detection plus Phase 7 structured activities into a safe, explicit replanning workflow:

**Hourly weather -> activity risk -> deterministic proposal -> explainable diff -> user approval -> normal Cloud Trip revision -> Today execution view.**

No weather-driven mutation is applied without an explicit user action.

## Baseline correction

Phase 8 does **not** need a new hourly-weather database design:

- `weather_hourly` already exists in the authoritative Weather D1 schema and is snapshot-versioned;
- the normalized weather provider contract already contains hourly observations;
- `weather-sync` already persists 48 hours of hourly data for featured cities in the same candidate snapshot that owns daily rows;
- `weather-read` is still daily-only for Trip clients and is therefore the first missing product boundary.

The existing provider isolation remains unchanged:

```text
provider -> weather-sync -> immutable Weather D1 snapshot -> weather-read -> Trip / UI
```

Browser and Trip API paths must never call Open-Meteo or another provider directly.

---

## Slice A — Hourly weather read contract

### Goal

Expose the already persisted near-term hourly snapshot through a bounded, read-only API suitable for activity windows.

### API

`GET /api/v1/trip-hourly`

Query contract:

```text
cityIds=city-a,city-b     # 1..4 unique city IDs
date=YYYY-MM-DD           # city-local calendar date
startHour=0..23            # optional, default 0
endHour=0..23              # optional, default 23, must be >= startHour
locale=en|zh-cn
```

Response contract:

```text
snapshotId
locale
date
startHour / endHour
requestedCityIds
freshness
coverage.availableCityIds
coverage.unavailableCityIds
items[]
  cityId
  localTime
  weatherCode
  condition
  temperatureC
  apparentTemperatureC
  precipitationMm
  rainProbability
  humidity
  windSpeedKph
  windGustKph
  uvIndex
  cloudCover
  visibilityM
  dataQuality
```

Rules:

- one local calendar date per call;
- maximum 4 cities and maximum 24 hourly slots per city;
- reads only the currently active immutable snapshot;
- missing hourly coverage returns an explicit `unavailableCityIds` result rather than inventing values;
- daily Trip APIs remain unchanged;
- response remains `private, no-store` with fixed-origin CORS;
- no provider import/call is allowed in `weather-read`.

### Slice A acceptance

- [ ] persisted hourly rows can be read from the active snapshot;
- [ ] one-day/hour-window bounds fail closed;
- [ ] >4 city requests fail closed;
- [ ] missing hourly coverage is explicit and non-optimistic;
- [ ] EN / zh-CN weather condition copy is consistent with daily reads;
- [ ] daily Trip forecast contract remains green;
- [ ] targeted unit/integration tests pass;
- [ ] full repository CI + Preview deployment pass;
- [ ] dedicated hourly Preview smoke verifies a real persisted hourly row.

---

## Slice B — Activity risk engine

### Goal

Compute deterministic risk for each Phase 7 `TripActivity` using the hourly window that overlaps the activity.

### Inputs

- structured activity metadata;
- city/date/start/end or duration;
- hourly weather rows;
- party profile;
- day theme;
- fixed/reservation/priority constraints.

### Output

```text
ActivityRisk
- activityId
- score: 0..100 | null
- level: low | medium | high | unknown
- affectedWindow
- reasonCodes[]
- moveMayReduceRisk
- fallbackAvailable
- confidence
```

Initial deterministic hazards:

- rain / precipitation probability;
- heat / apparent temperature;
- cold;
- sustained wind / gust;
- UV.

Rules:

- missing hourly data -> `unknown`, never a low-risk optimistic result;
- indoor activities receive materially lower rain/UV exposure;
- family/senior profiles use more conservative heat/cold/wind thresholds;
- fixed/reservation metadata does not alter weather facts, only allowable actions.

---

## Slice C — Deterministic replan solver

### Goal

Generate a bounded set of safe changes, not prose-only advice.

Hard constraints:

1. fixed activities never move automatically;
2. required reservations never move unless explicitly marked changeable;
3. transport/deadline constraints remain fixed;
4. user-locked/must-do activities cannot be replaced;
5. impossible time overlaps are rejected;
6. proposals cannot leave the trip/day bounds;
7. no proposal is applied automatically.

Optimization order:

1. zero hard-constraint violations;
2. maximize weather-risk reduction;
3. preserve must-see activities;
4. prefer same-day time shifts before replacement;
5. prefer curated lower-risk fallback POIs;
6. minimize edit count and approximate travel delta.

The solver is pure and deterministic for a given workspace + weather snapshot.

---

## Slice D — Proposed Revision API / permissions

Represent a replan as an immutable proposal:

```text
proposalId
tripId
baseVersion
weatherSnapshotId
createdAt
changes[]
riskBefore / riskAfter
travelDeltaMinutes
reasonCodes[]
unchangedFixedActivityIds[]
```

Actions:

- inspect proposal;
- accept all;
- accept selected changes;
- reject;
- optionally create a Phase 4 discussion/decision before applying.

Permissions:

- OWNER / EDITOR can create/review/apply proposals;
- VIEWER is read-only;
- stale `baseVersion` fails closed;
- applying creates the normal Cloud Trip revision/activity records.

D1 persistence is introduced only if proposal durability is required by the chosen API implementation; otherwise deterministic ephemeral proposals may be regenerated from immutable inputs.

---

## Slice E — Review / apply UX

Workspace experience:

```text
Weather changed
-> affected structured activities
-> Before / After proposal
-> risk reduction + reasons
-> fixed items explicitly unchanged
-> Accept all / select changes / reject
-> Cloud revision created
```

Requirements:

- EN / zh-CN / zh-Hant;
- mobile-first review cards;
- accessible change selection;
- no hidden mutations;
- resulting workspace stays compatible with Markdown/export/share.

---

## Slice F — Today / Execution Mode + release

Today Mode surfaces:

- active local trip day;
- next structured activity;
- current/near-term hourly weather window;
- active Weather Insights;
- accepted weather-driven changes;
- fixed deadlines;
- deterministic move-indoors / leave-earlier guidance only when supported by data.

### Phase 8 release smoke

Preview and production smoke must cover one end-to-end scenario:

1. create Workspace v2 Cloud Trip;
2. read real persisted hourly weather;
3. produce a deterministic weather-risk proposal;
4. verify fixed constraint remains unchanged;
5. apply selected proposal changes as OWNER/EDITOR;
6. verify new Cloud revision/activity record;
7. verify VIEWER cannot apply;
8. verify stale proposal/baseVersion is rejected.

---

## Phase 8 Definition of Done

- [ ] Hourly weather path is available through bounded provider-isolated reads.
- [ ] Activity-level risk supports rain/heat/cold/wind/UV.
- [ ] Missing hourly data remains unknown/fail-closed.
- [ ] Fixed/reservation constraints cannot be silently violated.
- [ ] Replan solver returns deterministic proposals for covered cases.
- [ ] Proposed diff explains risk reduction, edits and travel impact.
- [ ] User approval is mandatory before itinerary mutation.
- [ ] Accepted changes create standard Cloud Trip revision/activity records.
- [ ] VIEWER and stale-version mutation protection is enforced server-side.
- [ ] Today Mode works for the active trip day.
- [ ] EN / zh-CN / zh-Hant complete.
- [ ] Phase 5–7 regressions remain green.
- [ ] Full format/lint/typecheck/unit/integration/docs/static-export gates pass.
- [ ] Dedicated Preview and Production Phase 8 smoke pass.

## Execution order

1. Slice A — hourly read contract + Preview smoke.
2. Slice B — pure activity risk engine.
3. Slice C — pure deterministic solver.
4. Slice D — proposal API + permissions/version guard.
5. Slice E — review/apply UI + Cloud revisions.
6. Slice F — Today Mode + full Preview/Production acceptance.

No Slice advances past its acceptance gate with known failing tests or unresolved safety constraints.
