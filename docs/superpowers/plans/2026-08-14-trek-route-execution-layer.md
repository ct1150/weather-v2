# Weather V2 — TREK-inspired Route & Execution Layer

Date: 2026-08-14
Status: Implemented / CI validation pending
Branch: `agent/trek-route-execution-layer`
PR: `#45`

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

Delivered:

- this implementation plan;
- explicit clean-room rule in `route-intelligence.ts`;
- no TREK file copied into Weather V2;
- implementation based on generic algorithms (nearest-neighbor, 2-opt, OSRM HTTP contract, MapLibre rendering).

Acceptance:

- repository contains no new TREK copyright/license headers;
- existing Weather V2 architecture boundaries stay intact.

## 4. T1 — Route Intelligence (P0)

### Delivered domain contracts

- `RouteWaypoint`
- `RouteAnchor`
- `RouteLeg`
- `RoutePlan`
- `RouteProfile`
- `RouteCostMatrix`

### Delivered pure route optimizer

- deterministic nearest-neighbor seed;
- deterministic 2-opt improvement;
- optional start/end hotel anchors;
- locked waypoint preservation;
- estimated route fallback when a routing service is unavailable.

### Delivered routing adapter

OSRM-compatible adapter with:

- driving route geometry;
- per-leg distance/duration;
- configurable routing base URL;
- public no-key default;
- bounded route and table requests;
- route-aware activity-to-fallback travel-time matrix;
- strict optional `AbortSignal` handling compatible with `exactOptionalPropertyTypes`.

### Delivered replan integration

The deterministic replan input accepts an optional real route matrix. When present, fallback selection and displayed relocation cost use routed minutes. Missing routed values fail gracefully to the existing deterministic geometric approximation.

Tests added:

- route optimizer locks and anchors;
- deterministic ordering;
- estimated hotel-bookended route;
- OSRM route parser;
- OSRM table/matrix parser;
- routed fallback-cost regression.

## 5. T2 — Route-aware Trip Execution Mode (P0)

Delivered routes:

- `/trips/execution`
- `/zh-cn/trips/execution`
- `/zh-hant/trips/execution`

Delivered execution surface:

- EN / zh-CN / zh-Hant UI;
- day selector;
- route-preview-aligned activity/reservation timeline;
- compact fixed-constraint badges;
- route summary;
- real-route refresh;
- local estimated-route fallback;
- route optimization and persistence;
- MapLibre + OpenFreeMap route map;
- external Google Maps handoff;
- graceful fallback when coordinates/routing/WebGL are unavailable.

All existing Workspace pages now expose an explicit Execution Mode entry.

Acceptance behavior:

- editing remains in the existing Workspace;
- execution mode uses the same `TRIP_WORKSPACE_STORAGE_KEY` document;
- route optimization persists reordered structured activities back to Workspace;
- non-geocoded activities remain in place and are never discarded;
- locked/required/transport items are not reordered;
- preview timeline and map share the same optimized order before persistence.

## 6. T3 — Reservation / hard constraint layer (P0/P1)

Weather V2 already has canonical structured activity fields (`category`, `reservation`, `flexibility`, start/end time). To avoid a breaking Trip document schema migration, this increment adds an execution `TripReservation` projection from those canonical activities.

Delivered rules:

- transport -> hard reservation;
- `reservation=required` -> hard reservation;
- `flexibility=fixed` -> hard reservation;
- hotel coordinates -> route anchor;
- hard execution entities lock their source activity;
- hard constraints are passed to route optimization and remain protected by deterministic replan.

This keeps Cloud Trip/revision compatibility while creating a seam for a future persisted standalone reservation entity.

Tests added:

- hard-constraint classification;
- reservation projection;
- hotel anchors;
- route persistence without moving hard constraints;
- combined execution projection.

## 7. Route-aware weather replanning

Delivered in Execution Mode:

```text
weather-read hourly snapshot
  + structured activities
  + curated fallback POIs
  + OSRM route-cost matrix (best effort)
  -> deterministic replan
```

Rules:

- fixed/required/transport activities stay protected;
- safer same-day time moves remain preferred over replacements;
- fallback replacement ranking uses real routed minutes when available;
- OSRM failure falls back to the prior deterministic geometric estimate;
- no automatic itinerary mutation is introduced.

## 8. Validation gates

Required before merge:

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. web build/static export
6. existing Phase 6/7/8/9 regressions
7. route-execution unit/regression coverage

Current CI note:

- early PR runs failed before acquiring a GitHub Actions runner (`runner_id=0`, `steps=[]`), so those failures did not execute checkout, install, typecheck, tests, or build;
- later runs reached queued state and remain the authoritative validation path;
- PR stays Draft until executable CI gates complete successfully.

## 9. Rollout

1. Merge as a backwards-compatible additive feature only after CI validation.
2. Keep routing adapter fail-open to estimated geometry; routing failure must never break Workspace.
3. Observe public routing usage before considering a dedicated Cloudflare routing proxy/provider.
4. Persist a standalone reservation entity only after Cloud Trip document migration is explicitly designed and versioned.
