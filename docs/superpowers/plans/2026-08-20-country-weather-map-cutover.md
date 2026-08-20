# Country Weather Map Cutover — Execution Plan

## Goal

Replace the origin-and-reachability destination finder with a country-first, map-first product while preserving existing weather, city, legacy itinerary and analytics infrastructure.

## Phase A — Product entry cutover

- replace English, Simplified Chinese and Traditional Chinese homepages with a country selector and country cards;
- update navigation to “Choose a country / 选择国家 / 選擇國家”;
- update global metadata and PWA start URL;
- remove `/discover` and `/explore` from active sitemap acquisition;
- keep legacy `/discover` routes available with `noindex, follow`.

### Acceptance

- no active homepage asks for origin, transport or maximum travel time;
- homepage has one required choice: country;
- PWA opens the country selector.

## Phase B — Map-first country experience

- unify English, Simplified Chinese and Traditional Chinese explorers;
- default to the next seven days;
- add three-day, weekend and custom date windows;
- show weather icon, lower-rain days and temperature on every marker;
- preserve all destinations on the map;
- open daily forecast details inline after marker activation;
- remove active Travel Score and trip-planning actions from the country decision surface.

### Acceptance

- map appears without a submit action;
- every listed destination has an equivalent marker;
- marker activation does not navigate away;
- city detail remains one explicit secondary action.

## Phase C — Optional deterministic limits

- add rain probability, wind, minimum temperature and maximum temperature limits;
- update URL state immediately;
- grey failed destinations instead of hiding them;
- explain every failed condition in marker/list/inspector context;
- add one-click clear.

### Acceptance

- every visible limit changes the presentation deterministically;
- no limit changes the weather calculation or reorders a hidden score;
- zero-result states are impossible because filtered places remain visible.

## Phase D — SEO, sharing and analytics

- update country metadata to weather icon, lower-rain-day and temperature language;
- keep static country/city ItemList JSON-LD;
- retain canonical and hreflang coverage;
- make country/date/filter/city state shareable in the URL;
- reuse bounded analytics events for homepage view, country selection, country view and city interaction;
- add country-map funnel SQL.

### Acceptance

- country and city pages remain in the static sitemap;
- legacy discovery pages are not advertised by sitemap;
- D1 analytics accepts the new route templates without new personal data.

## Phase E — Quality and release

- rewrite homepage and country-map component tests;
- update critical-path, PWA and production-smoke contracts;
- run format, lint, builds, typecheck, tests, docs, static export, Worker builds, pipeline contracts and secret scan;
- merge only after unified PR CI succeeds;
- verify Deploy and Production Smoke on the merged main SHA;
- independently verify homepage and Japan map in all three locales;
- close obsolete or temporary PRs without merging them.

## Rollback

The cutover is isolated to web presentation, metadata, analytics route templates and tests. Weather ingestion, D1 weather data, Weather Read API, Trip API, provider boundaries and legacy URLs remain intact. A rollback can revert the single squash commit without database migration.

## Completion definition

```text
choose country
→ country weather map loads
→ weather icons make spatial differences visible
→ optional limits grey unsuitable places
→ marker opens daily detail
→ city page remains available
```

No origin, transport or Top 3 workflow appears in primary navigation or acquisition.
