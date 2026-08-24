import { describe, expect, it } from "vitest";
import { getBakedDataset } from "../build/bake";
import { buildWeekendWeatherRanking, buildWeeklyWeatherRanking } from "./weekly-weather-ranking";

function expectRanked(items: ReturnType<typeof buildWeeklyWeatherRanking>): void {
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    expect(previous).toBeDefined();
    expect(current).toBeDefined();
    if (previous === undefined || current === undefined) continue;
    expect(previous.rainFreeDays).toBeGreaterThanOrEqual(current.rainFreeDays);
    if (previous.rainFreeDays === current.rainFreeDays) {
      const previousRain = previous.totalRainMm ?? Number.POSITIVE_INFINITY;
      const currentRain = current.totalRainMm ?? Number.POSITIVE_INFINITY;
      expect(previousRain).toBeLessThanOrEqual(currentRain);
    }
  }
}

describe("weather rankings", () => {
  it("ranks all baked destinations by rain-free days before rain totals", async () => {
    const dataset = await getBakedDataset();
    const items = buildWeeklyWeatherRanking(dataset, "en");

    expect(items.length).toBe(dataset.cities.length);
    expectRanked(items);
  });

  it("localizes destination links without changing the weekly ranking order", async () => {
    const dataset = await getBakedDataset();
    const english = buildWeeklyWeatherRanking(dataset, "en");
    const simplified = buildWeeklyWeatherRanking(dataset, "zh-cn");

    expect(simplified.map((item) => item.cityId)).toEqual(english.map((item) => item.cityId));
    expect(english[0]?.path.startsWith("/zh-cn/")).toBe(false);
    expect(simplified[0]?.path.startsWith("/zh-cn/")).toBe(true);
  });

  it("ranks only the next real weekend calendar dates", async () => {
    const dataset = await getBakedDataset();
    const items = buildWeekendWeatherRanking(dataset, "en");

    expect(items.length).toBeGreaterThan(0);
    expectRanked(items);
    for (const item of items) {
      expect(item.totalDays).toBeGreaterThanOrEqual(1);
      expect(item.totalDays).toBeLessThanOrEqual(2);
      for (const date of item.rainFreeDates) {
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        expect([0, 6]).toContain(weekday);
      }
    }
  });

  it("localizes weekend destination links without changing order", async () => {
    const dataset = await getBakedDataset();
    const english = buildWeekendWeatherRanking(dataset, "en");
    const traditional = buildWeekendWeatherRanking(dataset, "zh-hant");

    expect(traditional.map((item) => item.cityId)).toEqual(english.map((item) => item.cityId));
    expect(traditional[0]?.path.startsWith("/zh-hant/")).toBe(true);
  });
});
