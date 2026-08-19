# OPC product cutover plan

Date: 2026-08-19  
Status: Phase 0 implemented in PR #55

## Phase 0 — OPC product cutover

- one homepage task and one top-level product navigation item;
- one active `dry` discovery intent;
- no traveller or trip-style dropdowns;
- four explicit optional weather limits;
- dry score independent from wind and temperature;
- Top 3 result cap;
- explicit `destination_selected` event;
- commercial surfaces only after selection;
- Trips retained as noindex advanced tools;
- Trips removed from navigation and sitemap;
- PWA starts at `/discover`;
- three-locale SEO and production-smoke contracts updated.

## Phase 1 — origin and reachability

Status: implemented in the Phase 1 reachability change.

- bounded starting hubs: Singapore, Hong Kong and Taipei;
- static, conservative flight / drive planning estimates;
- transport options shown only when the selected origin has maintained edges;
- maximum one-way planning-time filter;
- reachability applied before weather API batching and ranking;
- transport time used only as a tie-break after dry score and forecast confidence;
- origin, mode and travel time serialized into shareable URLs;
- no live fare, inventory, route or schedule dependency.

```text
origin + transport + maximum one-way planning time
→ eligible destination set
→ weather hard limits
→ least-rain Top 3
```

## Phase 2 — selection, monetization and retention

- persist selected destination;
- destination-specific hotel, flight, activity, eSIM, insurance or car-rental links;
- saved searches;
- D-7, D-3 and D-1 weather-change reminders;
- automated weekend least-rain email.

## Phase 3 — evidence-gated lightweight voting

Build anonymous Top 3 voting only after analytics prove that users repeatedly share result URLs. Do not build a full collaborative itinerary platform.

## Phase 4 — API and widget

Consider Dry Score API and widgets only after consumer demand and score stability are demonstrated.

## Architecture guardrails

- Weather provider boundaries remain unchanged: provider calls stay inside `weather-sync`.
- Immutable weather snapshots remain the decision evidence.
- The four-workflow low-frequency CI/CD model remains unchanged.
- No preview deployment fan-out is reintroduced.
- No runtime AI, booking, payment or live transport dependency is added in Phase 0.
