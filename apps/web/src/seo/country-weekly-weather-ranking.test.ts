import { describe, expect, it } from "vitest";
import { getBakedDataset } from "../build/bake";
import {
  buildCountryWeekendWeatherRanking,
  buildCountryWeeklyWeatherRanking,
} from "./country-weekly-weather-ranking";

describe("country weather rankings", () => {
  it("keeps every weekly ranked city inside the requested country with stable localized order", async () => {
    const dataset = await getBakedDataset();
    const country = dataset.countries.find(
      (item) => (dataset.citiesByCountry.get(item.id) ?? []).length >= 3,
    );
    expect(country).toBeDefined();
    if (country === undefined) return;

    const allowed = new Set(
      (dataset.citiesByCountry.get(country.id) ?? []).map((item) => item.city.id),
    );
    const en = buildCountryWeeklyWeatherRanking(dataset, country.slug, "en");
    const zhCn = buildCountryWeeklyWeatherRanking(dataset, country.slug, "zh-cn");
    const zhHant = buildCountryWeeklyWeatherRanking(dataset, country.slug, "zh-hant");

    expect(en.length).toBe(allowed.size);
    expect(en.every((item) => allowed.has(item.cityId))).toBe(true);
    expect(zhCn.every((item) => item.path.startsWith(`/zh-cn/${country.slug}/`))).toBe(true);
    expect(zhHant.every((item) => item.path.startsWith(`/zh-hant/${country.slug}/`))).toBe(true);
    expect(en.map((item) => item.cityId)).toEqual(zhCn.map((item) => item.cityId));
    expect(en.map((item) => item.cityId)).toEqual(zhHant.map((item) => item.cityId));
  });

  it("uses only the next real weekend while preserving country and locale ordering", async () => {
    const dataset = await getBakedDataset();
    const country = dataset.countries.find(
      (item) => (dataset.citiesByCountry.get(item.id) ?? []).length >= 3,
    );
    expect(country).toBeDefined();
    if (country === undefined) return;

    const allowed = new Set(
      (dataset.citiesByCountry.get(country.id) ?? []).map((item) => item.city.id),
    );
    const en = buildCountryWeekendWeatherRanking(dataset, country.slug, "en");
    const zhCn = buildCountryWeekendWeatherRanking(dataset, country.slug, "zh-cn");
    const zhHant = buildCountryWeekendWeatherRanking(dataset, country.slug, "zh-hant");

    expect(en.length).toBeGreaterThan(0);
    expect(en.every((item) => allowed.has(item.cityId))).toBe(true);
    expect(en.every((item) => item.totalDays > 0 && item.totalDays <= 2)).toBe(true);
    expect(zhCn.every((item) => item.path.startsWith(`/zh-cn/${country.slug}/`))).toBe(true);
    expect(zhHant.every((item) => item.path.startsWith(`/zh-hant/${country.slug}/`))).toBe(true);
    expect(en.map((item) => item.cityId)).toEqual(zhCn.map((item) => item.cityId));
    expect(en.map((item) => item.cityId)).toEqual(zhHant.map((item) => item.cityId));
  });
});
