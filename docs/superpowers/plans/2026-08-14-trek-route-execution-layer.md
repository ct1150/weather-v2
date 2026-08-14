# Weather V2 — TREK-inspired Route & Execution Layer

Date: 2026-08-14
Status: T0–T6 implemented / executable CI blocked by GitHub Billing
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
  -> offline execution / export
```

## 2. Architecture guardrails

1. Do not copy TREK AGPL source code. Reimplement behavior from first principles.
2. Do not change the existing weather provider boundary: `weather-sync` remains the only weather-provider caller.
3. Do not replace MapLibre/OpenFreeMap.
4. Do not introduce NestJS, SQLite, Redis, paid routing, or a request-time weather backend.
5. Do not silently mutate fixed/required/transport activities.
6. Preserve existing Workspace v1/v2 import, local storage, Cloud Trip, revision, and sharing compatibility.
7. Keep all new execution capabilities additive and Cloudflare static-export compatible.

## 3. T0 — Reference boundary

Delivered:

- this implementation plan;
- explicit clean-room rule in `route-intelligence.ts`;
- no TREK file copied into Weather V2;
- implementation based on generic algorithms and public protocols only.

## 4. T1 — Route Intelligence

Delivered:

- `RouteWaypoint`, `RouteAnchor`, `RouteLeg`, `RoutePlan`, `RouteProfile`, `RouteCostMatrix`;
- deterministic nearest-neighbor + 2-opt optimization;
- hotel start/end anchors;
- locked waypoint preservation;
- estimated route fallback;
- OSRM-compatible route geometry and table/matrix adapters;
- bounded route requests;
- strict optional `AbortSignal` handling;
- real route-cost injection into deterministic weather replan;
- geometric travel-cost fallback when routing is unavailable.

Tests cover locks, anchors, deterministic ordering, OSRM parsing and routed fallback selection.

## 5. T2 — Route-aware Trip Execution Mode

Delivered routes:

- `/trips/execution`
- `/zh-cn/trips/execution`
- `/zh-hant/trips/execution`

Delivered UI/behavior:

- EN / zh-CN / zh-Hant Execution Mode;
- day selector;
- route-preview-aligned timeline;
- fixed constraint badges;
- route summary;
- real road refresh;
- estimated route fallback;
- route optimization + persistence;
- MapLibre + OpenFreeMap route map;
- external Google Maps handoff;
- existing Workspace routes link into Execution Mode.

The timeline and map use the same optimized preview order before the user persists it.

## 6. T3 — Reservation / hard constraints

Delivered as a non-breaking projection from the existing structured activity schema:

- transport -> hard reservation;
- `reservation=required` -> hard reservation;
- `flexibility=fixed` -> hard reservation;
- hotel coordinates -> route anchor;
- hard entities lock their source activity;
- route optimization and deterministic replan preserve hard constraints.

No Trip document schema migration is introduced.

## 7. Route-aware weather replanning

Execution Mode now combines:

```text
persisted hourly weather
+ structured activities
+ curated fallback POIs
+ OSRM route-cost matrix (best effort)
-> deterministic replan
```

Rules:

- fixed/required/transport activities stay protected;
- safer same-day time moves remain preferred;
- fallback replacement uses real routed minutes when available;
- OSRM failure degrades to the existing deterministic geometric estimate;
- no automatic itinerary mutation is introduced.

## 8. T4 — Offline Execution / PWA

Delivered without adding Dexie/Workbox dependencies:

- static `manifest.webmanifest`;
- root Service Worker registration;
- installable standalone PWA metadata;
- network-first navigation cache;
- stale-while-revalidate same-origin asset cache;
- cross-origin API traffic is not intercepted/cached by the Service Worker;
- localized online/offline status banner;
- native IndexedDB stores for Trip bundle, weather bundle, route plans and queued mutation records;
- explicit mutation status model: `pending | syncing | failed | conflict`;
- “Download trip for offline use” saves the active Trip, saved weather and estimated route for every day;
- the same action pre-caches locale-specific Trips / Workspace / Execution shell routes;
- most recent offline Trip can be restored to the local editor when localStorage is unavailable/lost;
- IndexedDB transaction lifecycle is fail-safe and cache operations never break the live Trip.

Map vector-tile bulk download is deliberately not added; the PWA stores the executable Trip/weather/route data and lets MapLibre degrade when map-network data is unavailable.

## 9. T5 — Weather Execution UX

Delivered in Execution Mode:

- day-by-day saved weather overview;
- condition;
- min/max temperature;
- rain probability;
- wind speed;
- UV;
- sunrise/sunset;
- freshness/stale indication;
- existing hourly weather remains the source for route-aware replan analysis;
- no browser request directly calls a weather provider.

## 10. T6 — Export & Travel Utilities

Delivered:

- ICS calendar export for structured activities;
- timed and all-day activity support;
- GEO coordinates in calendar events where available;
- printable full-trip HTML;
- browser Print / Save PDF flow with HTML-download fallback when popup creation is blocked;
- deterministic weather-driven packing list;
- rain, UV, heat, cold and wind packing rules;
- family and senior comfort additions;
- EN / zh-CN / zh-Hant packing copy;
- PWA/offline/export contract tests;
- pure export/packing unit tests.

Budget, journal, generic document management and TREK's plugin/MCP system remain intentionally outside the Weather V2 weather-first product boundary.

## 11. Validation gates

Required before merge:

1. `pnpm format:check`
2. `pnpm lint`
3. library package builds
4. `pnpm typecheck`
5. `pnpm test`
6. docs gate
7. Next.js static export
8. worker builds
9. existing Phase 6/7/8/9 regression workflows
10. route/PWA/export tests added in this branch

### Current GitHub Actions blocker

GitHub Actions is not reaching repository code. The check annotation reports:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings.

Observed behavior:

- `runner_id=0`;
- `steps=[]`;
- Deploy fails before checkout;
- rerunning failed jobs reproduces the same result;
- all Phase verification workflows fail for the same pre-run billing reason.

Therefore no CI failure currently demonstrates a source/build/test defect. PR #45 remains Draft until GitHub Billing / Actions spending is restored and the full gates execute.

## 12. Rollout

1. Fix GitHub Billing / Actions spending limit.
2. Rerun PR #45 workflows.
3. Fix any real code/test/build failures that appear after a runner is allocated.
4. Keep PR Draft until all required gates pass.
5. Mark Ready and merge only after successful executable validation.
6. Observe public OSRM usage before considering a dedicated routing service/proxy.
