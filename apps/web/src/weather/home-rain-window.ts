import { windowIndicesForDates } from "./window-selection";

export type HomeWeatherPreset = "7d" | "weekend" | "custom";

export interface HomeWeatherDay {
  readonly localDate: string;
  readonly conditionLabel: string;
  readonly precipitationMm: number | null;
  readonly rainProbability: number | null;
}

export interface HomeCityWeatherSeries {
  readonly cityId: string;
  readonly cityName: string;
  readonly days: ReadonlyArray<HomeWeatherDay>;
}

export interface HomeCityRainSummary {
  readonly cityId: string;
  readonly dryDays: number;
  readonly totalDays: number;
  readonly dryPercent: number;
  readonly totalRainMm: number | null;
  readonly peakRainChance: number | null;
}

export interface HomeCountryRainSummary {
  readonly score: number | null;
  readonly topCityIds: ReadonlyArray<string>;
  readonly bestDryDays: number;
  readonly totalDays: number;
}

const PRECIPITATION_CONDITION = /rain|drizzle|shower|thunder|hail|snow|sleet|雨|雪|雷|冰雹/i;
const DRY_CONDITION = /clear|cloud|overcast|fog|mist|sun|晴|云|雲|阴|陰|雾|霧/i;

function isMostlyDry(day: HomeWeatherDay): boolean {
  if (PRECIPITATION_CONDITION.test(day.conditionLabel)) return false;
  if (!DRY_CONDITION.test(day.conditionLabel)) return false;
  if (day.precipitationMm !== null) return day.precipitationMm <= 0.5;
  return day.rainProbability !== null && day.rainProbability <= 35;
}

function numeric(values: ReadonlyArray<number | null>): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

export function availableHomeWeatherDates(
  cities: ReadonlyArray<HomeCityWeatherSeries>,
): ReadonlyArray<string> {
  return [...new Set(cities.flatMap((city) => city.days.map((day) => day.localDate)))].sort();
}

export function resolveHomeWeatherDates(
  availableDates: ReadonlyArray<string>,
  preset: HomeWeatherPreset,
  customFrom: string,
  customTo: string,
): ReadonlyArray<string> {
  if (preset === "7d") return availableDates.slice(0, 7);
  if (preset === "weekend") {
    return windowIndicesForDates(availableDates, "weekend")
      .map((index) => availableDates[index])
      .filter((date): date is string => date !== undefined);
  }
  if (customFrom.length === 0 || customTo.length === 0 || customFrom > customTo) return [];
  return availableDates.filter((date) => date >= customFrom && date <= customTo);
}

export function summarizeHomeCityRain(
  city: HomeCityWeatherSeries,
  selectedDates: ReadonlyArray<string>,
): HomeCityRainSummary | null {
  const selected = new Set(selectedDates);
  const days = city.days.filter((day) => selected.has(day.localDate));
  if (days.length === 0) return null;
  const dryDays = days.filter(isMostlyDry).length;
  const rain = numeric(days.map((day) => day.precipitationMm));
  const rainChance = numeric(days.map((day) => day.rainProbability));
  return {
    cityId: city.cityId,
    dryDays,
    totalDays: days.length,
    dryPercent: Math.round((dryDays / days.length) * 100),
    totalRainMm:
      rain.length === 0 ? null : Math.round(rain.reduce((sum, value) => sum + value, 0) * 10) / 10,
    peakRainChance: rainChance.length === 0 ? null : Math.max(...rainChance),
  };
}

function nullLast(value: number | null): number {
  return value === null ? Number.POSITIVE_INFINITY : value;
}

export function summarizeHomeCountryRain(
  cities: ReadonlyArray<HomeCityWeatherSeries>,
  selectedDates: ReadonlyArray<string>,
): HomeCountryRainSummary {
  const ranked = cities
    .map((city) => summarizeHomeCityRain(city, selectedDates))
    .filter((summary): summary is HomeCityRainSummary => summary !== null)
    .sort((left, right) => {
      if (right.dryPercent !== left.dryPercent) return right.dryPercent - left.dryPercent;
      const rainDelta = nullLast(left.totalRainMm) - nullLast(right.totalRainMm);
      if (rainDelta !== 0) return rainDelta;
      const chanceDelta = nullLast(left.peakRainChance) - nullLast(right.peakRainChance);
      if (chanceDelta !== 0) return chanceDelta;
      return left.cityId.localeCompare(right.cityId);
    });
  const top = ranked.slice(0, 3);
  if (top.length === 0) return { score: null, topCityIds: [], bestDryDays: 0, totalDays: 0 };
  return {
    score: Math.round(top.reduce((sum, city) => sum + city.dryPercent, 0) / top.length),
    topCityIds: top.map((city) => city.cityId),
    bestDryDays: top[0]?.dryDays ?? 0,
    totalDays: top[0]?.totalDays ?? 0,
  };
}
