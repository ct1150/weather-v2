---
title: API Specification
authority: API
status: Active
last_updated: 2026-07-17
---

# API Specification

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Public reads

<!-- requirement
id: API-READ-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-API_READ_001
owner: API
verification: pnpm docs:check
-->

<a id="API-READ-001"></a>

### API-READ-001 — Versioned read endpoint shapes

All public read endpoints are namespaced under `/api/v1`, execute through application use cases, and read only from precomputed KV/D1 data. The documented shapes are:

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

The schemas below are exhaustive. Every property is required. A property can be JSON `null` only where its type explicitly contains `null`; no property is omitted. Arrays are always present and preserve the stated order; an empty result is `[]`. Numbers must be finite. Scores are integers in `0..100`, confidence is finite in `0..1`, latitude is `-90..90`, longitude is `-180..180`, and ranks are positive integers.

```ts
type IsoInstant = string; // RFC 3339 UTC form YYYY-MM-DDTHH:mm:ss[.sss]Z
type OffsetDateTime = string; // RFC 3339 with required Z or numeric UTC offset
type LocalDate = string; // valid Gregorian YYYY-MM-DD
type Locale = "en" | "ja" | "ko" | "zh-cn" | "zh-tw";
type Theme =
  | "general"
  | "outdoor"
  | "beach"
  | "walking"
  | "hiking"
  | "camping"
  | "family"
  | "photography"
  | "night_view"
  | "food_trip"
  | "shopping"
  | "theme_park"
  | "mountain";
type Region =
  | "global"
  | "primary"
  | "secondary"
  | "jp"
  | "kr"
  | "sg"
  | "my"
  | "th"
  | "vn"
  | "id"
  | "ph"
  | "hk"
  | "tw"
  | "north_america"
  | "europe"
  | "australia";
type Unit = "metric" | "imperial";
type Window = "today" | "tomorrow" | "weekend" | "next_week";
type ScoreState = "available" | "limited_data" | "unavailable";
type ReasonCode =
  | "LOW_RAIN_CHANCE"
  | "COMFORTABLE_TEMPERATURE"
  | "LOW_HUMIDITY"
  | "CALM_WIND"
  | "HIGH_UV_CAUTION"
  | "HEAVY_RAIN_RISK"
  | "STORM_RISK"
  | "CLEAR_NIGHT_SKY"
  | "GOOD_GOLDEN_HOUR"
  | "LIMITED_DATA"
  | "STALE_DATA";

interface Freshness {
  dataUpdatedAt: IsoInstant;
  stale: boolean;
}

interface WeatherIdentity {
  snapshotId: string;
  rankingVersion: string | null;
  modelVersion: string;
  freshness: Freshness;
}

interface ContentIdentity {
  snapshotId: null;
  rankingVersion: null;
  modelVersion: null;
  contentVersion: string;
  freshness: Freshness;
}
```

For `WeatherIdentity`, `rankingVersion` is a string only on Rankings and Map and is `null` on City, Forecast, Hourly, and Compare. For `ContentIdentity`, all three weather identity fields are always `null`. `freshness.dataUpdatedAt` is the oldest source update instant used by the representation. Capture `now` once at request start in UTC; with deployment's positive-integer `WEATHER_DATA_MAX_AGE_MINUTES`, `stale` is true **exactly if and only if** `now - dataUpdatedAt > WEATHER_DATA_MAX_AGE_MINUTES * 60 seconds`. Equality is fresh. Publication status, manifest age, cache TTL, CDN/KV/D1 source, and fallback selection never independently set `stale`; a future or invalid `dataUpdatedAt` makes the representation unavailable rather than fresh. Both freshness fields equal envelope `meta`. The response `unit` controls numeric display values: metric uses Celsius, millimetres, kilometres per hour, and metres; imperial uses Fahrenheit, inches, miles per hour, and miles.

#### Success `data` schema — Rankings

```ts
interface RankingsData extends WeatherIdentity {
  rankingVersion: string;
  theme: Theme;
  window: Window;
  region: Region;
  locale: Locale;
  items: RankingItem[]; // ascending rank; length 0..validated limit
}

interface RankingItem {
  rank: number;
  cityId: string;
  countrySlug: string;
  citySlug: string;
  cityName: string;
  countryName: string;
  score: number;
  scoreState: "available";
  reasonCodes: ReasonCode[];
}
```

The returned `snapshotId` and `rankingVersion` are the exact D1 active publication pair. On an uncached read, a KV manifest may supply the model only after its complete identity and fencing token match D1; it never selects the pair. No item with a hidden or unavailable score enters `items`.

#### Success `data` schema — Country

```ts
interface CountryData extends ContentIdentity {
  locale: "en";
  country: {
    countryId: string;
    slug: string;
    iso2: string;
    iso3: string;
    name: string;
    summary: string | null;
    defaultTimezone: string;
  };
  cities: CountryCity[]; // ascending editorial rank, then cityId
}

interface CountryCity {
  cityId: string;
  citySlug: string;
  name: string;
  isFeatured: boolean;
}
```

This endpoint has no locale input in v1, so `locale` is exactly `en`. An unknown country returns `RESOURCE_NOT_FOUND`, not an empty country object.

#### Success `data` schema — City summary

```ts
interface CityData extends WeatherIdentity {
  rankingVersion: null;
  locale: Locale;
  unit: Unit;
  window: Window;
  includedDates: LocalDate[]; // chronological; exact dates used by the score
  city: {
    cityId: string;
    countryId: string;
    countrySlug: string;
    citySlug: string;
    cityName: string;
    countryName: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
  score: {
    value: number | null;
    state: ScoreState;
    confidence: number | null;
    reasonCodes: ReasonCode[];
  };
  current: {
    observedAt: IsoInstant;
    weatherCode: number | null;
    temperature: number | null;
    apparentTemperature: number | null;
    precipitation: number | null;
    precipitationProbability: number | null;
    humidity: number | null;
    windSpeed: number | null;
    windGust: number | null;
    uvIndex: number | null;
    cloudCover: number | null;
    visibility: number | null;
  };
}
```

`score.value` and `score.confidence` are non-null exactly when `state` is `available` or `limited_data`; both are null when `state` is `unavailable`. `reasonCodes` is present in every state. A missing current raw measurement is represented only by its documented nullable property.

#### Success `data` schema — Daily forecast

```ts
interface ForecastData extends WeatherIdentity {
  rankingVersion: null;
  cityId: string;
  timezone: string;
  unit: Unit;
  requestedDays: number;
  days: ForecastDay[]; // chronological, unique localDate, length 1..requestedDays
}

interface ForecastDay {
  localDate: LocalDate;
  weatherCode: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  apparentTemperatureMin: number | null;
  apparentTemperatureMax: number | null;
  precipitation: number | null;
  precipitationProbabilityMax: number | null;
  humidityMean: number | null;
  windSpeedMax: number | null;
  windGustMax: number | null;
  uvIndexMax: number | null;
  cloudCoverMean: number | null;
  visibilityMean: number | null;
  sunriseLocal: OffsetDateTime | null;
  sunsetLocal: OffsetDateTime | null;
}
```

`requestedDays` equals the validated `days` query value. A syntactically valid city with no trustworthy forecast returns `DATA_UNAVAILABLE`, not `days: []`.

#### Success `data` schema — Hourly forecast

```ts
interface HourlyData extends WeatherIdentity {
  rankingVersion: null;
  cityId: string;
  timezone: string;
  localDate: LocalDate;
  unit: Unit;
  hours: ForecastHour[]; // ascending instant; length >= 1; duplicate DST clock hours retain distinct offsets
}

interface ForecastHour {
  localTime: OffsetDateTime;
  weatherCode: number | null;
  temperature: number | null;
  apparentTemperature: number | null;
  precipitation: number | null;
  precipitationProbability: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windGust: number | null;
  uvIndex: number | null;
  cloudCover: number | null;
  visibility: number | null;
}
```

Every `localTime` carries its actual UTC offset. A resolved city/date with no trustworthy hourly rows returns `DATA_UNAVAILABLE`, not `hours: []`.

#### Success `data` schema — Map

```ts
interface MapData extends WeatherIdentity {
  rankingVersion: string;
  theme: Theme;
  window: Window;
  zoom: number;
  bounds: {
    // exact canonical bounds represented by canonicalBoundsString
    west: number;
    south: number;
    east: number;
    north: number;
  };
  canonicalBoundsString: string; // west,south,east,north; each fixed to 6 decimals
  canonicalBoundsHash: string; // base64url SHA-256 identity defined below
  mapRegionKey: string; // derived as wm:{zoom}:{tileSetHash}
  tileSetHash: string; // base64url SHA-256 of comma-joined tileIds
  tileIds: number[]; // unique ascending canonical Web Mercator IDs; length 1..64
  markers: MapMarker[]; // ascending cityId
}

interface MapMarker {
  cityId: string;
  countrySlug: string;
  citySlug: string;
  name: string;
  latitude: number;
  longitude: number;
  score: number | null;
  scoreState: ScoreState;
  primaryReasonCode: ReasonCode | null;
  dataUpdatedAt: IsoInstant;
  stale: boolean;
}
```

These are all marker fields. `score` is null exactly when `scoreState` is `unavailable`; `primaryReasonCode` is the first stable reason code or null when none exists. Each marker applies the same sole stale-age equation to its own `dataUpdatedAt`; top-level `dataUpdatedAt` is the oldest marker/source instant, so top-level stale is true whenever any included source is stale. `bounds`, `canonicalBoundsString`, `canonicalBoundsHash`, `mapRegionKey`, `tileSetHash`, and `tileIds` are the exact canonical identities used by the shared-cache key. Map data contains no forecast-day, forecast-hour, provider DTO, free text reason, or arbitrary property.

#### Success `data` schema — Search

```ts
interface SearchData extends ContentIdentity {
  query: string;
  locale: Locale;
  items: SearchItem[]; // relevance desc, searchWeight desc, kind asc, id asc; length 0..limit
}

interface SearchItem {
  kind: "city" | "country" | "article";
  id: string;
  title: string;
  subtitle: string | null;
  path: string;
  countryIso2: string | null;
}
```

`query` is the validated trimmed query. `countryIso2` is non-null only for a city result. Search has no cursor in v1.

#### Success `data` schema — Compare

```ts
interface CompareData extends WeatherIdentity {
  rankingVersion: null;
  window: Window;
  includedDates: LocalDate[]; // chronological intersection used for both cities
  cities: [CompareCity, CompareCity]; // lexicographic cityId order
  scoreDifference: number | null;
  winnerCityId: string | null;
}

interface CompareCity {
  cityId: string;
  countrySlug: string;
  citySlug: string;
  name: string;
  score: number | null;
  scoreState: ScoreState;
  confidence: number | null;
  reasonCodes: ReasonCode[];
}
```

`scoreDifference = abs(cities[0].score - cities[1].score)` when both scores are non-null and is null otherwise. `winnerCityId` is the higher-score city ID and is null for a tie or a null score. A disabled or unapproved canonical pair returns `NOT_INDEXABLE`.

#### Success `data` schema — Articles

```ts
interface ArticlesData extends ContentIdentity {
  locale: Locale;
  city: string | null;
  items: ArticleSummary[]; // publishedAt desc, articleId asc; length 0..20
  nextCursor: string | null;
}

interface ArticleSummary {
  articleId: string;
  slug: string;
  title: string;
  summary: string | null;
  authorName: string | null;
  publishedAt: IsoInstant;
  updatedAt: IsoInstant;
  citySlugs: string[]; // unique ascending slugs
}
```

`city` is the validated city filter or null. `nextCursor` is a server-issued base64url token only when another page exists and is null on the final page. An empty page is valid only when `items` is `[]` and `nextCursor` is null.

The Compare shape remains documented for compatibility, but Compare is a **Beta capability** governed by [PRD-FR-007](01-Product-PRD.md#PRD-FR-007); its presence here does not activate it in the baseline product. The article endpoint likewise does not override its owning Product release record.

The map endpoint returns exactly `MapData` and `MapMarker`; it never returns full hourly arrays. Endpoint handlers never call a weather provider or compute a new score.

Roadmap: [REL-MVP-API_READ_001](11-Roadmap.md#REL-MVP-API_READ_001).

#### Acceptance Criteria

- Contract tests cover every listed method, path, and parameter name under `/api/v1`.
- Every handler reads through a use case backed by KV/D1 and observes zero weather-provider calls, including cache misses.
- A map fixture remains compact and contains no hourly forecast array or provider DTO.
- The Compare endpoint cannot be enabled as a baseline capability merely because its shape exists; availability resolves through its linked Product/Roadmap contract.
- Unsupported versions or methods return a stable error rather than silently changing the v1 shape.

<!-- requirement
id: API-ENVELOPE-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-API_ENVELOPE_001
owner: API
verification: pnpm docs:check
-->

<a id="API-ENVELOPE-001"></a>

### API-ENVELOPE-001 — Uniform success and error envelopes

Successful reads return this exact generic envelope, where `data` is one of the nine endpoint schemas in [API-READ-001](#API-READ-001):

```ts
interface SuccessEnvelope<TData> {
  data: TData;
  meta: {
    requestId: string;
    generatedAt: IsoInstant;
    dataUpdatedAt: IsoInstant;
    stale: boolean;
    snapshotId: string | null;
    rankingVersion: string | null;
    modelVersion: string | null;
  };
}
```

`meta.snapshotId`, `meta.rankingVersion`, and `meta.modelVersion` exactly equal their `data` fields. Content endpoints set all three to null. Weather endpoints set snapshot/model to non-null; Rankings and Map also set ranking to non-null, while City, Forecast, Hourly, and Compare set ranking to null.

Errors return:

```json
{
  "error": {
    "code": "CITY_NOT_FOUND",
    "message": "City not found",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

The request header is exactly `X-Request-ID`. An inbound value is valid only when the single parsed header value is `8..128` ASCII characters and matches anchored `[A-Za-z0-9_-]+`; it is propagated byte-for-byte with no trimming or case folding. A missing, duplicate/combined, empty, too-short, too-long, or otherwise invalid value is ignored and replaced at the edge by a newly generated RFC 4122 UUIDv4. The chosen value is immutable for the request.

Every `2xx`, `3xx`, `4xx`, and `5xx` response returns that value in the `X-Request-ID` response header. Every success/error body that has a request-ID field uses the same value; bodyless `204`, `304`, redirects, and other bodyless responses still send the header. A CDN cache stores no request-specific ID: the edge overwrites `X-Request-ID` for each request after cache selection. Request ID never participates in an ETag, representation hash, or cache key.

All date/time fields are ISO-8601 strings with explicit UTC offset; date-only parameters are ISO calendar dates interpreted under the endpoint's documented city context. `generatedAt` identifies envelope generation, `dataUpdatedAt` identifies source-data freshness, and `stale` uses only the max-age equation in API-READ-001.

The complete stable v1 error-to-status mapping is:

| Error code           | HTTP status | Exact use                                                                                    |
| -------------------- | ----------: | -------------------------------------------------------------------------------------------- |
| `INVALID_PARAMETER`  |         400 | Missing, malformed, duplicate, out-of-range, unsupported, or unknown path/query input        |
| `COMPARE_SAME_CITY`  |         400 | Normalized `cityA` and `cityB` are identical                                                 |
| `UNAUTHORIZED`       |         401 | Internal authentication is absent or invalid; include `WWW-Authenticate` where applicable    |
| `FORBIDDEN`          |         403 | Authenticated principal is not authorized for the operation                                  |
| `CITY_NOT_FOUND`     |         404 | A syntactically valid city identifier does not resolve                                       |
| `RESOURCE_NOT_FOUND` |         404 | A syntactically valid non-city resource does not resolve                                     |
| `NOT_INDEXABLE`      |         404 | A disabled/nonapproved Compare pair or intentionally undisclosed representation is requested |
| `ENDPOINT_NOT_FOUND` |         404 | The path or API version is unsupported                                                       |
| `METHOD_NOT_ALLOWED` |         405 | The path exists but the method is not `GET`; include the exact `Allow` header                |
| `RATE_LIMITED`       |         429 | The applicable rate limit is exceeded; include integer-seconds `Retry-After`                 |
| `INTERNAL_ERROR`     |         500 | An unhandled server fault occurs                                                             |
| `DATA_UNAVAILABLE`   |         503 | No trustworthy D1-active or deployed fallback representation is available                    |

Messages may be localized, but code, status, and shape remain stable. Every error response sends `Cache-Control: private, no-store` and no `ETag`, including validation, authentication, authorization, not-found, rate-limit, unavailable, and internal failures. No response exposes SQL, stack traces, credentials, provider bodies, internal paths, or unsanitized exceptions.

Roadmap: [REL-MVP-API_ENVELOPE_001](11-Roadmap.md#REL-MVP-API_ENVELOPE_001).

#### Acceptance Criteria

- Schema tests accept the exact success/error shapes and reject a response containing both `data` and `error`.
- Header tests propagate each valid `X-Request-ID` boundary value unchanged, replace missing/invalid/multiple values with a syntactically valid UUIDv4, and return the chosen value on every `2xx`/`3xx`/`4xx`/`5xx` path including bodyless `304`.
- Cache tests prove `X-Request-ID` is applied per request and never stored as representation identity.
- Date fixtures require ISO-8601 values and distinguish generation time from source update time.
- Stable code-to-status mappings cover invalid input, missing city, same-city Compare, rate limit, authentication, authorization, unavailable data, and unhandled errors.
- Redaction tests inject SQL, stack, secret, provider, and path text and prove none appears in a public envelope.

## Validation and internal access

<!-- requirement
id: API-VALIDATION-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-API_VALIDATION_001
owner: API
verification: pnpm docs:check
-->

<a id="API-VALIDATION-001"></a>

### API-VALIDATION-001 — Bounded normalized input and parameterized access

Every path and query value is parsed by a runtime schema before use. The canonical v1 enum values are:

```text
locale = en | ja | ko | zh-cn | zh-tw
unit = metric | imperial
window = today | tomorrow | weekend | next_week
theme = general | outdoor | beach | walking | hiking | camping | family |
        photography | night_view | food_trip | shopping | theme_park | mountain
region = global | primary | secondary | jp | kr | sg | my | th | vn | id | ph |
         hk | tw | north_america | europe | australia
```

Enum input is ASCII-trimmed and case-folded to the listed canonical lower-case value. A slug is `1..80` ASCII characters matching `[a-z0-9]+(?:-[a-z0-9]+)*`. A `cityId` is `1..64` ASCII characters matching `[A-Za-z0-9_-]+`. Integers contain only decimal digits, with no sign, fraction, or exponent.

#### Endpoint parameter contract

| Endpoint                                      | Required and optional input; defaults and exact bounds                                                                                                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/rankings`                        | Required: `theme`, `window`. Optional: `region` default `global`; `limit` integer `1..100` default `20`; `locale` default `en`.                                                                                                                                                                                                       |
| `GET /api/v1/countries/{countrySlug}`         | `countrySlug` is a slug. No query parameters.                                                                                                                                                                                                                                                                                         |
| `GET /api/v1/cities/{countrySlug}/{citySlug}` | Both path values are slugs. Optional: `window` default `today`; `unit` default `metric`; `locale` default `en`.                                                                                                                                                                                                                       |
| `GET /api/v1/cities/{cityId}/forecast`        | `cityId` follows the ID grammar. Optional: `days` integer `1..14` default `7`; `unit` default `metric`.                                                                                                                                                                                                                               |
| `GET /api/v1/cities/{cityId}/hourly`          | `cityId` follows the ID grammar. Required: `date`, an existing Gregorian date in strict `YYYY-MM-DD` form. Optional: `unit` default `metric`.                                                                                                                                                                                         |
| `GET /api/v1/map`                             | Required: `theme`, `window`, `bounds`, `zoom`. `bounds` is exactly `west,south,east,north`; each coordinate follows the `boundsDecimal` grammar below, longitude is `-180..180`, latitude is `-85..85`, `west < east`, and `south < north`. `zoom` is integer `2..12`; the canonical box may intersect at most 64 Web Mercator tiles. |
| `GET /api/v1/search`                          | Required: `q`, trimmed length `2..80` Unicode scalar values. Optional: `locale` default `en`; `limit` integer `1..20` default `10`.                                                                                                                                                                                                   |
| `GET /api/v1/compare`                         | Required: `cityA`, `cityB`, each following the ID grammar. Optional: `window` default `today`. Identical normalized IDs return `COMPARE_SAME_CITY`; otherwise sort IDs lexicographically and require the canonical pair to be precomputed and approved.                                                                               |
| `GET /api/v1/articles`                        | Optional: `cursor`, a server-issued base64url token of `1..256` characters matching `[A-Za-z0-9_-]+`; `locale` default `en`; `city`, a slug. Page size is fixed at `20`.                                                                                                                                                              |

These are exhaustive per endpoint. Unknown parameters always return `INVALID_PARAMETER` with HTTP `400`; specifically, any query name not listed for that endpoint, including tracking parameters, is rejected and never ignored. A parameter appearing more than once, bracket/array syntax, an empty supplied value, or more than 20 total query pairs also returns `INVALID_PARAMETER` with HTTP `400`. Validation runs before cache lookup, D1 access, or provider access. Every listed endpoint accepts only `GET`; another method returns `METHOD_NOT_ALLOWED` with HTTP `405` and `Allow: GET`.

Destination slugs and IDs are normalized deterministically. Search matching is case- and accent-insensitive over approved names and aliases only after the `2..80` bound passes. Compare rejects identical cities, normalizes valid pair order, and accepts only approved precomputed pairs where that capability is enabled.

```text
boundsDecimal = -?(?:0|[1-9]\d*)(?:\.\d{1,6})?
```

`boundsDecimal` is an anchored ASCII grammar: it has no sign other than the optional leading minus, no exponent, no leading zero before another integer digit, and at most six fractional digits.

Map canonicalization occurs before D1/KV/CDN lookup. Parse each accepted decimal exactly, normalize negative zero to zero, and emit each coordinate with exactly six fractional digits in request order as `canonicalBoundsString = west,south,east,north`. Define `canonicalBoundsHash = base64url(SHA-256(UTF8("v1|" + canonicalBoundsString)))`. Equivalent accepted numeric spellings therefore share one bounds identity.

For zoom `z`, let `n = 2^z`, `x(lon) = n * (lon + 180) / 360`, and `y(lat) = n * (1 - asinh(tan(lat * pi / 180)) / pi) / 2`. Treat the canonical box as `[west,east) × [south,north)`. Intersected tile coordinates are every integer `x` from `floor(x(west))` through `ceil(x(east)) - 1` and every integer `y` from `floor(y(north))` through `ceil(y(south)) - 1`, clamped to `0..n-1`. Encode `tileId = y * n + x`, de-duplicate, and sort ascending; reject zero or more than 64 IDs. Define `tileSetHash = base64url(SHA-256(UTF8(commaSeparatedCanonicalTileIds)))` and derive `mapRegionKey = "wm:" + z + ":" + tileSetHash`. No caller supplies region/tile identity. Payload and cache key carry this same canonical bounds hash, map region key, tile-set hash, and tile IDs.

Every D1 query is parameterized; untrusted values never enter SQL through string interpolation. Invalid inputs return `INVALID_PARAMETER` without a database/provider call. Output serialization encodes untrusted text as data.

Roadmap: [REL-MVP-API_VALIDATION_001](11-Roadmap.md#REL-MVP-API_VALIDATION_001).

#### Acceptance Criteria

- Boundary fixtures cover every endpoint row, every enum, numeric minimum/maximum and immediate neighbor, slug/ID/search/cursor length and grammar, strict date validity, map decimal/order/zoom/64-tile limits, and all defaults.
- Map fixtures prove equivalent decimal spellings produce one six-decimal bounds string/hash; Web Mercator boundary, clamp, sort, tile hash, and derived region cases produce the exact payload/cache identity.
- Unknown, duplicate, empty, bracketed, and twenty-first query pairs return `INVALID_PARAMETER` with HTTP `400` before cache, D1, or provider access.
- Injection payloads in every path and query field reach only parameter bindings and cannot alter SQL structure.
- Search normalization is deterministic, bounded, case-insensitive, and accent-insensitive over approved aliases.
- Compare fixtures reject same-city and nonapproved pairs and canonicalize valid reversed pairs deterministically.
- Method fixtures return `405`, `METHOD_NOT_ALLOWED`, and exactly `Allow: GET` for every documented path.

<!-- requirement
id: API-INTERNAL-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-API_INTERNAL_001
owner: API
verification: pnpm docs:check
-->

<a id="API-INTERNAL-001"></a>

### API-INTERNAL-001 — Cron binding preference and strongly authenticated internal routes

Sync and maintenance jobs execute through Cloudflare Cron bindings and service bindings rather than public HTTP endpoints. If an operational constraint requires an internal HTTP route, it lives outside the public `/api/v1` namespace and requires all of: independently managed strong credentials, request-body signing, a timestamp and nonce, a short replay window, constant-time signature verification, authorization for the named operation, strict rate limiting, and structured audit logging.

Internal routes are default-deny, never authenticated by obscurity or a client-supplied role, and are not callable from browser bundles. Credentials are deployment secrets and never appear in URLs, logs, errors, or repositories. A request is rejected before work begins when authentication, authorization, timestamp, nonce, or signature validation fails.

Roadmap: [REL-MVP-API_INTERNAL_001](11-Roadmap.md#REL-MVP-API_INTERNAL_001).

#### Acceptance Criteria

- The default sync and maintenance path has no public HTTP dependency and is invocable by its scheduled binding.
- Missing, malformed, expired, replayed, incorrectly signed, or unauthorized internal requests are rejected before side effects.
- Signature verification covers method, path, timestamp, nonce, and body digest and uses constant-time comparison.
- Internal secrets are absent from client bundles, URLs, logs, public errors, and repository fixtures.
- Audit events identify request/run ID, operation, authenticated principal, decision, and sanitized error code without recording the secret.

## Public cache behavior

<!-- requirement
id: API-CACHE-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-API_CACHE_001
owner: API
verification: pnpm docs:check
-->

<a id="API-CACHE-001"></a>

### API-CACHE-001 — Immutable internal cores and per-request envelopes

The API has exactly two representation stages with different storage rules:

1. **Worker-owned internal CoreData stage.** `CoreData` is the schema-validated endpoint representation before request-scoped derivation: it contains the complete immutable payload values, authoritative publication/content identity, `dataUpdatedAt`, and, for Map, each marker's `dataUpdatedAt`; it omits every `stale` value and the entire HTTP envelope, including `meta`, `requestId`, and `generatedAt`. Authorized background workers alone publish canonical serialized immutable `CoreData` to identity-bound KV keys under the listed worker-owned TTLs. API request paths may read those bytes but never put, delete, repair, or backfill KV. The ephemeral Cache API is not used for either CoreData or API responses. Internal KV TTL expiry is eviction policy only and never defines weather freshness.
2. **Per-request HTTP envelope stage.** Every request resolves and schema-parses `CoreData`, dynamically derives all `stale` values from that request's captured `now`, inserts the request's chosen `requestId`, captures `generatedAt` when assembling a non-304 body, and creates the exact `SuccessEnvelope`. Every final HTTP success envelope is `Cache-Control: private, no-store`; a CDN never directly returns it, and no browser cache, shared cache, KV namespace, or Cache API may store or replay it. Errors and bodyless responses use the same no-store policy.

The resolver executes this order for every public read, including a worker-populated KV CoreData hit:

1. Select the immutable request ID under API-ENVELOPE-001 and validate/canonicalize every path and query input before any cache or database lookup.
2. Capture request `now`. Read authoritative identity from D1: weather reads join the active pointer/snapshot and current publication fencing-token high-water mark; content reads resolve the authoritative `contentHash`/`contentVersion`. A KV manifest remains only a hint and cannot select identity.
3. Derive the endpoint's internal key only from that D1 identity and canonical parameters. Fetch at most that key, schema-parse the bytes as `CoreData`, and verify its embedded identity and key fields exactly against D1. A parse, schema, checksum, identity, or fencing mismatch is a miss and cannot be served. On a miss, read only D1-active/content-authoritative rows and construct and parse the same `CoreData` schema for this request. Do not write KV, invoke Cache API, enqueue a request-path repair, or backfill any cache; continue serving D1-authoritative data on subsequent misses until an authorized worker repairs or republishes the immutable KV CoreData.
4. Compute the validator only from canonical `CoreData` plus the verified immutable identity. Evaluate `If-None-Match` only after step 3 has resolved and parsed the core. A match returns a bodyless `304` with that validator, `Cache-Control: private, no-store`, `Vary: Accept-Encoding`, and the current request's `X-Request-ID`; it does not reuse the ID from any prior request. A non-match proceeds to step 5.
5. Calculate top-level and nested `stale` fields solely by `now - dataUpdatedAt > WEATHER_DATA_MAX_AGE_MINUTES * 60 seconds`; equality is fresh. Then insert those booleans into the wire `data`, copy identity/freshness into `meta`, set this request's `requestId`, capture body `generatedAt`, and serialize the envelope. Cache source, core age, TTL, publication state, and fallback path never alter `stale`.

For weather endpoints, `identity` is the exact object `{ snapshotId, rankingVersion, modelVersion }`, where `rankingVersion` is null except for Rankings and Map. For content endpoints it is `{ contentHash, contentVersion }`. The weak validator algorithm is exact:

```text
coreHash = base64url(SHA-256(canonicalJson({ identity, coreData })))
ETag = 'W/"v1.' + coreHash + '"'
```

Canonical JSON recursively sorts object keys and preserves array order. `coreData` is exactly the parsed internal object, before injecting any `stale` property. The hash never includes `requestId`, `generatedAt`, or any `stale` value. Although `dataUpdatedAt` is part of immutable `CoreData`, no separately recomputed freshness field enters the hash. Search intentionally has no validator or worker-populated internal KV CoreData because its normalized query cardinality is user-driven.

#### Endpoint internal-core and final-response contract

Worker-owned internal KV `CoreData` TTL values below are seconds. `0 (disabled)` means workers publish no endpoint CoreData key and the API performs no internal KV lookup. All listed success responses also send the request's `X-Request-ID`; rows with an ETag send `Vary: Accept-Encoding`. The final HTTP column applies equally when dynamically calculated `stale` is true or false—there is no stale response-cache override.

| Endpoint/result                                  | Worker-owned KV `CoreData` TTL | Worker-populated immutable KV `CoreData` key                                                                                                                           | Response validator | Final HTTP `Cache-Control` |
| ------------------------------------------------ | -----------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------- |
| `/rankings` success                              |                           3600 | `core:v1:rankings:{snapshotId}:{rankingVersion}:{modelVersion}:{theme}:{window}:{region}:{limit}:{locale}`                                                             | Core weak `ETag`   | `private, no-store`        |
| `/countries/{countrySlug}` success               |                        2592000 | `core:v1:country:{contentHash}:{contentVersion}:{countrySlug}:en`                                                                                                      | Core weak `ETag`   | `private, no-store`        |
| `/cities/{countrySlug}/{citySlug}` success       |                           3600 | `core:v1:summary:{snapshotId}:{modelVersion}:{countrySlug}:{citySlug}:{window}:{unit}:{locale}`                                                                        | Core weak `ETag`   | `private, no-store`        |
| `/cities/{cityId}/forecast` success              |                           3600 | `core:v1:forecast:{snapshotId}:{modelVersion}:{cityId}:{days}:{unit}`                                                                                                  | Core weak `ETag`   | `private, no-store`        |
| `/cities/{cityId}/hourly` success                |                           3600 | `core:v1:hourly:{snapshotId}:{modelVersion}:{cityId}:{date}:{unit}`                                                                                                    | Core weak `ETag`   | `private, no-store`        |
| `/map` success                                   |                           3600 | `core:v1:map:{snapshotId}:{rankingVersion}:{modelVersion}:{theme}:{window}:{zoom}:{mapRegionKey}:{canonicalBoundsHash}:{tileSetHash}:{commaSeparatedCanonicalTileIds}` | Core weak `ETag`   | `private, no-store`        |
| `/search` success                                |                   0 (disabled) | None                                                                                                                                                                   | No `ETag`          | `private, no-store`        |
| `/compare` approved-pair success                 |                           3600 | `core:v1:compare:{snapshotId}:{modelVersion}:{lexicographicCityA}:{lexicographicCityB}:{window}`                                                                       | Core weak `ETag`   | `private, no-store`        |
| `/articles` success                              |                          86400 | `core:v1:articles:{contentHash}:{contentVersion}:{cursorOrFirst}:{locale}:{cityOrAll}`                                                                                 | Core weak `ETag`   | `private, no-store`        |
| Internal/authenticated/preview/personalized read |                   0 (disabled) | None                                                                                                                                                                   | No `ETag`          | `private, no-store`        |
| Any error status                                 |                   0 (disabled) | None                                                                                                                                                                   | No `ETag`          | `private, no-store`        |

`cursorOrFirst` is `first` when absent and otherwise the validated server-issued cursor; `cityOrAll` is `all` when absent. Map identity fields are derived by API-VALIDATION-001 and copied unchanged into `CoreData` and its key. Locale is explicit in each applicable key and is never inferred from `Accept-Language`. Equivalent canonical requests may reuse immutable internal core bytes, but their final envelopes independently recalculate freshness and have different request IDs and generation times. CORS uses an explicit allowed-origin and method policy and is never `*` for credentialed requests. Worker-owned KV TTLs cannot exceed [ARCH-CACHE-001](05-System-Architecture.md#ARCH-CACHE-001) or [ARCH-RENDER-001](05-System-Architecture.md#ARCH-RENDER-001).

Roadmap: [REL-MVP-API_CACHE_001](11-Roadmap.md#REL-MVP-API_CACHE_001).

#### Acceptance Criteria

- Worker-publication storage spies prove authorized worker KV writes contain only schema-valid immutable `CoreData`, never `meta`, an envelope, response headers, `requestId`, `generatedAt`, or any `stale` property. API request spies prove zero storage mutations and zero ephemeral Cache API operations on hits and misses.
- CDN routing tests prove every `/api/v1` request reaches the application handler and no final envelope is served as a direct CDN hit.
- Every-request tests prove authoritative D1 identity is read before deriving an internal key, worker-populated bytes are parsed and identity-checked before use, and candidate/caller identities or mismatched manifests/cores cannot enter a key or response. Miss fixtures read only D1-active/content-authoritative rows, perform no backfill or repair side effect, and continue to use D1 until worker publication is repaired.
- Boundary-clock tests reuse one core before, at, and after the max-age threshold: equality is fresh, only the later request is stale, and the internal bytes/key/ETag remain unchanged while request IDs and non-304 `generatedAt` values are assembled per request.
- Validator fixtures assert the exact canonical `{ identity, coreData }` hash and prove changing any immutable core/identity value changes the ETag while changing `requestId`, `generatedAt`, request time, or a derived `stale` value does not.
- Conditional-request tests prove `If-None-Match` is evaluated only after D1 identity validation and successful core parsing; a match returns bodyless `304` with `private, no-store`, the matching ETag, `Vary: Accept-Encoding`, and that request's current `X-Request-ID`.
- Per-endpoint contract fixtures assert every listed worker-owned KV TTL, exact canonical core key, validator choice, and final response header; every final success envelope, bodyless `304`, internal/authenticated/preview/personalized response, and error is `private, no-store` and no final envelope enters shared storage.
- Equivalent valid requests produce the exact listed internal key regardless of parameter order or accepted enum case; unknown/tracking and duplicate parameters return `400` before D1/internal-KV access and produce no key.
- Map core/key fixtures assert byte-identical `canonicalBoundsHash`, `mapRegionKey`, `tileSetHash`, and ordered tile-ID identity.
- CORS tests allow only configured origins/methods/headers and reject wildcard credentialed access.
- Cache poisoning tests cover duplicate parameters, encoded delimiters, host/origin variance, unknown fields, malformed cursors, map tile amplification, and arbitrary search/Compare amplification.
