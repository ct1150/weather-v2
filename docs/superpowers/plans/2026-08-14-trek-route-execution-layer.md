# Weather V2 — TREK-inspired Route & Execution Layer

Date: 2026-08-14
Status: Implementing
Branch: `agent/trek-route-execution-layer`

## 1. Objective

Add the strongest execution-layer ideas identified in TREK without importing TREK source code or changing Weather V2's weather-first architecture.

Target loop:

```text
Structured activities
  -> hard execution constraints
  -> route optimization
  -> real road duration / geometry
  -> execution timeline + map
  -> hourly weather
  -> deterministic replan
  -> route-aware fallback cost
```

## 2. Non-goals / architecture guardrails

1. Do not copy TREK AGPL source code. Reimplement behavior from first principles.
2. Do not change the existing weather provider boundary: `weather-sync` remains the only weather-provider caller.
3. Do not replace MapLibre/OpenFreeMap.
4. Do not introduce NestJS, SQLite, Redis, paid routing, or a request-time weather backend.
5. Do not silently mutate fixed/required/transport activities.
6. Preserve existing Workspace v1/v2 import, local storage, Cloud Trip, revision, and sharing compatibility.

## 3. T0 — Reference boundary

Deliverables:

- this implementation plan;
- explicit clean-room rule in source comments;
- no TREK file copied into Weather V2;
- implementation based on generic algorithms (nearest-neighbor, 2-opt, OSRM HTTP contract, MapLibre rendering).

Acceptance:

- repository contains no new TREK copyright/license headers;
- existing Weather V2 architecture boundaries stay intact.

## 4. T1 — Route Intelligence (P0)

### Domain contracts

Add:

- `RouteWaypoint`
- `RouteAnchor`
- `RouteLeg`
- `RoutePlan`
- `RouteProfile`

### Pure route optimizer

Implement deterministic:

- nearest-neighbor seed;
- 2-opt improvement;
- optional start/end hotel anchors;
- locked waypoint preservation;
- deterministic tie-breaking;
- estimated route fallback when a routing service is unavailable.

### Routing adapter

Add OSRM-compatible adapter with:

- driving route geometry;
- per-leg distance/duration;
- configurable routing base URL;
- public no-key default;
- bounded route and table requests;
- route-aware activity-to-fallback travel-time matrix.

### Replan integration

Extend the deterministic replan input with an optional real route matrix. When present, fallback selection and displayed relocation cost use routed minutes instead of the previous straight-line / fixed-speed approximation. Missing routed values fail gracefully to the existing approximation.

Acceptance:

- route optimizer tests cover locks, anchors, deterministic ordering, and distance improvement;
- routing parser/matrix tests cover success and malformed responses;
- replan regression proves routed travel cost wins over geometric approximation when supplied.

## 5. T2 — Route-aware Trip Execution Mode (P0)

Add a dedicated execution surface that reads/writes the same local Workspace document rather than replacing the existing editor.

Routes:

- `/trips/execution`
- `/zh-cn/trips/execution`
- `/zh-hant/trips/execution`

Execution surface:

- day selector;
- merged time-ordered activity/reservation timeline;
- compact fixed-constraint badges;
- route summary;
- real-route refresh;
- route optimization;
- MapLibre route map;
- external Maps handoff;
- graceful fallback when coordinates/routing/WebGL are unavailable.

The existing Workspace pages gain an explicit “Execution Mode” link.

Acceptance:

- editing remains in existing Workspace;
- execution mode uses the same `TRIP_WORKSPACE_STORAGE_KEY` document;
- route optimization persists reordered structured activities back to Workspace;
- non-geocoded activities remain in place and are never discarded;
- locked/required/transport items are not reordered.

## 6. T3 — Reservation / hard constraint layer (P0/P1)

Weather V2 already has canonical structured activity fields (`category`, `reservation`, `flexibility`, start/end time). To avoid a breaking Trip document schema migration in this increment, create an execution `TripReservation` entity as a deterministic projection from those canonical activities.

Rules:

- transport -> hard reservation;
- `reservation=required` -> hard reservation;
- `flexibility=fixed` -> hard reservation;
- hotel coordinates -> route anchor;
- confirmed/fixed execution entities lock their source activity;
- hard constraints are passed to route optimization and replan.

This keeps Cloud Trip/revision compatibility while creating a clean seam for a future persisted standalone reservation table/entity.

Acceptance:

- derived reservation tests cover train/flight/ticket/hotel behavior;
- route optimization preserves hard constraints;
- route-aware replan receives constrained activities.

## 7. Validation gates

Required before merge:

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. web build/static export
6. existing Phase 6/7/8/9 regressions
7. dedicated route execution smoke

## 8. Rollout

1. Merge as a backwards-compatible additive feature.
2. Keep routing adapter fail-open to estimated geometry; routing failure must never break Workspace.
3. Observe public routing usage before considering a dedicated Cloudflare routing proxy/provider.
4. Future increment can persist standalone reservations only after Cloud Trip document migration is explicitly designed and versioned.
