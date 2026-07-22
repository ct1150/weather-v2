# Requirements Document

## Introduction

Where Not Rain is an AI-powered, weather-driven travel discovery platform. It helps travelers discover the best destinations for the next 7 days based on weather suitability, complete the discovery-to-decision journey (discover, compare, book), and understand why a destination is recommended through explainable, rule-based Travel Scores.

This document defines the MVP (MoSCoW "Must") scope only, derived from SPEC.md as the single source of truth (FR-001..FR-012, data model §9, Travel Score §10, API §11, SEO §12, i18n §13, security §16, performance §15, states §6.4, deployment §7.1, testing §18, DoD §20, acceptance §25). Should/Could/Won't items are explicitly excluded.

The system is built with Next.js (App Router), React and TypeScript (strict), and deployed entirely on the Cloudflare FREE plan (Pages/Workers runtime, D1, KV, R2, Cron Triggers, Web Analytics). A hard architectural constraint governs the entire system: user request paths never call weather providers; weather data is acquired only by a scheduled ingestion pipeline and served from D1/KV.

## Glossary

- **Platform**: The complete Where Not Rain system, including web application, ingestion workers, and data stores.
- **Web_App**: The Next.js App Router application serving user-facing pages and read APIs.
- **Travel_Radar**: The homepage component that ranks the best destinations for a selected time window using rule-based scoring.
- **Weather_Explorer**: The MapLibre GL map component that displays cities as themed, color-coded markers.
- **City_Page**: The page at `/{countrySlug}/{citySlug}` presenting weather detail, Travel Score, and recommendations for one city.
- **Country_Page**: The page at `/{countrySlug}` presenting a country overview, best cities, and themed rankings.
- **Search_Service**: The fuzzy search capability over countries, cities, aliases, and destination keywords.
- **Rankings_Service**: The programmatic generation of destination ranking pages (e.g., `/best-weather`, `/best-beach`).
- **Compare_Service**: The city-versus-city comparison capability at `/compare/{cityA}-vs-{cityB}`.
- **Affiliate_Component**: A configurable UI block for Hotel, Activities, Flights, SIM, Insurance, Car Rental, or AdSlot placements.
- **Ingestion_Pipeline**: The hourly Cron-triggered process that fetches, validates, stores, and scores weather data and writes read models.
- **Weather_Provider**: An external weather data source. Open-Meteo is the primary provider; WeatherAPI is the pluggable fallback provider.
- **D1**: The Cloudflare D1 relational database storing normalized weather and content data.
- **KV**: The Cloudflare KV store holding versioned, compact read models.
- **Travel_Score**: A deterministic integer score from 0 to 100 expressing weather-based travel suitability for a city, day, and theme.
- **Reason_Code**: A stable, language-independent code (e.g., `LOW_RAIN_CHANCE`) that the i18n layer translates into user-facing recommendation text.
- **Snapshot**: A single successful set of ingested and validated weather data identified by a version, used to bind read models.
- **Stale_State**: A display condition indicating served data is from a prior successful sync and is no longer within the freshness target.
- **Time_Window**: One of the selectable ranges: Today, Tomorrow, This Weekend, Next Week.
- **Theme**: A travel activity category used for scoring and map filtering. MVP themes are Sunny, Beach, Hiking, Photography, Family, and Night View.
- **Locale**: A supported language. MVP locales are English (default, no prefix), Japanese (`/ja`), Korean (`/ko`), Simplified Chinese (`/zh-cn`), and Traditional Chinese (`/zh-tw`).
- **Quality_Gate**: The set of conditions a page must satisfy to be marked `index,follow`.

## Requirements

### Requirement 1: AI Travel Radar Homepage (FR-001)

**User Story:** As a weekend traveler, I want to see the best destinations for a chosen time window on the homepage, so that I can discover a suitable trip in seconds without searching cities one by one.

#### Acceptance Criteria

1. THE Travel_Radar SHALL display destination cards for the selected Time_Window, where each card contains city name, country name, weather condition, Travel_Score, maximum temperature, minimum temperature, precipitation probability, at least one recommendation reason, data update time, and a link to the City_Page.
2. THE Travel_Radar SHALL support the Time_Windows Today, Tomorrow, This Weekend, and Next Week.
3. THE Travel_Radar SHALL generate rankings using only data from the most recent successful Snapshot.
4. WHEN a user selects a Time_Window, THE Web_App SHALL encode the selection in a shareable URL query parameter and preserve browser forward and back navigation.
5. WHERE a card is displayed, THE Travel_Radar SHALL include at least one translated Reason_Code explaining the score.
6. IF the served data is older than the freshness target, THEN THE Travel_Radar SHALL display an "Updated {duration} ago" indicator and a Stale_State marker.
7. THE Web_App SHALL render the Travel_Radar rankings in server-side HTML so that search engine crawlers can read the rankings without client-side execution.
8. WHERE the confidence of a city score is below 0.7, THE Travel_Radar SHALL exclude the city from the top ranking.

### Requirement 2: Weather Explorer Map (FR-002)

**User Story:** As an inspiration-seeking user, I want an interactive themed map of cities, so that I can visually discover destinations by activity and weather suitability.

#### Acceptance Criteria

1. THE Weather_Explorer SHALL display city markers using MapLibre GL with support for zoom, hover, click, clustering, and theme filtering.
2. THE Weather_Explorer SHALL provide the Theme filters Sunny, Beach, Hiking, Photography, Family, and Night View.
3. THE Weather_Explorer SHALL color markers using the semantics green for suitable, yellow for average, red for rain or unsuitable, and purple for storm or strong-convection risk.
4. THE Web_App SHALL load the Weather_Explorer dynamically so that map assets do not block the homepage largest contentful paint.
5. IF WebGL is unavailable or map script loading fails, THEN THE Weather_Explorer SHALL display an accessible city ranking list fallback.
6. WHEN a user changes the active Theme, THE Weather_Explorer SHALL update marker colors and ordering to match the selected Theme.
7. THE Weather_Explorer SHALL transmit compact aggregated marker data and SHALL exclude full hourly forecast data from map responses.
8. THE Weather_Explorer SHALL make markers keyboard-accessible and SHALL provide readable text labels for popovers.

### Requirement 3: City Page (FR-003)

**User Story:** As a traveler evaluating a destination, I want a detailed city page with forecast, Travel Score, and explanations, so that I can confidently decide whether to go.

#### Acceptance Criteria

1. THE City_Page SHALL be served at the URL pattern `/{countrySlug}/{citySlug}`.
2. THE City_Page SHALL include in its initial server-rendered HTML the primary weather summary, the Travel_Score, and the forecast dates.
3. THE City_Page SHALL display a 7-day forecast and an hourly overview including rain, temperature, humidity, wind, and UV.
4. THE City_Page SHALL display the Travel_Score with score explanations and Perfect-For theme scores.
5. THE City_Page SHALL display the data update time, the city timezone, and the active unit system.
6. WHERE an Affiliate_Component is displayed, THE City_Page SHALL label the commercial relationship.
7. IF affiliate data for a section is unavailable, THEN THE City_Page SHALL hide that section without displaying placeholder or fabricated recommendations.
8. THE City_Page SHALL display FAQ content that is specific to the city data.

### Requirement 4: Country Page (FR-004)

**User Story:** As a user exploring a region, I want a country overview with its best cities and rankings, so that I can navigate to strong candidate destinations.

#### Acceptance Criteria

1. THE Country_Page SHALL be served at the URL pattern `/{countrySlug}`.
2. THE Country_Page SHALL display a country overview, best cities, regional weather, themed rankings, and related internal links.
3. THE Country_Page SHALL support sorting and progressive loading or pagination of the city list.
4. WHERE a country satisfies the content Quality_Gate, THE Web_App SHALL mark the Country_Page as `index,follow`.
5. IF a country does not satisfy the content Quality_Gate, THEN THE Web_App SHALL mark the Country_Page as `noindex,follow` and SHALL exclude it from the sitemap.

### Requirement 5: Fuzzy Search (FR-005)

**User Story:** As a search user, I want to find countries and cities by partial or localized names and aliases, so that I can reach a destination quickly.

#### Acceptance Criteria

1. THE Search_Service SHALL match by country name, city name, alias, and destination keyword using multilingual names, common aliases, accent-insensitive matching, and case normalization.
2. WHEN a user enters at least 2 characters, THE Search_Service SHALL display suggestions.
3. THE Search_Service SHALL support complete keyboard operation of the suggestion list.
4. THE Search_Service SHALL return results that include the result type, the country, and a current weather brief.
5. THE Search_Service SHALL apply length limits, input normalization, and parameterized queries to every search request.
6. THE Search_Service SHALL record anonymized search terms and result clicks and SHALL exclude personally identifiable information from those records.

### Requirement 6: Destination Rankings (FR-006)

**User Story:** As a search-intent visitor, I want ranking landing pages backed by real data, so that I can find themed best-weather destinations from long-tail queries.

#### Acceptance Criteria

1. THE Rankings_Service SHALL generate the ranking pages `/best-weather`, `/best-weekend`, `/best-beach`, `/best-hiking`, `/best-family`, and `/best-photo` for the MVP theme set.
2. THE Rankings_Service SHALL recompute weather-based rankings after each successful data Snapshot and SHALL update every ranking page at least once per day.
3. THE Rankings_Service SHALL display the scoring method, the data time, and the coverage scope on each ranking page.
4. IF a ranking page lacks sufficient candidate data or its theme model is not implemented, THEN THE Rankings_Service SHALL return `noindex` or SHALL NOT generate that page.
5. THE Rankings_Service SHALL restrict indexable pages to those satisfying the Quality_Gate so that no low-value city-by-theme combination pages are indexed.

### Requirement 7: Compare Cities (FR-007)

**User Story:** As a traveler choosing between two destinations, I want a side-by-side comparison, so that I can decide which city is better for my trip.

#### Acceptance Criteria

1. THE Compare_Service SHALL be served at the URL pattern `/compare/{cityA}-vs-{cityB}`.
2. THE Compare_Service SHALL compare weather, temperature, precipitation, Travel_Score, UV, humidity, and wind for the two cities.
3. THE Compare_Service SHALL normalize city order in the canonical URL and SHALL return HTTP 301 from the reversed-order URL to the canonical URL.
4. IF the two requested cities are identical, THEN THE Compare_Service SHALL return HTTP 404 or SHALL prompt the user to select a different city.
5. THE Compare_Service SHALL provide at least one data-driven conclusion about which city is better suited for a given activity.
6. THE Compare_Service SHALL restrict indexable comparison pages to a precomputed whitelist of city pairs.

### Requirement 8: Affiliate and Ads Components (FR-011)

**User Story:** As the platform operator, I want configurable affiliate and ad components, so that monetization can be enabled or disabled without harming layout or trust.

#### Acceptance Criteria

1. THE Affiliate_Component SHALL support the placement types Hotel, Activities, Flights, SIM, Insurance, Car Rental, and AdSlot.
2. THE Affiliate_Component SHALL integrate providers through an adapter interface so that the UI does not depend on provider-specific fields.
3. THE Affiliate_Component SHALL add a legal disclosure and appropriate `rel` attributes to every outbound link.
4. WHEN a user activates an outbound affiliate link, THE Affiliate_Component SHALL record the click event in a way that does not block navigation.
5. WHERE a feature flag or environment configuration disables a placement, THE Affiliate_Component SHALL omit that placement globally or per location.
6. IF an ad slot is disabled or unfilled, THEN THE Web_App SHALL render the layout without cumulative layout shift.

### Requirement 9: Hourly Ingestion Pipeline (SPEC §8)

**User Story:** As the platform operator, I want a scheduled ingestion pipeline that keeps weather data fresh and resilient, so that users always receive stored, explainable data without live provider calls.

#### Acceptance Criteria

1. WHEN the hourly Cron Trigger fires, THE Ingestion_Pipeline SHALL acquire a distributed lock with an expiration, fetch Weather_Provider data in bounded batches, validate and normalize the data, upsert it into D1 within a transaction, compute city, day, and theme Travel_Scores, update ranking snapshots, write versioned compact read models to KV, mark the sync run success, and release the lock.
2. THE Platform SHALL serve user requests only from KV read models or D1, and THE Platform SHALL NOT call any Weather_Provider on the user request path even when a cache entry is missing.
3. WHEN the primary Weather_Provider (Open-Meteo) fails, THE Ingestion_Pipeline SHALL fall back to the configured fallback Weather_Provider (WeatherAPI) and SHALL record the provider switch and failure reason in the sync run record.
4. IF a Cron run is already in progress, THEN THE Ingestion_Pipeline SHALL prevent overlapping execution using the distributed lock.
5. IF a single city fails during ingestion, THEN THE Ingestion_Pipeline SHALL record the failure and continue processing the remaining cities without rolling back the entire batch.
6. IF a sync run fails, THEN THE Platform SHALL continue serving the most recent successful Snapshot and SHALL mark the served data as Stale_State.
7. THE Ingestion_Pipeline SHALL fully validate new data before replacing the active Snapshot.
8. THE Ingestion_Pipeline SHALL store Weather_Provider secrets only in Cloudflare Secrets and SHALL exclude them from the repository, logs, client bundle, and error pages.

### Requirement 10: Travel Score Computation (SPEC §10)

**User Story:** As a traveler, I want deterministic and explainable travel scores, so that I can trust and understand the recommendations.

#### Acceptance Criteria

1. THE Travel_Score SHALL be an integer in the range 0 to 100.
2. THE Ingestion_Pipeline SHALL compute the general Travel_Score as `round(clamp(rain*0.30 + temperature*0.20 + comfort*0.15 + humidity*0.10 + wind*0.10 + uv*0.075 + cloud*0.075 - hazardPenalty, 0, 100))` using factors normalized to 0 to 100.
3. THE Ingestion_Pipeline SHALL compute theme scores for Sunny, Beach, Hiking, Photography, Family, and Night View using the theme weights defined in SPEC §10.4.
4. IF a required scoring factor is missing, THEN THE Ingestion_Pipeline SHALL compute the score as the weighted mean of available factors and SHALL set confidence to the available required weight divided by the total required weight.
5. THE Ingestion_Pipeline SHALL attach stable Reason_Codes to each score and SHALL exclude natural-language text from the score records.
6. THE Ingestion_Pipeline SHALL record a model version with each computed score so that scores are versioned.
7. THE Platform SHALL present Travel_Radar rankings and City_Page scores as rule-based results and SHALL NOT claim the scores are generated by generative AI in real time.

### Requirement 11: SEO and Structured Data (SPEC §12)

**User Story:** As a growth stakeholder, I want correct metadata and structured data on every indexable page, so that the platform ranks well without thin or duplicate content.

#### Acceptance Criteria

1. THE Web_App SHALL output on each page a unique title, a unique description, a canonical URL, Open Graph tags, Twitter Card tags, the correct language attribute with hreflang and x-default, crawlable server-rendered body content, and the data update time.
2. THE Web_App SHALL emit JSON-LD using `WebSite`, `Organization`, `BreadcrumbList`, `Place`, and `FAQPage` types appropriate to each page, and SHALL include only content that is visibly present on the page.
3. WHERE a page satisfies the Quality_Gate of active status, adequate data freshness, unique visible body content, a valid weather summary, a score explanation, and at least one internal link, THE Web_App SHALL mark the page `index,follow`.
4. IF a page does not satisfy the Quality_Gate, THEN THE Web_App SHALL mark the page `noindex,follow` and SHALL exclude the page from the sitemap.
5. THE Web_App SHALL generate a type-and-language split sitemap index and a robots policy that excludes search results, arbitrary filter combinations, admin, API, and preview pages from indexing.
6. THE Web_App SHALL update the `lastmod` value only when page body content changes meaningfully.

### Requirement 12: Internationalization (SPEC §13)

**User Story:** As a non-English speaker, I want localized content and formatting, so that I can use the platform in my language with correct units and dates.

#### Acceptance Criteria

1. THE Web_App SHALL support the Locales English, Japanese, Korean, Simplified Chinese, and Traditional Chinese.
2. THE Web_App SHALL serve English at prefix-free URLs and SHALL serve other Locales under the prefixes `/ja`, `/ko`, `/zh-cn`, and `/zh-tw`.
3. THE Web_App SHALL format dates, times, numbers, temperatures, and wind speeds using a locale-aware formatter.
4. THE Web_App SHALL compute city weather using the city local timezone rather than the server timezone.
5. WHEN a user selects a temperature unit, THE Web_App SHALL display values in the selected unit while D1 retains metric values.
6. IF a translation key is missing, THEN THE Web_App SHALL fall back to English and SHALL report the missing key in development and CI.

### Requirement 13: Security and Privacy (SPEC §16)

**User Story:** As a security-conscious operator, I want enforced security controls, so that the platform resists common attacks and protects secrets and user data.

#### Acceptance Criteria

1. THE Platform SHALL validate and normalize all inputs and SHALL execute all D1 queries as parameterized statements.
2. THE Web_App SHALL send the security response headers Content-Security-Policy, HSTS, Referrer-Policy, Permissions-Policy, and X-Content-Type-Options.
3. THE Platform SHALL apply layered rate limiting to API, search, compare, and internal endpoints.
4. THE Platform SHALL store all secrets only in Cloudflare Secrets and SHALL exclude secrets from the repository, logs, and client bundle.
5. IF an error occurs, THEN THE Web_App SHALL return a message in the user Locale and SHALL exclude stack traces, raw SQL, secrets, provider responses, and internal paths.
6. THE Affiliate_Component SHALL restrict outbound redirect targets to a provider whitelist so that open redirects are prevented.

### Requirement 14: Performance Budgets (SPEC §15)

**User Story:** As a mobile user, I want fast page loads, so that I can make decisions without waiting.

#### Acceptance Criteria

1. WHEN a representative mid-range mobile device loads a production page, THE Web_App SHALL achieve a largest contentful paint under 2.0 seconds.
2. THE Web_App SHALL maintain a cumulative layout shift below 0.05.
3. THE Web_App SHALL achieve an interaction to next paint within the Good range.
4. THE Web_App SHALL exclude MapLibre, full map data, and non-essential animation from the initial homepage load.

### Requirement 15: Component States (SPEC §6.4)

**User Story:** As a user under imperfect conditions, I want clear states for loading, empty, stale, error, and offline, so that I always understand what the platform is showing.

#### Acceptance Criteria

1. THE Web_App SHALL define for each asynchronous component the states skeleton, loading, empty, partial data, stale data, error, offline, and retry.
2. THE Web_App SHALL size skeleton placeholders close to final content dimensions to avoid cumulative layout shift.
3. WHERE the user has set `prefers-reduced-motion`, THE Web_App SHALL disable non-essential animation.
4. IF served data is in Stale_State, THEN THE Web_App SHALL display the data with its update time rather than an error.

### Requirement 16: Cloudflare Free Plan Deployment (SPEC §7.1)

**User Story:** As the platform operator, I want the entire system to run on the Cloudflare FREE plan, so that operating costs stay near zero.

#### Acceptance Criteria

1. THE Platform SHALL run on the Cloudflare FREE plan using Pages or the Workers runtime, D1, KV, R2, Cron Triggers, and Web Analytics.
2. THE Platform SHALL deploy the Next.js App Router application using a Cloudflare-supported adaptation that verifies App Router, server-side rendering or incremental static regeneration, bindings, and Cron.
3. WHERE a required configuration value is missing in the production environment, THE Platform SHALL fail fast at startup.
4. THE Platform SHALL validate runtime configuration using a schema and SHALL provide a `.env.example` file without real secret values.
