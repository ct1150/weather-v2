# Design Document

## Overview

Where Not Rain is a weather-driven travel discovery platform built on Next.js (App Router) and deployed entirely on the Cloudflare FREE plan. The defining architectural characteristic is a strict read/write separation: a scheduled ingestion pipeline is the **only** code path that contacts weather providers, while every user request is served from precomputed read models (KV) with a database fallback (D1). No user request ever calls a weather provider.

This design covers the MVP scope (SPEC.md FR-001..FR-012 plus §8–§16, §18, §20, §25) and maps every element back to `requirements.md`. It defines the monorepo layout, the layered architecture and its dependency rules, the ingestion data flow, the `WeatherProvider` abstraction, the D1 schema, the deterministic Travel Score model, versioned KV read models, the `/api/v1` contract, SEO/i18n strategy, security and performance design, component states, deployment, error handling, and the testing strategy.

### Design Goals

1. **Zero provider calls on the user path** — enforced structurally, not just by convention (Requirement 9.2).
2. **Deterministic, explainable, versioned scoring** — same inputs always yield the same score and reason codes (Requirement 10).
3. **Resilience through staleness, not failure** — a failed sync serves the last good snapshot marked stale (Requirements 9.6, 15.4).
4. **SEO correctness by construction** — quality gates decide indexability; thin/infinite pages are never indexed (Requirements 6, 11).
5. **Runs on the free tier** — bounded batches, compact read models, minimal bindings (Requirement 16).

### Technology Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js App Router | Server Components first; client leaves only interactive |
| Language | TypeScript (strict) | No `any` in domain/use-case layers |
| Styling | Tailwind CSS + shadcn/ui | Semantic tokens only, no scattered brand colors |
| Map | MapLibre GL | Dynamically imported, never in initial homepage bundle |
| Motion | Framer Motion | Lazy, gated by `prefers-reduced-motion` |
| Runtime | Cloudflare Workers/Pages | Official Next-on-Cloudflare adapter |
| Relational store | Cloudflare D1 | Normalized weather + content, parameterized SQL |
| Read model / cache | Cloudflare KV | Versioned compact JSON |
| Object store | Cloudflare R2 | Only when strictly needed (images, exports) |
| Scheduling | Cloudflare Cron Triggers | Hourly ingestion, maintenance tasks |
| Analytics | Cloudflare Web Analytics | GA4/Plausible optional adapters |

## Architecture

### Monorepo Structure (SPEC §7.2)

```text
WhereNotRain/
├── apps/
│   └── web/                    # Next.js App Router application (UI + read APIs)
├── workers/
│   ├── weather-sync/           # Hourly Cron ingestion + scoring + read-model writer
│   └── maintenance/            # Ranking refresh, sitemap, health, cleanup tasks
├── packages/
│   ├── ui/                     # Shared components, design tokens, state primitives
│   ├── domain/                 # Entities, Travel Score, use cases (framework-agnostic)
│   ├── weather/                # WeatherProvider interface + Open-Meteo/WeatherAPI adapters
│   ├── db/                     # D1 schema, migrations, repositories
│   ├── config/                 # Typed config + feature flags (runtime schema validated)
│   ├── analytics/              # Event contracts + adapters (CF/GA4/Plausible)
│   ├── seo/                    # Metadata builders, JSON-LD, sitemap, quality gates
│   ├── i18n/                   # Locale dictionaries, formatters, reason-code translation
│   └── test-utils/             # Generators, fixtures, fake bindings for tests
├── docs/
│   └── 12-ADR/                 # Architecture Decision Records
├── public/
├── tooling/                    # Shared eslint/tsconfig/tailwind/vitest presets
├── SPEC.md
└── README.md
```

**Dependency direction (must never form a cycle):**

```text
apps/web ─────────┐
workers/* ────────┼──▶ packages/domain ──▶ (no framework deps)
                  ├──▶ packages/weather ─▶ packages/domain
                  ├──▶ packages/db ──────▶ packages/domain
                  ├──▶ packages/seo ─────▶ packages/domain
                  ├──▶ packages/i18n
                  ├──▶ packages/config
                  └──▶ packages/ui ──────▶ packages/i18n, tokens
```

`packages/domain` sits at the bottom and imports nothing from Next.js, Cloudflare SDKs, or provider DTOs. Cycle prevention is enforced in CI via an import-boundary lint rule (e.g. `eslint-plugin-boundaries`).

### Layered Architecture (SPEC §7.3)

```text
┌─────────────────────────────────────────────────────────────┐
│ UI Layer (apps/web: Server/Client Components, route handlers)  │
│  - Renders ViewModels; never calls D1/KV/providers directly    │
└───────────────┬───────────────────────────────────────────────┘
                │ calls
┌───────────────▼───────────────────────────────────────────────┐
│ Application Use Cases (packages/domain/usecases)               │
│  - GetTravelRadar, GetCityPage, GetRanking, CompareCities, ... │
│  - Orchestrate repositories; assemble ViewModels               │
└───────────────┬───────────────────────────────────────────────┘
                │ depends on interfaces
┌───────────────▼───────────────────────────────────────────────┐
│ Domain (packages/domain)                                       │
│  - Entities: City, Country, WeatherDaily, CityScore, Ranking   │
│  - Pure logic: score computation, reason codes, aggregation    │
│  - Repository & Provider INTERFACES (ports)                    │
└───────────────┬───────────────────────────────────────────────┘
                │ implemented by
┌───────────────▼───────────────────────────────────────────────┐
│ Infrastructure Adapters                                        │
│  - packages/db: D1 repositories + KV read-model repositories   │
│  - packages/weather: Open-Meteo / WeatherAPI provider adapters │
│  - External DTOs validated (Zod) then MAPPED to domain types   │
└───────────────────────────────────────────────────────────────┘
```

**Enforced rules (Requirement mapping in parentheses):**

- UI does not import D1, KV, or provider SDKs. It calls use cases that return ViewModels. (SPEC §7.3)
- Domain has no dependency on Next.js, Cloudflare SDKs, or provider DTOs. (SPEC §7.3)
- All external data is validated with a schema, then mapped to internal types; DTOs never leak upward. (Requirement 9.1)
- Public API shapes and DB row types are never used directly as UI ViewModels; dedicated mappers exist.
- Scoring formulas, route builders, locale logic, and analytics event names are defined once and imported (no duplication).

### Deployment Topology (SPEC §7.1, Requirement 16)

```text
                    ┌──────────────────────────┐
   Browser ───────▶ │ Cloudflare CDN / Edge     │
                    │  (Next-on-Cloudflare)     │
                    └───────┬──────────┬────────┘
                            │          │
                 SSR/ISR    │          │ /api/v1/* route handlers
                            ▼          ▼
                    ┌──────────────────────────┐
                    │ Read path (user requests) │
                    │  KV (preferred)           │
                    │   └▶ D1 (fallback)        │
                    │       └▶ stale KV/D1      │
                    └──────────────────────────┘
                            ▲ writes read models
                            │
        Cron (hourly) ─────▶ workers/weather-sync ──▶ D1 (source of truth)
        Cron (daily)  ─────▶ workers/maintenance  ──▶ KV, sitemap, health

   workers/weather-sync ──▶ Open-Meteo / WeatherAPI   (ONLY provider callers)
   Browser / route handlers ─X─▶ providers            (structurally forbidden)
```

Provider SDK/client code lives only in `packages/weather` and is imported only by `workers/weather-sync`. `apps/web` has no dependency on `packages/weather`, so a user-path provider call cannot even compile. This makes Requirement 9.2 a build-time guarantee, and is verified by a boundary lint rule plus a test asserting `apps/web`'s dependency graph excludes `packages/weather`.

Next.js is deployed via the official Cloudflare adapter (Workers runtime target). Compatibility of App Router, SSR/ISR, bindings, and Cron is verified in a preview deployment before production. If Pages proves incompatible with the current official adapter, ADR-001 records the switch to the Workers deployment target while keeping the "all Cloudflare free plan" constraint (Requirement 16.2).

## Data Flow

### Ingestion Flow (SPEC §8.1, Requirement 9)

```text
Cron Trigger (hourly)
  1. acquireLock(key="weather-sync", ttl=15m)         # abort if held (9.4)
  2. create sync_run (status=running, provider=primary)
  3. for each batch of cities (bounded size):
       a. provider.fetchForecast(batch)               # 9.1
          └─ on primary failure → fallback provider    # 9.3 (record switch)
       b. validate DTO (Zod) → map to NormalizedForecast
       c. per-city failure → record sync_failure, continue  # 9.5
  4. within D1 transaction: upsert weather_snapshots / daily / hourly  # 9.1
  5. compute city_scores (all themes + windows), model_version  # 9.1, 10
  6. build ranking_snapshots + ranking_entries         # 9.1
  7. write versioned KV read models (summary/forecast/ranking/map)  # 9.1, 8.4
  8. mark snapshot ACTIVE only after full validation    # 9.7
  9. mark sync_run success
 10. releaseLock()
```

### User Request Flow (HARD CONSTRAINT — Requirement 9.2)

```text
User request
  → Next.js route / Server Component
  → UseCase(repositories)
      1. KV read model (preferred)         # versioned key
      2. on miss/KV error → D1 repository   # fallback (17: KV fails → D1)
      3. on D1 miss → last-known-good / stale read model
  → ViewModel → SSR HTML / JSON envelope

User request ─X─▶ Open-Meteo / WeatherAPI    # forbidden; not importable
```

Read resolution is centralized in a `ReadModelResolver` so every read path applies the same KV → D1 → stale ordering and sets the `stale` flag and `dataUpdatedAt` consistently (Requirements 9.6, 15.4, 1.6).

```ts
// packages/domain/read/read-model-resolver.ts
export interface ReadModelResolver {
  resolve<T>(key: VersionedKey, loadFromDb: () => Promise<T | null>): Promise<Resolved<T>>;
}
export interface Resolved<T> {
  data: T | null;
  source: "kv" | "d1" | "stale";
  dataUpdatedAt: string;   // ISO-8601
  stale: boolean;          // true when older than freshness target
}
```

## Components and Interfaces

This section defines the primary component interfaces (ports) and their responsibilities across layers. Infrastructure adapters implement these ports; use cases depend only on the interfaces.

| Component | Layer | Responsibility |
|---|---|---|
| `WeatherProvider` | weather (port) | Fetch + normalize provider forecasts (sync-only) |
| `ReadModelResolver` | domain | KV → D1 → stale read resolution + staleness flag |
| Repositories (`CityRepository`, `ScoreRepository`, `RankingRepository`, `SeoPageRepository`) | db | Parameterized D1 access + KV read models |
| Use cases (`GetTravelRadar`, `GetCityPage`, `GetRanking`, `CompareCities`, `Search`) | domain | Orchestrate repositories, assemble ViewModels |
| Score functions (`computeTravelScore`, theme scorers, `deriveReasonCodes`) | domain | Pure, deterministic, versioned scoring |
| SEO builders (`evaluateQualityGate`, metadata/JSON-LD/sitemap) | seo | Indexability + metadata generation |
| i18n resolver + formatters | i18n | Reason-code translation, locale-aware formatting |
| `AffiliateAdapter` | analytics/ui | Provider-agnostic offer rendering + whitelist redirect |

### WeatherProvider Interface (Port)

```ts
// packages/weather/provider.ts
export interface WeatherProvider {
  readonly id: string;                       // "open-meteo" | "weatherapi"
  fetchForecast(request: ForecastRequest): Promise<NormalizedForecast[]>;
  healthCheck(): Promise<ProviderHealth>;
}

export interface ForecastRequest {
  cities: Array<{ cityId: string; latitude: number; longitude: number; timezone: string }>;
  days: number;                              // e.g. 7
}

export interface NormalizedForecast {
  cityId: string;
  daily: NormalizedDaily[];                  // domain type, NOT provider DTO
  hourly: NormalizedHourly[];
  provider: string;
  fetchedAt: string;                         // ISO-8601 UTC
}

export interface ProviderHealth { healthy: boolean; latencyMs: number; detail?: string; }
```

Each adapter validates its raw response with a Zod schema, then maps to `NormalizedForecast`. Provider DTO types are private to their adapter module and never exported (Requirement 9.1, 9.3).

### Adapters

- **OpenMeteoAdapter** (primary): no API key required (free), batches coordinates, requests metric units.
- **WeatherApiAdapter** (fallback): reads `WEATHERAPI_SECRET` from Cloudflare Secrets only; disabled unless configured (Requirement 9.8, 13.4).

### Resilience: Circuit Breaker, Retries, Fallback (SPEC §8.2)

Resilience wrappers apply **only inside the sync worker**; they are not present on the user path because the provider package is not imported there.

```ts
// packages/weather/resilience.ts
export interface ResilienceOptions {
  timeoutMs: number;          // per request
  maxRetries: number;         // bounded
  baseDelayMs: number;        // exponential backoff base
  jitter: boolean;            // full jitter
  breaker: { failureThreshold: number; cooldownMs: number };
}
```

- **Timeout + bounded retries** with exponential backoff and full jitter per request.
- **Circuit breaker** states: `CLOSED → OPEN` after `failureThreshold` consecutive failures; `OPEN → HALF_OPEN` after `cooldownMs`; `HALF_OPEN → CLOSED` on success or back to `OPEN` on failure.
- **Batch rate limiting**: cities processed in bounded batches to respect free-tier limits and provider quotas.
- **Fallback**: when the primary breaker is OPEN or a fetch exhausts retries, the sync switches to the fallback provider and records `provider_switch` with the failure reason in `sync_runs` (Requirement 9.3).
- **Degradation is sync-only**: user requests never trigger a fetch; they serve stale data instead (Requirement 9.2, 9.6).

### Distributed Lock (SPEC §8.3, Requirement 9.4)

A lock with a TTL prevents overlapping Cron runs and recovers from a crashed run after expiry. Because KV is not strongly consistent, the lock uses D1 (a conditional insert/update on a `sync_locks` row with `expires_at`) as the authoritative coordination point, not KV (SPEC §8.4).

## Data Models

This section defines the D1 relational schema (SPEC §9), the KV read-model shapes, and the domain entities they map to.

All schema changes ship as ordered, forward-only migrations. Production startup never runs destructive auto-migration (SPEC §9.2). Storage is metric/SI; display units convert at the presentation layer (Requirement 12.5). Times are UTC ISO-8601, with city-local dates stored alongside forecast rows (Requirement 12.4). JSON columns are schema-validated in the application layer.

### Geography & Content

```sql
CREATE TABLE countries (
  id            TEXT PRIMARY KEY,
  iso2          TEXT NOT NULL UNIQUE,
  iso3          TEXT NOT NULL UNIQUE,
  default_timezone TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'active',   -- active | disabled
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE country_translations (
  country_id       TEXT NOT NULL REFERENCES countries(id),
  locale           TEXT NOT NULL,
  name             TEXT NOT NULL,
  seo_title        TEXT,
  seo_description  TEXT,
  PRIMARY KEY (country_id, locale)
);

CREATE TABLE cities (
  id            TEXT PRIMARY KEY,
  country_id    TEXT NOT NULL REFERENCES countries(id),
  slug          TEXT NOT NULL,
  latitude      REAL NOT NULL,          -- validated -90..90
  longitude     REAL NOT NULL,          -- validated -180..180
  timezone      TEXT NOT NULL,
  population    INTEGER,
  elevation_m   REAL,
  is_featured   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active',
  search_weight REAL NOT NULL DEFAULT 1.0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (country_id, slug)
);

CREATE TABLE city_translations (
  city_id          TEXT NOT NULL REFERENCES cities(id),
  locale           TEXT NOT NULL,
  name             TEXT NOT NULL,
  aliases_json     TEXT NOT NULL DEFAULT '[]',  -- validated string[]
  summary          TEXT,
  seo_title        TEXT,
  seo_description  TEXT,
  PRIMARY KEY (city_id, locale)
);
```

### Weather (snapshot-versioned)

```sql
CREATE TABLE weather_snapshots (
  id          TEXT PRIMARY KEY,          -- snapshotId, bound into KV keys
  provider    TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  valid_from  TEXT NOT NULL,
  valid_to    TEXT NOT NULL,
  status      TEXT NOT NULL,             -- pending | active | superseded | failed
  checksum    TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE weather_daily (
  snapshot_id                    TEXT NOT NULL REFERENCES weather_snapshots(id),
  city_id                        TEXT NOT NULL REFERENCES cities(id),
  local_date                     TEXT NOT NULL,   -- city-local calendar date
  weather_code                   INTEGER,
  temp_min_c                     REAL, temp_max_c REAL,
  apparent_min_c                 REAL, apparent_max_c REAL,
  precipitation_mm               REAL,
  precipitation_probability_max  INTEGER,
  humidity_mean                  INTEGER,
  wind_speed_max_kph             REAL, wind_gust_max_kph REAL,
  uv_index_max                   REAL,
  cloud_cover_mean               INTEGER,
  sunrise_local                  TEXT, sunset_local TEXT,
  data_quality                   TEXT NOT NULL,   -- complete | partial
  PRIMARY KEY (snapshot_id, city_id, local_date)
);

CREATE TABLE weather_hourly (
  snapshot_id              TEXT NOT NULL REFERENCES weather_snapshots(id),
  city_id                  TEXT NOT NULL REFERENCES cities(id),
  local_time               TEXT NOT NULL,
  weather_code             INTEGER,
  temperature_c            REAL, apparent_temperature_c REAL,
  precipitation_mm         REAL, precipitation_probability INTEGER,
  humidity                 INTEGER,
  wind_speed_kph           REAL, wind_gust_kph REAL,
  uv_index                 REAL, cloud_cover INTEGER,
  data_quality             TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, city_id, local_time)
);
```

### Scores & Rankings

```sql
CREATE TABLE city_scores (
  snapshot_id       TEXT NOT NULL REFERENCES weather_snapshots(id),
  city_id           TEXT NOT NULL REFERENCES cities(id),
  local_date        TEXT NOT NULL,
  window            TEXT NOT NULL,        -- today | tomorrow | weekend | next_week
  travel_score      INTEGER NOT NULL,     -- 0..100
  rain_score        INTEGER, outdoor_score INTEGER, beach_score INTEGER,
  walking_score     INTEGER, hiking_score INTEGER, camping_score INTEGER,
  family_score      INTEGER, photography_score INTEGER, night_view_score INTEGER,
  food_trip_score   INTEGER, shopping_score INTEGER,
  confidence        REAL NOT NULL,        -- 0..1
  reason_codes_json TEXT NOT NULL,        -- validated Reason_Code[]
  model_version     TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, city_id, local_date, window)
);

CREATE TABLE ranking_snapshots (
  id            TEXT PRIMARY KEY,
  snapshot_id   TEXT NOT NULL REFERENCES weather_snapshots(id),
  theme         TEXT NOT NULL,
  time_window   TEXT NOT NULL,
  region_key    TEXT NOT NULL,
  generated_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  model_version TEXT NOT NULL
);

CREATE TABLE ranking_entries (
  ranking_id        TEXT NOT NULL REFERENCES ranking_snapshots(id),
  city_id           TEXT NOT NULL REFERENCES cities(id),
  rank              INTEGER NOT NULL,
  score             INTEGER NOT NULL,
  reason_codes_json TEXT NOT NULL,
  PRIMARY KEY (ranking_id, city_id)
);
```

### Operations, SEO, Affiliate, Relationships

```sql
CREATE TABLE sync_runs (
  id            TEXT PRIMARY KEY,
  started_at    TEXT NOT NULL, finished_at TEXT,
  status        TEXT NOT NULL,          -- running | success | failed | partial
  provider      TEXT NOT NULL,
  provider_switched INTEGER NOT NULL DEFAULT 0,
  switch_reason TEXT,
  cities_ok     INTEGER NOT NULL DEFAULT 0,
  cities_failed INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER
);

CREATE TABLE sync_failures (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES sync_runs(id),
  city_id       TEXT REFERENCES cities(id),
  error_code    TEXT NOT NULL,
  detail        TEXT,                   -- sanitized, no secrets/provider bodies
  created_at    TEXT NOT NULL
);

CREATE TABLE sync_locks (
  key         TEXT PRIMARY KEY,         -- 'weather-sync'
  holder      TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE TABLE feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 0,  -- unknown flag => treated as disabled
  scope_json  TEXT,
  updated_at  TEXT NOT NULL
);

CREATE TABLE seo_page_registry (
  path            TEXT PRIMARY KEY,     -- canonical path
  page_type       TEXT NOT NULL,        -- city | country | ranking | compare | article
  locale          TEXT NOT NULL,
  indexable       INTEGER NOT NULL,     -- quality-gate result
  lastmod         TEXT NOT NULL,        -- updated only on meaningful change
  content_hash    TEXT NOT NULL,        -- drives lastmod change detection
  in_sitemap      INTEGER NOT NULL
);

CREATE TABLE affiliate_providers (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,            -- hotel | activities | flights | sim | insurance | car
  enabled     INTEGER NOT NULL DEFAULT 0,
  whitelist_host TEXT NOT NULL          -- open-redirect prevention
);

CREATE TABLE affiliate_offers (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES affiliate_providers(id),
  city_id     TEXT REFERENCES cities(id),
  target_url  TEXT NOT NULL,           -- must match provider whitelist host
  label       TEXT NOT NULL,
  currency    TEXT,                    -- required if any amount present
  created_at  TEXT NOT NULL
);

CREATE TABLE city_relationships (
  city_id       TEXT NOT NULL REFERENCES cities(id),
  related_city_id TEXT NOT NULL REFERENCES cities(id),
  relation_type TEXT NOT NULL,         -- nearby | similar | better_weather | cheaper
  rank          INTEGER NOT NULL,
  PRIMARY KEY (city_id, related_city_id, relation_type)
);
```

### Indexing Strategy

- `cities(country_id, slug)` unique — city page lookups (Requirement 3.1).
- `weather_daily(city_id, snapshot_id, local_date)` — forecast retrieval per active snapshot.
- `city_scores(snapshot_id, window, travel_score DESC)` — ranking generation and radar.
- `ranking_entries(ranking_id, rank)` — ordered ranking reads.
- `seo_page_registry(page_type, locale, in_sitemap)` — sitemap generation.
- `city_translations(city_id, locale)` and an alias-search index derived from `aliases_json` (normalized, accent-folded) — search (Requirement 5).
- `weather_snapshots(status)` — resolve the single ACTIVE snapshot quickly.

Query plans for the hot paths (city page, ranking, search, compare) are validated with `EXPLAIN QUERY PLAN` during the database phase.

## Travel Score Model (SPEC §10, Requirement 10)

Scoring lives entirely in `packages/domain` as pure, deterministic, versioned functions. Given identical normalized inputs and `model_version`, the output score and reason codes are always identical (Requirement 10.1, 10.6). Scores are computed only during ingestion, never on the user path.

### Factor Normalization (SPEC §10.2)

Each raw factor is normalized to an integer `0..100` by a pure function. Missing data does not default to the best value; it is reported as absent so confidence drops (Requirement 10.4).

```ts
// packages/domain/score/factors.ts
export interface WeatherFactors {   // each 0..100 or null when missing
  rain: number | null;
  temperature: number | null;
  comfort: number | null;
  humidity: number | null;
  wind: number | null;
  uv: number | null;
  cloud: number | null;
}
export interface HazardInput { hazardPenalty: number; } // 0..100
```

- **Rain**: combines precipitation probability, precipitation amount, and consecutive rain hours; heavy rain penalized non-linearly.
- **Temperature**: activity-defined comfort band; score decays with distance from the band.
- **Humidity**: 40–65% comfortable; high heat + high humidity penalized extra.
- **Wind**: light breeze negligible; strong wind/gusts penalized per activity risk.
- **UV**: low/mid negligible for general activities; extreme penalized; beach band differs.
- **Cloud**: preference is theme-dependent (photography/night view differ from beach).
- **Comfort**: composite of apparent temperature, humidity, wind.
- **Hazard Penalty**: storm, typhoon, extreme heat/cold, heavy rain — `0..100`, subtracted from the weighted base.

### General Travel Score (SPEC §10.3)

```ts
// packages/domain/score/travel-score.ts
const GENERAL_WEIGHTS = {
  rain: 0.30, temperature: 0.20, comfort: 0.15,
  humidity: 0.10, wind: 0.10, uv: 0.075, cloud: 0.075,
} as const;

export function computeTravelScore(f: WeatherFactors, h: HazardInput): ScoredResult {
  const present = entriesPresent(f, GENERAL_WEIGHTS);   // only non-null factors
  const totalWeight = sumWeights(GENERAL_WEIGHTS);
  const availableWeight = sumWeights(present.weights);
  // weighted mean of available factors (10.4)
  const base = present.total === 0 ? 0 : weightedMean(present);
  const travelScore = round(clamp(base - h.hazardPenalty, 0, 100));   // 10.2
  const confidence = availableWeight / totalWeight;                    // 10.4
  return { travelScore, confidence, reasonCodes: deriveReasonCodes(f, h) };
}
```

When all required factors are present, `availableWeight === totalWeight` so `confidence === 1` and the formula reduces exactly to SPEC §10.3. When factors are missing, the score is the weighted mean over available factors and confidence is the available fraction (Requirement 10.4). Confidence `< 0.7` excludes a city from the homepage top ranking (Requirement 1.8), while the city page shows a "limited data" marker.

### Theme Weights (SPEC §10.4)

Theme scores use the same normalized factors with theme-specific weight tables. MVP themes: Sunny (general), Beach, Hiking, Photography, Family, Night View (Requirement 10.3). Weights are defined once as constants:

```ts
export const THEME_WEIGHTS = {
  outdoor:    { rain: .30, temperature: .20, comfortHumidity: .20, wind: .15, uv: .10, cloudVis: .05 },
  beach:      { rain: .20, temperature: .25, comfortHumidity: .10, wind: .15, uv: .15, cloudVis: .10, other: .05 },
  hiking:     { rain: .30, temperature: .20, comfortHumidity: .15, wind: .20, uv: .05, cloudVis: .10 },
  family:     { rain: .35, temperature: .20, comfortHumidity: .25, wind: .10, uv: .05, cloudVis: .05 },
  photography:{ rain: .20, temperature: .10, comfortHumidity: .10, wind: .10, uv: .05, cloudVis: .35, other: .10 },
  nightView:  { rain: .25, temperature: .10, comfortHumidity: .10, wind: .15, uv: .00, cloudVis: .30, other: .10 },
} as const;
```

Non-weather components (Food/Shopping and similar) draw from independent city attributes; when that data is insufficient the theme score is hidden rather than fabricated from weather alone (SPEC §10.4).

### Time-Window Aggregation (SPEC §10.5)

- **Today / Tomorrow**: that day's score; aggregated over the active window 08:00–22:00 city-local when needed.
- **Weekend**: weighted average of the city-local Saturday and Sunday; exact dates displayed.
- **Next Week**: available days of the next natural week; page shows explicit dates.
- **Multi-day**: mean minus a volatility penalty so "one great day, two stormy days" does not rank highly.

### Reason Codes (SPEC §10.6)

The domain returns stable codes only (`LOW_RAIN_CHANCE`, `COMFORTABLE_TEMPERATURE`, `LOW_HUMIDITY`, `CALM_WIND`, `HIGH_UV_CAUTION`, `HEAVY_RAIN_RISK`, `STORM_RISK`, `CLEAR_NIGHT_SKY`, `GOOD_GOLDEN_HOUR`, `LIMITED_DATA`, `STALE_DATA`). The i18n layer translates them (Requirement 10.5). Natural-language text is never stored in score tables.

## KV Read Models & Caching (SPEC §8.4)

Read models are compact JSON written only by the sync/maintenance workers and read (never written) on the user path. Keys are versioned; a schema/format change bumps the `v1` prefix, and snapshot-bound keys embed `snapshotId` so a new snapshot never overwrites an in-flight read (SPEC §8.4).

### Key Scheme

```text
v1:city:{cityId}:summary:{locale}:{unit}
v1:city:{cityId}:forecast:{snapshotId}:{unit}
v1:ranking:{theme}:{window}:{region}:{locale}
v1:map:{theme}:{window}:{region}
v1:country:{countryId}:{locale}
v1:compare:{cityA}-{cityB}:{window}:{locale}    # whitelist pairs only
```

Each stored value carries `{ data, dataUpdatedAt, snapshotId, modelVersion }` so the resolver can compute staleness and the API `meta` block without extra reads.

### Cache TTLs (SPEC §8.4)

| Data | TTL | Invalidation |
|---|---:|---|
| Country | 30 days | active version invalidation on content change |
| City metadata | 7 days | excludes hourly weather |
| Current weather | 1 hour | refreshed only by Cron (stale-while-revalidate) |
| Forecast | 1 hour | bound to snapshot version |
| Rankings | 1 hour | rewritten after each successful sync |
| Articles | 1 day | invalidated on publish/update |
| Images | 365 days | immutable, content-hash filenames |

KV is never used for locks, counters, or critical state transitions — those use D1 (SPEC §8.4).

## API v1 Contract (SPEC §11, Requirement 11 read paths)

All public read endpoints live under `/api/v1`, are served by Next.js route handlers, read only from KV/D1, and return a uniform envelope with a `requestId`. Dates are ISO-8601. Every input is schema-validated (Zod), sort fields are whitelisted, `limit` is capped, and all D1 queries are parameterized (SPEC §11.5, Requirement 13.1).

### Endpoints

```text
GET /api/v1/rankings?theme=&window=&region=&limit=&locale=
GET /api/v1/countries/{countrySlug}
GET /api/v1/cities/{countrySlug}/{citySlug}?window=&unit=&locale=
GET /api/v1/cities/{cityId}/forecast?days=&unit=
GET /api/v1/cities/{cityId}/hourly?date=&unit=
GET /api/v1/map?theme=&window=&bounds=&zoom=
GET /api/v1/search?q=&locale=&limit=
GET /api/v1/compare?cityA=&cityB=&window=
GET /api/v1/articles?cursor=&locale=&city=
```

- `/map` returns compact aggregated markers only — no hourly arrays (Requirement 2.7).
- `/search` and `/compare` bound cache-key cardinality (length limits, normalization, whitelist) to prevent high-cardinality cache-poisoning (SPEC §11.5).
- Internal sync/maintenance runs via Cron bindings, not public HTTP; if ever exposed, they use a separate internal route with strong auth, signing, timestamps, and rate limits (SPEC §11.2).

### Success Envelope (SPEC §11.3)

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "generatedAt": "2026-07-16T00:00:00Z",
    "dataUpdatedAt": "2026-07-15T23:00:00Z",
    "stale": false
  }
}
```

### Error Envelope (SPEC §11.4)

```json
{ "error": { "code": "CITY_NOT_FOUND", "message": "City not found", "requestId": "req_..." } }
```

Error codes are stable and testable (`CITY_NOT_FOUND`, `INVALID_PARAMETER`, `RATE_LIMITED`, `COMPARE_SAME_CITY`, `NOT_INDEXABLE`, `DATA_UNAVAILABLE`, `INTERNAL_ERROR`). Responses never leak SQL, stack traces, secrets, provider bodies, or internal paths (Requirement 13.5). Messages are localized to the user locale (Requirement 13.5).

### Caching, CORS, Rate Limiting

Public endpoints set cache headers aligned with the KV TTL table, a restrictive CORS policy, and layered rate limits on API/search/compare (Requirement 13.3, SPEC §11.5).

## SEO Strategy (SPEC §12, Requirement 11)

`packages/seo` centralizes metadata builders, JSON-LD emitters, the quality gate, and sitemap/robots generation so no route re-implements SEO logic.

### Per-Page Metadata (Requirement 11.1)

Every page emits a unique title and description, canonical URL, Open Graph and Twitter Card tags, correct `lang` with `hreflang` + `x-default`, crawlable server-rendered body, and a visible data-update time. Filter/query variants canonicalize to a stable landing page (SPEC §12.4).

### Structured Data (Requirement 11.2)

JSON-LD types by page: `WebSite`/`Organization` (site-wide), `BreadcrumbList` (all), `Place` (city/country), `FAQPage` (city FAQ). Only content visibly present on the page is emitted as JSON-LD; scoring/review/event schema is not abused (SPEC §12.2).

### Quality Gate (Requirement 11.3, 11.4; Requirements 4, 6, 7)

A page is `index,follow` only when: the entity is active with adequate data freshness, it has unique visible body content (not a name-swapped template), a valid weather summary, a score explanation, and at least one internal link. Comparison pages must additionally be on the precomputed whitelist. Otherwise the page is `noindex,follow` and excluded from the sitemap.

```ts
// packages/seo/quality-gate.ts
export function evaluateQualityGate(input: QualityGateInput): QualityGateResult {
  const reasons: string[] = [];
  if (!input.active) reasons.push("inactive");
  if (!input.fresh) reasons.push("stale");
  if (!input.hasUniqueBody) reasons.push("thin-content");
  if (!input.hasWeatherSummary) reasons.push("no-weather");
  if (!input.hasScoreExplanation) reasons.push("no-explanation");
  if (input.internalLinks < 1) reasons.push("no-internal-links");
  if (input.pageType === "compare" && !input.whitelisted) reasons.push("not-whitelisted");
  return { indexable: reasons.length === 0, reasons };
}
```

The result is persisted in `seo_page_registry`; the sitemap generator includes only `indexable && in_sitemap` rows, and `lastmod` updates only when `content_hash` changes (Requirement 11.6).

### Sitemap & Robots (Requirement 11.5)

Sitemap index split by type and language to avoid oversized files. Robots excludes search results, arbitrary filter combinations, `/admin`, `/api`, and preview pages.

## Internationalization (SPEC §13, Requirement 12)

- MVP locales: English (prefix-free), `/ja`, `/ko`, `/zh-cn`, `/zh-tw` (Requirement 12.1, 12.2).
- No hardcoded UI copy; all strings resolve through `packages/i18n` dictionaries.
- Locale-aware formatting for dates, times, numbers, temperature, and wind speed (Requirement 12.3).
- City weather computed in the city's local timezone, not the server's (Requirement 12.4).
- User can toggle °C/°F; D1 always stores metric, conversion happens at display (Requirement 12.5).
- Missing translation key falls back to English and is reported in dev/CI (Requirement 12.6).
- URL slugs remain stable ASCII in MVP; display names are localized. `hreflang`/`x-default` emitted per localized page.
- Locale preference stored in a non-PII cookie; language suggestion never forces an SEO/cache-breaking redirect.

## Security & Privacy Design (SPEC §16, Requirement 13)

- **Input/Output**: schema validation + normalization on all inputs; output encoding; all D1 access parameterized (Requirement 13.1).
- **Headers**: CSP, HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options applied globally via middleware (Requirement 13.2).
- **Rate limiting**: layered limits on API, search, compare, and internal endpoints (Requirement 13.3).
- **Secrets**: only in Cloudflare Secrets; excluded from repo, logs, client bundle, and error pages. Provider keys live in `packages/weather`, imported only by the sync worker, so no key can reach the client bundle (Requirement 13.4, 9.8).
- **Error hygiene**: user-locale messages; no stack traces, SQL, secrets, provider responses, or internal paths (Requirement 13.5).
- **Affiliate redirects**: outbound targets restricted to a provider whitelist host to prevent open redirects; `rel` and disclosure added to every outbound link (Requirement 13.6, 8.3).
- **Admin**: `/admin` disabled by default; requires a real auth layer before exposing any data or write in production (SPEC §4 FR-012). Not in MVP feature scope beyond the gating requirement.
- **Threat model coverage**: XSS, SQL injection, cache poisoning, SSRF, open redirect, Cron replay, provider data poisoning, bot scraping, DDoS cost amplification, admin privilege escalation.

## Performance Design (SPEC §15, Requirement 14)

- **Server Components first**; only interactive leaf nodes are Client Components.
- **MapLibre, charts, ads, and Framer Motion are dynamically imported** and excluded from the initial homepage bundle so LCP < 2.0s (Requirement 14.1, 14.4).
- **CLS < 0.05** via skeletons sized to final content and reserved ad-slot dimensions (Requirement 14.2, 8.6, 15.2).
- **INP in Good range** by keeping main-thread work small and deferring third-party affiliate/analytics scripts (Requirement 14.3).
- **Compact read models** for rankings and city summaries minimize payload size.
- Images use explicit dimensions, modern formats, long cache; fonts are self-hosted/subset.
- Route-level JS budgets are quantified and tracked in CI (bundle-size budget).

## Component States (SPEC §6.4, Requirement 15)

Every asynchronous component implements a shared state contract from `packages/ui`:

```ts
export type AsyncState<T> =
  | { kind: "skeleton" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "partial"; data: Partial<T>; stale: boolean }
  | { kind: "stale"; data: T; updatedAt: string }
  | { kind: "error"; code: string; retry: () => void }
  | { kind: "offline" }
  | { kind: "ready"; data: T };
```

- Skeleton dimensions approximate final content to avoid CLS (Requirement 15.2).
- Errors show a user-locale message and a retry affordance; never a stack trace (Requirement 13.5).
- `prefers-reduced-motion` disables non-essential animation (Requirement 15.3).
- Stale data renders with its update time instead of an error (Requirement 15.4, 1.6).
- Dark mode supports system/light/dark; color is never the sole state carrier (SPEC §6.4, §6.5).

## Deployment (SPEC §7.1, Requirement 16)

- Entire system on the Cloudflare **FREE** plan: Pages/Workers runtime, D1, KV, R2, Cron Triggers, Web Analytics (Requirement 16.1).
- Next.js App Router deployed via the official Cloudflare adapter (Workers runtime target); a preview deployment verifies App Router, SSR/ISR, bindings, and Cron before production (Requirement 16.2). Any Pages↔adapter incompatibility is resolved by ADR-001 without leaving the free plan.
- Typed runtime config validated by schema; production **fails fast** when a required value is missing (Requirement 16.3). `.env.example` ships without real secrets (Requirement 16.4).
- Migrations run as an explicit, ordered deploy step — never destructive auto-migration at startup (SPEC §9.2).
- Free-tier discipline: bounded ingestion batches, minimal bindings, R2 only when strictly needed (SPEC §8.5). Cloudflare's current free quotas are re-checked at implementation; no fixed quota is hardcoded (SPEC §0).
- Deploy failures retain the last working version and support rollback (SPEC §17).

## Error Handling

Error handling follows the reliability model of SPEC §17: degrade to stale data rather than fail, and never expose internals.

### Failure Modes and Responses

| Failure | Response | Requirement |
|---|---|---|
| Primary provider fails (sync) | Circuit breaker opens; fall back to WeatherAPI; record switch + reason in `sync_runs` | 9.3 |
| Single city fails (sync) | Record `sync_failure`, continue batch; do not roll back | 9.5 |
| Whole sync run fails | Keep last ACTIVE snapshot; serve marked as stale | 9.6, 15.4 |
| Cron overlap | Distributed D1 lock with TTL aborts the second run | 9.4 |
| Corrupt/partial new batch | Only validated data replaces ACTIVE snapshot; bad data isolated | 9.7 |
| KV miss/error (user path) | Fall back to D1 repository | SPEC §17 |
| D1 transient failure (user path) | Serve last-known-good KV/static content | SPEC §17 |
| Provider called on user path | Impossible by construction (package not importable) | 9.2 |
| Invalid API input | `INVALID_PARAMETER` error envelope, HTTP 400 | 11.5, 13.1 |
| City not found | `CITY_NOT_FOUND`, HTTP 404 | 11.4 |
| Compare same city | `COMPARE_SAME_CITY` → HTTP 404 or prompt | 7.4 |
| Reversed compare URL | HTTP 301 to canonical | 7.3 |
| Any unhandled error | `INTERNAL_ERROR`, user-locale message, no internals leaked | 13.5 |

### Error Boundaries

- **Domain layer** returns typed `Result<T, DomainError>` rather than throwing for expected conditions (not found, insufficient data, low confidence).
- **Use-case layer** maps `DomainError` to stable API error codes and HTTP status.
- **UI layer** renders the `AsyncState` error/stale variants; React error boundaries catch unexpected render errors and show a localized fallback.
- **Structured logging** (SPEC §17): `timestamp, level, service, requestId/runId, event, durationMs, status, errorCode`; secrets, cookies, and provider bodies are never logged.

## Testing Strategy

A dual approach: **property-based tests** for universal invariants (scoring, normalization, canonicalization, aggregation) and **example/integration/E2E tests** for specific scenarios and infrastructure wiring. Property tests run a minimum of 100 iterations and are tagged with the feature name and property number.

### Unit Tests (SPEC §18.1)

- Score formula, boundary values, missing factors, hazard penalty (property + example).
- Time-window aggregation with city timezone / DST (property + example).
- Unit conversion and locale formatters (property: round-trip).
- Provider DTO normalization/validation (property: valid DTO always maps; invalid always rejected).
- Reason code generation (example + property).
- URL canonicalization for compare pairs (property: idempotent + order-independent).
- Feature flag defaults (example: unknown flag disabled).
- Quality gate decisions (property: any missing condition ⇒ not indexable).

### Integration Tests (SPEC §18.2)

- D1 migrations and repositories against a local D1.
- KV cache hit / miss / stale fallback ordering.
- Cron: normal run, partial failure, primary-provider failure → fallback.
- API schema, error envelope shape, rate limiting.
- Multilingual alias search.
- Sitemap, robots, hreflang, JSON-LD output.

### E2E Tests (SPEC §18.3)

1. Homepage → switch Weekend ranking → open city page.
2. Search "Tokyo" → keyboard select → view 7-day forecast.
3. Map → switch Beach → click city.
4. Compare Tokyo vs Osaka → canonical + correct results.
5. Toggle language and unit → URL/display correct.
6. Affiliate click recorded and redirected to whitelist URL.
7. Stale / empty / error states usable.

### Non-Functional Tests (SPEC §18.4)

Lighthouse CI (Perf/SEO/A11y/Best-Practices targets), axe accessibility, typecheck/lint/format, bundle-size budget, security-header check, and a cache-hit smoke test. No change to scoring logic, migrations, or cache behavior merges without tests (SPEC §18, §20).

## Correctness Properties Prework

Before writing correctness properties, each testable acceptance criterion was classified (PROPERTY / EXAMPLE / EDGE_CASE / INTEGRATION / SMOKE). See the recorded prework analysis; the properties below derive from it.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: No weather provider call on the user request path

*For any* sequence of user-path read operations (radar, city, country, ranking, map, search, compare, forecast, hourly, articles) executed against a spy `WeatherProvider`, the total number of provider calls SHALL be exactly zero.

**Validates: Requirements 9.2**

### Property 2: Travel Score is always an integer in 0..100

*For any* combination of weather factors (present or missing) and hazard penalty, `computeTravelScore` SHALL return an integer value `s` with `0 <= s <= 100`.

**Validates: Requirements 10.1**

### Property 3: General Travel Score matches the specified formula

*For any* complete set of normalized factors and hazard penalty, `computeTravelScore` SHALL equal `round(clamp(rain*0.30 + temperature*0.20 + comfort*0.15 + humidity*0.10 + wind*0.10 + uv*0.075 + cloud*0.075 - hazardPenalty, 0, 100))` as computed by an independent reference implementation.

**Validates: Requirements 10.2, 10.3**

### Property 4: Missing factors reduce to weighted mean with proportional confidence

*For any* subset of present factors, the score SHALL equal the weighted mean over only the present factors, and the confidence SHALL equal the sum of present required weights divided by the total required weight.

**Validates: Requirements 10.4**

### Property 5: Scoring is deterministic and versioned

*For any* fixed inputs and model version, repeated computation SHALL produce identical scores and identical reason codes, and every produced score SHALL carry a model version.

**Validates: Requirements 10.6**

### Property 6: Reason codes are stable and records carry no natural-language text

*For any* computed score, every attached reason code SHALL belong to the defined Reason_Code enum, and the persisted score record SHALL contain no natural-language text field.

**Validates: Requirements 10.5**

### Property 7: Confidence below 0.7 is excluded from the top ranking

*For any* set of scored cities, every city appearing in the homepage top ranking SHALL have confidence `>= 0.7`.

**Validates: Requirements 1.8**

### Property 8: Rankings use only the most recent successful snapshot

*For any* history of snapshots, the data source used to generate a ranking SHALL be the single most recent snapshot whose status is active/successful.

**Validates: Requirements 1.3**

### Property 9: Time window URL encoding round-trips

*For any* Time_Window, decoding the URL query parameter produced by encoding that window SHALL yield the original window.

**Validates: Requirements 1.4**

### Property 10: Stale flag reflects the freshness threshold

*For any* data-updated timestamp and freshness target, the resolver SHALL mark the result stale if and only if the data age exceeds the freshness target, and stale results SHALL still be served with their update time rather than as an error.

**Validates: Requirements 1.6, 9.6, 15.4**

### Property 11: Radar card and city SSR output contain all required fields

*For any* scored city, the built radar card SHALL contain city, country, weather condition, Travel_Score, max temp, min temp, precipitation probability, at least one reason, update time, and a city-page link; and the server-rendered city page SHALL contain the weather summary, the Travel_Score, and the forecast dates.

**Validates: Requirements 1.1, 3.2**

### Property 12: City and compare route builders round-trip

*For any* country/city slug pair, parsing the URL produced by the city route builder SHALL yield the original pair; and *for any* two distinct cities, the compare canonicalization SHALL be order-independent and idempotent, with the reversed-order URL resolving to the canonical URL.

**Validates: Requirements 3.1, 7.3**

### Property 13: Comparing a city with itself is rejected

*For any* single city, requesting a comparison of that city with itself SHALL yield the same-city error (HTTP 404 or a prompt), never a comparison result.

**Validates: Requirements 7.4**

### Property 14: Map payloads exclude hourly data and stay compact

*For any* map read model, the serialized marker payload SHALL contain no hourly forecast arrays and SHALL include only aggregated marker fields.

**Validates: Requirements 2.7**

### Property 15: Search matches are accent- and case-insensitive over names and aliases

*For any* city name or alias and *any* accent or case variation of a matching prefix of at least two characters, the Search_Service SHALL return that city.

**Validates: Requirements 5.1, 5.2**

### Property 16: Search normalization is bounded and injection-safe

*For any* input string, including over-length and SQL-injection payloads, the normalized query SHALL be within the length limit and the resulting D1 query SHALL be executed via parameter binding with no string interpolation.

**Validates: Requirements 5.5, 13.1**

### Property 17: Quality gate indexability is the conjunction of its conditions

*For any* page inputs, the page SHALL be marked `index,follow` if and only if every quality-gate condition holds (active, fresh, unique body, weather summary, score explanation, at least one internal link, and whitelisted when a compare page); otherwise it SHALL be marked `noindex,follow` and excluded from the sitemap.

**Validates: Requirements 4.4, 4.5, 6.4, 6.5, 7.6, 11.3, 11.4**

### Property 18: lastmod changes only when content changes

*For any* page registered twice, the `lastmod` value SHALL change if and only if the content hash changed.

**Validates: Requirements 11.6**

### Property 19: Page metadata is complete and unique

*For any* indexable page view model, the emitted metadata SHALL include a non-empty unique title, a non-empty unique description, a canonical URL, Open Graph tags, Twitter Card tags, a language attribute with hreflang and x-default, and a data update time; and emitted FAQ JSON-LD entries SHALL be a subset of the FAQ entries visibly present on the page.

**Validates: Requirements 11.1, 11.2**

### Property 20: Unit conversion round-trips while storage stays metric

*For any* stored metric temperature, converting to the display unit and back SHALL yield the original value within floating-point tolerance, and the stored value SHALL remain metric.

**Validates: Requirements 12.5**

### Property 21: City-local time computation depends only on the city timezone

*For any* UTC instant and city timezone, the derived city-local date SHALL depend only on the city timezone and SHALL be independent of the server timezone.

**Validates: Requirements 12.4**

### Property 22: Missing translation keys fall back to English and are reported

*For any* requested key absent in the active locale, the i18n resolver SHALL return the English value and SHALL emit a missing-key report in development/CI.

**Validates: Requirements 12.6**

### Property 23: Locale-aware formatting matches the locale reference

*For any* numeric/date value and supported locale, the formatter output SHALL match the locale-aware reference formatting.

**Validates: Requirements 12.3**

### Property 24: Affiliate section is shown only when data exists; links carry disclosure and rel

*For any* city, an affiliate section SHALL be rendered if and only if authorized offers exist for it (no placeholder or fabricated content otherwise); and *for any* rendered outbound affiliate link, the output SHALL include the legal disclosure and appropriate `rel` attributes.

**Validates: Requirements 3.7, 8.3**

### Property 25: Affiliate redirects are restricted to the provider whitelist

*For any* affiliate target URL, the outbound redirect SHALL be permitted if and only if the target host is in the provider whitelist, preventing open redirects.

**Validates: Requirements 13.6**

### Property 26: Ad slot dimensions are stable regardless of fill state

*For any* ad-slot fill state (filled, unfilled, disabled), the reserved layout box dimensions SHALL be identical, producing no cumulative layout shift.

**Validates: Requirements 8.6**

### Property 27: Partial-batch ingestion persists successes and isolates failures

*For any* ingestion batch where an arbitrary subset of cities fails, the pipeline SHALL persist all successful cities, record a failure for exactly the failing subset, and SHALL NOT roll back the whole batch; and an invalid candidate snapshot SHALL never replace the active snapshot.

**Validates: Requirements 9.5, 9.7**

### Property 28: Errors are localized and leak no internals

*For any* internal error, the API/UI response SHALL be a localized message that contains no SQL, stack trace, secret, provider response, or internal path.

**Validates: Requirements 13.5**

### Property 29: Startup fails fast on missing required configuration

*For any* configuration missing a required key, runtime schema validation SHALL fail at startup; and a complete configuration SHALL validate successfully.

**Validates: Requirements 16.3, 16.4**

## Design Decisions & ADRs

Key decisions are recorded as ADRs in `docs/12-ADR/`. Summaries below; the flagged workflow-governance decision (ADR-000) resolves a direct conflict between SPEC and the operating mode.

### ADR-000: Autonomous phase gating (workflow-governance conflict)

- **Status**: Accepted
- **Context**: SPEC §0.4, §21, and §24 mandate that development **stop and wait for product-owner confirmation after each phase** and never generate all phases at once. The current operating mode is **fast-task autonomous mode with zero user intervention**. These two requirements are in direct conflict: the SPEC's human-in-the-loop gate cannot be satisfied while also requiring zero intervention.
- **Decision**: Under fast-task autonomous mode, the SPEC's per-phase stop-and-confirm gates are **auto-approved**. The phase *ordering, per-phase deliverables, and acceptance criteria from SPEC §21 are still honored* — they are reflected in the tasks breakdown and executed sequentially — but the workflow does not block for manual confirmation between phases. The SPEC's output protocol (§24: change summary, key decisions, files, verification, known limits) is preserved as per-task reporting rather than as a blocking gate.
- **Alternatives considered**: (a) Halt after Phase 1 and wait — rejected, violates the zero-intervention requirement. (b) Ignore SPEC phase structure entirely — rejected, loses the valuable ordering and acceptance criteria and the "no future-phase work early" discipline.
- **Consequences**: Faster delivery with no manual checkpoints; the risk normally mitigated by human gates is shifted onto automated verification (typecheck, lint, unit/integration/E2E, Lighthouse/axe/security-header CI) and the correctness properties above. Any deviation from SPEC still requires an ADR entry (SPEC §0.6).
- **Cloudflare Free Plan / Security / SEO / Performance Impact**: None — this is a process decision only.
- **Upgrade Path**: If run in a supervised mode later, re-enable blocking gates by honoring SPEC §21 stop points.

### ADR-001: Next.js on Cloudflare deployment adaptation

- **Status**: Proposed
- **Decision**: Deploy via the official Cloudflare Next.js adapter targeting the Workers runtime; verify App Router, SSR/ISR, bindings, and Cron in a preview deployment before production. Stay entirely on the free plan.
- **Impact**: Requirement 16.1, 16.2. Re-check current free quotas at implementation; do not hardcode quotas.

### ADR-002: Monorepo and package boundaries

- **Status**: Accepted
- **Decision**: Adopt the SPEC §7.2 monorepo with a strict acyclic dependency graph and boundary lint. `packages/weather` is importable only by `workers/weather-sync`, making the no-provider-on-user-path constraint a build-time guarantee.
- **Impact**: Requirement 9.2; maintainability, no circular deps.

### ADR-003: D1 + KV read model and consistency strategy

- **Status**: Accepted
- **Decision**: D1 is the source of truth; KV holds versioned compact read models. User reads follow KV → D1 → stale. KV is never used for locks/counters/critical state; the sync lock uses D1 for consistency.
- **Impact**: Requirements 9.1, 9.2, 9.6; SPEC §8.4.

### ADR-004: Weather provider abstraction and fallback

- **Status**: Accepted
- **Decision**: A `WeatherProvider` port with Open-Meteo (primary) and WeatherAPI (fallback) adapters; timeouts, bounded retries with jitter, and a circuit breaker; fallback and degradation occur only in the sync worker.
- **Impact**: Requirements 9.1, 9.3, 9.8; SPEC §8.2.

### ADR-005: Travel Score v1 model

- **Status**: Accepted
- **Decision**: Deterministic, versioned, pure scoring in the domain layer using the SPEC §10.3 formula and §10.4 theme weights; missing factors lower confidence rather than defaulting to best.
- **Impact**: Requirement 10; SPEC §10.

### ADR-006: i18n URL and canonical strategy

- **Status**: Accepted
- **Decision**: English prefix-free; other locales under path prefixes; stable ASCII slugs; `hreflang`/`x-default` per page; non-PII locale cookie; no forced SEO-breaking redirects.
- **Impact**: Requirement 12; SPEC §13.

### ADR-007: Programmatic SEO quality gate

- **Status**: Accepted
- **Decision**: A single quality-gate function decides indexability; results persisted in `seo_page_registry`; sitemap includes only indexable pages; `lastmod` tracks a content hash. Compare pages require a whitelist.
- **Impact**: Requirements 4, 6, 7, 11; SPEC §12.

### ADR-008: Admin authentication (reserved)

- **Status**: Proposed
- **Decision**: `/admin` disabled by default; requires a real auth layer before any production exposure. Not implemented in MVP beyond the gating requirement.
- **Impact**: SPEC §4 FR-012, §16.
