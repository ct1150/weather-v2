# Where Not Rain — Cloud Trip Phase 5: Weather Change Intelligence

Date: 2026-08-08
Status: Complete

## Outcome

Cloud Trip now extends the Phase 4 decision-first collaboration workflow with weather-change intelligence:

**Open or monitor a cloud trip -> detect a meaningful forecast change -> understand which trip day is affected and why -> receive a concrete adjustment recommendation -> turn that recommendation into an explicit collaboration decision.**

Phase 5 implements the Product V1 `Change detection` increment without adding realtime chat infrastructure or provider calls to user-facing trip paths.

## Product principles

1. **Decision-first, not alert-first.** Only meaningful deterioration surfaces; small forecast noise remains silent.
2. **Explain every recommendation.** Rain, precipitation, wind, gust, heat, cold and UV changes use deterministic reason codes.
3. **Trip-aware severity.** Theme (`city`, `beach`, `outdoor`, `indoor`) and party profile (`adults`, `family`, `senior`) affect severity.
4. **Cloudflare-free-tier aware.** The release reuses D1, Workers, Cron and service bindings without Durable Objects, Queues or paid runtime dependencies.
5. **No provider calls from user paths.** `weather-sync` remains the only provider caller; Phase 5 consumes persisted forecasts through `weather-read`.
6. **No silent itinerary rewrites.** An actionable weather insight becomes a Phase 4 Decision only after an authorized user explicitly requests it.

## Delivered scope

### P5A — Deterministic weather delta engine

- Compares the latest forecast observation for a trip day with the previous observation.
- Detects meaningful deterioration in precipitation probability, precipitation volume, sustained wind, gusts, heat, cold and UV.
- Weights impact by day theme and travelling party.
- Emits stable reason codes, `none` / `watch` / `action` severity and `keep_plan` / `adjust_timing` / `activate_plan_b` recommendations.
- Treats the first observation as a baseline and suppresses minor forecast noise and improvements.

### P5B — Durable monitoring state

D1 migration `0005_weather_intelligence.sql` adds:

- `trip_weather_observations` for durable per-day forecast observations;
- `trip_weather_insights` for append-only meaningful deterioration records;
- idempotency by trip, day and weather snapshot;
- open/converted insight lifecycle and optional link to the resulting Phase 4 decision;
- indexes for latest-observation and insight-list queries.

### P5C — Trip weather monitor

- Reads active cloud trips inside the supported forecast horizon.
- Uses a `WEATHER_READ` Worker service binding rather than public HTTP or direct provider access.
- Batches unique cities within the existing weather-read API bounds.
- Persists each new observation before deterministic comparison.
- Creates insights only for meaningful deterioration.
- Isolates per-trip monitor failures with structured logs so one bad trip does not abort the full scheduled run.

### P5D — Scheduled execution

- Production `trip-api` runs weather monitoring at `37 */6 * * *`, after the existing weather publication cadence at minute 17.
- Preview intentionally has no automatic Cron; trusted verification explicitly refreshes the preview weather snapshot before smoke testing.
- Same-snapshot retries are idempotent.
- Monitoring uses awaited Worker/D1 operations and does not store request-scoped mutable global state.

### P5E — API + collaboration workflow

Delivered endpoints:

```text
GET  /api/v1/trips/:tripId/weather-insights
POST /api/v1/trips/:tripId/weather-refresh
POST /api/v1/trips/:tripId/weather-insights/:id/decision
```

Authorization:

- OWNER / EDITOR can inspect insights, refresh weather and convert an actionable insight into a Phase 4 decision.
- VIEWER can inspect weather insights but cannot refresh or create a decision from them.
- Non-members receive 404 for private weather-intelligence resources.
- Decision conversion is idempotent and records the normal Phase 4 `decision_created` activity event.

### P5F — Web experience

- Added a collapsed `Weather changes / 天气变化 / 天氣變化` workspace before the collaboration panel.
- Shows only meaningful changes with before/after weather metrics, deterministic reasons, impact score and recommended action.
- OWNER/EDITOR can manually check the latest forecast and create a collaboration decision with one action.
- VIEWER receives a read-only experience.
- English, Simplified Chinese and Traditional Chinese are included.

## Architecture

```text
Open-Meteo
   |
   v
weather-sync (only provider caller, every 6h)
   |
   v
Weather D1 -> active immutable snapshot
   |
   v
weather-read (read-only)
   ^
   | Worker service binding
   |
trip-api scheduled/manual monitor
   |
   +--> Trip D1: observations + weather insights
   +--> Phase 4 Decision / Activity workflow
   |
   v
Static Next.js trip workspace
```

## Verification

### Preview

- Final Phase 5 PR head passed Deploy Run 211: format, lint, library build, typecheck, unit/integration tests, documentation gate, Next.js static export, `weather-sync`, `weather-read` and `trip-api` builds, pipeline contracts, immutable artifact smoke, secret scan, Preview D1 migrations, Worker deployment, auth migration, existing Trip API smoke, extended weather smoke and Pages deployment.
- Preview migration `0005_weather_intelligence.sql` applied successfully.
- Preview `trip-api` deployed with `WEATHER_READ -> where-not-rain-read-preview` service binding.
- Dedicated Phase 5 Preview Smoke Run 6 passed after refreshing the no-Cron preview weather snapshot. It verified real weather publication, service binding, first-observation baseline, same-snapshot idempotency and Viewer mutation denial.

### Production

- Phase 5 product PR #34 was squash-merged as `45bffaf9a74b740afd1d72e222007296ae6bdcdf`.
- Production Deploy Run 212 completed successfully for that exact product release SHA, including production D1 migration/deployment and the existing production gates.
- Production Product Smoke passed on the same product release SHA.
- Production Collaboration Smoke passed on the same product release SHA, confirming Phase 1–4 collaboration behavior remained intact.
- Dedicated Phase 5 Production Smoke Run 8 passed. It verified Phase 5 health flags, the real `weather-read` service binding path, first-observation silence, same-snapshot idempotency, Viewer insight access and Viewer mutation denial.
- The Phase 5 smoke result is persisted in `PHASE5_WEATHER_SMOKE_STATUS.md` for auditable release evidence.

## Definition of Done

- Forecast noise does not create repeated insights. ✅
- Material deterioration creates deterministic, explainable insights. ✅
- First observation creates a baseline without alerting. ✅
- Retry of the same weather snapshot is idempotent. ✅
- Monitoring runs without direct provider access from `trip-api`. ✅
- OWNER/EDITOR/VIEWER permissions are enforced server-side. ✅
- Actionable insight can become a Phase 4 decision. ✅
- English, Simplified Chinese and Traditional Chinese UI is complete. ✅
- Preview and production smoke cover monitoring and weather insight behavior. ✅
- Phase 1–4 behavior remains intact. ✅

## Explicitly deferred

- Push notifications and email digests until insight precision is validated in production.
- Official government severe-weather alert ingestion, which requires a separate source and trust model.
- Realtime presence and WebSocket/Durable Object collaboration.
- Automatic silent itinerary rewrites.
- ML/LLM-generated risk scoring; Phase 5 core decisions remain deterministic and testable.
