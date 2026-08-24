import type { BakedDataset } from "../build/types";
import { projectCountry } from "../build/bake";
import type { PublishedLocale } from "../app/seo";
import type { CountryWeatherCityViewModel } from "../app/view-models";
import { isMostlyDryTravelDay } from "../components/rain-day-classification";

export interface WeeklyWeatherRankItem {
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly path: string;
  readonly rainFreeDays: number;
  readonly totalDays: number;
  readonly rainFreeDates: ReadonlyArray<string>;
  readonly totalRainMm: number | null;
  readonly peakRainChance: number | null;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
}

function numeric(values: ReadonlyArray<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function localizedPath(path: string, locale: PublishedLocale): string {
  if (locale === "en") return path;
  return `/${locale}${path}`;
}

function rankItem(city: CountryWeatherCityViewModel, locale: PublishedLocale): WeeklyWeatherRankItem {
  const rainAmounts = numeric(city.days.map((day) => day.weather.precipitationMm));
  const rainChances = numeric(city.days.map((day) => day.weather.rainProbability));
  const minimums = numeric(city.days.map((day) => day.weather.temperatureMin));
  const maximums = numeric(city.days.map((day) => day.weather.temperatureMax));
  const rainFreeDates = city.days.filter(isMostlyDryTravelDay).map((day) => day.localDate);

  return {
    cityId: city.cityId,
    cityName: city.cityName,
    countryName: city.countryName,
    path: localizedPath(city.path, locale),
    rainFreeDays: rainFreeDates.length,
    totalDays: city.days.length,
    rainFreeDates,
    totalRainMm:
      rainAmounts.length === 0
        ? null
        : Math.round(rainAmounts.reduce((sum, value) => sum + value, 0) * 10) / 10,
    peakRainChance: rainChances.length === 0 ? null : Math.max(...rainChances),
    temperatureMin: minimums.length === 0 ? null : Math.min(...minimums),
    temperatureMax: maximums.length === 0 ? null : Math.max(...maximums),
  };
}

function numericSort(value: number | null): number {
  return value === null ? Number.POSITIVE_INFINITY : value;
}

export function buildWeeklyWeatherRanking(
  dataset: BakedDataset,
  locale: PublishedLocale,
): ReadonlyArray<WeeklyWeatherRankItem> {
  const items = dataset.countries.flatMap((country) => {
    const projected = projectCountry(dataset, country.slug, locale);
    return (projected.weatherCities ?? []).map((city) => rankItem(city, locale));
  });

  return items.sort((a, b) => {
    if (b.rainFreeDays !== a.rainFreeDays) return b.rainFreeDays - a.rainFreeDays;
    const rainDelta = numericSort(a.totalRainMm) - numericSort(b.totalRainMm);
    if (rainDelta !== 0) return rainDelta;
    const chanceDelta = numericSort(a.peakRainChance) - numericSort(b.peakRainChance);
    if (chanceDelta !== 0) return chanceDelta;
    return a.cityName.localeCompare(b.cityName);
  });
}
