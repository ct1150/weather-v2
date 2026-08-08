import { describe, expect, it } from "vitest";
import { assessWeatherChange, type TripWeatherObservation } from "./weather-intelligence";

function observation(overrides: Partial<TripWeatherObservation> = {}): TripWeatherObservation {
  return {
    snapshotId: "snapshot-a",
    cityId: "jp-tokyo",
    date: "2026-08-12",
    observedAt: "2026-08-08T00:00:00.000Z",
    rainProbability: 20,
    precipitationMm: 0.5,
    temperatureMinC: 23,
    temperatureMaxC: 31,
    windSpeedKph: 12,
    windGustKph: 20,
    uvIndex: 7,
    ...overrides,
  };
}

describe("Phase 5 weather intelligence", () => {
  it("suppresses small forecast noise", () => {
    const result = assessWeatherChange({
      previous: observation(),
      current: observation({
        snapshotId: "snapshot-b",
        rainProbability: 32,
        precipitationMm: 1.2,
        windSpeedKph: 17,
      }),
      theme: "city",
      partyProfile: "adults",
    });

    expect(result).toEqual({
      severity: "none",
      recommendation: "keep_plan",
      impactScore: 0,
      reasonCodes: [],
    });
  });

  it("marks a material outdoor rain deterioration as actionable", () => {
    const result = assessWeatherChange({
      previous: observation({ rainProbability: 25, precipitationMm: 0.3 }),
      current: observation({
        snapshotId: "snapshot-b",
        rainProbability: 82,
        precipitationMm: 14,
        windSpeedKph: 31,
        windGustKph: 48,
      }),
      theme: "outdoor",
      partyProfile: "family",
    });

    expect(result.severity).toBe("action");
    expect(result.recommendation).toBe("activate_plan_b");
    expect(result.impactScore).toBeGreaterThanOrEqual(55);
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "RAIN_PROBABILITY_JUMP",
        "HEAVY_RAIN_THRESHOLD",
        "PRECIPITATION_VOLUME_JUMP",
        "WIND_THRESHOLD",
        "GUST_THRESHOLD",
      ]),
    );
  });

  it("uses stricter heat thresholds for senior trips", () => {
    const adults = assessWeatherChange({
      previous: observation({ temperatureMaxC: 32 }),
      current: observation({ snapshotId: "snapshot-b", temperatureMaxC: 34 }),
      theme: "city",
      partyProfile: "adults",
    });
    const seniors = assessWeatherChange({
      previous: observation({ temperatureMaxC: 32 }),
      current: observation({ snapshotId: "snapshot-b", temperatureMaxC: 34 }),
      theme: "city",
      partyProfile: "senior",
    });

    expect(adults.reasonCodes).not.toContain("HEAT_THRESHOLD");
    expect(seniors.reasonCodes).toContain("HEAT_THRESHOLD");
    expect(seniors.severity).toBe("watch");
  });

  it("reduces the same deterioration for indoor days", () => {
    const previous = observation({ rainProbability: 25, precipitationMm: 0.2 });
    const current = observation({
      snapshotId: "snapshot-b",
      rainProbability: 78,
      precipitationMm: 9,
      windSpeedKph: 30,
    });

    const outdoor = assessWeatherChange({ previous, current, theme: "outdoor", partyProfile: "adults" });
    const indoor = assessWeatherChange({ previous, current, theme: "indoor", partyProfile: "adults" });

    expect(outdoor.impactScore).toBeGreaterThan(indoor.impactScore);
    expect(outdoor.severity).toBe("action");
    expect(indoor.severity).toBe("watch");
  });

  it("does not alert when weather improves", () => {
    const result = assessWeatherChange({
      previous: observation({
        rainProbability: 85,
        precipitationMm: 16,
        windSpeedKph: 34,
        windGustKph: 50,
        temperatureMaxC: 36,
      }),
      current: observation({
        snapshotId: "snapshot-b",
        rainProbability: 25,
        precipitationMm: 1,
        windSpeedKph: 15,
        windGustKph: 22,
        temperatureMaxC: 30,
      }),
      theme: "outdoor",
      partyProfile: "family",
    });

    expect(result.severity).toBe("none");
    expect(result.recommendation).toBe("keep_plan");
    expect(result.reasonCodes).toEqual([]);
  });
});
