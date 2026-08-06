import { describe, expect, it } from "vitest";
import { assessActivityWeather } from "./weather-score";
import type { WeatherWindowSnapshot } from "./types";

function weather(overrides: Partial<WeatherWindowSnapshot> = {}): WeatherWindowSnapshot {
  return {
    source: "snapshot",
    updatedAt: "2026-08-06T09:00:00+08:00",
    condition: "晴",
    temperatureMinC: 12,
    temperatureMaxC: 25,
    rainProbability: 10,
    precipitationMm: 0,
    windSpeedKph: 7,
    windGustKph: 14,
    cloudCover: 35,
    visibilityM: 20_000,
    uvIndex: 7,
    sunrise: "06:30",
    sunset: "20:20",
    ...overrides,
  };
}

describe("trip activity weather scoring", () => {
  it("rewards a calm and dry salt-lake window", () => {
    const result = assessActivityWeather("salt_lake", weather());
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.riskLevel).toBe("low");
  });

  it("penalizes wind and rain for a salt-lake mirror experience", () => {
    const result = assessActivityWeather(
      "salt_lake",
      weather({ rainProbability: 75, windSpeedKph: 30, windGustKph: 48, cloudCover: 90 }),
    );
    expect(result.score).toBeLessThan(50);
    expect(result.riskLevel).toBe("high");
  });

  it("keeps indoor activities resilient when weather is unavailable", () => {
    const result = assessActivityWeather("indoor", null);
    expect(result.score).toBe(90);
    expect(result.riskLevel).toBe("low");
  });
});
