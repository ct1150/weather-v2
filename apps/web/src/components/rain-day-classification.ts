import type { CountryWeatherDayViewModel } from "../app/view-models";

type RainSignalDay = {
  readonly weather: Pick<
    CountryWeatherDayViewModel["weather"],
    "conditionLabel" | "precipitationMm" | "rainProbability"
  >;
};

const PRECIPITATION_CONDITION = /rain|drizzle|shower|thunder|hail|snow|sleet/i;

/**
 * "Mostly dry" is intentionally stricter than "low precipitation".
 * A day with an explicit precipitation condition is never presented as dry,
 * even when the forecast amount is tiny (for example persistent drizzle).
 */
export function isMostlyDryTravelDay(day: RainSignalDay): boolean {
  const { conditionLabel, precipitationMm, rainProbability } = day.weather;

  if (PRECIPITATION_CONDITION.test(conditionLabel)) return false;
  if (precipitationMm !== null && precipitationMm !== undefined && precipitationMm > 0.5) {
    return false;
  }
  if (rainProbability !== null && rainProbability !== undefined && rainProbability > 35) {
    return false;
  }

  return precipitationMm !== null && precipitationMm !== undefined
    ? true
    : rainProbability !== null && rainProbability !== undefined;
}
