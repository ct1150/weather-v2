import { describeWeatherCode } from "@wnr/domain";
import type { BakedDataset } from "../build/types";
import type { BrowserAnalyticsLocale } from "../analytics/browser-events";
import type { CountryMapHomeItem } from "../components/CountryMapHome";
import {
  availableHomeWeatherDates,
  summarizeHomeCountryRain,
  type HomeCityWeatherSeries,
} from "../weather/home-rain-window";
import { worldWeatherStatus } from "./world-overview";

export function buildCountryMapHomeItems(
  dataset: BakedDataset,
  locale: BrowserAnalyticsLocale,
): ReadonlyArray<CountryMapHomeItem> {
  return dataset.countries.map((country) => {
    const cities = dataset.citiesByCountry.get(country.id) ?? [];
    const cityWeather: HomeCityWeatherSeries[] = cities.map((item) => ({
      cityId: item.city.id,
      cityName: item.city.name[locale] ?? item.city.name.en,
      days: item.forecast.days.map((day) => ({
        localDate: day.localDate,
        conditionLabel: describeWeatherCode(day.weatherCode).label,
        precipitationMm: day.precipitationMm,
        rainProbability: day.precipitationProbabilityMax,
      })),
    }));
    const selectedDates = availableHomeWeatherDates(cityWeather).slice(0, 7);
    const weather = summarizeHomeCountryRain(cityWeather, selectedDates);
    const topIds = new Set(weather.topCityIds);
    const topCities = [
      ...cityWeather.filter((item) => topIds.has(item.cityId)),
      ...cityWeather.filter((item) => !topIds.has(item.cityId)),
    ].slice(0, 4);
    const path = locale === "en" ? `/${country.slug}` : `/${locale}/${country.slug}`;
    return {
      countryId: country.id,
      slug: country.slug,
      name: country.name[locale] ?? country.name.en,
      path,
      summary: country.summary?.[locale] ?? country.summary?.en ?? "",
      cityCount: cities.length,
      cityNames: topCities.map((item) => item.cityName),
      weatherScore: weather.score,
      weatherStatus: worldWeatherStatus(weather.score),
      bestDryDays: weather.bestDryDays,
      weatherDays: weather.totalDays,
      cityWeather,
    };
  });
}
