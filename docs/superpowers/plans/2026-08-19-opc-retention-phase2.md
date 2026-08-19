# OPC retention Phase 2 — saved searches and calendar rechecks

Date: 2026-08-19  
Status: Implementation in PR

## Goal

Extend the OPC least-rain decision funnel after Phase 1 without adding accounts, email delivery infrastructure or a background notification service.

```text
reachable least-rain query
→ save the exact shareable query locally
→ reopen it later from the same device
→ download D-7 / D-3 / D-1 calendar recheck reminders
→ return to the current weather snapshot before booking
```

## Product scope

### Saved searches

- store the complete discovery URL, including origin, transport, maximum one-way planning time, dates, weather limits and comparison shortlist;
- retain at most five searches per browser;
- deduplicate the same canonical query;
- newest save appears first;
- allow open, copy-link and remove actions;
- require an applied date range before saving;
- keep all data local to the browser.

### Calendar recheck reminders

- generate an `.ics` calendar file for the saved query;
- create all-day reminders at D-7, D-3 and D-1 when those dates are still in the future;
- create one immediate recheck event when the trip is too close for the standard offsets;
- create no reminder after the trip start date has passed;
- deep-link every event back to the exact saved discovery URL;
- do not collect an email address or claim that weather changes are pushed automatically.

### Comparison retention

- align the persisted comparison shortlist with the product Top 3 limit;
- keep URL state authoritative;
- preserve existing cross-session shortlist restoration;
- remove duplicate result-click analytics from the retention component because the planner already owns that event.

## Explicit non-goals

- email subscriptions;
- Web Push delivery;
- scheduled Cloudflare notification jobs;
- background weather-delta detection;
- accounts or cross-device sync;
- live booking or fare alerts;
- full itinerary collaboration.

## Trust language

The UI must state that calendar reminders are downloaded locally and that nothing is sent to the server. A reminder asks the user to recheck the latest forecast; it does not claim that the forecast changed.

## Data contract

```ts
interface SavedDiscoverySearch {
  id: string;
  url: string;
  from: string;
  to: string;
  originId: ReachabilityOriginId;
  mode: ReachabilityModeFilter;
  maxTravelMinutes: number;
  savedAt: string;
}
```

Storage keys:

```text
wnr:saved-discovery-searches:v1
wnr:discovery-shortlist:v1
```

Limits:

```text
saved searches: 5
comparison shortlist: 3
```

## Validation

- pure unit tests for canonical URL capture, malformed storage, deduplication and limits;
- pure unit tests for D-7 / D-3 / D-1 calendar output, close-trip fallback and expired trips;
- source contracts for all three locales and URL-authoritative comparison retention;
- full repository PR CI before merge.

## Later evidence gate

A server-side alert system should be considered only after analytics or direct feedback show that users repeatedly save and reopen searches. Until then, calendar reminders provide a real retention loop with effectively zero operating burden.
