import type { CountryWeatherDayViewModel } from "../app/view-models";

type RainSignalDay = {
  readonly weather: Pick<
    CountryWeatherDayViewModel["weather"],
    "conditionLabel" | "precipitationMm" | "rainProbability"
  >;
};

const PRECIPITATION_CONDITION = /rain|drizzle|shower|thunder|hail|snow|sleet|雨|雪|雷|冰雹/i;
const DRY_CONDITION = /clear|cloud|overcast|fog|mist|sun|晴|云|雲|阴|陰|雾|霧/i;

/**
 * User-facing "basically not raining" should follow the day's forecast condition
 * and expected precipitation amount first. Rain probability is uncertainty, so it
 * is only a fallback when the daily precipitation amount is unavailable.
 *
 * Explicit precipitation conditions are never presented as rain-free, even when
 * the forecast amount is tiny (for example persistent drizzle).
 */
export function isMostlyDryTravelDay(day: RainSignalDay): boolean {
  const { conditionLabel, precipitationMm, rainProbability } = day.weather;

  if (PRECIPITATION_CONDITION.test(conditionLabel)) return false;
  if (!DRY_CONDITION.test(conditionLabel)) return false;

  if (precipitationMm !== null && precipitationMm !== undefined) {
    return precipitationMm <= 0.5;
  }

  return rainProbability !== null && rainProbability !== undefined && rainProbability <= 35;
}
