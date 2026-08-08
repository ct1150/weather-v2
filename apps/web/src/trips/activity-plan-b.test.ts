import { describe, expect, it } from "vitest";
import type { TripForecastDay, TripWorkspaceDay } from "./workspace";
import { resolveConcretePlanB } from "./activity-plan-b";

function day(overrides: Partial<TripWorkspaceDay> = {}): TripWorkspaceDay {
  return {
    id: "day-1",
    dayNumber: 1,
    date: "2026-08-12",
    cityId: "jp-kyoto",
    cityName: "Kyoto",
    countryName: "Japan",
    theme: "outdoor",
    flexible: true,
    activities: ["14:00 Arashiyama Bamboo Grove"],
    notes: "",
    ...overrides,
  };
}

function forecast(overrides: Partial<TripForecastDay> = {}): TripForecastDay {
  return {
    cityId: "jp-kyoto",
    date: "2026-08-12",
    weatherCode: 61,
    condition: "Rain",
    temperatureMinC: 23,
    temperatureMaxC: 29,
    precipitationMm: 12,
    rainProbability: 82,
    windSpeedKph: 18,
    windGustKph: 28,
    uvIndex: 5,
    cloudCover: 90,
    visibilityM: 8_000,
    sunrise: "05:15",
    sunset: "18:50",
    dataQuality: "ok",
    ...overrides,
  };
}

describe("Phase 7 concrete Plan B", () => {
  it("turns a rainy outdoor activity into concrete indoor candidates", () => {
    const result = resolveConcretePlanB(day(), forecast(), "en");
    expect(result?.reason).toBe("rain");
    expect(result?.affectedActivity.title).toBe("Arashiyama Bamboo Grove");
    expect(result?.fixed).toBe(false);
    expect(result?.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result?.candidates.every((candidate) => candidate.poi.environment === "indoor")).toBe(
      true,
    );
  });

  it("preserves a fixed affected activity instead of pretending it can move", () => {
    const result = resolveConcretePlanB(
      day({ flexible: false, notes: "Ticket is fixed" }),
      forecast(),
      "zh-cn",
    );
    expect(result?.fixed).toBe(true);
  });

  it("stays silent for an indoor-only day or low-risk forecast", () => {
    expect(
      resolveConcretePlanB(
        day({ theme: "indoor", activities: ["14:00 Kyoto Railway Museum"] }),
        forecast(),
        "en",
      ),
    ).toBeNull();
    expect(
      resolveConcretePlanB(day(), forecast({ rainProbability: 20, precipitationMm: 0.2 }), "en"),
    ).toBeNull();
  });
});
