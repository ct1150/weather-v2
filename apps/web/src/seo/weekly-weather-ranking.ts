import type { BakedDataset } from "../build/types";
import { projectCountry } from "../build/bake";
import type { PublishedLocale } from "../app/seo";
import type {
  CountryWeatherCityViewModel,
  CountryWeatherDayViewModel,
} from "../app/view-models";
import { isMostlyDryTravelDay } from "../components/rain-day-classification";
import { toTraditionalText } from "../trips/traditional";
import { windowIndicesForDates } from "../weather/window-selection";

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
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

function localizedPath(path: string, locale: PublishedLocale): string {
  if (locale === "en") return path;
  return `/${locale}${path}`;
}

function localizedName(value: string, locale: PublishedLocale): string {
  return locale === "zh-hant" ? toTraditionalText(value) : value;
}

function rankItem(
  city: CountryWeatherCityViewModel,
  days: ReadonlyArray<CountryWeatherDayViewModel>,
  locale: PublishedLocale,
): WeeklyWeatherRankItem {
  const rainAmounts = numeric(days.map((day) => day.weather.precipitationMm));
  const rainChances = numeric(days.map((day) => day.weather.rainProbability));
  const minimums = numeric(days.map((day) => day.weather.temperatureMin));
  const maximums = numeric(days.map((day) => day.weather.temperatureMax));
  const rainFreeDates = days.filter(isMostlyDryTravelDay).map((day) => day.localDate);

  return {
    cityId: city.cityId,
    cityName: localizedName(city.cityName, locale),
    countryName: localizedName(city.countryName, locale),
    path: localizedPath(city.path, locale),
    rainFreeDays: rainFreeDates.length,
    totalDays: days.length,
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

function sortRanking(items: WeeklyWeatherRankItem[]): ReadonlyArray<WeeklyWeatherRankItem> {
  return items.sort((a, b) => {
    if (b.rainFreeDays !== a.rainFreeDays) return b.rainFreeDays - a.rainFreeDays;
    const rainDelta = numericSort(a.totalRainMm) - numericSort(b.totalRainMm);
    if (rainDelta !== 0) return rainDelta;
    const chanceDelta = numericSort(a.peakRainChance) - numericSort(b.peakRainChance);
    if (chanceDelta !== 0) return chanceDelta;
    return a.cityId.localeCompare(b.cityId);
  });
}

function projectedCities(
  dataset: BakedDataset,
  locale: PublishedLocale,
): ReadonlyArray<CountryWeatherCityViewModel> {
  const projectionLocale = locale === "zh-hant" ? "zh-cn" : locale;
  return dataset.countries.flatMap((country) => {
    const projected = projectCountry(dataset, country.slug, projectionLocale);
    return projected.weatherCities ?? [];
  });
}

export function buildWeeklyWeatherRanking(
  dataset: BakedDataset,
  locale: PublishedLocale,
): ReadonlyArray<WeeklyWeatherRankItem> {
  const items = projectedCities(dataset, locale).map((city) => rankItem(city, city.days, locale));
  return sortRanking(items);
}

export function buildWeekendWeatherRanking(
  dataset: BakedDataset,
  locale: PublishedLocale,
): ReadonlyArray<WeeklyWeatherRankItem> {
  const items = projectedCities(dataset, locale)
    .map((city) => {
      const indices = windowIndicesForDates(
        city.days.map((day) => day.localDate),
        "weekend",
      );
      const days = indices
        .map((index) => city.days[index])
        .filter((day): day is CountryWeatherDayViewModel => day !== undefined);
      return rankItem(city, days, locale);
    })
    .filter((item) => item.totalDays > 0);
  return sortRanking(items);
}
