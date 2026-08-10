import type { TripCityOption, TripForecastDay, TripPartyProfile } from "../trips/workspace";

export type WeatherDiscoveryIntent =
  | "dry"
  | "outdoor"
  | "beach"
  | "cool_escape"
  | "warm_escape"
  | "family_comfort"
  | "senior_comfort";

export type DiscoveryTheme = "city" | "beach" | "outdoor" | "indoor";

export type DiscoveryReasonCode =
  | "DRY_WINDOW"
  | "RAIN_RISK"
  | "COMFORTABLE_TEMPERATURE"
  | "HEAT_RISK"
  | "COLD_RISK"
  | "LOW_WIND"
  | "WIND_RISK"
  | "UV_CAUTION"
  | "BEACH_READY"
  | "FAMILY_COMFORT"
  | "SENIOR_COMFORT"
  | "LIMITED_DATA"
  | "CUSTOM_CONSTRAINT_MISS";

export interface DiscoveryPreferences {
  readonly intent: WeatherDiscoveryIntent;
  readonly from: string;
  readonly to: string;
  readonly rainProbabilityMax: number | null;
  readonly temperatureMinC: number | null;
  readonly temperatureMaxC: number | null;
  readonly windSpeedMaxKph: number | null;
  readonly partyProfile: TripPartyProfile | null;
  readonly theme: DiscoveryTheme | null;
}

export interface DiscoveryMetrics {
  readonly days: number;
  readonly maxRainProbability: number | null;
  readonly averageRainProbability: number | null;
  readonly totalPrecipitationMm: number | null;
  readonly averagePrecipitationMm: number | null;
  readonly averageMinC: number | null;
  readonly averageMaxC: number | null;
  readonly maxWindKph: number | null;
  readonly maxGustKph: number | null;
  readonly maxUv: number | null;
}

export interface DiscoveryScore {
  readonly score: number | null;
  readonly confidence: number;
  readonly passesConstraints: boolean;
  readonly reasonCodes: ReadonlyArray<DiscoveryReasonCode>;
  readonly metrics: DiscoveryMetrics;
}

export interface DiscoveryCityResult extends DiscoveryScore {
  readonly city: TripCityOption;
  readonly forecastDays: ReadonlyArray<TripForecastDay>;
}

const INTENTS: ReadonlyArray<WeatherDiscoveryIntent> = [
  "dry",
  "outdoor",
  "beach",
  "cool_escape",
  "warm_escape",
  "family_comfort",
  "senior_comfort",
];

const THEMES: ReadonlyArray<DiscoveryTheme> = ["city", "beach", "outdoor", "indoor"];
const PARTY_PROFILES: ReadonlyArray<TripPartyProfile> = ["adults", "family", "senior"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  return rounded(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function maximum(values: ReadonlyArray<number>): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

function sum(values: ReadonlyArray<number>): number | null {
  return values.length === 0 ? null : rounded(values.reduce((total, value) => total + value, 0));
}

function numbers(
  days: ReadonlyArray<TripForecastDay>,
  pick: (day: TripForecastDay) => number | null,
): number[] {
  return days
    .map(pick)
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

export function summarizeDiscoveryWeather(days: ReadonlyArray<TripForecastDay>): DiscoveryMetrics {
  const rainProbabilities = numbers(days, (day) => day.rainProbability);
  const precipitation = numbers(days, (day) => day.precipitationMm);
  return {
    days: days.length,
    maxRainProbability: maximum(rainProbabilities),
    averageRainProbability: average(rainProbabilities),
    totalPrecipitationMm: sum(precipitation),
    averagePrecipitationMm: average(precipitation),
    averageMinC: average(numbers(days, (day) => day.temperatureMinC)),
    averageMaxC: average(numbers(days, (day) => day.temperatureMaxC)),
    maxWindKph: maximum(numbers(days, (day) => day.windSpeedKph)),
    maxGustKph: maximum(numbers(days, (day) => day.windGustKph)),
    maxUv: maximum(numbers(days, (day) => day.uvIndex)),
  };
}

function addReason(
  reasons: DiscoveryReasonCode[],
  reason: DiscoveryReasonCode,
  condition: boolean,
): void {
  if (condition && !reasons.includes(reason)) reasons.push(reason);
}

function missingMetricCount(metrics: DiscoveryMetrics): number {
  return [
    metrics.averageRainProbability,
    metrics.averagePrecipitationMm,
    metrics.averageMinC,
    metrics.averageMaxC,
    metrics.maxWindKph,
    metrics.maxUv,
  ].filter((value) => value === null).length;
}

function temperaturePenalty(
  value: number | null,
  low: number,
  high: number,
  scale: number,
): number {
  if (value === null) return 0;
  if (value < low) return Math.min((low - value) * scale, 30);
  if (value > high) return Math.min((value - high) * scale, 30);
  return 0;
}

function abovePenalty(value: number | null, threshold: number, scale: number, cap = 30): number {
  if (value === null || value <= threshold) return 0;
  return Math.min((value - threshold) * scale, cap);
}

function belowPenalty(value: number | null, threshold: number, scale: number, cap = 30): number {
  if (value === null || value >= threshold) return 0;
  return Math.min((threshold - value) * scale, cap);
}

function rainPenalty(value: number | null, scale: number): number {
  return value === null ? 0 : Math.min(value * scale, 50);
}

function scoreIntent(
  intent: WeatherDiscoveryIntent,
  metrics: DiscoveryMetrics,
  reasons: DiscoveryReasonCode[],
): number {
  const peakRain = metrics.maxRainProbability;
  const averageRain = metrics.averageRainProbability;
  const high = metrics.averageMaxC;
  const low = metrics.averageMinC;
  const wind = metrics.maxWindKph;
  const uv = metrics.maxUv;
  const averagePrecipitation = metrics.averagePrecipitationMm;
  let penalty = 0;

  if (intent === "dry") {
    // A multi-day trip should be scored by its overall wetness, not be flattened by
    // one high-probability hour/day. Keep peak rain as a bounded severe-day surcharge.
    penalty += rainPenalty(averageRain, 0.55);
    penalty +=
      averagePrecipitation === null ? 0 : Math.min(averagePrecipitation * 3, 25);
    penalty += abovePenalty(peakRain, 75, 0.35, 9);
    penalty += abovePenalty(wind, 35, 0.4, 8);
  } else if (intent === "outdoor") {
    penalty += rainPenalty(peakRain, 0.43);
    penalty += abovePenalty(wind, 22, 1.2, 25);
    penalty += temperaturePenalty(high, 18, 30, 2.2);
    penalty += belowPenalty(low, 10, 1.5, 15);
    penalty += abovePenalty(uv, 9, 3, 12);
  } else if (intent === "beach") {
    penalty += rainPenalty(peakRain, 0.48);
    penalty += abovePenalty(wind, 25, 1.4, 30);
    penalty += temperaturePenalty(high, 24, 32, 2.5);
    penalty += belowPenalty(low, 18, 1.5, 15);
    penalty += abovePenalty(uv, 10, 2.5, 10);
  } else if (intent === "cool_escape") {
    penalty += rainPenalty(peakRain, 0.25);
    penalty += temperaturePenalty(high, 18, 27, 3.2);
    penalty += belowPenalty(low, 12, 2, 18);
    penalty += abovePenalty(wind, 30, 0.8, 12);
  } else if (intent === "warm_escape") {
    penalty += rainPenalty(peakRain, 0.28);
    penalty += temperaturePenalty(high, 22, 30, 3);
    penalty += belowPenalty(low, 15, 2.2, 20);
    penalty += abovePenalty(wind, 30, 0.8, 12);
  } else if (intent === "family_comfort") {
    penalty += rainPenalty(peakRain, 0.42);
    penalty += temperaturePenalty(high, 18, 30, 2.7);
    penalty += belowPenalty(low, 14, 2, 18);
    penalty += abovePenalty(wind, 24, 1.3, 24);
    penalty += abovePenalty(uv, 8, 2.5, 15);
  } else {
    penalty += rainPenalty(peakRain, 0.46);
    penalty += temperaturePenalty(high, 18, 28, 3.2);
    penalty += belowPenalty(low, 15, 2.4, 20);
    penalty += abovePenalty(wind, 20, 1.7, 28);
    penalty += abovePenalty(uv, 7, 2.8, 16);
  }

  addReason(
    reasons,
    "DRY_WINDOW",
    averageRain !== null &&
      averageRain <= 25 &&
      averagePrecipitation !== null &&
      averagePrecipitation <= 2,
  );
  addReason(
    reasons,
    "RAIN_RISK",
    (averageRain !== null && averageRain >= 60) ||
      (peakRain !== null && peakRain >= 85 && averagePrecipitation !== null && averagePrecipitation >= 5),
  );
  addReason(
    reasons,
    "COMFORTABLE_TEMPERATURE",
    high !== null && low !== null && high >= 20 && high <= 30 && low >= 12 && low <= 24,
  );
  addReason(reasons, "HEAT_RISK", high !== null && high >= 33);
  addReason(reasons, "COLD_RISK", low !== null && low <= 8);
  addReason(reasons, "LOW_WIND", wind !== null && wind <= 20);
  addReason(reasons, "WIND_RISK", wind !== null && wind >= 35);
  addReason(reasons, "UV_CAUTION", uv !== null && uv >= 9);
  addReason(
    reasons,
    "BEACH_READY",
    intent === "beach" &&
      peakRain !== null &&
      peakRain <= 35 &&
      high !== null &&
      high >= 24 &&
      high <= 32,
  );
  addReason(
    reasons,
    "FAMILY_COMFORT",
    intent === "family_comfort" && peakRain !== null && peakRain <= 35 && high !== null && high <= 30,
  );
  addReason(
    reasons,
    "SENIOR_COMFORT",
    intent === "senior_comfort" && peakRain !== null && peakRain <= 30 && high !== null && high <= 28,
  );

  return clamp(Math.round(100 - penalty), 0, 100);
}

function passesConstraints(metrics: DiscoveryMetrics, preferences: DiscoveryPreferences): boolean {
  if (
    preferences.rainProbabilityMax !== null &&
    (metrics.maxRainProbability === null ||
      metrics.maxRainProbability > preferences.rainProbabilityMax)
  ) {
    return false;
  }
  if (
    preferences.temperatureMinC !== null &&
    (metrics.averageMinC === null || metrics.averageMinC < preferences.temperatureMinC)
  ) {
    return false;
  }
  if (
    preferences.temperatureMaxC !== null &&
    (metrics.averageMaxC === null || metrics.averageMaxC > preferences.temperatureMaxC)
  ) {
    return false;
  }
  if (
    preferences.windSpeedMaxKph !== null &&
    (metrics.maxWindKph === null || metrics.maxWindKph > preferences.windSpeedMaxKph)
  ) {
    return false;
  }
  return true;
}

export function assessDiscoveryWeather(
  days: ReadonlyArray<TripForecastDay>,
  preferences: DiscoveryPreferences,
): DiscoveryScore {
  const metrics = summarizeDiscoveryWeather(days);
  const reasons: DiscoveryReasonCode[] = [];
  const missing = missingMetricCount(metrics);
  const confidence = rounded(clamp((6 - missing) / 6, 0, 1));
  if (metrics.days === 0 || confidence < 0.5) {
    return {
      score: null,
      confidence,
      passesConstraints: false,
      reasonCodes: ["LIMITED_DATA"],
      metrics,
    };
  }

  const constraintsOk = passesConstraints(metrics, preferences);
  if (!constraintsOk) reasons.push("CUSTOM_CONSTRAINT_MISS");
  const score = scoreIntent(preferences.intent, metrics, reasons);
  if (confidence < 1) addReason(reasons, "LIMITED_DATA", true);

  return {
    score,
    confidence,
    passesConstraints: constraintsOk,
    reasonCodes: reasons,
    metrics,
  };
}

export function rankDiscoveryCities(
  cities: ReadonlyArray<TripCityOption>,
  forecast: ReadonlyArray<TripForecastDay>,
  preferences: DiscoveryPreferences,
): ReadonlyArray<DiscoveryCityResult> {
  const byCity = new Map<string, TripForecastDay[]>();
  for (const day of forecast) {
    const current = byCity.get(day.cityId) ?? [];
    current.push(day);
    byCity.set(day.cityId, current);
  }

  return cities
    .map((city) => {
      const forecastDays = [...(byCity.get(city.cityId) ?? [])].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const assessment = assessDiscoveryWeather(forecastDays, preferences);
      return { city, forecastDays, ...assessment } satisfies DiscoveryCityResult;
    })
    .filter((result) => result.passesConstraints && result.score !== null)
    .sort((left, right) => {
      const scoreDifference = (right.score ?? -1) - (left.score ?? -1);
      if (scoreDifference !== 0) return scoreDifference;
      const confidenceDifference = right.confidence - left.confidence;
      if (confidenceDifference !== 0) return confidenceDifference;
      return left.city.cityName.localeCompare(right.city.cityName);
    });
}

function parseNumber(
  search: URLSearchParams,
  key: string,
  min: number,
  max: number,
): number | null {
  const raw = search.get(key);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function isIsoDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

export function parseDiscoveryPreferences(
  search: URLSearchParams,
  fallback: { readonly from: string; readonly to: string },
): DiscoveryPreferences {
  const intentRaw = search.get("intent");
  const partyRaw = search.get("party");
  const themeRaw = search.get("theme");
  return {
    intent: INTENTS.includes(intentRaw as WeatherDiscoveryIntent)
      ? (intentRaw as WeatherDiscoveryIntent)
      : "dry",
    from: isIsoDate(search.get("from")) ? search.get("from")! : fallback.from,
    to: isIsoDate(search.get("to")) ? search.get("to")! : fallback.to,
    rainProbabilityMax: parseNumber(search, "rainMax", 0, 100),
    temperatureMinC: parseNumber(search, "tempMin", -50, 60),
    temperatureMaxC: parseNumber(search, "tempMax", -50, 60),
    windSpeedMaxKph: parseNumber(search, "windMax", 0, 250),
    partyProfile: PARTY_PROFILES.includes(partyRaw as TripPartyProfile)
      ? (partyRaw as TripPartyProfile)
      : null,
    theme: THEMES.includes(themeRaw as DiscoveryTheme) ? (themeRaw as DiscoveryTheme) : null,
  };
}

export function serializeDiscoveryPreferences(preferences: DiscoveryPreferences): URLSearchParams {
  const search = new URLSearchParams({
    intent: preferences.intent,
    from: preferences.from,
    to: preferences.to,
  });
  if (preferences.rainProbabilityMax !== null)
    search.set("rainMax", String(preferences.rainProbabilityMax));
  if (preferences.temperatureMinC !== null)
    search.set("tempMin", String(preferences.temperatureMinC));
  if (preferences.temperatureMaxC !== null)
    search.set("tempMax", String(preferences.temperatureMaxC));
  if (preferences.windSpeedMaxKph !== null)
    search.set("windMax", String(preferences.windSpeedMaxKph));
  if (preferences.partyProfile !== null) search.set("party", preferences.partyProfile);
  if (preferences.theme !== null) search.set("theme", preferences.theme);
  return search;
}

export function listDiscoveryIntents(): ReadonlyArray<WeatherDiscoveryIntent> {
  return INTENTS;
}
