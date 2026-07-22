// @wnr/weather — sync-only WeatherProvider port and the MVP FAKE adapter.
//
// The named `createWeatherProvider(name)` factory lives here so both the FAKE and the
// real `OpenMeteoProvider` adapters are constructed through one stable entry point
// (docs/15 §7: WEATHER_PRIMARY_PROVIDER selects the adapter).

import { OpenMeteoProvider } from "./open-meteo.js";
//
// ARCH-PROVIDER-001: the internal weather port has the stable minimum shape
// { id, fetchForecast, healthCheck }. WeatherAPI/Open-Meteo real adapters (with timeouts,
// bounded retries, jittered backoff, circuit breaker, and credentials via secret bindings)
// are a later release; they must run only inside the sync worker and stay out of browser
// bundles. ENG-SECURITY-001: this module NEVER calls a real external API. The only adapter
// shipped in MVP is the deterministic FAKE one, so there is no code path that could reach a
// network. Raw provider DTOs remain private; every record is normalized before it crosses
// the adapter boundary.

/** A request for a bounded multi-day forecast for one city. */
export interface ForecastRequest {
  readonly cityId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  /** Number of city-local days to return, starting at startDate. */
  readonly days: number;
  /** Inclusive city-local start date as YYYY-MM-DD. */
  readonly startDate: string;
}

/** One normalized hourly observation (metric domain, no provider DTO). */
export interface NormalizedHourly {
  readonly localTime: string;
  readonly weatherCode: number | null;
  readonly temperatureC: number | null;
  readonly apparentTemperatureC: number | null;
  readonly precipitationMm: number | null;
  readonly precipitationProbability: number | null;
  readonly humidity: number | null;
  readonly windSpeedKph: number | null;
  readonly windGustKph: number | null;
  readonly uvIndex: number | null;
  readonly cloudCover: number | null;
  readonly visibilityM: number | null;
}

/** One normalized daily aggregate with its 24 hourly rows. */
export interface NormalizedDaily {
  readonly localDate: string;
  readonly weatherCode: number | null;
  readonly tempMinC: number | null;
  readonly tempMaxC: number | null;
  readonly apparentMinC: number | null;
  readonly apparentMaxC: number | null;
  readonly precipitationMm: number | null;
  readonly precipitationProbabilityMax: number | null;
  readonly humidityMean: number | null;
  readonly windSpeedMaxKph: number | null;
  readonly windGustMaxKph: number | null;
  readonly uvIndexMax: number | null;
  readonly cloudCoverMean: number | null;
  readonly visibilityMeanM: number | null;
  readonly sunriseLocal: string | null;
  readonly sunsetLocal: string | null;
  readonly hourly: ReadonlyArray<NormalizedHourly>;
}

/** Normalized forecast for a single city across the requested window. */
export interface NormalizedForecast {
  readonly cityId: string;
  readonly days: ReadonlyArray<NormalizedDaily>;
}

export interface ProviderHealth {
  readonly ok: boolean;
  readonly providerId: string;
  readonly latencyMs: number;
  readonly checkedAt: string;
}

/** Stable internal weather-provider port (ARCH-PROVIDER-001). */
export interface WeatherProvider {
  readonly id: string;
  fetchForecast(request: ForecastRequest): Promise<NormalizedForecast[]>;
  healthCheck(): Promise<ProviderHealth>;
}

/** Thrown when a forecast request fails pre-flight validation. */
export class ProviderRequestError extends Error {
  readonly cityId: string | null;
  constructor(message: string, cityId: string | null = null) {
    super(message);
    this.name = "ProviderRequestError";
    this.cityId = cityId;
  }
}

function hashString(value: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return (state >>> 0) / 4294967296;
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampInt(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

function addDays(isoDate: string, days: number): string {
  const parts = isoDate.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function validateForecastRequest(request: ForecastRequest): void {
  if (typeof request.cityId !== "string" || request.cityId.length === 0) {
    throw new ProviderRequestError("cityId is required", null);
  }
  if (!Number.isFinite(request.latitude) || request.latitude < -90 || request.latitude > 90) {
    throw new ProviderRequestError("latitude must be within -90..90", request.cityId);
  }
  if (!Number.isFinite(request.longitude) || request.longitude < -180 || request.longitude > 180) {
    throw new ProviderRequestError("longitude must be within -180..180", request.cityId);
  }
  if (!Number.isInteger(request.days) || request.days < 0) {
    throw new ProviderRequestError("days must be a non-negative integer", request.cityId);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.startDate)) {
    throw new ProviderRequestError("startDate must be YYYY-MM-DD", request.cityId);
  }
}

function buildHourly(cityId: string, localDate: string): ReadonlyArray<NormalizedHourly> {
  const rows: NormalizedHourly[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const rng = seededRandom(hashString(`${cityId}|${localDate}|${hour}`));
    const r = () => rng();
    const diurnal = Math.cos(((hour - 15) * Math.PI) / 12); // 1 at 15:00, -1 at 03:00
    const baseTemp = 18 + 6 * diurnal + (r() - 0.5) * 2;
    const temperatureC = round1(baseTemp);
    const humidity = clampInt(45 + r() * 45, 0, 100);
    const windSpeedKph = round1(5 + r() * 25);
    const windGustKph = round1(windSpeedKph * (1.3 + r() * 0.6));
    const precipProb = clampInt(r() * 100, 0, 100);
    const precipitationMm = precipProb > 60 ? round1(((precipProb - 60) / 40) * (2 + r() * 8)) : 0;
    const cloudCover = clampInt(r() * 100, 0, 100);
    const uvRaw = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) * 11;
    const uvIndex = hour >= 6 && hour <= 18 ? round1(uvRaw) : 0;
    const apparentTemperatureC = round1(temperatureC - windSpeedKph * 0.1 + (humidity - 50) * 0.02);
    const visibilityM = clampInt(20000 - cloudCover * 90 - precipitationMm * 400, 500, 20000);
    const weatherCode = precipitationMm > 4 ? 3 : cloudCover > 70 ? 2 : cloudCover > 30 ? 1 : 0;
    rows.push({
      localTime: `${localDate}T${String(hour).padStart(2, "0")}:00`,
      weatherCode,
      temperatureC,
      apparentTemperatureC,
      precipitationMm,
      precipitationProbability: precipProb,
      humidity,
      windSpeedKph,
      windGustKph,
      uvIndex,
      cloudCover,
      visibilityM,
    });
  }
  return rows;
}

function aggregateDay(localDate: string, hourly: ReadonlyArray<NormalizedHourly>): NormalizedDaily {
  const pick = (sel: (h: NormalizedHourly) => number | null): number[] =>
    hourly.map(sel).filter((v): v is number => v != null);
  const maxOf = (arr: number[]): number | null => (arr.length ? Math.max(...arr) : null);
  const minOf = (arr: number[]): number | null => (arr.length ? Math.min(...arr) : null);
  const meanOf = (arr: number[]): number | null =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const temps = pick((h) => h.temperatureC);
  const apparent = pick((h) => h.apparentTemperatureC);
  const prec = pick((h) => h.precipitationMm);

  const maxCloud = maxOf(pick((h) => h.cloudCover)) ?? 0;
  const maxPrec = maxOf(prec) ?? 0;
  const weatherCode = maxPrec > 4 ? 3 : maxCloud > 70 ? 2 : maxCloud > 30 ? 1 : 0;

  return {
    localDate,
    weatherCode,
    tempMinC: minOf(temps) == null ? null : round1(minOf(temps) as number),
    tempMaxC: maxOf(temps) == null ? null : round1(maxOf(temps) as number),
    apparentMinC: minOf(apparent) == null ? null : round1(minOf(apparent) as number),
    apparentMaxC: maxOf(apparent) == null ? null : round1(maxOf(apparent) as number),
    precipitationMm: prec.length === 0 ? null : round1(prec.reduce((a, b) => a + b, 0)),
    precipitationProbabilityMax: maxOf(pick((h) => h.precipitationProbability)),
    humidityMean:
      meanOf(pick((h) => h.humidity)) == null
        ? null
        : clampInt(meanOf(pick((h) => h.humidity)) as number, 0, 100),
    windSpeedMaxKph:
      maxOf(pick((h) => h.windSpeedKph)) == null
        ? null
        : round1(maxOf(pick((h) => h.windSpeedKph)) as number),
    windGustMaxKph:
      maxOf(pick((h) => h.windGustKph)) == null
        ? null
        : round1(maxOf(pick((h) => h.windGustKph)) as number),
    uvIndexMax:
      maxOf(pick((h) => h.uvIndex)) == null
        ? null
        : round1(maxOf(pick((h) => h.uvIndex)) as number),
    cloudCoverMean:
      meanOf(pick((h) => h.cloudCover)) == null
        ? null
        : clampInt(meanOf(pick((h) => h.cloudCover)) as number, 0, 100),
    visibilityMeanM:
      meanOf(pick((h) => h.visibilityM)) == null
        ? null
        : clampInt(meanOf(pick((h) => h.visibilityM)) as number, 0, 20000),
    sunriseLocal: "06:12",
    sunsetLocal: "20:45",
    hourly,
  };
}

/**
 * Deterministic, network-free weather adapter. The same (cityId, date, hour) always yields
 * the same observation, so the sync worker can recompute or compare without any external call.
 */
export class FakeWeatherProvider implements WeatherProvider {
  readonly id = "fake";

  async fetchForecast(request: ForecastRequest): Promise<NormalizedForecast[]> {
    validateForecastRequest(request);
    if (request.days === 0) return [];
    const days: NormalizedDaily[] = [];
    for (let d = 0; d < request.days; d++) {
      const localDate = addDays(request.startDate, d);
      const hourly = buildHourly(request.cityId, localDate);
      days.push(aggregateDay(localDate, hourly));
    }
    return [{ cityId: request.cityId, days }];
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      providerId: this.id,
      latencyMs: 0,
      checkedAt: new Date(0).toISOString(),
    };
  }
}

/**
 * Legal provider identifiers selected by `WEATHER_PRIMARY_PROVIDER` (docs/15 §7).
 * `weatherapi` is a reserved-but-disabled name this phase (no secret wiring).
 */
export type WeatherProviderName = "open-meteo" | "fake" | "weatherapi";

/**
 * Construct the configured weather adapter. Defaults to the MVP FAKE provider for
 * backward compatibility and safe local builds. `open-meteo` selects the real,
 * key-free adapter; `weatherapi` is reserved but disabled this phase and throws.
 */
export function createWeatherProvider(name: WeatherProviderName = "fake"): WeatherProvider {
  switch (name) {
    case "open-meteo":
      return new OpenMeteoProvider();
    case "weatherapi":
      // ARCH-PROVIDER-001: WeatherAPI is reserved but disabled this phase (no secret wiring).
      throw new ProviderRequestError("provider 'weatherapi' is disabled this phase", null);
    case "fake":
    default:
      return new FakeWeatherProvider();
  }
}
