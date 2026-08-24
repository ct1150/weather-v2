import { describe, expect, it } from "vitest";
import { getBakedDataset } from "../build/bake";
import { buildWeeklyWeatherRanking } from "./weekly-weather-ranking";

describe("weekly weather ranking", () => {
  it("ranks all baked destinations by rain-free days before rain totals", async () => {
    const dataset = await getBakedDataset();
    const items = buildWeeklyWeatherRanking(dataset, "en");

    expect(items.length).toBe(dataset.cities.length);
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
  });

  it("localizes destination links without changing the ranking order", async () => {
    const dataset = await getBakedDataset();
    const english = buildWeeklyWeatherRanking(dataset, "en");
    const simplified = buildWeeklyWeatherRanking(dataset, "zh-cn");

    expect(simplified.map((item) => item.cityId)).toEqual(english.map((item) => item.cityId));
    expect(english[0]?.path.startsWith("/zh-cn/")).toBe(false);
    expect(simplified[0]?.path.startsWith("/zh-cn/")).toBe(true);
  });
});
