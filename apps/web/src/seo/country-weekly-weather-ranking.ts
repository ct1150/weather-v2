import type { PublishedLocale } from "../app/seo";
import type { BakedDataset } from "../build/types";
import {
  buildWeeklyWeatherRanking,
  type WeeklyWeatherRankItem,
} from "./weekly-weather-ranking";

function countryPathPrefix(countrySlug: string, locale: PublishedLocale): string {
  return locale === "en" ? `/${countrySlug}/` : `/${locale}/${countrySlug}/`;
}

export function buildCountryWeeklyWeatherRanking(
  dataset: BakedDataset,
  countrySlug: string,
  locale: PublishedLocale,
): ReadonlyArray<WeeklyWeatherRankItem> {
  const prefix = countryPathPrefix(countrySlug, locale);
  return buildWeeklyWeatherRanking(dataset, locale).filter((item) => item.path.startsWith(prefix));
}
