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
- Slice A now exposes those rows through the provider-isolated `weather-read` boundary.

The existing provider isolation remains unchanged:

```text
provider -> weather-sync -> immutable Weather D1 snapshot -> weather-read -> Trip / UI
```

Browser and Trip API paths must never call Open-Meteo or another provider directly.

---

## Slice A — Hourly weather read contract

Status: **Complete**

### Delivered API

`GET /api/v1/trip-hourly`

Query contract:

```text
cityIds=city-a,city-b     # 1..4 unique city IDs
date=YYYY-MM-DD           # city-local calendar date
startHour=0..23           # optional, default 0
endHour=0..23             # optional, default 23, must be >= startHour
locale=en|zh-cn
```

Response includes the active snapshot ID, date/hour bounds, freshness, explicit available/unavailable city coverage and bounded hourly weather rows.

Rules:

- one local calendar date per call;
- maximum 4 cities and maximum 24 hourly slots per city;
- reads only the currently active immutable snapshot;
- missing hourly coverage is explicitly unavailable rather than synthetically optimistic;
- daily Trip APIs remain unchanged;
- response remains `private, no-store` with fixed-origin CORS;
- `weather-read` still has no weather-provider dependency.

### Acceptance evidence

- focused weather-read integration tests: success;
- full repository Deploy Run 273: success, including format/lint/typecheck/unit/integration/docs/static export, all Worker builds, Preview D1/Workers/Trip API/Pages and existing smoke gates;
- dedicated Hourly Preview smoke: success against persisted Tokyo hourly data;
- invalid hour window and >4-city requests: rejected fail-closed;
- Phase 6 Discovery and Phase 7 Activity Intelligence Preview regressions remained green.

### Slice A acceptance

- [x] persisted hourly rows can be read from the active snapshot;
- [x] one-day/hour-window bounds fail closed;
- [x] >4 city requests fail closed;
- [x] missing hourly coverage is explicit and non-optimistic;
- [x] EN / zh-CN weather condition copy is consistent with daily reads;
- [x] daily Trip forecast contract remains green;
- [x] targeted unit/integration tests pass;
- [x] full repository CI + Preview deployment pass;
- [x] dedicated hourly Preview smoke verifies a real persisted hourly row.

---

## Slice B — Activity risk engine

Status: **Implementation verified; full repository gate pending on current acceptance head**

### Delivered pure contract

`assessActivityHourlyRisk(...)` computes deterministic risk for a Phase 7 `TripActivity` using only hourly rows that overlap the activity window.

Output:

```text
ActivityHourlyRisk
- activityId
- score: 0..100 | null
- level: low | medium | high | unknown
- affectedWindow
- reasonCodes[]
- moveMayReduceRisk
- fallbackAvailable
- confidence
- hourlyRowsUsed
```

Implemented hazards:

- rain / precipitation probability;
- heat / apparent temperature;
- cold;
- sustained wind / gust;
- UV.

Rules:

- missing activity time -> `unknown`;
- no overlapping hourly rows -> `unknown`;
- only overlapping local-hour rows influence risk;
- indoor activities are not falsely penalized by rain/UV when they are not weather-sensitive;
- family/senior profiles use more conservative heat/cold/wind thresholds;
- fixed/required-reservation activities can remain high risk but never return a move recommendation;
- data-quality / hourly-window coverage determines confidence;
- no network, storage or mutation side effects exist in the risk engine.

### Slice B acceptance

- [x] deterministic focused Vitest contract passes;
- [x] heavy rain makes a rain-sensitive outdoor activity high risk;
- [x] non-overlapping later weather does not contaminate a morning activity;
- [x] indoor rain/UV behavior stays materially safer;
- [x] family/senior heat thresholds are more conservative than adults;
- [x] fixed/required-reservation constraints suppress move recommendations;
- [x] missing time/hourly data fails closed to unknown;
- [ ] full repository CI and existing Preview regressions pass on the formatted Slice B head.

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

- [x] Hourly weather path is available through bounded provider-isolated reads.
- [x] Activity-level risk supports rain/heat/cold/wind/UV.
- [x] Missing hourly data remains unknown/fail-closed.
- [x] Fixed/reservation constraints are represented in activity risk without silent movement.
- [ ] Replan solver returns deterministic proposals for covered cases.
- [ ] Proposed diff explains risk reduction, edits and travel impact.
- [ ] User approval is mandatory before itinerary mutation.
- [ ] Accepted changes create standard Cloud Trip revision/activity records.
- [ ] VIEWER and stale-version mutation protection is enforced server-side.
- [ ] Today Mode works for the active trip day.
- [ ] EN / zh-CN / zh-Hant complete.
- [ ] Phase 5–7 regressions remain green on final Phase 8 acceptance head.
- [ ] Full format/lint/typecheck/unit/integration/docs/static-export gates pass on final Phase 8 head.
- [ ] Dedicated Preview and Production Phase 8 smoke pass.

## Execution order

1. Slice A — hourly read contract + Preview smoke. **Complete.**
2. Slice B — pure activity risk engine. **Implementation verified; repository acceptance pending.**
3. Slice C — pure deterministic solver.
4. Slice D — proposal API + permissions/version guard.
5. Slice E — review/apply UI + Cloud revisions.
6. Slice F — Today Mode + full Preview/Production acceptance.

No Slice advances past its acceptance gate with known failing tests or unresolved safety constraints.
