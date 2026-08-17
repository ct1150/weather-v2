import { describe, expect, it } from "vitest";

import type { TripActivity } from "./activity-intelligence";
import type { ActivityHourlyWeather } from "./activity-risk";
import { buildDeterministicReplan } from "./replan-solver";

function activity(id: string, overrides: Partial<TripActivity> = {}): TripActivity {
  return {
    id,
    title: id,
    cityId: "jp-tokyo",
    startTime: "09:00",
    endTime: null,
    durationMinutes: 120,
    latitude: 35.68,
    longitude: 139.76,
    category: "leisure",
    environment: "outdoor",
    weatherSensitivity: ["rain"],
    flexibility: "movable",
    reservation: "none",
    priority: "preferred",
    poiId: null,
    alternatives: [],
    notes: "",
    ...overrides,
  };
}

function hourly(): ReadonlyArray<ActivityHourlyWeather> {
  return Array.from({ length: 16 }, (_, index) => ({
    cityId: "jp-tokyo",
    localTime: `2026-08-09T${String(index + 7).padStart(2, "0")}:00`,
    weatherCode: 61,
    condition: "Rain",
    temperatureC: 26,
    apparentTemperatureC: 27,
    precipitationMm: 8,
    rainProbability: 95,
    humidity: 70,
    windSpeedKph: 9,
    windGustKph: 14,
    uvIndex: 3,
    cloudCover: 90,
    visibilityM: 10000,
    dataQuality: "good",
  }));
}

describe("route-aware deterministic replan", () => {
  it("uses routed minutes and breaks equal-risk fallback ties by real travel cost", () => {
    const source = activity("source");
    const farButGeometricallyClose = activity("fallback-a", {
      title: "A",
      environment: "indoor",
      weatherSensitivity: [],
      category: "attraction",
      latitude: 35.681,
      longitude: 139.761,
    });
    const routedNear = activity("fallback-b", {
      title: "B",
      environment: "indoor",
      weatherSensitivity: [],
      category: "attraction",
      latitude: 35.7,
      longitude: 139.79,
    });

    const proposal = buildDeterministicReplan({
      date: "2026-08-09",
      weatherSnapshotId: "snapshot-route",
      activities: [source],
      hourly: hourly(),
      fallbackActivities: [farButGeometricallyClose, routedNear],
      routeCostMatrix: {
        entries: [
          { fromId: "source", toId: "fallback-a", durationMinutes: 55, distanceMeters: 9000 },
          { fromId: "source", toId: "fallback-b", durationMinutes: 8, distanceMeters: 3200 },
        ],
      },
      partyProfile: "adults",
    });

    expect(proposal.changes).toHaveLength(1);
    expect(proposal.changes[0]).toMatchObject({
      kind: "replace_activity",
      after: { title: "B" },
      travelDeltaMinutes: 8,
    });
  });
});
