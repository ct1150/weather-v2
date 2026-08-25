export type RainWindowRisk = "good" | "mixed" | "wet" | "unknown";

export interface RainWindowSignals {
  readonly dayCount: number;
  readonly dryDays: number;
  readonly totalRainMm: number | null;
  readonly maxDailyRainMm: number | null;
  readonly maxRainProbability: number | null;
}

export interface RainWindowAssessment {
  readonly risk: RainWindowRisk;
  readonly dryRatio: number;
  readonly averageRainMm: number | null;
}

export const RAIN_WINDOW_THRESHOLDS = {
  goodDryRatio: 0.7,
  wetDryRatio: 0.4,
  goodAverageRainMm: 1.5,
  wetAverageRainMm: 5,
  goodMaxDailyRainMm: 10,
  extremeDailyRainMm: 50,
  goodFallbackMaxRainProbability: 50,
} as const;

/**
 * Classifies the selected travel window, not the single worst forecast day.
 *
 * Product semantics:
 * - good: most days are dry and the rain that remains is light
 * - mixed: there is still a useful dry window, but rain can affect part of the trip
 * - wet: dry opportunities are scarce or rainfall is broadly/heavily disruptive
 * - unknown: there is not enough rain data to make the call
 */
export function assessRainWindow(signals: RainWindowSignals): RainWindowAssessment {
  const dayCount = Math.max(0, Math.floor(signals.dayCount));
  const dryDays = Math.max(0, Math.min(dayCount, Math.floor(signals.dryDays)));
  const dryRatio = dayCount === 0 ? 0 : dryDays / dayCount;
  const averageRainMm =
    dayCount > 0 && signals.totalRainMm !== null ? signals.totalRainMm / dayCount : null;

  if (
    dayCount === 0 ||
    (signals.totalRainMm === null && signals.maxRainProbability === null)
  ) {
    return { risk: "unknown", dryRatio, averageRainMm };
  }

  const rainfallIsLight =
    averageRainMm !== null
      ? averageRainMm <= RAIN_WINDOW_THRESHOLDS.goodAverageRainMm &&
        (signals.maxDailyRainMm === null ||
          signals.maxDailyRainMm <= RAIN_WINDOW_THRESHOLDS.goodMaxDailyRainMm)
      : (signals.maxRainProbability ?? Infinity) <=
        RAIN_WINDOW_THRESHOLDS.goodFallbackMaxRainProbability;

  if (dryRatio >= RAIN_WINDOW_THRESHOLDS.goodDryRatio && rainfallIsLight) {
    return { risk: "good", dryRatio, averageRainMm };
  }

  const broadlyWet =
    dryRatio < RAIN_WINDOW_THRESHOLDS.wetDryRatio ||
    (dryRatio < RAIN_WINDOW_THRESHOLDS.goodDryRatio &&
      averageRainMm !== null &&
      averageRainMm >= RAIN_WINDOW_THRESHOLDS.wetAverageRainMm) ||
    (signals.maxDailyRainMm !== null &&
      signals.maxDailyRainMm >= RAIN_WINDOW_THRESHOLDS.extremeDailyRainMm);

  return {
    risk: broadlyWet ? "wet" : "mixed",
    dryRatio,
    averageRainMm,
  };
}
