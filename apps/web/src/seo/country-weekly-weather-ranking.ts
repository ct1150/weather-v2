import type { PublishedLocale } from "../app/seo";
import type { BakedDataset } from "../build/types";
import {
  buildWeekendWeatherRanking,
  buildWeeklyWeatherRanking,
  type WeeklyWeatherRankItem,
} from "./weekly-weather-ranking";

function countryPathPrefix(countrySlug: string, locale: PublishedLocale): string {
  return locale === "en" ? `/${countrySlug}/` : `/${locale}/${countrySlug}/`;
}

function filterCountry(
  items: ReadonlyArray<WeeklyWeatherRankItem>,
  countrySlug: string,
  locale: PublishedLocale,
): ReadonlyArray<WeeklyWeatherRankItem> {
  const prefix = countryPathPrefix(countrySlug, locale);
  return items.filter((item) => item.path.startsWith(prefix));
}

export function buildCountryWeeklyWeatherRanking(
  dataset: BakedDataset,
  countrySlug: string,
  locale: PublishedLocale,
): ReadonlyArray<WeeklyWeatherRankItem> {
  return filterCountry(buildWeeklyWeatherRanking(dataset, locale), countrySlug, locale);
}

export function buildCountryWeekendWeatherRanking(
  dataset: BakedDataset,
  countrySlug: string,
  locale: PublishedLocale,
): ReadonlyArray<WeeklyWeatherRankItem> {
  return filterCountry(buildWeekendWeatherRanking(dataset, locale), countrySlug, locale);
}
