// @wnr/weather — Open-Meteo adapter (Open-MeteoProvider).
//
// ARCH-PROVIDER-001: this adapter implements the same stable internal port as the
// MVP FAKE one ({ id, fetchForecast, healthCheck }). Unlike the fake, it contacts a
// REAL, KEY-FREE provider (Open-Meteo, https://open-meteo.com) — but ONLY from inside
// the sync worker, never from the browser bundle (the package is not imported by apps/web).
//
// ENG-SECURITY-001: the request carries NO API key / secret (Open-Meteo is anonymous and
// free). Per-city failures are surfaced as `ProviderRequestError` so the worker can
// isolate a single bad city without failing the whole batch (city-level fault isolation).
//
// Normalization is 1:1 with the existing `NormalizedDaily` / `NormalizedHourly` DTOs, which
// already match the `weather_daily` / `weather_hourly` D1 columns 1:1 (docs/14 appendix A).

import {
  ProviderRequestError,
  validateForecastRequest,
  type ForecastRequest,
  type NormalizedDaily,
  type NormalizedForecast,
  type NormalizedHourly,
  type ProviderHealth,
  type WeatherProvider,
} from "./provider.js";

const DEFAULT_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_BACKOFF_MS = 300;

/** Tunables for the Open-Meteo adapter (kept small + overridable for tests). */
export interface OpenMeteoOptions {
  /** Forecast endpoint. Defaults to the public Open-Meteo forecast API. */
  readonly endpoint?: string;
  /** Per-attempt request timeout in milliseconds. */
  readonly timeoutMs?: number;
  /** Maximum number of additional retry attempts after the first (<= 2 in production). */
  readonly maxRetries?: number;
  /** Base backoff in milliseconds for exponential jitter between retries. */
  readonly baseBackoffMs?: number;
}

/** Raw Open-Meteo daily series (subset we consume; 1:1 with `weather_daily`). */
interface OpenMeteoDaily {
  readonly time: ReadonlyArray<string>;
  readonly weather_code: ReadonlyArray<number>;
  readonly temperature_2m_max: ReadonlyArray<number>;
  readonly temperature_2m_min: ReadonlyArray<number>;
  readonly apparent_temperature_max: ReadonlyArray<number>;
  readonly apparent_temperature_min: ReadonlyArray<number>;
  readonly precipitation_sum: ReadonlyArray<number>;
  readonly precipitation_probability_max: ReadonlyArray<number>;
  readonly relative_humidity_2m_mean: ReadonlyArray<number>;
  readonly wind_speed_10m_max: ReadonlyArray<number>;
  readonly wind_gusts_10m_max: ReadonlyArray<number>;
  readonly uv_index_max: ReadonlyArray<number>;
  readonly cloud_cover_mean: ReadonlyArray<number>;
  readonly visibility_mean: ReadonlyArray<number>;
  readonly sunrise: ReadonlyArray<string>;
  readonly sunset: ReadonlyArray<string>;
}

/** Raw Open-Meteo hourly series (subset we consume; 1:1 with `weather_hourly`). */
interface OpenMeteoHourly {
  readonly time: ReadonlyArray<string>;
  readonly weather_code: ReadonlyArray<number>;
  readonly temperature_2m: ReadonlyArray<number>;
  readonly apparent_temperature: ReadonlyArray<number>;
  readonly precipitation: ReadonlyArray<number>;
  readonly precipitation_probability: ReadonlyArray<number>;
  readonly relative_humidity_2m: ReadonlyArray<number>;
  readonly wind_speed_10m: ReadonlyArray<number>;
  readonly wind_gusts_10m: ReadonlyArray<number>;
  readonly uv_index: ReadonlyArray<number>;
  readonly cloud_cover: ReadonlyArray<number>;
  readonly visibility: ReadonlyArray<number>;
}

interface OpenMeteoResponse {
  readonly daily?: OpenMeteoDaily;
  readonly hourly?: OpenMeteoHourly;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Truncate an Open-Meteo local ISO timestamp to `HH:MM` (no timezone suffix). */
function truncateHHMM(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

/** "YYYY-MM-DD" + N days -> "YYYY-MM-DD" (date math only, no TZ drift). */
function addDays(isoDate: string, days: number): string {
  const parts = isoDate.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Group hourly rows by the date portion of their local timestamp (e.g. 24 per day). */
function groupHourlyByDay(hourly: OpenMeteoHourly | undefined): Map<string, NormalizedHourly[]> {
  const map = new Map<string, NormalizedHourly[]>();
  if (hourly == null || !Array.isArray(hourly.time)) return map;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = hourly.time[i];
    if (typeof t !== "string") continue;
    const datePart = t.slice(0, 10);
    const row: NormalizedHourly = {
      localTime: t,
      weatherCode: numOrNull(hourly.weather_code?.[i]),
      temperatureC: numOrNull(hourly.temperature_2m?.[i]),
      apparentTemperatureC: numOrNull(hourly.apparent_temperature?.[i]),
      precipitationMm: numOrNull(hourly.precipitation?.[i]),
      precipitationProbability: numOrNull(hourly.precipitation_probability?.[i]),
      humidity: numOrNull(hourly.relative_humidity_2m?.[i]),
      windSpeedKph: numOrNull(hourly.wind_speed_10m?.[i]),
      windGustKph: numOrNull(hourly.wind_gusts_10m?.[i]),
      uvIndex: numOrNull(hourly.uv_index?.[i]),
      cloudCover: numOrNull(hourly.cloud_cover?.[i]),
      visibilityM: numOrNull(hourly.visibility?.[i]),
    };
    const existing = map.get(datePart);
    if (existing) existing.push(row);
    else map.set(datePart, [row]);
  }
  return map;
}

/** Map a raw Open-Meteo response onto `NormalizedDaily[]` (1:1 D1 columns). */
function normalizeDaily(resp: OpenMeteoResponse): NormalizedDaily[] {
  const daily = resp.daily;
  if (daily == null || !Array.isArray(daily.time) || daily.time.length === 0) {
    throw new ProviderRequestError("Open-Meteo response is missing the daily series", "open-meteo");
  }
  const hourlyByDay = groupHourlyByDay(resp.hourly);
  const out: NormalizedDaily[] = [];
  for (let i = 0; i < daily.time.length; i++) {
    const localDate = daily.time[i];
    if (typeof localDate !== "string") continue;
    out.push({
      localDate,
      weatherCode: numOrNull(daily.weather_code?.[i]),
      tempMinC: numOrNull(daily.temperature_2m_min?.[i]),
      tempMaxC: numOrNull(daily.temperature_2m_max?.[i]),
      apparentMinC: numOrNull(daily.apparent_temperature_min?.[i]),
      apparentMaxC: numOrNull(daily.apparent_temperature_max?.[i]),
      precipitationMm: numOrNull(daily.precipitation_sum?.[i]),
      precipitationProbabilityMax: numOrNull(daily.precipitation_probability_max?.[i]),
      humidityMean: numOrNull(daily.relative_humidity_2m_mean?.[i]),
      windSpeedMaxKph: numOrNull(daily.wind_speed_10m_max?.[i]),
      windGustMaxKph: numOrNull(daily.wind_gusts_10m_max?.[i]),
      uvIndexMax: numOrNull(daily.uv_index_max?.[i]),
      cloudCoverMean: numOrNull(daily.cloud_cover_mean?.[i]),
      visibilityMeanM: numOrNull(daily.visibility_mean?.[i]),
      sunriseLocal: truncateHHMM(daily.sunrise?.[i]),
      sunsetLocal: truncateHHMM(daily.sunset?.[i]),
      hourly: hourlyByDay.get(localDate) ?? [],
    });
  }
  return out;
}

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "relative_humidity_2m_mean",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "uv_index_max",
  "cloud_cover_mean",
  "visibility_mean",
  "sunrise",
  "sunset",
] as const;

const HOURLY_FIELDS = [
  "weather_code",
  "temperature_2m",
  "apparent_temperature",
  "precipitation",
  "precipitation_probability",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_gusts_10m",
  "uv_index",
  "cloud_cover",
  "visibility",
] as const;

/** Build the anonymous, key-free Open-Meteo forecast URL for one city window. */
export function buildOpenMeteoUrl(
  req: ForecastRequest,
  endpoint: string = DEFAULT_ENDPOINT,
): string {
  const params = new URLSearchParams();
  params.set("latitude", String(req.latitude));
  params.set("longitude", String(req.longitude));
  params.set("timezone", req.timezone);
  params.set("start_date", req.startDate);
  params.set("end_date", addDays(req.startDate, Math.max(0, req.days - 1)));
  params.set("daily", DAILY_FIELDS.join(","));
  params.set("hourly", HOURLY_FIELDS.join(","));
  return `${endpoint}?${params.toString()}`;
}

/**
 * Real, key-free weather adapter backed by Open-Meteo. One HTTP GET per city window;
 * each attempt is bounded by an AbortController timeout and retried with exponential
 * jitter (up to `maxRetries` extra attempts). Network/HTTP failures raise
 * `ProviderRequestError` so the calling worker can isolate the failing city.
 */
export class OpenMeteoProvider implements WeatherProvider {
  readonly id = "open-meteo";
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;

  constructor(options: OpenMeteoOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  }

  /** Perform a single fetch with timeout + bounded exponential-backoff retries. */
  private async fetchWithRetry(url: string): Promise<Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new ProviderRequestError(`Open-Meteo returned HTTP ${res.status}`, this.id);
        }
        return res;
      } catch (err) {
        lastErr = err;
        if (attempt < this.maxRetries) {
          const backoff =
            this.baseBackoffMs * 2 ** attempt + Math.floor(Math.random() * this.baseBackoffMs);
          await sleep(backoff);
        }
      } finally {
        clearTimeout(timer);
      }
    }
    const reason = lastErr instanceof Error ? lastErr.message : "unknown error";
    throw new ProviderRequestError(
      `Open-Meteo request failed after ${this.maxRetries + 1} attempt(s): ${reason}`,
      this.id,
    );
  }

  async fetchForecast(request: ForecastRequest): Promise<NormalizedForecast[]> {
    validateForecastRequest(request);
    if (request.days === 0) return [];

    const url = buildOpenMeteoUrl(request, this.endpoint);
    let resp: OpenMeteoResponse;
    try {
      const res = await this.fetchWithRetry(url);
      resp = (await res.json()) as OpenMeteoResponse;
    } catch (err) {
      if (err instanceof ProviderRequestError) throw err;
      throw new ProviderRequestError(
        `Open-Meteo fetch failed for city "${request.cityId}": ${(err as Error).message}`,
        request.cityId,
      );
    }

    const days = normalizeDaily(resp);
    return [{ cityId: request.cityId, days }];
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    try {
      const probe: ForecastRequest = {
        cityId: "__health__",
        latitude: 0,
        longitude: 0,
        timezone: "UTC",
        days: 1,
        startDate: "2020-01-01",
      };
      const res = await this.fetchWithRetry(buildOpenMeteoUrl(probe, this.endpoint));
      const json = (await res.json()) as OpenMeteoResponse;
      const ok = json.daily != null;
      return { ok, providerId: this.id, latencyMs: Date.now() - startedAt, checkedAt };
    } catch {
      return { ok: false, providerId: this.id, latencyMs: Date.now() - startedAt, checkedAt };
    }
  }
}
