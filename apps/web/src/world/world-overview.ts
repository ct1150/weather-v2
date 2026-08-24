import type { BakedCity } from "../build/types";

export type WorldWeatherStatus = "excellent" | "good" | "mixed" | "poor" | "unknown";

export interface WorldCountryWeatherSummary {
  readonly score: number | null;
  readonly status: WorldWeatherStatus;
  readonly topCityIds: ReadonlyArray<string>;
}

export function worldWeatherStatus(score: number | null): WorldWeatherStatus {
  if (score === null) return "unknown";
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "mixed";
  return "poor";
}

/**
 * Country overview intentionally represents the best realistic options inside a country,
 * not an average over every supported city. The top-three city mean answers the product
 * question: "does this country have good weather options worth opening right now?"
 */
export function summarizeCountryWeather(
  cities: ReadonlyArray<BakedCity>,
): WorldCountryWeatherSummary {
  const scored = cities
    .filter(
      (item): item is BakedCity & { score: BakedCity["score"] & { score: number } } =>
        typeof item.score.score === "number" && Number.isFinite(item.score.score),
    )
    .sort((a, b) => b.score.score - a.score.score);
  const top = scored.slice(0, 3);
  const score =
    top.length === 0
      ? null
      : Math.round(top.reduce((sum, item) => sum + item.score.score, 0) / top.length);

  return {
    score,
    status: worldWeatherStatus(score),
    topCityIds: top.map((item) => item.city.id),
  };
}
