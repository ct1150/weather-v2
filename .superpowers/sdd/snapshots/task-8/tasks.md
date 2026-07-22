# Implementation Plan: Where Not Rain

## Overview

This plan converts the design into incremental, compiling TypeScript coding steps, sequenced along the SPEC §21 phase ordering (Architecture/scaffolding → DB → folder structure → design system → API → weather service → homepage → map → country → city → SEO → affiliate/ads → analytics → deployment).

The hard constraints are front-loaded before any UI:

1. **Monorepo scaffolding + package boundaries** so `packages/weather` is importable only by `workers/weather-sync` (making "no provider call on the user path" a build-time guarantee — Requirement 9.2, Property 1).
2. **D1 schema + forward-only migrations** as the source of truth.
3. **Travel Score domain functions** — pure, deterministic, versioned (Requirement 10, Properties 2–6).
4. **Ingestion pipeline + KV read models** (Requirement 9, Properties 8, 10, 27).

Only then do use cases, API, and UI layers build on top. Scoring, canonicalization, quality-gate, and normalization logic are implemented test-first: the property test sub-task references the exact property number and the requirement clause it validates.

Language: **TypeScript (strict)** as fixed by the design. Property tests use `fast-check` (min 100 iterations, tagged with feature name + property number).

Convention: sub-tasks marked with `*` are optional test tasks and are NOT auto-implemented; all unmarked sub-tasks MUST be implemented.

## Tasks

- [ ] 1. Monorepo scaffolding, tooling, typed config, and package boundaries
  - [ ] 1.1 Initialize the monorepo workspace and shared tooling
    - Create the SPEC §7.2 layout: `apps/web`, `workers/weather-sync`, `workers/maintenance`, and `packages/{ui,domain,weather,db,config,analytics,seo,i18n,test-utils}`, plus `tooling/` presets and `docs/12-ADR/`.
    - Configure the workspace package manager, shared `tsconfig` (strict, no implicit any), ESLint/Prettier, Tailwind preset, and Vitest preset in `tooling/`; wire each package to extend them.
    - Ensure every package builds and typechecks empty (barrel `index.ts` per package).
    - _Requirements: 16.1_
  - [ ] 1.2 Implement `packages/config` typed runtime configuration with schema validation
    - Define a Zod config schema for all required runtime keys (bindings names, provider flags, freshness target, locales, feature-flag defaults) and a `loadConfig()` that fails fast on any missing required key.
    - Provide `.env.example` with placeholder (non-secret) values; treat unknown feature flags as disabled.
    - _Requirements: 16.3, 16.4, 8.5_
  - [ ]* 1.3 Write property test for fail-fast configuration validation
    - **Property 29: Startup fails fast on missing required configuration**
    - **Validates: Requirements 16.3, 16.4**
  - [ ] 1.4 Configure import-boundary enforcement across packages
    - Add `eslint-plugin-boundaries` (or equivalent) rules encoding the acyclic dependency graph: `packages/domain` imports no framework/Cloudflare/provider code; `packages/weather` is importable only by `workers/weather-sync`; `apps/web` may not import `packages/weather`.
    - Fail CI on any boundary violation or cycle.
    - _Requirements: 9.2_
  - [ ]* 1.5 Write build-time boundary test asserting the user path cannot reach providers
    - **Property 1: No weather provider call on the user request path** (build-time facet)
    - Assert `apps/web`'s resolved dependency graph excludes `packages/weather`.
    - **Validates: Requirements 9.2**

- [ ] 2. Domain kernel: entities, ports, and Result types
  - [ ] 2.1 Define domain entities and value types in `packages/domain`
    - Add `City`, `Country`, `WeatherDaily`, `WeatherHourly`, `CityScore`, `Ranking`, `Snapshot`, `Reason_Code` enum, `TimeWindow`, `Theme`, `Locale`, and unit/temperature value types.
    - _Requirements: 10.1, 10.5, 12.1_
  - [ ] 2.2 Define repository/provider ports and the `Result`/`DomainError` model
    - Declare interfaces `CityRepository`, `ScoreRepository`, `RankingRepository`, `SeoPageRepository`, `WeatherProvider` (port re-exported by weather pkg), and `ReadModelResolver`; add `Result<T, DomainError>` with typed domain errors (not-found, insufficient-data, low-confidence).
    - _Requirements: 9.1, 9.2_

- [ ] 3. Travel Score domain (pure, deterministic, versioned) — test-first
  - [ ] 3.1 Implement factor normalization functions
    - In `packages/domain/score/factors.ts`, normalize rain, temperature, comfort, humidity, wind, uv, cloud to integer `0..100` or `null` when data is absent (missing never defaults to best); compute hazard penalty `0..100`.
    - _Requirements: 10.2, 10.4_
  - [ ]* 3.2 Write property test for factor normalization bounds and missing handling
    - **Property 4 (support): normalized factors stay in 0..100 and absent inputs yield null**
    - **Validates: Requirements 10.4**
  - [ ] 3.3 Implement `computeTravelScore` with confidence
    - Implement the SPEC §10.3 weighted formula with `round(clamp(..-hazardPenalty,0,100))`; compute confidence as available/total required weight; reduce to weighted mean over present factors when some are missing.
    - _Requirements: 10.1, 10.2, 10.4_
  - [ ]* 3.4 Write property test for integer score range
    - **Property 2: Travel Score is always an integer in 0..100**
    - **Validates: Requirements 10.1**
  - [ ]* 3.5 Write property test for the general-score formula against a reference implementation
    - **Property 3: General Travel Score matches the specified formula**
    - **Validates: Requirements 10.2, 10.3**
  - [ ]* 3.6 Write property test for missing-factor behavior
    - **Property 4: Missing factors reduce to weighted mean with proportional confidence**
    - **Validates: Requirements 10.4**
  - [ ] 3.7 Implement theme scorers with the SPEC §10.4 weight tables
    - Add `THEME_WEIGHTS` constants and theme scoring for Sunny, Beach, Hiking, Photography, Family, Night View; hide non-weather themes when their data is insufficient rather than fabricating.
    - _Requirements: 10.3_
  - [ ] 3.8 Implement reason-code derivation
    - `deriveReasonCodes(factors, hazard)` returns only codes from the defined `Reason_Code` enum; no natural-language text is stored.
    - _Requirements: 10.5_
  - [ ]* 3.9 Write property test for reason-code stability and no-NL-text
    - **Property 6: Reason codes are stable and records carry no natural-language text**
    - **Validates: Requirements 10.5**
  - [ ] 3.10 Implement time-window aggregation
    - Today/Tomorrow (08:00–22:00 city-local window), Weekend (weighted Sat+Sun), Next Week (available days), multi-day mean minus volatility penalty; attach `model_version` to every result.
    - _Requirements: 10.6_
  - [ ]* 3.11 Write property test for determinism and versioning
    - **Property 5: Scoring is deterministic and versioned**
    - **Validates: Requirements 10.6**

- [ ] 4. Checkpoint - scoring domain
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Database: D1 schema, migrations, repositories, and read-model resolution
  - [ ] 5.1 Author forward-only D1 migrations for the full schema
    - Create ordered migrations for geography/content, weather (snapshots/daily/hourly), scores/rankings, ops (`sync_runs`, `sync_failures`, `sync_locks`, `feature_flags`), `seo_page_registry`, affiliate tables, and `city_relationships`; add the indexing strategy from the design. No destructive auto-migration.
    - _Requirements: 9.1, 12.4, 12.5_
  - [ ] 5.2 Implement the migration runner and seed-data specification
    - Add an explicit ordered migration step usable in CI/deploy and a documented seed spec (countries/cities/translations); never run destructive migration at startup.
    - _Requirements: 16.2_
  - [ ] 5.3 Implement parameterized D1 repositories in `packages/db`
    - Implement `CityRepository`, `ScoreRepository`, `RankingRepository`, `SeoPageRepository` using only parameterized statements; map rows to domain types (no row types leaking upward).
    - _Requirements: 9.1, 13.1_
  - [ ]* 5.4 Write integration tests for migrations and repositories
    - Run migrations against a local D1 and validate hot-path queries with `EXPLAIN QUERY PLAN`.
    - _Requirements: 9.1, 13.1_
  - [ ] 5.5 Define KV read-model shapes and versioned key builders
    - Implement the `v1:...` key scheme (summary/forecast/ranking/map/country/compare); each value carries `{ data, dataUpdatedAt, snapshotId, modelVersion }`.
    - _Requirements: 9.1_
  - [ ] 5.6 Implement `ReadModelResolver` (KV → D1 → stale)
    - Centralize read resolution with the freshness threshold, setting `source`, `dataUpdatedAt`, and `stale` consistently.
    - _Requirements: 9.6, 15.4, 1.6_
  - [ ]* 5.7 Write property test for the staleness flag
    - **Property 10: Stale flag reflects the freshness threshold**
    - **Validates: Requirements 1.6, 9.6, 15.4**
  - [ ] 5.8 Implement active-snapshot selection
    - Resolve the single most recent `active` snapshot and bind it to ranking/read-model generation.
    - _Requirements: 1.3, 9.7_
  - [ ]* 5.9 Write property test for snapshot selection
    - **Property 8: Rankings use only the most recent successful snapshot**
    - **Validates: Requirements 1.3**

- [ ] 6. Internationalization and formatting (`packages/i18n`)
  - [ ] 6.1 Implement locale dictionaries, fallback resolver, and reason-code translation
    - Support en/ja/ko/zh-cn/zh-tw; missing keys fall back to English and emit a missing-key report in dev/CI; translate `Reason_Code`s.
    - _Requirements: 12.1, 12.6, 10.5_
  - [ ]* 6.2 Write property test for missing-key fallback
    - **Property 22: Missing translation keys fall back to English and are reported**
    - **Validates: Requirements 12.6**
  - [ ] 6.3 Implement locale-aware formatters
    - Format dates, times, numbers, temperatures, and wind speeds per locale.
    - _Requirements: 12.3_
  - [ ]* 6.4 Write property test for locale-aware formatting
    - **Property 23: Locale-aware formatting matches the locale reference**
    - **Validates: Requirements 12.3**
  - [ ] 6.5 Implement unit conversion (metric storage, display conversion)
    - Convert °C↔°F and metric↔display units at presentation; storage stays metric.
    - _Requirements: 12.5_
  - [ ]* 6.6 Write property test for unit-conversion round-trip
    - **Property 20: Unit conversion round-trips while storage stays metric**
    - **Validates: Requirements 12.5**
  - [ ] 6.7 Implement city-local timezone/date computation
    - Derive the city-local calendar date from a UTC instant using only the city timezone.
    - _Requirements: 12.4_
  - [ ]* 6.8 Write property test for city-local time computation
    - **Property 21: City-local time computation depends only on the city timezone**
    - **Validates: Requirements 12.4**

- [ ] 7. Weather provider package (`packages/weather`, sync-only)
  - [ ] 7.1 Define the `WeatherProvider` port and normalized types
    - Add `WeatherProvider`, `ForecastRequest`, `NormalizedForecast/Daily/Hourly`, `ProviderHealth`; provider DTO types stay private to adapters.
    - _Requirements: 9.1_
  - [ ] 7.2 Implement the Open-Meteo adapter (primary) with Zod validation → domain mapping
    - Batch coordinates, request metric units, validate the raw response, and map to `NormalizedForecast`; never export DTOs.
    - _Requirements: 9.1_
  - [ ]* 7.3 Write property test for DTO normalization
    - **Property (normalization): any valid provider DTO maps successfully and any invalid DTO is rejected**
    - **Validates: Requirements 9.1**
  - [ ] 7.4 Implement the WeatherAPI fallback adapter (secret-gated)
    - Read `WEATHERAPI_SECRET` from Cloudflare Secrets only; disabled unless configured.
    - _Requirements: 9.3, 9.8, 13.4_
  - [ ] 7.5 Implement resilience wrappers (timeout, bounded retry, circuit breaker)
    - Per-request timeout, exponential backoff with full jitter, and a CLOSED→OPEN→HALF_OPEN breaker; used only inside the sync worker.
    - _Requirements: 9.3_
  - [ ] 7.6 Implement the D1-backed distributed lock
    - Conditional insert/update on `sync_locks` with `expires_at`; recover after expiry; never use KV for locking.
    - _Requirements: 9.4_

- [ ] 8. Ingestion pipeline worker (`workers/weather-sync`)
  - [ ] 8.1 Implement the sync orchestration
    - Acquire lock → create `sync_run` → fetch bounded batches → validate/normalize → upsert weather within a D1 transaction → compute city/day/theme scores → build ranking snapshots → mark snapshot active only after full validation → mark run success → release lock.
    - _Requirements: 9.1, 9.7, 10.6_
  - [ ]* 8.2 Write property test for partial-batch isolation
    - **Property 27: Partial-batch ingestion persists successes and isolates failures**
    - **Validates: Requirements 9.5, 9.7**
  - [ ] 8.3 Implement provider fallback and switch recording
    - On primary breaker open / retry exhaustion, switch to fallback and record `provider_switched` + `switch_reason` in `sync_runs`; record per-city `sync_failure`s and continue.
    - _Requirements: 9.3, 9.5_
  - [ ] 8.4 Implement the versioned KV read-model writer
    - Write summary/forecast/ranking/map/country read models with snapshot-bound versioned keys after validation.
    - _Requirements: 9.1_
  - [ ]* 8.5 Write integration tests for the cron run
    - Normal run, single-city failure (partial), and primary-provider failure → fallback.
    - _Requirements: 9.3, 9.4, 9.5, 9.6_
  - [ ]* 8.6 Write property test asserting no provider call on the user path (runtime facet)
    - **Property 1: No weather provider call on the user request path**
    - Execute all read use cases against a spy `WeatherProvider` and assert zero calls.
    - **Validates: Requirements 9.2**

- [ ] 9. Maintenance worker (`workers/maintenance`)
  - [ ] 9.1 Implement ranking refresh with expiry
    - Recompute ranking snapshots after each successful sync and refresh at least daily; set `expires_at`.
    - _Requirements: 6.2_
  - [ ] 9.2 Implement sitemap/health/cleanup maintenance tasks
    - Regenerate sitemap inputs, run health checks, and clean superseded snapshots.
    - _Requirements: 11.5_

- [ ] 10. Checkpoint - data + ingestion backbone
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. SEO package (`packages/seo`)
  - [ ] 11.1 Implement the quality gate
    - `evaluateQualityGate` returns `index,follow` only when active, fresh, unique body, weather summary, score explanation, ≥1 internal link, and (for compare) whitelisted; otherwise `noindex,follow` + excluded from sitemap.
    - _Requirements: 4.4, 4.5, 6.4, 6.5, 7.6, 11.3, 11.4_
  - [ ]* 11.2 Write property test for the quality gate
    - **Property 17: Quality gate indexability is the conjunction of its conditions**
    - **Validates: Requirements 4.4, 4.5, 6.4, 6.5, 7.6, 11.3, 11.4**
  - [ ] 11.3 Implement metadata builders and JSON-LD emitters
    - Per-page unique title/description, canonical, OG/Twitter, `lang`+hreflang+x-default, data-update time; JSON-LD `WebSite`/`Organization`/`BreadcrumbList`/`Place`/`FAQPage` restricted to visibly present content.
    - _Requirements: 11.1, 11.2_
  - [ ]* 11.4 Write property test for metadata completeness and FAQ subset
    - **Property 19: Page metadata is complete and unique**
    - **Validates: Requirements 11.1, 11.2**
  - [ ] 11.5 Implement the SEO page registry, lastmod/content-hash, sitemap index, and robots
    - Persist quality-gate results in `seo_page_registry`; update `lastmod` only when `content_hash` changes; emit type-and-language split sitemap index; robots excludes search/filter/admin/api/preview.
    - _Requirements: 11.5, 11.6_
  - [ ]* 11.6 Write property test for lastmod change detection
    - **Property 18: lastmod changes only when content changes**
    - **Validates: Requirements 11.6**

- [ ] 12. Design system (`packages/ui`)
  - [ ] 12.1 Implement design tokens, Tailwind/shadcn presets, and dark mode
    - Semantic tokens (no scattered brand colors), typography/spacing/radius/icon scales, system/light/dark; color is never the sole state carrier.
    - _Requirements: 15.3_
  - [ ] 12.2 Implement the `AsyncState` contract and shared state components
    - `AsyncState<T>` union and skeleton/loading/empty/partial/stale/error/offline/ready components; skeletons sized to final content; `prefers-reduced-motion` disables non-essential animation; errors show localized message + retry, never a stack trace.
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 13. Application use cases and route builders (`packages/domain/usecases`)
  - [ ] 13.1 Implement route builders and compare canonicalization
    - City route `/{countrySlug}/{citySlug}`; compare canonicalization is order-independent and idempotent with a canonical `/compare/{cityA}-vs-{cityB}`.
    - _Requirements: 3.1, 7.1, 7.3_
  - [ ]* 13.2 Write property test for route builders
    - **Property 12: City and compare route builders round-trip**
    - **Validates: Requirements 3.1, 7.3**
  - [ ] 13.3 Implement `GetTravelRadar`
    - Read the active snapshot via the resolver, exclude cities with confidence < 0.7 from the top ranking, and assemble radar card ViewModels with all required fields.
    - _Requirements: 1.1, 1.3, 1.8_
  - [ ]* 13.4 Write property test for the confidence exclusion
    - **Property 7: Confidence below 0.7 is excluded from the top ranking**
    - **Validates: Requirements 1.8**
  - [ ]* 13.5 Write property test for radar card / city SSR field completeness
    - **Property 11: Radar card and city SSR output contain all required fields**
    - **Validates: Requirements 1.1, 3.2**
  - [ ] 13.6 Implement `GetCityPage`, `GetCountryPage`, and `GetRanking`
    - Assemble ViewModels (weather summary, score, forecast dates, themed rankings, related links) from the resolver; return typed `Result` on missing data.
    - _Requirements: 3.2, 3.3, 3.4, 4.2, 6.1, 6.3_
  - [ ] 13.7 Implement `CompareCities` with same-city rejection
    - Compare weather/temp/precip/score/uv/humidity/wind, produce ≥1 data-driven conclusion, and reject identical cities.
    - _Requirements: 7.2, 7.4, 7.5_
  - [ ]* 13.8 Write property test for same-city rejection
    - **Property 13: Comparing a city with itself is rejected**
    - **Validates: Requirements 7.4**
  - [ ] 13.9 Implement `Search`
    - Normalize input (length limit, accent-fold, case), match names/aliases/keywords via parameterized queries, return type + country + weather brief; record anonymized terms/clicks without PII.
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 13.1_
  - [ ]* 13.10 Write property test for accent/case-insensitive matching
    - **Property 15: Search matches are accent- and case-insensitive over names and aliases**
    - **Validates: Requirements 5.1, 5.2**
  - [ ]* 13.11 Write property test for bounded, injection-safe normalization
    - **Property 16: Search normalization is bounded and injection-safe**
    - **Validates: Requirements 5.5, 13.1**

- [ ] 14. API v1 route handlers and security (`apps/web`)
  - [ ] 14.1 Implement the response envelope, error codes, and input validation
    - Uniform success/error envelopes with `requestId`; stable error codes; Zod validation, whitelisted sort fields, capped `limit`.
    - _Requirements: 11.1, 13.1_
  - [ ] 14.2 Implement the `/api/v1/*` endpoints wired to use cases
    - rankings, countries, cities, forecast, hourly, map, search, compare, articles — reading only KV/D1 via use cases; `/map` returns compact markers with no hourly arrays.
    - _Requirements: 2.7, 9.2_
  - [ ] 14.3 Implement compare canonical redirect and same-city handling in the route
    - HTTP 301 from reversed-order URL to canonical; HTTP 404 (or prompt) for identical cities.
    - _Requirements: 7.3, 7.4_
  - [ ] 14.4 Implement security headers, CORS, and layered rate limiting middleware
    - CSP, HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options; restrictive CORS; rate limits on API/search/compare/internal.
    - _Requirements: 13.2, 13.3_
  - [ ]* 14.5 Write property test for error hygiene
    - **Property 28: Errors are localized and leak no internals**
    - **Validates: Requirements 13.5**
  - [ ]* 14.6 Write integration tests for the API contract
    - Envelope shape, error codes/status, and rate limiting behavior.
    - _Requirements: 11.1, 13.3, 13.5_

- [ ] 15. Checkpoint - domain, API, and platform services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Homepage (Travel Radar)
  - [ ] 16.1 Implement the server-rendered Travel Radar with time-window selection
    - SSR cards for the selected window; encode the window in a shareable URL query param that preserves back/forward; render `AsyncState` variants.
    - _Requirements: 1.1, 1.2, 1.4, 1.7_
  - [ ]* 16.2 Write property test for time-window URL encoding
    - **Property 9: Time window URL encoding round-trips**
    - **Validates: Requirements 1.4**
  - [ ] 16.3 Implement the homepage search UI, stale indicator, and homepage SEO
    - Keyboard-operable suggestion list (≥2 chars); "Updated {duration} ago" + stale marker when past freshness target; homepage metadata via `packages/seo`.
    - _Requirements: 1.5, 1.6, 5.2, 5.3, 15.4_

- [ ] 17. Weather Explorer map
  - [ ] 17.1 Implement the dynamically imported MapLibre map
    - Zoom/hover/click/clustering/theme filtering; keyboard-accessible markers with readable popover labels; markers recolor and reorder on theme change; excluded from the initial homepage bundle.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.8, 14.4_
  - [ ] 17.2 Implement the WebGL/map-failure fallback ranking list
    - Accessible city ranking list when WebGL is unavailable or the map script fails.
    - _Requirements: 2.5_
  - [ ] 17.3 Implement the `/api/v1/map` compact marker payload
    - Aggregated marker fields only; exclude full hourly forecast arrays.
    - _Requirements: 2.7_
  - [ ]* 17.4 Write property test for compact map payloads
    - **Property 14: Map payloads exclude hourly data and stay compact**
    - **Validates: Requirements 2.7**

- [ ] 18. Country page
  - [ ] 18.1 Implement the Country page at `/{countrySlug}`
    - Overview, best cities, regional weather, themed rankings, related internal links, sorting + progressive loading/pagination; apply the quality gate to set index/noindex and sitemap inclusion.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 19. City page
  - [ ] 19.1 Implement the City page SSR at `/{countrySlug}/{citySlug}`
    - Server-render weather summary, Travel_Score, and forecast dates; show 7-day + hourly (rain/temp/humidity/wind/UV), Perfect-For theme scores, data-update time, timezone, and active unit system.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ] 19.2 Implement city-specific FAQ and its JSON-LD wiring
    - FAQ content derived from the city's data; emit `FAQPage` JSON-LD only for visibly present entries.
    - _Requirements: 3.8, 11.2_
  - [ ] 19.3 Implement affiliate slots on the City page
    - Render an affiliate section only when authorized offers exist (no placeholders/fabrication); label the commercial relationship.
    - _Requirements: 3.6, 3.7_

- [ ] 20. Affiliate and Ads components (`packages/analytics` + `packages/ui`)
  - [ ] 20.1 Implement the `AffiliateAdapter` interface and reusable placement blocks
    - Support Hotel/Activities/Flights/SIM/Insurance/Car Rental/AdSlot through a provider-agnostic adapter; add legal disclosure and appropriate `rel` on every outbound link.
    - _Requirements: 8.1, 8.2, 8.3_
  - [ ]* 20.2 Write property test for conditional rendering and disclosure/rel
    - **Property 24: Affiliate section is shown only when data exists; links carry disclosure and rel**
    - **Validates: Requirements 3.7, 8.3**
  - [ ] 20.3 Implement whitelist-restricted outbound redirect
    - Permit outbound redirects only when the target host is in the provider whitelist.
    - _Requirements: 13.6_
  - [ ]* 20.4 Write property test for redirect whitelisting
    - **Property 25: Affiliate redirects are restricted to the provider whitelist**
    - **Validates: Requirements 13.6**
  - [ ] 20.5 Implement ad-slot reserved dimensions, feature flags, and non-blocking click tracking
    - Reserve identical layout box for filled/unfilled/disabled states; gate placements by feature flag/env; record clicks without blocking navigation.
    - _Requirements: 8.4, 8.5, 8.6_
  - [ ]* 20.6 Write property test for ad-slot dimensional stability
    - **Property 26: Ad slot dimensions are stable regardless of fill state**
    - **Validates: Requirements 8.6**

- [ ] 21. SEO wiring and generation across pages
  - [ ] 21.1 Wire metadata, JSON-LD, canonical, and hreflang into all pages
    - Apply `packages/seo` builders to homepage, country, city, ranking, and compare pages; canonicalize filter/query variants; restrict compare indexability to the whitelist.
    - _Requirements: 6.3, 7.6, 11.1, 11.2, 11.3, 12.2_
  - [ ] 21.2 Generate the split sitemap index and robots policy from the registry
    - Emit type-and-language split sitemap including only `indexable && in_sitemap` rows; robots excludes search/filter/admin/api/preview.
    - _Requirements: 11.4, 11.5_

- [ ] 22. Analytics
  - [ ] 22.1 Implement analytics event contracts, adapters, and wiring
    - Cloudflare Web Analytics with optional GA4/Plausible adapters; single source for event names; defer third-party scripts; record search/affiliate events without PII.
    - _Requirements: 5.6, 8.4_

- [ ] 23. Deployment and CI
  - [ ] 23.1 Configure the Cloudflare adapter, `wrangler` bindings, and Cron triggers
    - Configure the official Next-on-Cloudflare (Workers runtime) adapter; declare D1/KV/R2 bindings and hourly/daily Cron; verify App Router/SSR/ISR/bindings/Cron in a preview target (ADR-001).
    - _Requirements: 16.1, 16.2_
  - [ ] 23.2 Configure the migrations deploy step and secrets documentation
    - Add an explicit ordered migration deploy step (no destructive auto-migration) and finalize `.env.example`; document Cloudflare Secrets usage (no secrets in repo/logs/bundle).
    - _Requirements: 9.8, 13.4, 16.2, 16.4_
  - [ ]* 23.3 Configure the CI pipeline (verification gates)
    - Typecheck, lint (incl. boundary rules), property + integration + E2E tests, Lighthouse CI (Perf/SEO/A11y), axe, bundle-size budget, and security-header check; block merges that change scoring/migrations/cache without tests.
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 24. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Sub-tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; they are NOT auto-implemented.
- Each task references specific requirement clauses; property test tasks additionally cite the exact Property number from the design's Correctness Properties section.
- Property 1 is validated twice: at build time (task 1.5, dependency-graph exclusion) and at runtime (task 8.6, spy provider) — matching the design's "structural + verified" guarantee.
- The hard constraints (package boundaries, D1 schema/migrations, scoring domain, ingestion + KV read models) are completed in tasks 1–10 before any UI is built.
- Checkpoints (tasks 4, 10, 15, 24) provide incremental validation points.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "2.1", "5.1", "6.1", "6.3", "6.5", "6.7", "12.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "3.1", "5.2", "5.5", "6.2", "6.4", "6.6", "6.8", "11.1", "13.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.7", "3.8", "5.3", "7.1", "11.2", "11.3", "12.2", "13.2", "14.1", "23.2"] },
    { "id": 4, "tasks": ["1.5", "3.4", "3.5", "3.6", "3.9", "3.10", "5.4", "5.6", "5.8", "7.2", "7.4", "7.5", "7.6", "11.4", "11.5", "13.9", "14.4", "20.1"] },
    { "id": 5, "tasks": ["3.11", "5.7", "5.9", "7.3", "8.1", "9.2", "11.6", "13.3", "13.6", "13.7", "13.10", "13.11", "20.2", "20.3", "20.5"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4", "13.4", "13.5", "13.8", "14.2", "16.1", "18.1", "19.1", "20.4", "20.6"] },
    { "id": 7, "tasks": ["8.5", "8.6", "9.1", "14.3", "14.5", "14.6", "16.2", "16.3", "17.1", "17.3", "19.2", "22.1", "23.1"] },
    { "id": 8, "tasks": ["17.2", "17.4", "19.3"] },
    { "id": 9, "tasks": ["21.1"] },
    { "id": 10, "tasks": ["21.2"] },
    { "id": 11, "tasks": ["23.3"] }
  ]
}
```
