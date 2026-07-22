// apps/web/src/api/v1/schemas.ts
//
// v1 public-read API contract: canonical types, bounded input validation and
// canonicalization, uniform success/error envelopes, and the stable
// error-to-status table.
//
// Authority: docs/07-API-Spec.md — API-READ-001 (shapes), API-ENVELOPE-001
// (envelopes), API-VALIDATION-001 (bounded normalized input), API-CACHE-001
// (immutable cores, per-request envelopes, ETag). The runtime uses these types
// and helpers; the server never emits unvalidated or uncanonicalized values.

import { createHash, randomUUID } from "node:crypto";

import { type ApplicationResult, fail, ok } from "../../lib/result";

// ---------------------------------------------------------------------------
// Canonical enums (API-READ-001 / API-VALIDATION-001)
// ---------------------------------------------------------------------------

export type Locale = "en" | "ja" | "ko" | "zh-cn" | "zh-tw";
export type Unit = "metric" | "imperial";
export type Window = "today" | "tomorrow" | "weekend" | "next_week";
export type Theme =
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
export type Region =
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
export type ScoreState = "available" | "limited_data" | "unavailable";
export type ReasonCode =
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

export type IsoInstant = string; // RFC 3339 UTC YYYY-MM-DDTHH:mm:ss[.sss]Z
export type OffsetDateTime = string; // RFC 3339 with required Z or numeric offset
export type LocalDate = string; // valid Gregorian YYYY-MM-DD

// ---------------------------------------------------------------------------
// Identity + freshness (API-READ-001)
// ---------------------------------------------------------------------------

export interface Freshness {
  readonly dataUpdatedAt: IsoInstant;
  readonly stale: boolean;
}

/** Weather endpoints carry snapshot/ranking/model identity. */
export interface WeatherIdentity {
  readonly snapshotId: string;
  readonly rankingVersion: string | null;
  readonly modelVersion: string;
  readonly freshness: Freshness;
}

/** Content endpoints carry only content identity; weather fields are null. */
export interface ContentIdentity {
  readonly snapshotId: null;
  readonly rankingVersion: null;
  readonly modelVersion: null;
  readonly contentVersion: string;
  readonly freshness: Freshness;
}

// ---------------------------------------------------------------------------
// Endpoint data schemas (API-READ-001) — exhaustive; every property required.
// ---------------------------------------------------------------------------

export interface RankingItem {
  readonly rank: number;
  readonly cityId: string;
  readonly countrySlug: string;
  readonly citySlug: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly score: number;
  readonly scoreState: "available";
  readonly reasonCodes: ReadonlyArray<ReasonCode>;
}

export interface RankingsData extends WeatherIdentity {
  readonly rankingVersion: string;
  readonly theme: Theme;
  readonly window: Window;
  readonly region: Region;
  readonly locale: Locale;
  readonly items: ReadonlyArray<RankingItem>;
}

export interface CountryCity {
  readonly cityId: string;
  readonly citySlug: string;
  readonly name: string;
  readonly isFeatured: boolean;
}

export interface CountryData extends ContentIdentity {
  readonly locale: "en";
  readonly country: {
    readonly countryId: string;
    readonly slug: string;
    readonly iso2: string;
    readonly iso3: string;
    readonly name: string;
    readonly summary: string | null;
    readonly defaultTimezone: string;
  };
  readonly cities: ReadonlyArray<CountryCity>;
}

export interface CityData extends WeatherIdentity {
  readonly rankingVersion: null;
  readonly locale: Locale;
  readonly unit: Unit;
  readonly window: Window;
  readonly includedDates: ReadonlyArray<LocalDate>;
  readonly city: {
    readonly cityId: string;
    readonly countryId: string;
    readonly countrySlug: string;
    readonly citySlug: string;
    readonly cityName: string;
    readonly countryName: string;
    readonly timezone: string;
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly score: {
    readonly value: number | null;
    readonly state: ScoreState;
    readonly confidence: number | null;
    readonly reasonCodes: ReadonlyArray<ReasonCode>;
  };
  readonly current: {
    readonly observedAt: IsoInstant;
    readonly weatherCode: number | null;
    readonly temperature: number | null;
    readonly apparentTemperature: number | null;
    readonly precipitation: number | null;
    readonly precipitationProbability: number | null;
    readonly humidity: number | null;
    readonly windSpeed: number | null;
    readonly windGust: number | null;
    readonly uvIndex: number | null;
    readonly cloudCover: number | null;
    readonly visibility: number | null;
  };
}

export interface ForecastDay {
  readonly localDate: LocalDate;
  readonly weatherCode: number | null;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
  readonly apparentTemperatureMin: number | null;
  readonly apparentTemperatureMax: number | null;
  readonly precipitation: number | null;
  readonly precipitationProbabilityMax: number | null;
  readonly humidityMean: number | null;
  readonly windSpeedMax: number | null;
  readonly windGustMax: number | null;
  readonly uvIndexMax: number | null;
  readonly cloudCoverMean: number | null;
  readonly visibilityMean: number | null;
  readonly sunriseLocal: OffsetDateTime | null;
  readonly sunsetLocal: OffsetDateTime | null;
}

export interface ForecastData extends WeatherIdentity {
  readonly rankingVersion: null;
  readonly cityId: string;
  readonly timezone: string;
  readonly unit: Unit;
  readonly requestedDays: number;
  readonly days: ReadonlyArray<ForecastDay>;
}

export interface ForecastHour {
  readonly localTime: OffsetDateTime;
  readonly weatherCode: number | null;
  readonly temperature: number | null;
  readonly apparentTemperature: number | null;
  readonly precipitation: number | null;
  readonly precipitationProbability: number | null;
  readonly humidity: number | null;
  readonly windSpeed: number | null;
  readonly windGust: number | null;
  readonly uvIndex: number | null;
  readonly cloudCover: number | null;
  readonly visibility: number | null;
}

export interface HourlyData extends WeatherIdentity {
  readonly rankingVersion: null;
  readonly cityId: string;
  readonly timezone: string;
  readonly localDate: LocalDate;
  readonly unit: Unit;
  readonly hours: ReadonlyArray<ForecastHour>;
}

export interface MapMarker {
  readonly cityId: string;
  readonly countrySlug: string;
  readonly citySlug: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly score: number | null;
  readonly scoreState: ScoreState;
  readonly primaryReasonCode: ReasonCode | null;
  readonly dataUpdatedAt: IsoInstant;
  readonly stale: boolean;
}

export interface MapData extends WeatherIdentity {
  readonly rankingVersion: string;
  readonly theme: Theme;
  readonly window: Window;
  readonly zoom: number;
  readonly bounds: {
    readonly west: number;
    readonly south: number;
    readonly east: number;
    readonly north: number;
  };
  readonly canonicalBoundsString: string;
  readonly canonicalBoundsHash: string;
  readonly mapRegionKey: string;
  readonly tileSetHash: string;
  readonly tileIds: ReadonlyArray<number>;
  readonly markers: ReadonlyArray<MapMarker>;
}

export interface SearchItem {
  readonly kind: "city" | "country" | "article";
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly path: string;
  readonly countryIso2: string | null;
}

export interface SearchData extends ContentIdentity {
  readonly query: string;
  readonly locale: Locale;
  readonly items: ReadonlyArray<SearchItem>;
}

export interface CompareCity {
  readonly cityId: string;
  readonly countrySlug: string;
  readonly citySlug: string;
  readonly name: string;
  readonly score: number | null;
  readonly scoreState: ScoreState;
  readonly confidence: number | null;
  readonly reasonCodes: ReadonlyArray<ReasonCode>;
}

export interface CompareData extends WeatherIdentity {
  readonly rankingVersion: null;
  readonly window: Window;
  readonly includedDates: ReadonlyArray<LocalDate>;
  readonly cities: readonly [CompareCity, CompareCity];
  readonly scoreDifference: number | null;
  readonly winnerCityId: string | null;
}

export interface ArticleSummary {
  readonly articleId: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string | null;
  readonly authorName: string | null;
  readonly publishedAt: IsoInstant;
  readonly updatedAt: IsoInstant;
  readonly citySlugs: ReadonlyArray<string>;
}

export interface ArticlesData extends ContentIdentity {
  readonly locale: Locale;
  readonly city: string | null;
  readonly items: ReadonlyArray<ArticleSummary>;
  readonly nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Stable error codes + status mapping (API-ENVELOPE-001)
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | "INVALID_PARAMETER"
  | "COMPARE_SAME_CITY"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CITY_NOT_FOUND"
  | "RESOURCE_NOT_FOUND"
  | "NOT_INDEXABLE"
  | "ENDPOINT_NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "DATA_UNAVAILABLE";

/** The complete stable v1 error-to-status mapping (API-ENVELOPE-001 §table). */
export const API_ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> = Object.freeze({
  INVALID_PARAMETER: 400,
  COMPARE_SAME_CITY: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CITY_NOT_FOUND: 404,
  RESOURCE_NOT_FOUND: 404,
  NOT_INDEXABLE: 404,
  ENDPOINT_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  DATA_UNAVAILABLE: 503,
});

// ---------------------------------------------------------------------------
// Envelopes (API-ENVELOPE-001)
// ---------------------------------------------------------------------------

export interface EnvelopeMeta {
  readonly requestId: string;
  readonly generatedAt: IsoInstant;
  readonly dataUpdatedAt: IsoInstant;
  readonly stale: boolean;
  readonly snapshotId: string | null;
  readonly rankingVersion: string | null;
  readonly modelVersion: string | null;
}

export interface SuccessEnvelope<TData> {
  readonly data: TData;
  readonly meta: EnvelopeMeta;
}

export interface ErrorEnvelope {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

/** Build a success envelope. `meta` is captured per request (API-CACHE-001 step 5). */
export function makeSuccessEnvelope<TData>(data: TData, meta: EnvelopeMeta): SuccessEnvelope<TData> {
  return { data, meta };
}

/** Build an error envelope. Only code/message/requestId are ever present. */
export function makeErrorEnvelope(code: ApiErrorCode, message: string, requestId: string): ErrorEnvelope {
  return { error: { code, message, requestId } };
}

/** True when a parsed body is a success envelope (has `data`, never `error`). */
export function isSuccessEnvelope(value: unknown): value is SuccessEnvelope<unknown> {
  return typeof value === "object" && value !== null && "data" in value && !("error" in value);
}

/** True when a parsed body is an error envelope (has `error`, never `data`). */
export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return typeof value === "object" && value !== null && "error" in value && !("data" in value);
}

// ---------------------------------------------------------------------------
// Bounded input validation + canonicalization (API-VALIDATION-001)
// ---------------------------------------------------------------------------

const LOCALES: ReadonlyArray<Locale> = ["en", "ja", "ko", "zh-cn", "zh-tw"];
const UNITS: ReadonlyArray<Unit> = ["metric", "imperial"];
const WINDOWS: ReadonlyArray<Window> = ["today", "tomorrow", "weekend", "next_week"];
const THEMES: ReadonlyArray<Theme> = [
  "general",
  "outdoor",
  "beach",
  "walking",
  "hiking",
  "camping",
  "family",
  "photography",
  "night_view",
  "food_trip",
  "shopping",
  "theme_park",
  "mountain",
];
const REGIONS: ReadonlyArray<Region> = [
  "global",
  "primary",
  "secondary",
  "jp",
  "kr",
  "sg",
  "my",
  "th",
  "vn",
  "id",
  "ph",
  "hk",
  "tw",
  "north_america",
  "europe",
  "australia",
];

function canonicalizeEnum<T extends string>(value: string, allowed: ReadonlyArray<T>): T | null {
  const candidate = value.trim().toLowerCase();
  return (allowed as ReadonlyArray<string>).includes(candidate) ? (candidate as T) : null;
}

export function parseLocale(value: string | null | undefined): ApplicationResult<Locale> {
  if (typeof value !== "string") return fail("INVALID_PARAMETER", "locale is required");
  const v = canonicalizeEnum(value, LOCALES);
  return v === null ? fail("INVALID_PARAMETER", `unsupported locale: ${value}`) : ok(v);
}

export function parseUnit(value: string | null | undefined): ApplicationResult<Unit> {
  if (typeof value !== "string") return fail("INVALID_PARAMETER", "unit is required");
  const v = canonicalizeEnum(value, UNITS);
  return v === null ? fail("INVALID_PARAMETER", `unsupported unit: ${value}`) : ok(v);
}

export function parseWindow(value: string | null | undefined): ApplicationResult<Window> {
  if (typeof value !== "string") return fail("INVALID_PARAMETER", "window is required");
  const v = canonicalizeEnum(value, WINDOWS);
  return v === null ? fail("INVALID_PARAMETER", `unsupported window: ${value}`) : ok(v);
}

export function parseTheme(value: string | null | undefined): ApplicationResult<Theme> {
  if (typeof value !== "string") return fail("INVALID_PARAMETER", "theme is required");
  const v = canonicalizeEnum(value, THEMES);
  return v === null ? fail("INVALID_PARAMETER", `unsupported theme: ${value}`) : ok(v);
}

export function parseRegion(value: string | null | undefined): ApplicationResult<Region> {
  if (typeof value !== "string") return fail("INVALID_PARAMETER", "region is required");
  const v = canonicalizeEnum(value, REGIONS);
  return v === null ? fail("INVALID_PARAMETER", `unsupported region: ${value}`) : ok(v);
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate a slug: 1..80 ASCII lowercase `[a-z0-9]+(?:-[a-z0-9]+)*`. Slugs are
 * canonical lowercase ASCII (DATA-GEOGRAPHY-001); an uppercase value is rejected
 * rather than silently lowercased, matching the D1 geography validator.
 */
export function parseSlug(value: string | null | undefined): ApplicationResult<string> {
  if (typeof value !== "string") return fail("INVALID_PARAMETER", "slug is required");
  const v = value.trim();
  if (v.length < 1 || v.length > 80 || !SLUG_RE.test(v)) {
    return fail("INVALID_PARAMETER", `invalid slug: ${value}`);
  }
  return ok(v);
}

const CITY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Validate a cityId: 1..64 ASCII `[A-Za-z0-9_-]+`. */
export function parseCityId(value: string | null | undefined): ApplicationResult<string> {
  if (typeof value !== "string") return fail("INVALID_PARAMETER", "cityId is required");
  const v = value.trim();
  if (v.length < 1 || v.length > 64 || !CITY_ID_RE.test(v)) {
    return fail("INVALID_PARAMETER", `invalid cityId: ${value}`);
  }
  return ok(v);
}

const DECIMAL_INT_RE = /^\d+$/;

/** Parse a non-negative decimal integer within `[min, max]`; optional default. */
export function parseInteger(
  value: string | null | undefined,
  min: number,
  max: number,
  fallback?: number,
): ApplicationResult<number> {
  if (value === null || value === undefined || value === "") {
    return fallback !== undefined ? ok(fallback) : fail("INVALID_PARAMETER", "integer is required");
  }
  if (!DECIMAL_INT_RE.test(value)) {
    return fail("INVALID_PARAMETER", `expected decimal digits: ${value}`);
  }
  const n = Number(value);
  if (n < min || n > max) {
    return fail("INVALID_PARAMETER", `out of range ${min}..${max}: ${value}`);
  }
  return ok(n);
}

const CURSOR_RE = /^[A-Za-z0-9_-]{1,256}$/;

/** Validate a server-issued base64url cursor (articles pagination). */
export function parseCursor(value: string | null | undefined): ApplicationResult<string | null> {
  if (value === null || value === undefined || value === "") return ok(null);
  if (!CURSOR_RE.test(value)) return fail("INVALID_PARAMETER", "invalid cursor");
  return ok(value);
}

/**
 * Validate the complete query-parameter set for an endpoint. Rejects unknown,
 * duplicate, empty-valued, bracket/array, and >20-pair inputs before any
 * cache/D1/provider access (API-VALIDATION-001).
 */
export function validateQueryParameters(
  allowed: ReadonlyArray<string>,
  entries: ReadonlyArray<readonly [string, string]>,
): ApplicationResult<ReadonlyArray<readonly [string, string]>> {
  if (entries.length > 20) {
    return fail("INVALID_PARAMETER", "too many query parameters (max 20)");
  }
  const seen = new Set<string>();
  for (const [key, val] of entries) {
    if (!allowed.includes(key)) {
      return fail("INVALID_PARAMETER", `unknown parameter: ${key}`);
    }
    if (seen.has(key)) {
      return fail("INVALID_PARAMETER", `duplicate parameter: ${key}`);
    }
    seen.add(key);
    if (val === "") {
      return fail("INVALID_PARAMETER", `empty value for ${key}`);
    }
    if (key.includes("[")) {
      return fail("INVALID_PARAMETER", `bracket/array syntax not allowed: ${key}`);
    }
  }
  return ok(entries);
}

/**
 * Validate the search query: trimmed length 2..80 Unicode scalar values
 * (API-VALIDATION-001). Returns the validated trimmed query.
 */
export function parseSearchQuery(value: string | null | undefined): ApplicationResult<string> {
  if (typeof value !== "string") return fail("INVALID_PARAMETER", "q is required");
  const v = value.trim();
  const scalarCount = [...v].length;
  if (scalarCount < 2) return fail("INVALID_PARAMETER", "q must be at least 2 characters");
  if (scalarCount > 80) return fail("INVALID_PARAMETER", "q must be at most 80 characters");
  return ok(v);
}

// ---------------------------------------------------------------------------
// Map bounds canonicalization + tile math (API-VALIDATION-001 / API-CACHE-001)
// ---------------------------------------------------------------------------

const BOUNDS_DECIMAL_RE = /^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

/** Parse one bounds decimal per the anchored `boundsDecimal` grammar. */
export function parseBoundsDecimal(value: string): number | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!BOUNDS_DECIMAL_RE.test(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Object.is(n, -0) ? 0 : n;
}

export interface CanonicalBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
  /** `west,south,east,north` each fixed to six decimals (request order). */
  readonly canonicalString: string;
  /** base64url SHA-256 of `v1|` + canonicalString. */
  readonly hash: string;
}

function base64urlSha256(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

function formatSix(n: number): string {
  return Object.is(n, -0) ? "0.000000" : n.toFixed(6);
}

/**
 * Canonicalize map bounds: validate longitude (-180..180) and latitude
 * (-85..85) ranges, require `west < east` and `south < north`, normalize
 * negative zero, and emit the exact six-decimal string + hash
 * (API-VALIDATION-001). Equivalent accepted spellings share one identity.
 */
export function canonicalizeBounds(
  west: number,
  south: number,
  east: number,
  north: number,
): ApplicationResult<CanonicalBounds> {
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return fail("INVALID_PARAMETER", "bounds must be finite numbers");
  }
  if (west < -180 || west > 180 || east < -180 || east > 180) {
    return fail("INVALID_PARAMETER", "longitude must be within -180..180");
  }
  if (south < -85 || south > 85 || north < -85 || north > 85) {
    return fail("INVALID_PARAMETER", "latitude must be within -85..85");
  }
  if (west >= east) return fail("INVALID_PARAMETER", "west must be < east");
  if (south >= north) return fail("INVALID_PARAMETER", "south must be < north");

  const canonicalString = `${formatSix(west)},${formatSix(south)},${formatSix(east)},${formatSix(north)}`;
  return ok({
    west,
    south,
    east,
    north,
    canonicalString,
    hash: base64urlSha256(`v1|${canonicalString}`),
  });
}

export interface MapTiles {
  readonly tileIds: ReadonlyArray<number>;
  readonly tileSetHash: string;
  readonly mapRegionKey: string;
}

/**
 * Compute the canonical Web Mercator tile identity for a zoom level and bounds
 * box (API-VALIDATION-001): at most 64 unique ascending tiles, clamped to the
 * grid. Derives `tileSetHash` and `mapRegionKey`.
 */
export function computeMapTiles(bounds: CanonicalBounds, zoom: number): ApplicationResult<MapTiles> {
  if (!Number.isInteger(zoom) || zoom < 2 || zoom > 12) {
    return fail("INVALID_PARAMETER", "zoom must be an integer 2..12");
  }
  const n = 2 ** zoom;
  const xOf = (lon: number): number => (n * (lon + 180)) / 360;
  const yOf = (lat: number): number =>
    (n * (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI)) / 2;

  const clamp = (v: number): number => Math.max(0, Math.min(n - 1, v));
  const xMin = clamp(Math.floor(xOf(bounds.west)));
  const xMax = clamp(Math.ceil(xOf(bounds.east)) - 1);
  const yMin = clamp(Math.floor(yOf(bounds.north)));
  const yMax = clamp(Math.ceil(yOf(bounds.south)) - 1);

  const ids: number[] = [];
  for (let ty = yMin; ty <= yMax; ty++) {
    for (let tx = xMin; tx <= xMax; tx++) {
      ids.push(ty * n + tx);
    }
  }
  const unique = Array.from(new Set(ids)).sort((a, b) => a - b);
  if (unique.length < 1) return fail("INVALID_PARAMETER", "bounds cover no tiles");
  if (unique.length > 64) return fail("INVALID_PARAMETER", "bounds cover more than 64 tiles");

  const tileSetHash = base64urlSha256(unique.join(","));
  return ok({ tileIds: unique, tileSetHash, mapRegionKey: `wm:${zoom}:${tileSetHash}` });
}

// ---------------------------------------------------------------------------
// Request ID (API-ENVELOPE-001) + freshness + weak ETag (API-CACHE-001)
// ---------------------------------------------------------------------------

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Select the immutable per-request ID. A single inbound header value that is
 * 8..128 ASCII `[A-Za-z0-9_-]+` is propagated byte-for-byte. Any missing,
 * duplicate, empty, too-short, too-long, or otherwise invalid value is replaced
 * by a freshly generated RFC 4122 UUIDv4. No trimming or case folding occurs.
 */
export function parseRequestId(headerValue: string | null | undefined): string {
  if (typeof headerValue === "string" && REQUEST_ID_RE.test(headerValue)) {
    return headerValue;
  }
  return generateRequestId();
}

/** Generate an RFC 4122 v4 UUID (used when an inbound request ID is invalid). */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Compute freshness from the authoritative max-age equation (API-READ-001):
 * `stale` is true exactly when `now - dataUpdatedAt > maxAgeMinutes * 60s`;
 * equality is fresh. An invalid/unparseable `dataUpdatedAt` or `now` is never
 * treated as fresh (it makes the representation unavailable, not live).
 */
export function computeStale(dataUpdatedAt: string, now: string, maxAgeMinutes: number): boolean {
  const updated = Date.parse(dataUpdatedAt);
  const current = Date.parse(now);
  if (!Number.isFinite(updated) || !Number.isFinite(current)) return true;
  return current - updated > maxAgeMinutes * 60 * 1000;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}

/** Canonical JSON: recursively sort object keys, preserve array order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/**
 * Weak validator hash (API-CACHE-001): base64url SHA-256 of canonical
 * `{ identity, coreData }`. The hash never includes `requestId`, `generatedAt`,
 * or any `stale` value, so those request-scoped fields do not change the ETag.
 */
export function computeCoreHash(identity: unknown, coreData: unknown): string {
  return base64urlSha256(canonicalJson({ identity, coreData }));
}

/** Wrap a core hash in the documented weak ETag form `W/"v1.<hash>"`. */
export function buildETag(coreHash: string): string {
  return `W/"v1.${coreHash}"`;
}
