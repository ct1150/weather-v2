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
- Slice A exposes those rows through the provider-isolated `weather-read` boundary.

The existing provider isolation remains unchanged:

```text
provider -> weather-sync -> immutable Weather D1 snapshot -> weather-read -> Trip / UI
```

Browser and Trip API paths must never call Open-Meteo or another provider directly.

---

## Slice A — Hourly weather read contract

Status: **Complete**

Delivered `GET /api/v1/trip-hourly` with one local date, 1–4 cities, an optional 0–23 hour window, active-snapshot-only reads and explicit available/unavailable coverage.

Acceptance evidence:

- focused weather-read integration tests: success;
- full repository Deploy Run 273: success;
- dedicated Hourly Preview smoke: success against persisted Tokyo hourly data;
- invalid hour window and >4-city requests: rejected fail-closed;
- daily Trip APIs and provider isolation remained unchanged.

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

Status: **Complete**

`assessActivityHourlyRisk(...)` computes deterministic risk for a Phase 7 `TripActivity` using only hourly rows that overlap the activity window.

Output includes score, low/medium/high/unknown level, affected window, stable reason codes, move/fallback signals, confidence and rows used.

Implemented hazards:

- rain / precipitation probability;
- heat / apparent temperature;
- cold;
- sustained wind / gust;
- UV.

Rules:

- missing activity time or overlapping hourly coverage -> `unknown`;
- later non-overlapping weather cannot contaminate an earlier activity;
- indoor activities are not falsely penalized by rain/UV when they are not sensitive;
- family/senior profiles use more conservative thresholds;
- fixed/required-reservation activities can remain high risk but never return a move recommendation;
- risk engine is pure with no network/storage/mutation side effects.

Acceptance evidence:

- focused Slice B Vitest contract: success;
- Deploy Run 279: success across full repository CI/static export/Preview deployment;
- Phase 5 Weather Intelligence Preview regression: success;
- Phase 6 Weather Discovery Preview regression: success;
- Phase 7 Activity Intelligence Preview regression: success;
- Phase 8 Hourly Preview regression: success.

### Slice B acceptance

- [x] deterministic focused Vitest contract passes;
- [x] heavy rain makes a rain-sensitive outdoor activity high risk;
- [x] non-overlapping later weather does not contaminate a morning activity;
- [x] indoor rain/UV behavior stays materially safer;
- [x] family/senior heat thresholds are more conservative than adults;
- [x] fixed/required-reservation constraints suppress move recommendations;
- [x] missing time/hourly data fails closed to unknown;
- [x] full repository CI and existing Preview regressions pass.

---

## Slice C — Deterministic replan solver

Status: **In Progress**

### Goal

Generate a bounded set of safe changes, not prose-only advice.

Hard constraints:

1. fixed activities never move automatically;
2. required reservations never move automatically;
3. transport/deadline activities remain fixed;
4. must-do activities cannot be replaced;
5. candidate time shifts cannot overlap another known activity;
6. proposals remain on the same trip day;
7. no proposal is applied automatically.

Optimization order:

1. zero hard-constraint violations;
2. maximize weather-risk reduction;
3. preserve must-see activities;
4. prefer same-day time shifts before replacement;
5. prefer curated lower-risk fallback POIs;
6. minimize edit count, time shift and approximate travel delta.

The solver is pure and deterministic for the same activity/workspace/hourly snapshot inputs.

### Slice C acceptance

- [ ] high-risk fixed/required/transport activities remain unchanged;
- [ ] same-day safer time shift is preferred over replacement;
- [ ] candidate shifts that overlap another activity are rejected;
- [ ] lower-risk indoor fallback can be proposed when no adequate time shift exists;
- [ ] must-do activity is never replaced;
- [ ] missing hourly coverage creates no optimistic proposal;
- [ ] identical inputs produce identical proposals;
- [ ] proposal draft includes risk before/after, reason codes and travel delta;
- [ ] focused tests and full repository Preview gate pass.

---

## Slice D — Proposed Revision API / permissions

Represent a replan as an immutable proposal with baseVersion, weatherSnapshotId, structured changes, before/after risk, approximate travel delta, reason codes and unchanged fixed activity IDs.

OWNER / EDITOR may create/review/apply; VIEWER remains read-only; stale baseVersion fails closed. Applying must use the normal Cloud Trip update/revision path rather than bypassing optimistic locking.

---

## Slice E — Review / apply UX

Workspace review flow:

```text
Weather changed
-> affected structured activities
-> Before / After proposal
-> risk reduction + reasons
-> fixed items explicitly unchanged
-> Accept all / select changes / reject
-> normal Cloud Trip revision created
```

EN / zh-CN / zh-Hant, mobile-first, accessible and never silently mutating.

---

## Slice F — Today / Execution Mode + release

Today Mode surfaces the active local day, next structured activity, current hourly window, Weather Insights, accepted weather-driven changes and fixed deadlines.

Final Preview/Production smoke must create a Workspace v2 Cloud Trip, read real hourly weather, produce a deterministic proposal, preserve fixed constraints, apply selected changes as OWNER/EDITOR through normal revisions, reject VIEWER writes and reject stale baseVersion.

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
2. Slice B — pure activity risk engine. **Complete.**
3. Slice C — pure deterministic solver. **In Progress.**
4. Slice D — proposal API + permissions/version guard.
5. Slice E — review/apply UI + Cloud revisions.
6. Slice F — Today Mode + full Preview/Production acceptance.

No Slice advances past its acceptance gate with known failing tests or unresolved safety constraints.
