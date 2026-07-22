---
title: Product PRD
authority: Product
status: Active
last_updated: 2026-07-17
---

# Product PRD

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Destination discovery

<!-- requirement
id: PRD-FR-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-PRD_FR_001
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-001"></a>

### PRD-FR-001 — Travel Radar

The homepage Travel Radar presents the best destinations for **Today**, **Tomorrow**, **This Weekend**, and **Next Week**. It is a deterministic, explainable recommendation product based on the latest successful weather and score data; the name or presentation must not imply a live generative-AI decision when no such capability produced it.

Each destination card includes city, country, weather condition, Travel Score, minimum and maximum temperature, rain probability, at least one recommendation reason, data update time, and a destination-detail link.

Roadmap: [REL-MVP-PRD_FR_001](11-Roadmap.md#REL-MVP-PRD_FR_001).

#### Acceptance Criteria

- Results use only the most recent successfully activated data and exclude destinations that fail the applicable score-confidence rules.
- Selecting a time window updates a shareable URL state, and browser back and forward navigation restores the selected window.
- Weekend and next-week labels show exact city-local dates so their meaning is unambiguous.
- Every result exposes at least one data-derived reason such as low rain chance or comfortable temperature; unsupported natural-language claims are not shown.
- Stale results remain usable only with a visible `Updated ... ago` or equivalent stale indication and are never presented as live data.
- The recommendation cards and their required fields are available in crawlable primary page content without requiring the user to load the map.

<!-- requirement
id: PRD-FR-002
status: Active
kind: Hard
roadmap_ref: REL-MVP-PRD_FR_002
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-002"></a>

### PRD-FR-002 — Weather Explorer

Weather Explorer provides a map-led destination discovery experience with city markers, clustering, zoom, hover, click, and theme filtering. Its core filters are Sunny, Beach, Hiking, Photography, Family, and Night View. Additional seasonal or activity themes appear only when their separately governed data and product contracts are available.

Map colors communicate suitability and risk: green for sunny or suitable, yellow for cloudy or moderate, red for rain or unsuitable conditions, and purple for storm or severe-convective risk. Text and icon labels carry the same meaning so color is never the only signal.

Roadmap: [REL-MVP-PRD_FR_002](11-Roadmap.md#REL-MVP-PRD_FR_002).

#### Acceptance Criteria

- The map loads progressively after the primary decision content and does not need to be present for the user to discover ranked destinations.
- Devices without WebGL, low-capability devices, and map-script failures receive an accessible ranked-list fallback with equivalent destination links and active-filter meaning.
- Marker and cluster payloads remain compact and exclude full hourly forecasts.
- Changing theme updates marker meaning, color, and destination ordering from the same selected theme.
- Markers are keyboard reachable, expose readable city and score labels, and open operable detail surfaces.
- Loading, empty, partial, stale, offline, error, and retry outcomes use the shared UX state contract rather than leaving a blank map.

<!-- requirement
id: PRD-FR-003
status: Active
kind: Hard
roadmap_ref: REL-MVP-PRD_FR_003
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-003"></a>

### PRD-FR-003 — City Page

A city page uses the stable route `/{countrySlug}/{citySlug}` and turns weather data into a travel decision. Its core content is a hero and weather summary, Travel Score with reasons, seven-day forecast, hourly overview, rain, temperature, humidity, wind and UV detail, travel recommendations, and available activity-suitability signals. Theme Park and Mountain are conditional city activity-suitability signals governed by [DATA-ACTIVITY-001](06-Database.md#DATA-ACTIVITY-001); each is shown only when trustworthy supporting data is sufficient.

Commercial blocks, related destinations, related articles, and FAQ are conditional sections: they appear only when their owning capability is active and the page has valid, relevant data. Potential commercial categories include lodging, attractions or activities, tours, car rental, connectivity, and insurance.

Roadmap: [REL-MVP-PRD_FR_003](11-Roadmap.md#REL-MVP-PRD_FR_003).

#### Acceptance Criteria

- Primary page content includes the city identity, applicable local dates, weather summary, Travel Score, and score explanation before optional interactive enhancement.
- Data update time, city time zone, and displayed unit system are visible or directly discoverable.
- Theme Park and Mountain signals, and any other affected activity score or section, are hidden when trustworthy supporting data is insufficient instead of fabricating suitability.
- Commercial sections identify their commercial nature, can be disabled, and disappear when no valid offer data exists; no false recommendation or blank placeholder is shown.
- Related destinations and articles are deduplicated, explain their relevance where applicable, and link only to valid destinations.
- FAQ questions and answers are specific to visible city data and do not repeat a city-name-swapped template.
- Partial, stale, unavailable, and error states preserve the last trustworthy decision context and clearly identify unavailable details.

<!-- requirement
id: PRD-FR-004
status: Active
kind: Hard
roadmap_ref: REL-MVP-PRD_FR_004
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-004"></a>

### PRD-FR-004 — Country Page

A country page uses `/{countrySlug}` and provides a unique country overview, available destination coverage, best cities, regional weather context, applicable theme rankings, useful seasonal guidance, and links to relevant city or editorial content.

Roadmap: [REL-MVP-PRD_FR_004](11-Roadmap.md#REL-MVP-PRD_FR_004).

#### Acceptance Criteria

- A public country page has a unique summary, at least one valid city data set, and meaningful internal links; otherwise it is withheld from indexing or not generated.
- City results can be sorted and can use pagination or progressive loading without hiding the primary country summary.
- Weather and ranking claims expose their data update context and do not claim complete national coverage when coverage is partial.
- Seasonal and editorial modules appear only when their underlying capability and source quality are available.
- Empty and partial states explain destination coverage rather than displaying empty rankings.

<!-- requirement
id: PRD-FR-005
status: Active
kind: Hard
roadmap_ref: REL-MVP-PRD_FR_005
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-005"></a>

### PRD-FR-005 — Fuzzy Search

Search discovers countries, cities, known aliases, and destination terms across supported display languages. Suggestions begin after two entered characters and identify each result's type, country, and current weather summary when available.

Roadmap: [REL-MVP-PRD_FR_005](11-Roadmap.md#REL-MVP-PRD_FR_005).

#### Acceptance Criteria

- Matching is case-insensitive and accent-insensitive and covers localized names and approved aliases without changing the canonical destination route.
- The suggestion list and result selection are fully operable by keyboard, expose an accessible result count, and retain a visible focus state.
- Input length and result count are bounded; normalization is deterministic; user input is handled as data rather than executable query syntax.
- A result clearly identifies whether it is a country, city, or available editorial destination and never invents a match.
- No result state, a partial service result, and a search error each provide a clear next action.
- Search measurement, when enabled, does not require storing personal information or presenting raw free text as a public page.

<!-- requirement
id: PRD-FR-006
status: Active
kind: Hard
roadmap_ref: REL-MVP-PRD_FR_006
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-006"></a>

### PRD-FR-006 — Destination Rankings

The baseline ranking product provides `/best-weather`, `/best-weekend`, `/best-beach`, `/best-hiking`, `/best-family`, and `/best-photo`. Every ranking is generated from real destination data and an implemented, explainable scoring model. Additional food, shopping, seasonal, or risk rankings require their own valid model and content contract before publication.

Roadmap: [REL-MVP-PRD_FR_006](11-Roadmap.md#REL-MVP-PRD_FR_006).

#### Acceptance Criteria

- Weather-sensitive rankings recalculate after each successfully activated data sync; every published ranking is refreshed at least daily.
- Each page explains its ranking method, data timestamp, time window, and geographic coverage.
- Ranking entries use valid scores and reasons, and destinations below the applicable confidence threshold do not enter a top ranking.
- An unimplemented theme, insufficient candidate set, or insufficient unique explanation produces `noindex` or no page rather than a thin ranking.
- The product does not create arbitrary city-by-theme pages merely to increase index count.
- Ranking links resolve to valid destination pages and preserve the selected time window where that context matters.

## Planned decision tools

<!-- requirement
id: PRD-FR-007
status: Active
kind: Hard
roadmap_ref: REL-Beta-PRD_FR_007
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-007"></a>

### PRD-FR-007 — Compare Cities

Compare Cities uses `/compare/{cityA}-vs-{cityB}` to compare weather, temperature, rain, Travel Score, UV, humidity, wind, Walking, Food, and Shopping signals. Price information appears only when an authorized source supplies the amount, currency, and freshness context.

Roadmap: [REL-Beta-PRD_FR_007](11-Roadmap.md#REL-Beta-PRD_FR_007).

#### Acceptance Criteria

- City order is normalized deterministically, and the reverse order redirects permanently to one canonical URL.
- Comparing a city with itself returns a not-found outcome or an accessible prompt to select another city.
- The comparison identifies which city is better suited to applicable activities using visible source data and reasons rather than a generic winner claim.
- Missing dimensions are marked unavailable and do not silently award either city an advantage.
- Only precomputed, explicitly approved city pairs with real user or search value are indexable; arbitrary pairs are not added to the index surface.
- The comparison remains absent from the baseline destination journey until its Roadmap record is the active delivery scope.

<!-- requirement
id: PRD-FR-008
status: Active
kind: Hard
roadmap_ref: REL-Beta-PRD_FR_008
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-008"></a>

### PRD-FR-008 — Weekend Planner

Weekend Planner accepts an origin city, a specific weekend, and travel preferences, then returns candidate destinations with applicable weather, travel time, budget information, and commercial entry points when trustworthy data exists.

Roadmap: [REL-Beta-PRD_FR_008](11-Roadmap.md#REL-Beta-PRD_FR_008).

#### Acceptance Criteria

- The selected weekend is expressed as exact dates and evaluated in each candidate city's local time.
- Each recommendation includes weather suitability and a reason tied to the user's stated preferences.
- Travel-time, transport, price, and budget fields appear only from authorized sources with appropriate currency and freshness context.
- When current price data is unavailable, the product uses a neutral action such as “Check price” and never presents an estimate as a live quote.
- The planner handles no-match, partial-data, and stale-data outcomes without fabricating a complete itinerary.

<!-- requirement
id: PRD-FR-009
status: Active
kind: Hard
roadmap_ref: REL-V1-PRD_FR_009
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-009"></a>

### PRD-FR-009 — Seasonal Travel

Seasonal Travel covers Cherry Blossom, Autumn, Snow, Ski, Beach, Rainy Season, Typhoon, and Aurora discovery. A seasonal page combines weather with explicit seasonal or destination evidence; weather alone cannot establish bloom, foliage, snow, ski operation, storm impact, or aurora visibility.

Roadmap: [REL-V1-PRD_FR_009](11-Roadmap.md#REL-V1-PRD_FR_009).

#### Acceptance Criteria

- Every displayed seasonal status names or links its qualified source and shows when that evidence was verified or updated.
- Destination-specific seasonality uses explicit maintained rules or trusted destination, government, tourism-board, or contracted-provider data.
- Missing, expired, contradictory, or low-confidence seasonal evidence hides the status and excludes the destination from the affected ranking.
- Typhoon and other safety-sensitive pages distinguish forecast information from emergency guidance and prioritize official sources.
- Each indexable seasonal page has sufficient candidates, unique explanation, and current evidence; otherwise it is not indexed or not generated.

<!-- requirement
id: PRD-FR-010
status: Active
kind: Hard
roadmap_ref: REL-Beta-PRD_FR_010
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-010"></a>

### PRD-FR-010 — Growth-loop recommendations

Eligible city pages may recommend up to three nearby cities, three similar cities, three cities with better weather for the selected context, and three cheaper cities when trustworthy cost data exists. They may also surface relevant guides, lodging and attraction entry points, FAQ, and related articles.

Roadmap: [REL-Beta-PRD_FR_010](11-Roadmap.md#REL-Beta-PRD_FR_010).

#### Acceptance Criteria

- Recommendation groups are deduplicated against the current city and one another, and every destination link resolves to an active page.
- Nearby, similar, and better-weather labels derive from the corresponding relationship and current comparison context; each recommendation exposes a concise reason.
- “Cheaper” is used only with qualified, comparable cost data and visible currency and freshness context.
- Optional editorial and commercial items are hidden when no valid data exists.
- Recommendation links use stable routes and do not create unbounded filter or query URL spaces.

## Commercial and operational surfaces

<!-- requirement
id: PRD-FR-011
status: Active
kind: Hard
roadmap_ref: REL-MVP-PRD_FR_011
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-011"></a>

### PRD-FR-011 — Commercial surfaces and disclosure

The product may expose reusable commercial surfaces for lodging, activities, flights, connectivity, insurance, car rental, and advertising. These surfaces are optional enhancements to a complete travel-decision experience, not prerequisites for core weather content.

Roadmap: [REL-MVP-PRD_FR_011](11-Roadmap.md#REL-MVP-PRD_FR_011).

#### Acceptance Criteria

- Every commercial recommendation or outbound action has a clear, proximate disclosure that remains understandable in all supported locales and input modes.
- A commercial surface appears only with valid configured data and can be disabled globally or at its supported placement without removing core destination information.
- Disabled, unavailable, or unfilled surfaces leave no misleading recommendation, unusable control, blank reserved content block, or layout shift.
- Displayed price, availability, rating, or discount claims come only from authorized current data and include necessary currency or qualification.
- Commercial tracking does not block the user's outbound navigation.
- User-facing components do not expose provider-specific implementation fields as the product contract.

<!-- requirement
id: PRD-FR-012
status: Active
kind: Hard
roadmap_ref: REL-Beta-PRD_FR_012
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-012"></a>

### PRD-FR-012 — Protected read-only Admin

The `/admin` product surface is disabled by default and, when enabled, provides read-only operational views for weather-update status, cache status, aggregate commercial activity, top cities and countries, broken links, SEO health, and sanitized logs.

Roadmap: [REL-Beta-PRD_FR_012](11-Roadmap.md#REL-Beta-PRD_FR_012).

#### Acceptance Criteria

- A hidden route is never treated as access control; every enabled Admin view requires the approved identity, authorization, and audit controls.
- Production exposes no Admin data before those controls are implemented and verified.
- This requirement provides no data mutation, sync trigger, configuration update, or other write operation.
- Views contain only the minimum operational and aggregate information needed and do not expose secrets, raw credentials, personal data, or unsanitized provider errors.
- Disabled and unauthorized requests reveal neither dashboard data nor internal implementation detail.

## Editorial and assisted products

<!-- requirement
id: PRD-FR-013
status: Active
kind: Hard
roadmap_ref: REL-Beta-PRD_FR_013
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-013"></a>

### PRD-FR-013 — Articles and RSS

The editorial product provides an article index, stable article pages, and an RSS feed. Supported editorial themes include Best Weather This Week, Weekend Destinations, Cherry Blossom Weather, Autumn Foliage, Beach Guides, Travel by Month, and Rainy Season Guides.

Roadmap: [REL-Beta-PRD_FR_013](11-Roadmap.md#REL-Beta-PRD_FR_013).

#### Acceptance Criteria

- Published articles have stable slugs, title, summary, body, author or reviewer attribution, publication or update time, and applicable source attribution.
- Each article can link to relevant active cities automatically, while an editor can review, remove, reorder, or replace those links.
- RSS includes only published, canonical articles and updates an item when meaningful editorial content changes.
- Draft, preview, rejected, and unreviewed articles are excluded from public listings, RSS, and indexing.
- Publication satisfies the editorial, factual-source, and safety rules in [SEO-CONTENT-001](03-SEO-Bible.md#SEO-CONTENT-001).

<!-- requirement
id: PRD-FR-014
status: Active
kind: Hard
roadmap_ref: REL-V1-PRD_FR_014
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-014"></a>

### PRD-FR-014 — Travel News editorial workflow

Travel News supports human-reviewed coverage of significant weather and travel events such as typhoons, heavy rain, festivals, fireworks, cherry blossom, and autumn leaves. Automation or AI may assist research and drafting but cannot publish factual travel or safety content autonomously.

Roadmap: [REL-V1-PRD_FR_014](11-Roadmap.md#REL-V1-PRD_FR_014).

#### Acceptance Criteria

- Every item moves through an explicit draft and human-review step before publication, and the record identifies its reviewer and review time.
- Weather, seasonal, event, closure, and safety claims retain qualified sources and visible update times.
- High-risk weather and disaster coverage prioritizes official sources, distinguishes information from emergency advice, and includes a non-emergency-service notice.
- Material source changes or expired evidence return an item to review or remove it from publication.
- Assisted text is checked for unsupported facts, duplicate or thin content, misleading certainty, and unsafe recommendations before release.

<!-- requirement
id: PRD-FR-015
status: Active
kind: Hard
roadmap_ref: REL-V2-PRD_FR_015
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-015"></a>

### PRD-FR-015 — AI Travel Match

AI Travel Match accepts trip constraints such as dates, duration, origin, budget, and travel style and returns destinations with weather suitability, reasons, and optional lodging, activity, transport, or budget context when reliable data is available.

Roadmap: [REL-V2-PRD_FR_015](11-Roadmap.md#REL-V2-PRD_FR_015).

#### Acceptance Criteria

- The result distinguishes deterministic weather and destination data from generated explanation and identifies the evidence behind each recommendation.
- Budget, price, travel-time, hotel, activity, and transport claims appear only from authorized sources and are never invented to complete an answer.
- The capability communicates uncertainty, missing constraints, unavailable data, and stale inputs instead of presenting false precision.
- Safety-sensitive requests do not replace official guidance or emergency services, and applicable responses direct users to qualified sources.
- Failure or unavailability of an AI service does not remove access to baseline destination and weather discovery.

<!-- requirement
id: PRD-FR-016
status: Active
kind: Hard
roadmap_ref: REL-V2-PRD_FR_016
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-016"></a>

### PRD-FR-016 — 30-Day Outlook

The 30-Day Outlook presents a longer-horizon trend or probability product. It is not called a forecast in product claims and must not represent uncertain long-range conditions as deterministic daily weather.

Roadmap: [REL-V2-PRD_FR_016](11-Roadmap.md#REL-V2-PRD_FR_016).

#### Acceptance Criteria

- Every outlook labels the horizon, model or source, generation time, geographic scope, and available confidence or probability.
- Presentation uses ranges, trends, scenarios, or probabilities appropriate to source capability rather than precise unsupported daily outcomes.
- A visible disclaimer explains that the outlook is uncertain and is not a substitute for a current short-range forecast or official warning.
- Missing confidence, expired source data, or an unsupported location produces an unavailable state instead of a fabricated outlook.
- Product metadata, headings, and user-facing calls to action consistently use **30-Day Outlook** or **30-Day Trend**, not **30-Day Forecast**.

<!-- requirement
id: PRD-FR-017
status: Active
kind: Hard
roadmap_ref: REL-V2-PRD_FR_017
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-017"></a>

### PRD-FR-017 — Favorites, Email Alerts, Account, and Premium

V2 SHALL deliver an account-backed Premium experience for saving favorite cities and receiving email alerts. An account is required only for synchronized Favorites, Email Alerts, and Premium entitlement; anonymous users retain the complete baseline destination and weather-discovery experience. Premium status unlocks only capabilities explicitly assigned to it and does not imply that an account, favorite, or alert has a commercial booking, price, or availability relationship.

A Favorite references one active canonical city identity and is deduplicated per account. An Email Alert is explicit opt-in for one or more saved cities, identifies its weather condition or threshold and delivery cadence, and uses only the latest successfully activated weather and score data. Alert evaluation runs outside the user request path and never calls a weather provider from a page, API read, or email request. Account, consent, entitlement, favorite, and alert data are private, minimized, exportable, and deletable under the applicable security and privacy contracts.

Roadmap: [REL-V2-PRD_FR_017](11-Roadmap.md#REL-V2-PRD_FR_017).

#### Acceptance Criteria

- A signed-out user can use all baseline destination, ranking, map, search, country, and city discovery without creating an account or encountering a Premium gate.
- Favorite creation accepts only an active canonical city, is idempotent for the same account and city, and removing a favorite does not delete canonical destination or weather data.
- Email delivery is blocked until the address and alert have explicit verified opt-in; every message identifies the city, triggering condition, source update time, and one-step unsubscribe or equivalent legally compliant withdrawal control.
- Alert evaluation uses only successfully activated precomputed data, visibly distinguishes stale or unavailable inputs, suppresses unsupported or duplicate notifications, and produces zero weather-provider calls from user and email-delivery request paths.
- Authentication, authorization, and entitlement tests prevent one account from reading or changing another account's profile, favorites, alert rules, consent, or Premium state; logs, analytics, caches, and public responses expose none of that private data.
- Account deletion and consent withdrawal stop future email delivery and remove or irreversibly de-identify account-owned favorites, rules, and entitlement data within the documented retention policy while preserving only required non-personal audit evidence.

<!-- requirement
id: PRD-FR-018
status: Active
kind: Hard
roadmap_ref: REL-Beta-PRD_FR_018
owner: Product
verification: pnpm docs:check
-->

<a id="PRD-FR-018"></a>

### PRD-FR-018 — 14-Day Interactive Timeline

Beta SHALL deliver an Interactive Timeline for map-led destination discovery. The timeline presents up to 14 consecutive city-local calendar dates, labels the applicable **Today**, **Tomorrow**, **Weekend**, and **Next Week** navigation points, and refreshes the map and equivalent ranked-list results from the same selected-date state.

Roadmap: [REL-Beta-PRD_FR_018](11-Roadmap.md#REL-Beta-PRD_FR_018).

#### Acceptance Criteria

- Every selectable day shows its exact city-local calendar date; Today, Tomorrow, Weekend, and Next Week labels include or directly expose the dates they represent, and the UI identifies the destination time zone when it can differ from the user's.
- The timeline exposes no more than 14 consecutive days and only dates present in the latest successfully activated provider dataset. A shorter provider horizon, missing date, unsupported destination, or unavailable provider field is explicitly marked unavailable and is never synthesized; selecting the timeline causes zero weather-provider calls from a user request path.
- Forecast values identify their source update time and forecast status, preserve available probability or confidence context, distinguish stale or partial data, and never describe uncertain future conditions as observed facts or guaranteed outcomes.
- The selected date or labeled window, active theme or filter, and destination context are encoded in a canonical shareable URL; reload and browser back and forward navigation restore the same valid state, while invalid or expired state falls back deterministically with an explanation.
- Date and window controls are keyboard operable with visible focus and programmatic selected state; selection changes are announced without stealing focus, color is not the only signal, and reduced-motion preferences are honored.
- The ranked-list alternative exposes the same selected date, destination links, weather meaning, and unavailable or stale status as the map, and loading, empty, partial, stale, offline, error, and retry outcomes use the shared UX state contract.
