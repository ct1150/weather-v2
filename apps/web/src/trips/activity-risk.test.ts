import { describe, expect, it } from "vitest";

import type { TripActivity } from "./activity-intelligence";
import {
  assessActivityHourlyRisk,
  type ActivityHourlyWeather,
  type ActivityRiskPartyProfile,
} from "./activity-risk";

function activity(overrides: Partial<TripActivity> = {}): TripActivity {
  return {
    id: "activity-day-1-1-park",
    title: "City park walk",
    cityId: "jp-tokyo",
    startTime: "09:00",
    endTime: null,
    durationMinutes: 120,
    latitude: 35.6,
    longitude: 139.7,
    category: "leisure",
    environment: "outdoor",
    weatherSensitivity: ["rain", "heat", "cold", "wind", "uv"],
    flexibility: "movable",
    reservation: "none",
    priority: "preferred",
    poiId: "poi-park",
    alternatives: [],
    notes: "",
    ...overrides,
  };
}

function hour(
  localTime: string,
  overrides: Partial<ActivityHourlyWeather> = {},
): ActivityHourlyWeather {
  return {
    cityId: "jp-tokyo",
    localTime,
    weatherCode: 1,
    condition: "Cloudy",
    temperatureC: 27,
    apparentTemperatureC: 28,
    precipitationMm: 0,
    rainProbability: 10,
    humidity: 60,
    windSpeedKph: 8,
    windGustKph: 14,
    uvIndex: 4,
    cloudCover: 45,
    visibilityM: 18000,
    dataQuality: "good",
    ...overrides,
  };
}

function assess(
  candidate: TripActivity,
  hourly: ReadonlyArray<ActivityHourlyWeather>,
  partyProfile: ActivityRiskPartyProfile = "adults",
) {
  return assessActivityHourlyRisk({
    activity: candidate,
    date: "2026-08-09",
    hourly,
    partyProfile,
  });
}

describe("Phase 8 activity hourly risk", () => {
  it("uses only the hourly rows overlapping the activity window", () => {
    const result = assess(activity(), [
      hour("2026-08-09T09:00"),
      hour("2026-08-09T10:00"),
      hour("2026-08-09T18:00", { rainProbability: 95, precipitationMm: 12 }),
    ]);

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe("low");
    expect(result.affectedWindow).toEqual({ startTime: "09:00", endTime: "11:00" });
    expect(result.reasonCodes).not.toContain("rain_high");
  });

  it("marks a rain-sensitive outdoor activity high risk under heavy rain", () => {
    const result = assess(activity(), [
      hour("2026-08-09T09:00", { rainProbability: 82, precipitationMm: 4.5 }),
      hour("2026-08-09T10:00", { rainProbability: 90, precipitationMm: 7 }),
    ]);

    expect(result.level).toBe("high");
    expect(result.score).toBeLessThan(50);
    expect(result.reasonCodes).toContain("rain_high");
    expect(result.moveMayReduceRisk).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("keeps indoor activities materially safer for rain and UV", () => {
    const indoor = activity({
      title: "Museum",
      environment: "indoor",
      weatherSensitivity: [],
      category: "attraction",
    });
    const result = assess(indoor, [
      hour("2026-08-09T09:00", { rainProbability: 95, precipitationMm: 8, uvIndex: 10 }),
      hour("2026-08-09T10:00", { rainProbability: 92, precipitationMm: 5, uvIndex: 11 }),
    ]);

    expect(result.level).toBe("low");
    expect(result.reasonCodes).not.toContain("rain_high");
    expect(result.reasonCodes).not.toContain("uv_high");
  });

  it("uses more conservative heat thresholds for family and senior parties", () => {
    const hotHours = [
      hour("2026-08-09T09:00", { temperatureC: 32, apparentTemperatureC: 34 }),
      hour("2026-08-09T10:00", { temperatureC: 33, apparentTemperatureC: 35 }),
    ];
    const adults = assess(activity(), hotHours, "adults");
    const family = assess(activity(), hotHours, "family");
    const senior = assess(activity(), hotHours, "senior");

    expect(adults.score ?? 0).toBeGreaterThan(family.score ?? 0);
    expect(family.score ?? 0).toBeGreaterThanOrEqual(senior.score ?? 0);
    expect(family.reasonCodes).toContain("heat_high");
    expect(senior.reasonCodes).toContain("heat_high");
  });

  it("protects fixed or required-reservation activities from move recommendations", () => {
    const fixed = activity({ flexibility: "fixed", reservation: "required", priority: "must" });
    const result = assess(fixed, [
      hour("2026-08-09T09:00", { rainProbability: 92, precipitationMm: 9 }),
      hour("2026-08-09T10:00", { rainProbability: 88, precipitationMm: 6 }),
    ]);

    expect(result.level).toBe("high");
    expect(result.moveMayReduceRisk).toBe(false);
    expect(result.reasonCodes).toContain("constraint_fixed");
    expect(result.reasonCodes).toContain("reservation_required");
  });

  it("fails closed when activity time or overlapping hourly coverage is missing", () => {
    const noTime = assess(activity({ startTime: null }), [hour("2026-08-09T09:00")]);
    const noCoverage = assess(activity(), [hour("2026-08-09T15:00")]);

    expect(noTime).toMatchObject({
      score: null,
      level: "unknown",
      reasonCodes: ["missing_activity_time"],
      confidence: "unknown",
    });
    expect(noCoverage).toMatchObject({
      score: null,
      level: "unknown",
      reasonCodes: ["missing_hourly_coverage"],
      confidence: "unknown",
    });
  });
});
