import type {
  DiscoveryCityResult,
  DiscoveryPreferences,
  DiscoveryReasonCode,
} from "./weather-discovery";

export const DISCOVERY_MATCH_SCORE_MIN = 60;

function above(value: number | null, threshold: number, scale: number, cap: number): number {
  if (value === null || value <= threshold) return 0;
  return Math.min((value - threshold) * scale, cap);
}

function below(value: number | null, threshold: number, scale: number, cap: number): number {
  if (value === null || value >= threshold) return 0;
  return Math.min((threshold - value) * scale, cap);
}

function reason(
  reasons: DiscoveryReasonCode[],
  code: DiscoveryReasonCode,
  condition: boolean,
): void {
  if (condition && !reasons.includes(code)) reasons.push(code);
}

export function contextualizeDiscoveryResult(
  result: DiscoveryCityResult,
  preferences: DiscoveryPreferences,
): DiscoveryCityResult {
  if (result.score === null) return result;
  const metrics = result.metrics;
  const reasons = [...result.reasonCodes];
  let penalty = 0;
  let score = result.score;

  if (preferences.partyProfile === "family") {
    penalty += above(metrics.maxRainProbability, 40, 0.25, 12);
    penalty += above(metrics.averageMaxC, 30, 2, 14);
    penalty += below(metrics.averageMinC, 14, 1.5, 10);
    penalty += above(metrics.maxWindKph, 24, 0.9, 12);
    penalty += above(metrics.maxUv, 8, 1.8, 8);
    reason(
      reasons,
      "FAMILY_COMFORT",
      metrics.maxRainProbability !== null &&
        metrics.maxRainProbability <= 35 &&
        metrics.averageMaxC !== null &&
        metrics.averageMaxC <= 30,
    );
  }

  if (preferences.partyProfile === "senior") {
    penalty += above(metrics.maxRainProbability, 35, 0.35, 16);
    penalty += above(metrics.averageMaxC, 28, 2.4, 18);
    penalty += below(metrics.averageMinC, 15, 1.8, 12);
    penalty += above(metrics.maxWindKph, 20, 1.2, 16);
    penalty += above(metrics.maxUv, 7, 2, 10);
    reason(
      reasons,
      "SENIOR_COMFORT",
      metrics.maxRainProbability !== null &&
        metrics.maxRainProbability <= 30 &&
        metrics.averageMaxC !== null &&
        metrics.averageMaxC <= 28,
    );
  }

  if (preferences.theme === "beach") {
    penalty += above(metrics.maxRainProbability, 35, 0.25, 12);
    penalty += above(metrics.maxWindKph, 25, 1, 14);
    penalty += below(metrics.averageMaxC, 24, 1.8, 12);
    penalty += above(metrics.averageMaxC, 33, 1.8, 12);
    reason(
      reasons,
      "BEACH_READY",
      metrics.maxRainProbability !== null &&
        metrics.maxRainProbability <= 35 &&
        metrics.averageMaxC !== null &&
        metrics.averageMaxC >= 24 &&
        metrics.averageMaxC <= 32,
    );
  } else if (preferences.theme === "outdoor") {
    penalty += above(metrics.maxRainProbability, 45, 0.2, 10);
    penalty += above(metrics.maxWindKph, 28, 0.8, 12);
    penalty += above(metrics.maxUv, 9, 1.5, 8);
  } else if (preferences.theme === "city") {
    penalty += above(metrics.maxRainProbability, 65, 0.12, 6);
    penalty += above(metrics.averageMaxC, 34, 1.4, 8);
    penalty += above(metrics.maxWindKph, 38, 0.6, 6);
  } else if (preferences.theme === "indoor") {
    const recoverableWeatherPenalty = Math.max(0, 100 - score);
    score += recoverableWeatherPenalty * 0.35;
    penalty *= 0.35;
  }

  return {
    ...result,
    score: Math.max(0, Math.min(100, Math.round(score - penalty))),
    reasonCodes: reasons,
  };
}

export function isDiscoveryPreferenceMatch(result: DiscoveryCityResult): boolean {
  return result.score !== null && result.score >= DISCOVERY_MATCH_SCORE_MIN;
}

export function contextualizeDiscoveryResults(
  results: ReadonlyArray<DiscoveryCityResult>,
  preferences: DiscoveryPreferences,
): ReadonlyArray<DiscoveryCityResult> {
  return results
    .map((result) => contextualizeDiscoveryResult(result, preferences))
    .filter(isDiscoveryPreferenceMatch)
    .sort((left, right) => {
      const scoreDifference = (right.score ?? -1) - (left.score ?? -1);
      if (scoreDifference !== 0) return scoreDifference;
      return left.city.cityName.localeCompare(right.city.cityName);
    });
}
