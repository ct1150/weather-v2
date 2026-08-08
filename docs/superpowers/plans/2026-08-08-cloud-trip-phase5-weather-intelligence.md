# Where Not Rain — Cloud Trip Phase 5: Weather Change Intelligence

Date: 2026-08-08
Status: In Progress

## Outcome

Cloud Trip should stop being a passive itinerary viewer and become a weather-aware execution assistant.

Primary journey:

**Open or monitor a cloud trip -> detect a meaningful forecast change -> understand which trip day is affected and why -> receive a concrete adjustment recommendation -> turn that recommendation into an explicit collaboration decision.**

Phase 5 extends the Product V1 `Change detection` increment and reuses the Phase 4 decision-first collaboration model. It does not add realtime chat infrastructure.

## Product principles

1. **Decision-first, not alert-first.** Only meaningful changes should surface; small forecast noise must not create alert fatigue.
2. **Explain every recommendation.** Rain, wind, heat, cold and UV deltas remain visible as deterministic reason codes.
3. **Trip-aware severity.** The same weather change can be low impact for an indoor day and high impact for a beach/outdoor day; family/senior trips use stricter thresholds.
4. **Cloudflare-free-tier aware.** Reuse D1, Workers, Cron and service bindings. Do not introduce Durable Objects, Queues or paid dependencies for the first release.
5. **No provider calls from user paths.** `weather-sync` remains the only provider caller; Phase 5 consumes persisted weather through `weather-read`.

## Scope

### P5A — Deterministic weather delta engine

- Compare the latest observation for a trip day with its previously observed forecast.
- Detect meaningful deterioration in precipitation probability, precipitation volume, sustained wind, gusts, heat, cold and UV.
- Weight the result by day theme (`city`, `beach`, `outdoor`, `indoor`) and party profile (`adults`, `family`, `senior`).
- Emit stable reason codes, severity (`none`, `watch`, `action`) and recommendation kind (`keep_plan`, `adjust_timing`, `activate_plan_b`).
- Treat the first observation as a baseline and avoid false alerts.

### P5B — Durable monitoring state

Add D1 state for:

- the last observed forecast per cloud-trip day;
- append-only weather insights generated from a new weather snapshot;
- idempotency by trip/day/weather-snapshot;
- insight lifecycle needed by the UI (`open`, later `acknowledged`/`superseded` if required).

### P5C — Trip weather monitor

- Read active cloud trips whose dates are inside the supported forecast horizon.
- Batch unique city/date requests through the `weather-read` Worker using a service binding.
- Persist the new observation.
- Compare against the prior observation through P5A.
- Create an insight only when the change is meaningful.
- Record a collaboration activity event for actionable weather deterioration.

### P5D — Scheduled execution

- Run after weather publication on a bounded cadence using a Worker Cron Trigger.
- Keep preview without automatic Cron; provide an internal smoke/manual trigger.
- Make the scheduled path idempotent and safe to retry.
- Use structured logs and never store request-scoped mutable state globally.

### P5E — API + collaboration workflow

Planned endpoints:

```text
GET  /api/v1/trips/:tripId/weather-insights
POST /api/v1/trips/:tripId/weather-refresh       # owner/editor manual refresh, bounded
POST /api/v1/trips/:tripId/weather-insights/:id/decision
```

Behavior:

- OWNER / EDITOR can refresh and convert a recommendation into a Phase 4 decision.
- VIEWER can inspect insights but cannot mutate them.
- Non-members receive 404 for private weather-intelligence resources.

### P5F — Web experience

- Add a collapsed `天气变化 / Weather changes` section near collaboration controls.
- Show only the days that changed materially.
- Surface `what changed`, `why it matters`, `recommended action`, and the last weather snapshot time.
- One-click `Create decision` should prefill a Phase 4 decision instead of silently rewriting the itinerary.
- Localize English, Simplified Chinese and Traditional Chinese.

## Initial meaningful-change policy

The first implementation intentionally favors deterministic thresholds over machine learning:

- large rain-probability jump or crossing a high-rain threshold;
- significant precipitation-volume increase;
- sustained-wind/gust increase or crossing outdoor-risk thresholds;
- crossing heat/cold thresholds, stricter for family/senior groups;
- UV threshold crossing on beach/outdoor days.

The engine suppresses minor changes and treats improvements as informational rather than actionable.

## Architecture

```text
Open-Meteo
   |
   v
weather-sync (provider caller, every 6h)
   |
   v
Weather D1 -> active immutable snapshot
   |
   v
weather-read (read-only)
   ^
   | service binding
   |
trip-api scheduled/manual monitor
   |
   +--> Trip D1: last observations + weather insights
   +--> Phase 4 activity / decision workflow
   |
   v
Static Next.js trip workspace
```

Cloudflare implementation should follow current platform guidance: use in-process bindings where possible, prepared D1 statements, a `scheduled()` handler for Cron work, explicit awaiting/waitUntil handling, and no global request state.

## Delivery slices

1. **Slice A — Engine + contract tests** — in progress.
2. **Slice B — D1 migration + persistence adapter.**
3. **Slice C — weather-read service binding + monitor runner.**
4. **Slice D — API endpoints + auth/role tests.**
5. **Slice E — localized web UI + decision conversion.**
6. **Slice F — trusted preview/production smoke + release.**

## Definition of Done

- Forecast noise does not create repeated insights. ⬜
- Material deterioration creates deterministic, explainable insights. ⬜
- First observation creates a baseline without alerting. ⬜
- Retry of the same weather snapshot is idempotent. ⬜
- Monitoring runs without direct provider access from `trip-api`. ⬜
- OWNER/EDITOR/VIEWER permissions are enforced server-side. ⬜
- Actionable insight can become a Phase 4 decision. ⬜
- English, Simplified Chinese and Traditional Chinese UI is complete. ⬜
- Preview and production smoke cover monitor, insight and decision conversion. ⬜
- Phase 1–4 behavior remains intact. ⬜

## Explicitly deferred

- Push notifications and email digests until insight precision is validated in production.
- Official government severe-weather alert ingestion (separate source and trust model).
- Realtime presence, WebSocket/Durable Object collaboration.
- Automatic silent itinerary rewrites.
- ML/LLM-generated risk scoring; Phase 5 core decisions stay deterministic and testable.
