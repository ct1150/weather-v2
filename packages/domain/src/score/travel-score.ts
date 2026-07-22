// @wnr/domain — deterministic Travel Score kernel (DATA-SCORE-001).
//
// Pure, framework-free scoring. Every factor normalizes a raw weather observation to 0..100.
// Missing or out-of-domain inputs are absent (null), never defaulted to the best value, so
// confidence falls as data is removed. The general Travel Score is the weighted mean of the
// available listed factors (rain 0.30, temperature 0.20, comfort 0.15, humidity 0.10,
// wind 0.10, uv 0.075, cloud 0.075). Confidence below 0.7 hides the score with LIMITED_DATA.
//
// Theme scores and the hazard-penalty schedule live in DATA-ACTIVITY-001 (a later release);
// `hazardPenalty` is accepted so the kernel is forward-compatible, and defaults to 0 for MVP.

/** A single resolved weather observation (hourly row, or daily-derived aggregation). */
export interface WeatherRow {
  precipitationProbability?: number | null;
  precipitationMm?: number | null;
  temperatureC?: number | null;
  apparentTemperatureC?: number | null;
  humidity?: number | null;
  windSpeedKph?: number | null;
  windGustKph?: number | null;
  uvIndex?: number | null;
  cloudCover?: number | null;
  visibilityM?: number | null;
}

export interface TravelScoreInput {
  /** Resolved observation used as the score source. */
  readonly row: WeatherRow;
  /** Model version frozen with the result for reproducibility. */
  readonly modelVersion: string;
  /**
   * Hazard penalty subtracted after the weighted base. The exact schedule is defined in
   * DATA-ACTIVITY-001 (later release). Defaults to 0 for MVP.
   */
  readonly hazardPenalty?: number;
  /**
   * Optional acquisition time of the source weather. When both are provided and the gap
   * exceeds two hours, STALE_DATA is attached (DATA-SCORE-001 freshness rule).
   */
  readonly fetchedAt?: string | null;
  readonly asOf?: string | null;
}

export interface TravelScoreResult {
  /** Final integer score in 0..100, or null when the score is suppressed (e.g. LIMITED_DATA). */
  readonly score: number | null;
  /** Available-weight fraction in 0..1. */
  readonly confidence: number;
  /** Stable, language-neutral reason codes (never natural-language prose). */
  readonly reasonCodes: ReadonlyArray<string>;
  /** Names of the factors that actually contributed. */
  readonly availableFactors: ReadonlyArray<string>;
  /** True when the score is suppressed and must not be shown or ranked. */
  readonly hidden: boolean;
  /** Frozen model version for reproducibility. */
  readonly modelVersion: string;
}

const CONFIDENCE_THRESHOLD = 0.7;
const MAX_WEATHER_AGE_MS = 2 * 60 * 60 * 1000;

/** General-model factor weights. They sum to exactly 1.0. */
const GENERAL_WEIGHTS = {
  rain: 0.3,
  temperature: 0.2,
  comfort: 0.15,
  humidity: 0.1,
  wind: 0.1,
  uv: 0.075,
  cloud: 0.075,
} as const;

/** Linear interpolation between two points; undefined outside [x0, x1]. */
function line(x: number, x0: number, y0: number, x1: number, y1: number): number {
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function inRange(value: unknown, lo: number, hi: number): value is number {
  return isFiniteNumber(value) && value >= lo && value <= hi;
}

function nonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

// --- Rain -------------------------------------------------------------------

function rainAmountFactor(m: number): number {
  if (m <= 0) return 100;
  if (m <= 2) return line(m, 0, 100, 2, 80);
  if (m <= 10) return line(m, 2, 80, 10, 40);
  if (m < 30) return line(m, 10, 40, 30, 0);
  return 0;
}

/** Rain factor: min(100 - probabilityPct, rainAmountFactor). Missing when either input is invalid. */
export function rainFactor(probabilityPct: number | null | undefined, precipitationMm: number | null | undefined): number | null {
  if (!inRange(probabilityPct, 0, 100) || !nonNegative(precipitationMm)) return null;
  return Math.min(100 - probabilityPct, rainAmountFactor(precipitationMm));
}

// --- Temperature / comfort --------------------------------------------------

export function temperatureFactor(t: number | null | undefined): number | null {
  if (!isFiniteNumber(t)) return null;
  if (t <= 0) return 0;
  if (t < 10) return line(t, 0, 0, 10, 50);
  if (t < 18) return line(t, 10, 50, 18, 100);
  if (t <= 26) return 100;
  if (t <= 32) return line(t, 26, 100, 32, 60);
  if (t < 40) return line(t, 32, 60, 40, 0);
  return 0;
}

export function comfortFactor(apparentT: number | null | undefined): number | null {
  return temperatureFactor(apparentT);
}

// --- Humidity ---------------------------------------------------------------

export function humidityFactor(h: number | null | undefined): number | null {
  if (!inRange(h, 0, 100)) return null;
  if (h <= 20) return 0;
  if (h < 30) return line(h, 20, 0, 30, 100);
  if (h <= 60) return 100;
  if (h <= 80) return line(h, 60, 100, 80, 40);
  if (h < 100) return line(h, 80, 40, 100, 0);
  return 0;
}

// --- Wind -------------------------------------------------------------------

export function windSpeedFactor(s: number | null | undefined): number | null {
  if (!nonNegative(s)) return null;
  if (s <= 10) return 100;
  if (s <= 25) return line(s, 10, 100, 25, 60);
  if (s < 40) return line(s, 25, 60, 40, 0);
  return 0;
}

export function windGustFactor(g: number | null | undefined): number | null {
  if (!nonNegative(g)) return null;
  if (g <= 20) return 100;
  if (g < 50) return line(g, 20, 100, 50, 0);
  return 0;
}

export function windFactor(speedKph: number | null | undefined, gustKph: number | null | undefined): number | null {
  const speed = windSpeedFactor(speedKph);
  const gust = windGustFactor(gustKph);
  if (speed == null || gust == null) return null;
  return Math.min(speed, gust);
}

// --- UV ---------------------------------------------------------------------

export function uvFactor(u: number | null | undefined): number | null {
  if (!nonNegative(u)) return null;
  if (u <= 2) return 100;
  if (u <= 5) return line(u, 2, 100, 5, 80);
  if (u <= 8) return line(u, 5, 80, 8, 40);
  if (u < 11) return line(u, 8, 40, 11, 0);
  return 0;
}

// --- Cloud ------------------------------------------------------------------

export function cloudFactor(c: number | null | undefined): number | null {
  if (!inRange(c, 0, 100)) return null;
  if (c <= 20) return 100;
  if (c <= 60) return line(c, 20, 100, 60, 60);
  if (c < 100) return line(c, 60, 60, 100, 0);
  return 0;
}

// --- Visibility (not used by the general model, exported for completeness) --

export function visibilityFactor(vMetres: number | null | undefined): number | null {
  if (!nonNegative(vMetres)) return null;
  if (vMetres <= 1000) return 0;
  if (vMetres <= 5000) return line(vMetres, 1000, 0, 5000, 50);
  if (vMetres < 10000) return line(vMetres, 5000, 50, 10000, 100);
  return 100;
}

function parseInstant(value: string | null | undefined): number | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Deterministically compute the general Travel Score from one resolved weather row.
 * Identical inputs and model version always yield the same integer score and codes.
 */
export function calculateTravelScore(input: TravelScoreInput): TravelScoreResult {
  const { row } = input;
  const hazardPenalty = input.hazardPenalty ?? 0;

  const factors: ReadonlyArray<{
    readonly name: string;
    readonly value: number | null;
    readonly weight: number;
  }> = [
    { name: "rain", value: rainFactor(row.precipitationProbability, row.precipitationMm), weight: GENERAL_WEIGHTS.rain },
    { name: "temperature", value: temperatureFactor(row.temperatureC), weight: GENERAL_WEIGHTS.temperature },
    { name: "comfort", value: comfortFactor(row.apparentTemperatureC), weight: GENERAL_WEIGHTS.comfort },
    { name: "humidity", value: humidityFactor(row.humidity), weight: GENERAL_WEIGHTS.humidity },
    { name: "wind", value: windFactor(row.windSpeedKph, row.windGustKph), weight: GENERAL_WEIGHTS.wind },
    { name: "uv", value: uvFactor(row.uvIndex), weight: GENERAL_WEIGHTS.uv },
    { name: "cloud", value: cloudFactor(row.cloudCover), weight: GENERAL_WEIGHTS.cloud },
  ];

  const available = factors.filter((f) => f.value != null) as ReadonlyArray<{
    readonly name: string;
    readonly value: number;
    readonly weight: number;
  }>;

  const availableWeight = available.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = available.reduce((sum, f) => sum + f.value * f.weight, 0);
  const base = availableWeight > 0 ? weightedSum / availableWeight : 0;
  const confidence = availableWeight; // total weight is exactly 1.0

  const reasonCodes: string[] = [];
  const hidden = availableWeight === 0 || confidence < CONFIDENCE_THRESHOLD;

  if (availableWeight === 0) {
    reasonCodes.push("LIMITED_DATA");
  } else {
    if (confidence < CONFIDENCE_THRESHOLD) reasonCodes.push("LIMITED_DATA");

    const rain = factors.find((f) => f.name === "rain")?.value;
    if (rain != null) {
      if (rain >= 80) reasonCodes.push("LOW_RAIN_CHANCE");
      else if (rain <= 20) reasonCodes.push("HEAVY_RAIN_RISK");
    }
    const temperature = factors.find((f) => f.name === "temperature")?.value;
    if (temperature != null && temperature >= 70) reasonCodes.push("COMFORTABLE_TEMPERATURE");
    const humidity = factors.find((f) => f.name === "humidity")?.value;
    if (humidity != null && humidity >= 70) reasonCodes.push("LOW_HUMIDITY");
    const wind = factors.find((f) => f.name === "wind")?.value;
    if (wind != null && wind >= 80) reasonCodes.push("CALM_WIND");
    const uv = factors.find((f) => f.name === "uv")?.value;
    if (uv != null && uv <= 30) reasonCodes.push("HIGH_UV_CAUTION");

    const fetchedAt = parseInstant(input.fetchedAt);
    const asOf = parseInstant(input.asOf);
    if (fetchedAt != null && asOf != null && asOf - fetchedAt > MAX_WEATHER_AGE_MS) {
      reasonCodes.push("STALE_DATA");
    }
  }

  const score = hidden ? null : Math.round(clamp(base - hazardPenalty, 0, 100));

  return {
    score,
    confidence,
    reasonCodes: reasonCodes.sort(),
    availableFactors: available.map((f) => f.name).sort(),
    hidden,
    modelVersion: input.modelVersion,
  };
}
