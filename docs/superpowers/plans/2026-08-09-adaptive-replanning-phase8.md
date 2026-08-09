# Where Not Rain — Phase 8: Adaptive Replanning

Date: 2026-08-09
Status: Complete

## Outcome

Turn Phase 5 weather change detection plus Phase 7 structured activities into a safe, explicit replanning workflow:

**Hourly weather -> activity risk -> deterministic proposal -> explainable diff -> user approval -> normal Cloud Trip revision -> Today execution view.**

No weather-driven mutation is applied without an explicit user action.

## Baseline

Hourly rows were already snapshot-versioned and persisted. Phase 8 preserves the existing provider boundary:

```text
provider -> weather-sync -> immutable Weather D1 snapshot -> weather-read -> Trip / UI
```

Browser and Trip API user paths do not call a weather provider directly.

---

## Slice A — Hourly weather read contract

Status: **Complete**

Delivered bounded `GET /api/v1/trip-hourly` with:

- one local calendar date per call;
- 1–4 unique city IDs;
- optional 0–23 hour bounds;
- active immutable snapshot only;
- explicit available/unavailable coverage;
- no synthetic optimistic weather;
- fixed-origin CORS and `private, no-store`;
- no provider dependency in `weather-read`.

Acceptance:

- focused weather-read integration tests: success;
- full repository Deploy 273: success;
- dedicated Hourly Preview smoke against persisted hourly data: success.

---

## Slice B — Activity risk engine

Status: **Complete**

Pure deterministic `assessActivityHourlyRisk(...)` over overlapping hourly rows and Phase 7 structured activities.

Hazards:

- rain / precipitation probability;
- heat / apparent temperature;
- cold;
- sustained wind / gust;
- UV.

Rules:

- missing activity time or hourly coverage -> `unknown`;
- only overlapping local-hour rows influence risk;
- indoor activities avoid false rain/UV exposure penalties;
- family/senior profiles use more conservative thresholds;
- fixed/required-reservation activities may remain high risk but never receive a move recommendation;
- no network, storage or mutation side effects.

Acceptance:

- focused deterministic Activity Risk tests: success;
- full repository Deploy 279: success;
- Phase 5/6/7/Hourly Preview regressions: success.

---

## Slice C — Deterministic replan solver

Status: **Complete**

Pure `buildDeterministicReplan(...)` produces proposal drafts only.

Hard constraints:

1. fixed activities remain unchanged;
2. required reservations remain unchanged;
3. transport remains unchanged;
4. must-do activities may move in time but are never replaced;
5. known interval overlaps are rejected;
6. solver never moves an activity earlier than its original start;
7. changes remain on the same local day;
8. solver has no mutation/network/storage side effects.

Optimization order:

1. zero hard-constraint violations;
2. maximize weather-risk reduction;
3. preserve must-see activities;
4. prefer same-day later time shifts;
5. prefer curated lower-risk fallback POIs only when no adequate shift exists;
6. minimize shift / approximate relocation cost with deterministic tie-breakers.

Proposal draft includes before/after activities, risk before/after, risk reduction, reason codes, travel delta, aggregate risk, unchanged fixed IDs, date and weather snapshot ID.

Acceptance:

- focused Activity Risk + Solver tests: success;
- fixed/required/transport unchanged: success;
- overlap rejection: success;
- safer shift before fallback: success;
- must-do not replaced: success;
- missing hourly data no optimistic proposal: success;
- equivalent inputs produce equivalent outputs: success;
- full repository Deploy 285: success;
- Phase 5/6/7/Hourly Preview regressions: success.

---

## Slice D — Proposal apply boundary / permissions

Status: **Complete**

Endpoint:

`POST /api/v1/trips/:tripId/replan/apply`

Required body:

```text
baseVersion
locale
document
weatherSnapshotId
selectedChangeIds[]
```

Server invariants:

1. resulting document must be valid Workspace v2;
2. OWNER / EDITOR only; VIEWER fails 403;
3. stale `baseVersion` fails 409 with current version;
4. top-level trip metadata and day structure cannot be changed through replan apply;
5. dates, destinations, themes, flexibility and notes cannot be changed through replan apply;
6. activity count/order/IDs remain stable;
7. actual changed structured activity IDs must exactly match `selectedChangeIds`;
8. compatibility `activities` may change only on a day whose structured activity changed;
9. at least one structured activity must actually change;
10. successful apply reuses the existing `updateTrip(...)` path with operation `replan`;
11. immutable revision/activity records are created normally;
12. audit payload records `weatherSnapshotId` and selected activity IDs.

No new D1 proposal table was required; proposal drafts remain deterministic and ephemeral until explicitly applied.

Acceptance:

- OWNER apply: success;
- EDITOR apply: success;
- VIEWER rejection: success;
- stale version rejection: success;
- unrelated metadata change rejection: success;
- selected-change exact matching: success;
- no-op rejection: success;
- revision operation/audit payload verification: success;
- focused Trip API tests: success;
- full repository Deploy 295: success;
- Phase 5/6/7/Hourly Preview regressions: success.

---

## Slice E — Review / apply UX

Status: **Complete**

Delivered mobile-first EN / zh-CN / zh-Hant proposal review:

- hourly analysis without mutation;
- before/after activity and risk presentation;
- fixed activities explicitly shown as unchanged;
- selectable proposal changes;
- local-only and Viewer users can inspect but cannot apply;
- Cloud apply uses only `/replan/apply`;
- local workspace is updated only after server acceptance;
- accepted changes become normal Cloud Trip revisions.

Acceptance:

- focused UI contracts, Activity Risk, Solver and Web typecheck: success;
- full repository Deploy 301: success;
- Phase 5/6/7/Hourly Preview regressions: success.

---

## Slice F — Today / Execution Mode + release

Status: **Complete**

Today Mode surfaces:

- active trip day resolved in the destination timezone, not device timezone;
- current / next structured activity;
- current bounded hourly weather;
- activity-level weather risk;
- fixed constraints and deadlines;
- relevant Weather Insights for Cloud trips;
- latest accepted replan audit context;
- deterministic indoor fallback guidance only when supported by available hourly data.

Focused Today Mode resolver/UI contracts and Web typecheck passed.

### Final Preview acceptance

Final acceptance head:

`af7d69b3fe0b1dc353cacbd741a6d7ea1abf5e00`

All six final gates passed:

1. full repository Deploy 313 + Preview deployment;
2. Phase 5 Weather Intelligence Preview regression;
3. Phase 6 Discovery Preview regression;
4. Phase 7 Activity Intelligence Preview regression;
5. Phase 8 Hourly Weather Preview regression;
6. Phase 8 Adaptive Replanning Preview end-to-end smoke.

The Preview end-to-end smoke verified real persisted hourly weather, deterministic same-day later replanning, OWNER/EDITOR apply, fixed transport preservation, VIEWER rejection, stale-version rejection, immutable `replan` revisions and weather-snapshot audit context.

### Merge and Production acceptance

PR #37 squash merged to `main` as product release SHA:

`c26a444e1a2ebf51664276da7dfbf4a737a5a607`

Production Deploy Run:

`31320097163`

Production Deploy: **success**.

The production run passed format, lint, typecheck, unit/integration tests, documentation gate, static export, all Worker builds, production Weather D1 migrations/seed, production weather-sync Cron, protected weather refresh, weather-read deployment, Trip D1, Trip API, Better Auth migration, Trip API production smoke, Pages production deployment, IndexNow and final active-snapshot freshness/Cron smoke.

Dedicated Phase 8 Production Adaptive Replanning smoke: **success**.

Production smoke verified:

- real persisted hourly weather snapshot read;
- deterministic same-day later proposal;
- OWNER replan apply;
- EDITOR replan apply;
- fixed transport constraint unchanged;
- VIEWER apply rejected;
- stale `baseVersion` rejected with current version;
- immutable `replan` revisions created;
- replan audit retained weather snapshot and selected activity IDs.

Authoritative evidence: `PHASE8_REPLAN_SMOKE_STATUS.md` bound to release SHA `c26a444e1a2ebf51664276da7dfbf4a737a5a607`.

---

## Phase 8 Definition of Done

- [x] bounded provider-isolated hourly weather path;
- [x] activity-level rain/heat/cold/wind/UV risk;
- [x] missing hourly data unknown/fail-closed;
- [x] fixed/reservation constraints represented without silent movement;
- [x] deterministic replan proposal drafts;
- [x] proposal draft explains risk/edit/travel impact;
- [x] explicit user approval required before mutation;
- [x] approved changes create standard Cloud Trip revision/activity records;
- [x] VIEWER and stale-version protection enforced server-side;
- [x] Today Mode works for the active destination-local trip day;
- [x] EN / zh-CN / zh-Hant complete;
- [x] Phase 5–7 regressions green on final Phase 8 acceptance head;
- [x] final repository gates green;
- [x] dedicated Preview and Production Phase 8 smoke green.

## Conclusion

Phase 8 is complete and production accepted. No known Phase 8 product, CI, Preview or Production acceptance debt remains. Continue with the existing Phase 9 plan without expanding Phase 8 scope.
