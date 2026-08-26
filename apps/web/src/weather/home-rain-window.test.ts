import { describe, expect, it } from "vitest";
import {
  resolveHomeWeatherDates,
  summarizeHomeCityRain,
  summarizeHomeCountryRain,
  type HomeCityWeatherSeries,
} from "./home-rain-window";

const dates = [
  "2026-08-24",
  "2026-08-25",
  "2026-08-26",
  "2026-08-27",
  "2026-08-28",
  "2026-08-29",
  "2026-08-30",
];

function city(
  cityId: string,
  rain: ReadonlyArray<{ condition: string; mm: number; chance: number }>,
): HomeCityWeatherSeries {
  return {
    cityId,
    cityName: cityId,
    days: dates.map((localDate, index) => ({
      localDate,
      conditionLabel: rain[index]?.condition ?? "Clear",
      precipitationMm: rain[index]?.mm ?? 0,
      rainProbability: rain[index]?.chance ?? 0,
    })),
  };
}

describe("home rain window", () => {
  it("resolves next 7 days, the real weekend and inclusive custom dates", () => {
    expect(resolveHomeWeatherDates(dates, "7d", "", "")).toEqual(dates);
    expect(resolveHomeWeatherDates(dates, "weekend", "", "")).toEqual([
      "2026-08-29",
      "2026-08-30",
    ]);
    expect(
      resolveHomeWeatherDates(dates, "custom", "2026-08-26", "2026-08-28"),
    ).toEqual(["2026-08-26", "2026-08-27", "2026-08-28"]);
  });

  it("uses condition and precipitation amount before probability for mostly-dry days", () => {
    const sample = city("jp-tokyo", [
      { condition: "Clear", mm: 0.2, chance: 80 },
      { condition: "Light rain", mm: 0.1, chance: 10 },
      { condition: "Partly cloudy", mm: 0.8, chance: 20 },
    ]);
    const summary = summarizeHomeCityRain(sample, dates.slice(0, 3));
    expect(summary?.dryDays).toBe(1);
    expect(summary?.dryPercent).toBe(33);
    expect(summary?.totalRainMm).toBe(1.1);
    expect(summary?.peakRainChance).toBe(80);
  });

  it("summarizes a country from its three strongest dry-window cities", () => {
    const allDry = Array.from({ length: 7 }, () => ({
      condition: "Clear",
      mm: 0,
      chance: 10,
    }));
    const sixDry = allDry.map((day, index) =>
      index === 0 ? { condition: "Rain", mm: 4, chance: 90 } : day,
    );
    const fiveDry = allDry.map((day, index) =>
      index < 2 ? { condition: "Rain", mm: 3, chance: 85 } : day,
    );
    const wet = allDry.map((day, index) =>
      index < 4 ? { condition: "Rain", mm: 6, chance: 95 } : day,
    );

    const summary = summarizeHomeCountryRain(
      [city("a", allDry), city("b", sixDry), city("c", fiveDry), city("d", wet)],
      dates,
    );

    expect(summary.topCityIds).toEqual(["a", "b", "c"]);
    expect(summary.bestDryDays).toBe(7);
    expect(summary.totalDays).toBe(7);
    expect(summary.score).toBe(86);
  });
});
