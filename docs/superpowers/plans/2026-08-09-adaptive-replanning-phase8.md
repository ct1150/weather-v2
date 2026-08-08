# Where Not Rain — Phase 8: Adaptive Replanning

Date: 2026-08-09
Status: In Progress

## Outcome

Turn Phase 5 weather change detection plus Phase 7 structured activities into a safe, explicit replanning workflow:

**Hourly weather -> activity risk -> deterministic proposal -> explainable diff -> user approval -> normal Cloud Trip revision -> Today execution view.**

No weather-driven mutation is applied without an explicit user action.

## Baseline correction

Phase 8 does **not** need a new hourly-weather database design. `weather_hourly`, provider hourly normalization and snapshot persistence already existed; Slice A exposes them through the provider-isolated `weather-read` boundary.

```text
provider -> weather-sync -> immutable Weather D1 snapshot -> weather-read -> Trip / UI
```

Browser and Trip API paths must never call a weather provider directly.

---

## Slice A — Hourly weather read contract

Status: **Complete**

Delivered `GET /api/v1/trip-hourly` with one local date, 1–4 cities, optional hour bounds, active-snapshot-only reads and explicit available/unavailable coverage.

Acceptance:

- focused weather-read tests: success;
- Deploy Run 273: full repository CI + Preview deployment success;
- dedicated Hourly Preview smoke: success with persisted Tokyo hourly data;
- invalid hour window / >4 cities fail closed;
- daily Trip APIs and provider isolation unchanged.

---

## Slice B — Activity risk engine

Status: **Complete**

`assessActivityHourlyRisk(...)` is a pure deterministic engine over Phase 7 structured activities and overlapping hourly weather.

Delivered:

- rain / heat / cold / wind / UV risk;
- low / medium / high / unknown;
- stable reason codes and affected hour window;
- family/senior conservative thresholds;
- fixed/required reservation constraints suppress move recommendations;
- missing activity time/hourly coverage -> unknown;
- confidence reflects hourly coverage/data quality.

Acceptance:

- focused Slice B tests: success;
- Deploy Run 279: full repository CI/static export/Preview deployment success;
- Phase 5, Phase 6, Phase 7 and Hourly Preview regressions: success.

---

## Slice C — Deterministic replan solver

Status: **Implementation verified; full repository gate pending on formatted solver head**

`buildDeterministicReplan(...)` returns a proposal draft only. It has no network, storage or mutation side effects.

Hard constraints:

1. fixed activities remain unchanged;
2. required reservations remain unchanged;
3. transport activities remain unchanged;
4. must-do activities may move in time when safe but are never replaced;
5. candidate time shifts cannot overlap another known activity interval;
6. solver never moves an activity earlier than its original start;
7. changes remain on the same local day;
8. no proposal is applied automatically.

Optimization:

1. zero hard-constraint violations;
2. maximize risk reduction;
3. prefer same-day later time shift;
4. if no adequate shift exists, consider a lower-risk fallback for non-must activities;
5. minimize time shift / approximate relocation cost using deterministic tie-breakers.

Proposal draft includes:

- complete before/after `TripActivity` objects;
- risk before/after and risk reduction;
- `better_hourly_window` / `indoor_fallback` reason codes;
- approximate travel delta (zero for time move, haversine-based conservative relocation estimate when coordinates exist);
- aggregate before/after risk;
- explicit `unchangedFixedActivityIds`;
- source weather snapshot ID and local date.

Focused Slice C tests verify:

- high-risk fixed/required/transport activities remain unchanged;
- same-day safer shift is preferred before replacement;
- overlap candidates are rejected;
- indoor fallback is used only when no adequate shift exists;
- must-do is never replaced;
- missing hourly coverage creates no optimistic proposal;
- identical inputs return equivalent proposal values.

### Slice C acceptance

- [x] high-risk fixed/required/transport activities remain unchanged;
- [x] same-day safer time shift is preferred over replacement;
- [x] candidate shifts that overlap another activity are rejected;
- [x] lower-risk indoor fallback can be proposed when no adequate time shift exists;
- [x] must-do activity is never replaced;
- [x] missing hourly coverage creates no optimistic proposal;
- [x] identical inputs produce identical proposals;
- [x] proposal draft includes risk before/after, reason codes and travel delta;
- [x] focused Activity Risk + Solver tests pass;
- [ ] full repository CI and Preview regressions pass on the formatted solver head.

---

## Slice D — Proposed Revision API / permissions

Next after Slice C repository acceptance.

The apply boundary must reuse normal Cloud Trip validation, OWNER/EDITOR access control and optimistic `baseVersion` protection. It must not create a second write path that bypasses immutable revisions/activity records.

Target proposal/application contract includes baseVersion, weatherSnapshotId, selected changes, before/after risk and resulting validated Workspace v2 document. VIEWER writes and stale versions fail closed.

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

Today Mode surfaces active local day, next structured activity, current hourly window, Weather Insights, accepted changes and fixed deadlines.

Final Preview/Production smoke must create Workspace v2 Cloud Trip, read real hourly weather, produce a deterministic proposal, preserve fixed constraints, apply selected changes as OWNER/EDITOR through normal revisions, reject VIEWER writes and reject stale baseVersion.

---

## Phase 8 Definition of Done

- [x] Hourly weather path is available through bounded provider-isolated reads.
- [x] Activity-level risk supports rain/heat/cold/wind/UV.
- [x] Missing hourly data remains unknown/fail-closed.
- [x] Fixed/reservation constraints are represented without silent movement.
- [x] Replan solver returns deterministic proposal drafts for covered cases.
- [x] Proposal draft explains risk reduction, edits and travel impact.
- [ ] User approval is mandatory before itinerary mutation.
- [ ] Accepted changes create standard Cloud Trip revision/activity records.
- [ ] VIEWER and stale-version mutation protection is enforced server-side.
- [ ] Today Mode works for the active trip day.
- [ ] EN / zh-CN / zh-Hant complete.
- [ ] Phase 5–7 regressions remain green on final Phase 8 acceptance head.
- [ ] Full repository gates pass on final Phase 8 head.
- [ ] Dedicated Preview and Production Phase 8 smoke pass.

## Execution order

1. Slice A — hourly read contract + Preview smoke. **Complete.**
2. Slice B — pure activity risk engine. **Complete.**
3. Slice C — pure deterministic solver. **Implementation verified; repository acceptance pending.**
4. Slice D — proposal/apply API + permissions/version guard.
5. Slice E — review/apply UI + Cloud revisions.
6. Slice F — Today Mode + full Preview/Production acceptance.

No Slice advances past its acceptance gate with known failing tests or unresolved safety constraints.
