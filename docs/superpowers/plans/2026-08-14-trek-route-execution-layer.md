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
- two-waypoint optimization when anchors make order meaningful;
- estimated route fallback;
- OSRM-compatible route geometry and table/matrix adapters;
- bounded route requests;
- strict optional `AbortSignal` handling;
- real route-cost injection into deterministic weather replan;
- geometric travel-cost fallback when routing is unavailable.

Tests cover locks, anchors, two-waypoint anchor ordering, deterministic ordering, OSRM parsing and routed fallback selection.

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
- existing Workspace routes link into Execution Mode;
- localStorage absence falls back to the most recent IndexedDB offline Trip;
- saved route cache is loaded per day when its route-context fingerprint still matches.

The timeline and map use the same optimized preview order before the user persists it.

Safety rule added during implementation review:

- an activity with an explicit `startTime` is **sequence-locked for route optimization**, even when it remains weather-movable in the replan solver;
- only untimed, non-hard-constrained activities can be physically reordered by “Optimize route & save”;
- this prevents route optimization from creating a timeline where a 14:00 activity appears before a 09:00 activity without changing the clock time.

## 6. T3 — Reservation / hard constraints

Delivered as a non-breaking projection from the existing structured activity schema:

- transport -> hard reservation;
- `reservation=required` -> hard reservation;
- `flexibility=fixed` -> hard reservation;
- hotel coordinates -> route anchor;
- hard entities lock their source activity;
- route optimization and deterministic replan preserve hard constraints;
- non-geocoded activities remain in their original slots during route persistence.

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
- OSRM source/fallback IDs are the same IDs consumed by the deterministic solver, so routed relocation values are actually used;
- OSRM failure degrades to the existing deterministic geometric estimate;
- no automatic itinerary mutation is introduced.

## 8. T4 — Offline Execution / PWA

Delivered without adding Dexie/Workbox dependencies:

- static `manifest.webmanifest`;
- production-only root Service Worker registration, avoiding development/HMR cache pollution;
- installable standalone PWA metadata;
- network-first navigation cache;
- stale-while-revalidate same-origin asset cache;
- locale-aware navigation fallback for EN / zh-CN / zh-Hant;
- all-cache-miss navigation returns a valid `Response.error()` rather than `undefined`;
- cross-origin API traffic is not intercepted/cached by the Service Worker;
- localized online/offline status banner;
- native IndexedDB stores for Trip bundle, weather bundle, route plans and queued mutation records;
- explicit mutation status model: `pending | syncing | failed | conflict`;
- “Download trip for offline use” saves the active Trip and saved weather;
- route-context fingerprints invalidate stale route caches after coordinates, order, locks or hotel anchors change;
- matching routed cache is preserved instead of being overwritten by an estimated route during offline download;
- the same action pre-caches locale-specific Trips / Workspace / Execution shell routes;
- most recent offline Trip can be opened directly in Execution Mode when localStorage is unavailable/lost;
- the offline copy can be restored into the local editor;
- IndexedDB transaction lifecycle is fail-safe and cache operations never break the live Trip.

Cloud Trip offline editing is wired into the existing optimistic-concurrency model:

```text
local edit
  -> online PATCH
  -> transient/network failure
  -> coalesced IndexedDB PATCH (latest document, original baseVersion)
  -> more offline edits replace queued document, not baseVersion
  -> browser online event
  -> replay
      -> success: persist remote + delete queue
      -> 403/409: keep local document + conflict UI
      -> transient failure: keep failed queue
```

Additional safety rules:

- `saving` state cannot schedule another autosave loop;
- `offline` state coalesces the latest edit instead of retrying every 900 ms;
- malformed/legacy queue documents fail closed as `OFFLINE_MUTATION_INVALID`;
- 403 after offline editing is treated as a conflict instead of silently replacing local changes with viewer content;
- “Load cloud version” explicitly discards the queued local write before loading remote state.

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
- weather cache keys are shared across the three existing Workspace locales;
- export/offline actions re-read the canonical current Workspace at click time so a just-optimized route is not exported from stale sibling component state;
- weather fallback is workspace-ID-scoped, preventing one Trip's weather from leaking into another Trip;
- existing hourly weather remains the source for route-aware replan analysis;
- no browser request directly calls a weather provider.

## 10. T6 — Export & Travel Utilities

Delivered:

- ICS calendar export for structured activities;
- timed and all-day activity support;
- activities crossing midnight generate a true next-day `DTEND` instead of being truncated to 23:59;
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

## 11. Validation added

New/expanded coverage includes:

- route optimizer locks, anchors and two-point anchor ordering;
- route cache fingerprint determinism/invalidation;
- reservation and hard constraint projection;
- scheduled-activity sequence locks;
- non-geocoded activity preservation;
- OSRM route/table parsing;
- route-aware replan cost regression;
- offline/PWA static contracts;
- Cloud Trip offline queue policy and replay wiring contracts;
- ICS, cross-midnight ICS and weather packing rules.

## 12. Required merge and release gates

### Before merge

The consolidated `PR CI` must succeed after the PR is marked Ready. It covers:

1. `pnpm format:check`
2. `pnpm lint`
3. library package builds
4. `pnpm typecheck`
5. `pnpm test`
6. docs gate
7. Next.js static export
8. worker builds
9. deploy pipeline contract tests
10. route/PWA/offline-sync/export tests added in this branch
11. secret scan

Draft PR synchronizations skip the hosted runner entirely.

### After merge

A push to `main` runs the production `Deploy` workflow. A successful Deploy then triggers one consolidated `Production Smoke` runner covering broad product pages/APIs plus the former Phase 5–9, hourly, adaptive replanning and collaboration production checks.

Manual Deploy, Production Smoke and static weather refresh jobs are all restricted to `refs/heads/main` so a selected feature branch cannot publish production.

### Current GitHub Actions blocker

Earlier workflow runs did not reach repository code. GitHub reported:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings.

The CI/CD cost-control refactor now ensures Draft PR commits create only a skipped `PR CI` job with no runner steps. It prevents future unnecessary consumption but cannot clear the existing Billing/Actions spending lock.

Therefore no prior CI failure demonstrates a source/build/test defect. PR #45 remains Draft until Billing / Actions spending is restored and the consolidated PR CI can execute.

Local environment note:

- Node 22 and TypeScript 5.8.3 are available in the assistant runtime;
- Prettier is not installed there;
- direct GitHub clone is unavailable from that runtime because outbound DNS/network access is disabled;
- source-level review therefore cannot substitute for the repository's executable CI gates.

## 13. Rollout

1. Fix GitHub Billing / Actions spending limit.
2. Mark PR #45 Ready once implementation is final.
3. Run the single consolidated PR CI.
4. Fix any real source/test/build failures that appear.
5. Merge only after PR CI succeeds.
6. Let the main push trigger one production Deploy and one consolidated Production Smoke.
7. Observe public OSRM usage before considering a dedicated routing service/proxy.
