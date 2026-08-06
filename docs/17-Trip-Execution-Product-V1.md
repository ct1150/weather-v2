# Trip Execution Product V1

## Product outcome

The first demo proved that weather can be rendered beside an itinerary. Product V1 turns that concept into a complete user task:

1. Create a trip from a blank workspace or existing Markdown.
2. Assign a supported weather city to each day.
3. Mark the day as city, beach, outdoor, or indoor and select the travelling party.
4. Refresh the persisted public forecast and receive a score, risk explanation, and executable Plan B.
5. Keep editing without an account, reopen the trip on the same device, share an editable copy, or export Markdown.

The primary launch audience is Chinese-speaking independent travellers planning multi-city trips in Japan, South Korea, and Southeast Asia. The current weather catalogue contains the seeded active cities in Japan, South Korea, Thailand, Vietnam, Singapore, Malaysia, Indonesia, the Philippines, and Cambodia.

## User value boundary

Product V1 is valuable when a traveller can answer these questions in one screen:

- Which days are safe to keep as planned?
- Which days need shorter outdoor exposure or a time change?
- What indoor or lower-risk replacement should the group use?
- Does the recommendation become stricter when children or seniors are travelling?
- Can the plan be reopened and shared without creating an account?

The product does not claim to book transport, replace official severe-weather alerts, or guarantee attraction opening status. Fixed tickets and opening hours remain user-entered constraints.

## Architecture

- **Static Next.js web app:** editing, local persistence, sharing, export, and deterministic decision UI.
- **weather-read Worker:** public, read-only city catalogue and bounded trip forecast endpoints. It never calls a provider or writes data.
- **weather-sync Worker:** the only provider caller; continues publishing versioned forecast snapshots into D1.
- **D1:** active weather snapshot and daily forecast source of truth.
- **No account requirement:** itinerary content stays in browser storage or the URL fragment. URL fragments are not sent to the server.

### Public product endpoints

```text
GET /api/v1/trip-cities?locale=en|zh-cn
GET /api/v1/trip-forecast?cityIds=<comma-separated>&from=YYYY-MM-DD&to=YYYY-MM-DD&locale=en|zh-cn
```

Safety and cost bounds:

- Maximum 12 cities per forecast request.
- Maximum 16 calendar days per forecast request and shared workspace.
- Read-only active snapshot data only.
- No user itinerary content is submitted to either endpoint.
- Invalid ranges, locale values, and identifiers fail closed with `400`.

## Persistence and sharing

- Workspace key: `wnr:trip-workspace:v1`.
- Last weather response is cached per workspace for graceful offline/error fallback.
- Share payload is normalized, size-bounded JSON encoded in the URL fragment `#trip=...`.
- Opening a shared URL creates an editable local copy.
- Markdown export provides a portable escape hatch and prevents product lock-in.

## Decision model

Each day starts at 100 and applies deterministic penalties based on:

- precipitation probability;
- sustained wind and gusts;
- high and low temperature;
- ultraviolet index;
- day theme sensitivity;
- adult, family, or senior party profile.

The output contains a `0..100` score, low/medium/high risk level, human-readable reasons, and a theme-specific Plan B. Missing forecast data is shown explicitly and never presented as a confident score.

## Product validation before promotion

- Markdown import creates an editable workspace.
- Local storage restores the latest itinerary.
- Share payload round-trips and rejects malformed input.
- Rainy beach days score lower than indoor days.
- City catalogue returns localized names.
- Forecast endpoint reads only the active D1 snapshot and enforces bounds.
- Format, lint, typecheck, unit/integration tests, documentation gate, static export, Worker builds, and Cloudflare preview deployment all pass.

## Next product increments

1. **Today mode:** automatically focus the current trip day and show “leave by” reminders.
2. **Change detection:** compare the last two weather snapshots and highlight meaningful deterioration.
3. **Cloud sync:** optional sign-in for multi-device recovery while retaining guest mode.
4. **Official alerts:** ingest supported government alert feeds and separate alerts from forecast scoring.
5. **Conversion layer:** context-aware hotel, activity, insurance, and transport affiliates only after the core decision task is complete.
6. **Paid tier:** multi-device sync, automatic monitoring, proactive notifications, version history, and group collaboration.
