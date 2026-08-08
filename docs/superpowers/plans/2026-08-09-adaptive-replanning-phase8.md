# Where Not Rain — Phase 8: Adaptive Replanning

Date: 2026-08-09
Status: In Progress

## Outcome

Turn Phase 5 weather change detection plus Phase 7 structured activities into a safe, explicit replanning workflow:

**Hourly weather -> activity risk -> deterministic proposal -> explainable diff -> user approval -> normal Cloud Trip revision -> Today execution view.**

No weather-driven mutation is applied without an explicit user action.

## Baseline

Hourly rows were already snapshot-versioned and persisted. Phase 8 preserves the existing provider boundary:

```text
provider -> weather-sync -> immutable Weather D1 snapshot -> weather-read -> Trip / UI
```

---

## Slice A — Hourly weather read contract

Status: **Complete**

- bounded `GET /api/v1/trip-hourly`;
- one local date, 1–4 cities, optional hour bounds;
- active-snapshot-only reads;
- explicit available/unavailable coverage;
- no provider dependency in `weather-read`;
- Deploy Run 273 + dedicated Hourly Preview smoke: success.

---

## Slice B — Activity risk engine

Status: **Complete**

Pure deterministic `assessActivityHourlyRisk(...)` over overlapping hourly rows and Phase 7 structured activities.

- rain / heat / cold / wind / UV;
- low / medium / high / unknown;
- stable reason codes;
- family/senior conservative thresholds;
- fixed/required reservation suppress move suggestions;
- missing time/hourly data fails closed;
- Deploy Run 279 + Phase5/6/7/Hourly Preview regressions: success.

---

## Slice C — Deterministic replan solver

Status: **Complete**

Pure `buildDeterministicReplan(...)` produces proposal drafts only.

Hard constraints:

1. fixed activities remain unchanged;
2. required reservations remain unchanged;
3. transport remains unchanged;
4. must-do may move in time but is never replaced;
5. known interval overlaps are rejected;
6. solver never moves an activity earlier than its original start;
7. changes remain on the same local day;
8. solver has no mutation/network/storage side effects.

Optimization:

- maximize risk reduction;
- prefer same-day later time shift;
- use lower-risk fallback only when no adequate shift exists;
- deterministic tie-breakers minimize shift / approximate relocation cost.

Proposal draft includes before/after activities, risk before/after, risk reduction, reason codes, travel delta, aggregate risk, unchanged fixed IDs, date and weather snapshot ID.

Acceptance evidence:

- focused Activity Risk + Solver tests: success;
- fixed/required/transport unchanged: success;
- overlap rejection: success;
- safer shift before fallback: success;
- must-do not replaced: success;
- missing hourly data no optimistic proposal: success;
- identical inputs equivalent outputs: success;
- Deploy Run 285: full repository CI/static export/Preview deployment success;
- Phase5/6/7/Hourly Preview regressions on the solver acceptance series: success.

---

## Slice D — Proposal apply boundary / permissions

Status: **In Progress**

### Design

Proposal generation remains client/pure and ephemeral. The server owns the **apply boundary** only.

Target endpoint:

`POST /api/v1/trips/:tripId/replan/apply`

Required body:

```text
baseVersion
locale
document                 # resulting validated Workspace v2 document
weatherSnapshotId
selectedChangeIds[]       # activity IDs explicitly approved by user
```

Server invariants:

1. resulting document must be Workspace v2 and pass normal Trip validation;
2. OWNER / EDITOR only; VIEWER fails 403 through the existing update path;
3. stale `baseVersion` fails 409 with currentVersion;
4. top-level trip metadata and day structure cannot be changed through replan apply;
5. dates, destinations, themes, flexibility and notes cannot be changed through replan apply;
6. activity count/order/IDs stay stable; solver changes activity fields in place;
7. actual changed structured activity IDs must exactly match `selectedChangeIds`;
8. compatibility `activities` may change only on a day whose structured activities changed;
9. at least one structured activity must actually change;
10. successful apply calls the existing `updateTrip(...)` path with operation `replan`, creating normal immutable revision/activity records;
11. replan audit activity payload records the weather snapshot ID and selected activity IDs.

No new D1 table is required for ephemeral proposal drafts.

### Slice D acceptance

- [ ] valid OWNER apply creates version+1 normal revision;
- [ ] EDITOR apply succeeds through the same boundary;
- [ ] VIEWER apply is rejected server-side;
- [ ] stale baseVersion returns 409/currentVersion;
- [ ] unrelated title/date/city/note changes are rejected;
- [ ] selected IDs must exactly match actual structured activity changes;
- [ ] no-op apply is rejected;
- [ ] revision operation is `replan` and activity audit contains weatherSnapshotId/selectedChangeIds;
- [ ] focused Trip API tests pass;
- [ ] full repository Preview gate passes.

---

## Slice E — Review / apply UX

After Slice D acceptance, build mobile-first EN / zh-CN / zh-Hant proposal review, selected-change application and rejection UI. Applying uses Slice D and therefore creates normal Cloud Trip revisions.

---

## Slice F — Today / Execution Mode + release

Today Mode surfaces active local day, next structured activity, current hourly window, Weather Insights, accepted changes and fixed deadlines.

Final Preview/Production smoke must create Workspace v2 Cloud Trip, read real hourly weather, produce a deterministic proposal, preserve fixed constraints, apply selected changes as OWNER/EDITOR, reject VIEWER writes and reject stale baseVersion.

---

## Phase 8 Definition of Done

- [x] bounded provider-isolated hourly weather path;
- [x] activity-level rain/heat/cold/wind/UV risk;
- [x] missing hourly data unknown/fail-closed;
- [x] fixed/reservation constraints represented without silent movement;
- [x] deterministic replan proposal drafts;
- [x] proposal draft explains risk/edit/travel impact;
- [ ] explicit user approval required before mutation;
- [ ] approved changes create standard Cloud Trip revision/activity records;
- [ ] VIEWER and stale-version protection enforced server-side;
- [ ] Today Mode works for active trip day;
- [ ] EN / zh-CN / zh-Hant complete;
- [ ] Phase 5–7 regressions green on final Phase 8 head;
- [ ] final repository gates green;
- [ ] dedicated Preview and Production Phase 8 smoke green.

## Execution order

1. Slice A — hourly read. **Complete.**
2. Slice B — activity risk. **Complete.**
3. Slice C — deterministic solver. **Complete.**
4. Slice D — apply boundary + permissions/version guard. **In Progress.**
5. Slice E — review/apply UX.
6. Slice F — Today Mode + final acceptance.
