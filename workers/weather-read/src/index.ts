// Public, read-only weather API. This worker deliberately has no weather-provider,
// KV write, or sync dependency: clients can only observe the last activated D1 snapshot.

import type { D1DatabaseLike } from "@wnr/test-utils";

const DEFAULT_ORIGIN = "https://where-not-rain.pages.dev";
/** Six-hour schedule plus one-hour delivery/retry tolerance. */
const MAX_AGE_MS = 7 * 60 * 60 * 1000;
const MAX_TRIP_CITIES = 12;
const MAX_TRIP_HOURLY_CITIES = 4;
const MAX_TRIP_RANGE_DAYS = 16;

export interface WorkerEnv {
  readonly DB: D1DatabaseLike;
  /** Exact public Pages origin. A deployment variable, never reflected from request input. */
  readonly WEB_ORIGIN?: string;
}

interface ActivePublicationRow {
  readonly snapshot_id: string;
  readonly ranking_version: string;
  readonly model_version: string;
  readonly published_at: string;
}

interface RankingRow {
  readonly rank: number;
  readonly city_id: string;
  readonly country_slug: string;
  readonly city_slug: string;
  readonly city_name: string;
  readonly country_name: string;
  readonly score: number;
  readonly reason_codes_json: string;
}

interface TripCityRow {
  readonly city_id: string;
  readonly country_slug: string;
  readonly city_slug: string;
  readonly city_name: string;
  readonly country_name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly is_featured: number;
}

interface TripForecastRow {
  readonly city_id: string;
  readonly local_date: string;
  readonly weather_code: number | null;
  readonly temp_min_c: number | null;
  readonly temp_max_c: number | null;
  readonly precipitation_mm: number | null;
  readonly precipitation_probability_max: number | null;
  readonly wind_speed_max_kph: number | null;
  readonly wind_gust_max_kph: number | null;
  readonly uv_index_max: number | null;
  readonly cloud_cover_mean: number | null;
  readonly visibility_mean_m: number | null;
  readonly sunrise_local: string | null;
  readonly sunset_local: string | null;
  readonly data_quality: string;
}

interface TripHourlyRow {
  readonly city_id: string;
  readonly local_time: string;
  readonly weather_code: number | null;
  readonly temperature_c: number | null;
  readonly apparent_temperature_c: number | null;
  readonly precipitation_mm: number | null;
  readonly precipitation_probability: number | null;
  readonly humidity: number | null;
  readonly wind_speed_kph: number | null;
  readonly wind_gust_kph: number | null;
  readonly uv_index: number | null;
  readonly cloud_cover: number | null;
  readonly visibility_m: number | null;
  readonly data_quality: string;
}

type ApiLocale = "en" | "zh-cn";

function headers(env: WorkerEnv): Record<string, string> {
  return {
    "access-control-allow-origin": env.WEB_ORIGIN ?? DEFAULT_ORIGIN,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "private, no-store",
    vary: "Origin",
  };
}

function json(body: unknown, status: number, env: WorkerEnv): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(env), "content-type": "application/json; charset=utf-8" },
  });
}

function parseReasons(value: string): ReadonlyArray<string> {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function isStale(dataUpdatedAt: string, now: Date): boolean {
  const updated = Date.parse(dataUpdatedAt);
  return Number.isNaN(updated) || updated > now.getTime() || now.getTime() - updated > MAX_AGE_MS;
}

function parseLocale(url: URL): ApiLocale | null {
  const value = url.searchParams.get("locale") ?? "en";
  return value === "en" || value === "zh-cn" ? value : null;
}

function dbLocale(locale: ApiLocale): "en" | "zh" {
  return locale === "zh-cn" ? "zh" : "en";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function rangeDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

function parseHour(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^\d{1,2}$/u.test(value)) return null;
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function localHour(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:00`;
}

function parseCityIds(url: URL, maxCities = MAX_TRIP_CITIES): ReadonlyArray<string> | null {
  const raw = url.searchParams.get("cityIds") ?? "";
  const values = [
    ...new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  if (
    values.length === 0 ||
    values.length > maxCities ||
    values.some((value) => !/^[a-z0-9-]{2,64}$/u.test(value))
  ) {
    return null;
  }
  return values;
}

function weatherCondition(code: number | null, locale: ApiLocale): string {
  if (code === null) return locale === "zh-cn" ? "天气待确认" : "Weather unavailable";
  if (code === 0) return locale === "zh-cn" ? "晴" : "Clear";
  if (code <= 3) return locale === "zh-cn" ? "多云" : "Cloudy";
  if (code === 45 || code === 48) return locale === "zh-cn" ? "雾" : "Fog";
  if (code >= 51 && code <= 67) return locale === "zh-cn" ? "雨" : "Rain";
  if (code >= 71 && code <= 77) return locale === "zh-cn" ? "雪" : "Snow";
  if (code >= 80 && code <= 82) return locale === "zh-cn" ? "阵雨" : "Showers";
  if (code >= 85 && code <= 86) return locale === "zh-cn" ? "阵雪" : "Snow showers";
  if (code >= 95) return locale === "zh-cn" ? "雷雨" : "Thunderstorm";
  return locale === "zh-cn" ? "天气变化" : "Variable weather";
}

async function readActivePublication(db: D1DatabaseLike): Promise<ActivePublicationRow | null> {
  return db
    .prepare(
      "SELECT p.snapshot_id, p.ranking_version, p.model_version, p.published_at " +
        "FROM active_weather_snapshot p JOIN weather_snapshots s ON s.id = p.snapshot_id " +
        "WHERE p.pointer_key = 'weather' AND s.status = 'active'",
    )
    .first<ActivePublicationRow>();
}

async function readTodayRanking(
  db: D1DatabaseLike,
  publication: ActivePublicationRow,
): Promise<ReadonlyArray<RankingRow>> {
  const result = await db
    .prepare(
      "SELECT e.rank, e.city_id, c.slug AS city_slug, co.slug AS country_slug, " +
        "ct.name AS city_name, cot.name AS country_name, e.score, e.reason_codes_json " +
        "FROM ranking_snapshots r " +
        "JOIN ranking_entries e ON e.ranking_id = r.id " +
        "JOIN cities c ON c.id = e.city_id " +
        "JOIN countries co ON co.id = c.country_id " +
        "JOIN city_translations ct ON ct.city_id = c.id AND ct.locale = 'en' " +
        "JOIN country_translations cot ON cot.country_id = co.id AND cot.locale = 'en' " +
        "WHERE r.snapshot_id = ? AND r.ranking_version = ? AND r.theme = 'general' " +
        "AND r.time_window = 'today' AND r.region_key = 'global' " +
        "ORDER BY e.rank ASC, e.city_id ASC",
    )
    .bind(publication.snapshot_id, publication.ranking_version)
    .all<RankingRow>();
  return result.results;
}

async function readTripCities(
  db: D1DatabaseLike,
  locale: ApiLocale,
): Promise<ReadonlyArray<TripCityRow>> {
  const result = await db
    .prepare(
      "SELECT c.id AS city_id, co.slug AS country_slug, c.slug AS city_slug, " +
        "COALESCE(ct_local.name, ct_en.name) AS city_name, " +
        "COALESCE(cot_local.name, cot_en.name) AS country_name, " +
        "c.latitude, c.longitude, c.timezone, c.is_featured " +
        "FROM cities c JOIN countries co ON co.id = c.country_id " +
        "JOIN city_translations ct_en ON ct_en.city_id = c.id AND ct_en.locale = 'en' " +
        "JOIN country_translations cot_en ON cot_en.country_id = co.id AND cot_en.locale = 'en' " +
        "LEFT JOIN city_translations ct_local ON ct_local.city_id = c.id AND ct_local.locale = ? " +
        "LEFT JOIN country_translations cot_local ON cot_local.country_id = co.id AND cot_local.locale = ? " +
        "WHERE c.status = 'active' AND co.status = 'active' " +
        "ORDER BY co.slug ASC, c.is_featured DESC, c.search_weight DESC, city_name ASC",
    )
    .bind(dbLocale(locale), dbLocale(locale))
    .all<TripCityRow>();
  return result.results;
}

async function readTripForecast(
  db: D1DatabaseLike,
  publication: ActivePublicationRow,
  cityIds: ReadonlyArray<string>,
  from: string,
  to: string,
): Promise<ReadonlyArray<TripForecastRow>> {
  const placeholders = cityIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      "SELECT d.city_id, d.local_date, d.weather_code, d.temp_min_c, d.temp_max_c, " +
        "d.precipitation_mm, d.precipitation_probability_max, d.wind_speed_max_kph, " +
        "d.wind_gust_max_kph, d.uv_index_max, d.cloud_cover_mean, d.visibility_mean_m, " +
        "d.sunrise_local, d.sunset_local, d.data_quality " +
        "FROM weather_daily d " +
        `WHERE d.snapshot_id = ? AND d.city_id IN (${placeholders}) ` +
        "AND d.local_date >= ? AND d.local_date <= ? " +
        "ORDER BY d.local_date ASC, d.city_id ASC",
    )
    .bind(publication.snapshot_id, ...cityIds, from, to)
    .all<TripForecastRow>();
  return result.results;
}

async function readTripHourly(
  db: D1DatabaseLike,
  publication: ActivePublicationRow,
  cityIds: ReadonlyArray<string>,
  date: string,
  startHour: number,
  endHour: number,
): Promise<ReadonlyArray<TripHourlyRow>> {
  const placeholders = cityIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      "SELECT h.city_id, h.local_time, h.weather_code, h.temperature_c, " +
        "h.apparent_temperature_c, h.precipitation_mm, h.precipitation_probability, " +
        "h.humidity, h.wind_speed_kph, h.wind_gust_kph, h.uv_index, h.cloud_cover, " +
        "h.visibility_m, h.data_quality FROM weather_hourly h " +
        `WHERE h.snapshot_id = ? AND h.city_id IN (${placeholders}) ` +
        "AND h.local_time >= ? AND h.local_time <= ? " +
        "ORDER BY h.local_time ASC, h.city_id ASC",
    )
    .bind(publication.snapshot_id, ...cityIds, localHour(date, startHour), localHour(date, endHour))
    .all<TripHourlyRow>();
  return result.results;
}

async function handleRanking(url: URL, env: WorkerEnv, now: Date): Promise<Response> {
  if ((url.searchParams.get("theme") ?? "general") !== "general") {
    return json({ error: { code: "INVALID_PARAMETER", field: "theme" } }, 400, env);
  }
  if ((url.searchParams.get("window") ?? "today") !== "today") {
    return json({ error: { code: "INVALID_PARAMETER", field: "window" } }, 400, env);
  }

  const publication = await readActivePublication(env.DB);
  if (publication === null) return json({ error: { code: "DATA_UNAVAILABLE" } }, 503, env);
  const ranking = await readTodayRanking(env.DB, publication);
  if (ranking.length === 0) return json({ error: { code: "DATA_UNAVAILABLE" } }, 503, env);

  const stale = isStale(publication.published_at, now);
  return json(
    {
      data: {
        snapshotId: publication.snapshot_id,
        rankingVersion: publication.ranking_version,
        modelVersion: publication.model_version,
        freshness: { dataUpdatedAt: publication.published_at, stale },
        theme: "general",
        window: "today",
        region: "global",
        locale: "en",
        items: ranking.map((item) => ({
          rank: item.rank,
          cityId: item.city_id,
          countrySlug: item.country_slug,
          citySlug: item.city_slug,
          cityName: item.city_name,
          countryName: item.country_name,
          score: item.score,
          scoreState: "available",
          reasonCodes: parseReasons(item.reason_codes_json),
        })),
      },
      meta: { generatedAt: now.toISOString(), dataUpdatedAt: publication.published_at, stale },
    },
    200,
    env,
  );
}

async function handleTripCities(url: URL, env: WorkerEnv, now: Date): Promise<Response> {
  const locale = parseLocale(url);
  if (locale === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "locale" } }, 400, env);
  const cities = await readTripCities(env.DB, locale);
  if (cities.length === 0) return json({ error: { code: "DATA_UNAVAILABLE" } }, 503, env);

  return json(
    {
      data: {
        locale,
        items: cities.map((city) => ({
          cityId: city.city_id,
          countrySlug: city.country_slug,
          citySlug: city.city_slug,
          cityName: city.city_name,
          countryName: city.country_name,
          latitude: city.latitude,
          longitude: city.longitude,
          timezone: city.timezone,
          featured: city.is_featured === 1,
        })),
      },
      meta: { generatedAt: now.toISOString() },
    },
    200,
    env,
  );
}

async function handleTripHourly(url: URL, env: WorkerEnv, now: Date): Promise<Response> {
  const locale = parseLocale(url);
  if (locale === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "locale" } }, 400, env);
  const cityIds = parseCityIds(url, MAX_TRIP_HOURLY_CITIES);
  if (cityIds === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "cityIds" } }, 400, env);
  const date = url.searchParams.get("date") ?? "";
  if (!isIsoDate(date))
    return json({ error: { code: "INVALID_PARAMETER", field: "date" } }, 400, env);
  const startHour = parseHour(url.searchParams.get("startHour"), 0);
  const endHour = parseHour(url.searchParams.get("endHour"), 23);
  if (startHour === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "startHour" } }, 400, env);
  if (endHour === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "endHour" } }, 400, env);
  if (endHour < startHour)
    return json({ error: { code: "INVALID_PARAMETER", field: "hourWindow" } }, 400, env);

  const publication = await readActivePublication(env.DB);
  if (publication === null) return json({ error: { code: "DATA_UNAVAILABLE" } }, 503, env);
  const hourly = await readTripHourly(env.DB, publication, cityIds, date, startHour, endHour);
  const availableSet = new Set(hourly.map((item) => item.city_id));
  const availableCityIds = cityIds.filter((cityId) => availableSet.has(cityId));
  const unavailableCityIds = cityIds.filter((cityId) => !availableSet.has(cityId));
  const stale = isStale(publication.published_at, now);

  return json(
    {
      data: {
        snapshotId: publication.snapshot_id,
        locale,
        date,
        startHour,
        endHour,
        requestedCityIds: cityIds,
        freshness: { dataUpdatedAt: publication.published_at, stale },
        coverage: { availableCityIds, unavailableCityIds },
        items: hourly.map((item) => ({
          cityId: item.city_id,
          localTime: item.local_time,
          weatherCode: item.weather_code,
          condition: weatherCondition(item.weather_code, locale),
          temperatureC: item.temperature_c,
          apparentTemperatureC: item.apparent_temperature_c,
          precipitationMm: item.precipitation_mm,
          rainProbability: item.precipitation_probability,
          humidity: item.humidity,
          windSpeedKph: item.wind_speed_kph,
          windGustKph: item.wind_gust_kph,
          uvIndex: item.uv_index,
          cloudCover: item.cloud_cover,
          visibilityM: item.visibility_m,
          dataQuality: item.data_quality,
        })),
      },
      meta: { generatedAt: now.toISOString(), dataUpdatedAt: publication.published_at, stale },
    },
    200,
    env,
  );
}

async function handleTripForecast(url: URL, env: WorkerEnv, now: Date): Promise<Response> {
  const locale = parseLocale(url);
  if (locale === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "locale" } }, 400, env);
  const cityIds = parseCityIds(url);
  if (cityIds === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "cityIds" } }, 400, env);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!isIsoDate(from))
    return json({ error: { code: "INVALID_PARAMETER", field: "from" } }, 400, env);
  if (!isIsoDate(to)) return json({ error: { code: "INVALID_PARAMETER", field: "to" } }, 400, env);
  const days = rangeDays(from, to);
  if (days < 1 || days > MAX_TRIP_RANGE_DAYS) {
    return json({ error: { code: "INVALID_PARAMETER", field: "dateRange" } }, 400, env);
  }

  const publication = await readActivePublication(env.DB);
  if (publication === null) return json({ error: { code: "DATA_UNAVAILABLE" } }, 503, env);
  const forecast = await readTripForecast(env.DB, publication, cityIds, from, to);
  const stale = isStale(publication.published_at, now);

  return json(
    {
      data: {
        snapshotId: publication.snapshot_id,
        locale,
        from,
        to,
        requestedCityIds: cityIds,
        freshness: { dataUpdatedAt: publication.published_at, stale },
        items: forecast.map((item) => ({
          cityId: item.city_id,
          date: item.local_date,
          weatherCode: item.weather_code,
          condition: weatherCondition(item.weather_code, locale),
          temperatureMinC: item.temp_min_c,
          temperatureMaxC: item.temp_max_c,
          precipitationMm: item.precipitation_mm,
          rainProbability: item.precipitation_probability_max,
          windSpeedKph: item.wind_speed_max_kph,
          windGustKph: item.wind_gust_max_kph,
          uvIndex: item.uv_index_max,
          cloudCover: item.cloud_cover_mean,
          visibilityM: item.visibility_mean_m,
          sunrise: item.sunrise_local,
          sunset: item.sunset_local,
          dataQuality: item.data_quality,
        })),
      },
      meta: { generatedAt: now.toISOString(), dataUpdatedAt: publication.published_at, stale },
    },
    200,
    env,
  );
}

/** Handle a public request; exported separately for deterministic integration tests. */
export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  now = new Date(),
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headers(env) });
  }
  if (request.method !== "GET") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405, env);

  const url = new URL(request.url);
  if (url.pathname === "/health") {
    return json({ ok: true, service: "weather-read", readOnly: true }, 200, env);
  }
  if (url.pathname === "/api/v1/rankings") return handleRanking(url, env, now);
  if (url.pathname === "/api/v1/trip-cities") return handleTripCities(url, env, now);
  if (url.pathname === "/api/v1/trip-hourly") return handleTripHourly(url, env, now);
  if (url.pathname === "/api/v1/trip-forecast") return handleTripForecast(url, env, now);
  return json({ error: { code: "RESOURCE_NOT_FOUND" } }, 404, env);
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
