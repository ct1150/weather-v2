import { describe, expect, it } from "vitest";

import type { TripActivity } from "./activity-intelligence";
import type { ActivityHourlyWeather } from "./activity-risk";
import { buildDeterministicReplan } from "./replan-solver";

function activity(id: string, startTime: string, overrides: Partial<TripActivity> = {}): TripActivity {
  return {
    id,
    title: id,
    cityId: "jp-tokyo",
    startTime,
    endTime: null,
    durationMinutes: 120,
    latitude: 35.68,
    longitude: 139.76,
    category: "leisure",
    environment: "outdoor",
    weatherSensitivity: ["rain", "heat", "cold", "wind", "uv"],
    flexibility: "movable",
    reservation: "none",
    priority: "preferred",
    poiId: null,
    alternatives: [],
    notes: "",
    ...overrides,
  };
}

function hour(hourValue: number, rainProbability = 10, precipitationMm = 0): ActivityHourlyWeather {
  return {
    cityId: "jp-tokyo",
    localTime: `2026-08-09T${String(hourValue).padStart(2, "0")}:00`,
    weatherCode: rainProbability >= 75 ? 61 : 1,
    condition: rainProbability >= 75 ? "Rain" : "Cloudy",
    temperatureC: 27,
    apparentTemperatureC: 28,
    precipitationMm,
    rainProbability,
    humidity: 60,
    windSpeedKph: 8,
    windGustKph: 14,
    uvIndex: 4,
    cloudCover: 45,
    visibilityM: 18000,
    dataQuality: "good",
  };
}

function weatherDay(rainyHours: ReadonlyArray<number>): ReadonlyArray<ActivityHourlyWeather> {
  return Array.from({ length: 16 }, (_, index) => {
    const hourValue = index + 7;
    return rainyHours.includes(hourValue) ? hour(hourValue, 90, 7) : hour(hourValue);
  });
}

function solve(
  activities: ReadonlyArray<TripActivity>,
  hourly: ReadonlyArray<ActivityHourlyWeather>,
  fallbackActivities: ReadonlyArray<TripActivity> = [],
) {
  return buildDeterministicReplan({
    date: "2026-08-09",
    weatherSnapshotId: "snapshot-1",
    activities,
    hourly,
    fallbackActivities,
    partyProfile: "adults",
  });
}

describe("Phase 8 deterministic replan solver", () => {
  it("leaves high-risk fixed, required-reservation and transport activities unchanged", () => {
    const fixed = activity("fixed-ticket", "09:00", {
      flexibility: "fixed",
      reservation: "required",
      priority: "must",
    });
    const transport = activity("airport-train", "12:00", {
      category: "transport",
      flexibility: "movable",
      reservation: "none",
    });
    const proposal = solve([fixed, transport], weatherDay([9, 10, 12, 13]));

    expect(proposal.changes).toEqual([]);
    expect(proposal.unchangedFixedActivityIds).toEqual(["fixed-ticket", "airport-train"]);
  });

  it("prefers the best same-day safer time shift before replacement", () => {
    const outdoor = activity("garden", "09:00");
    const fallback = activity("museum", "09:00", {
      title: "Indoor museum",
      environment: "indoor",
      weatherSensitivity: [],
      category: "attraction",
      poiId: "museum-1",
    });
    const proposal = solve([outdoor], weatherDay([9, 10, 11, 12]), [fallback]);

    expect(proposal.changes).toHaveLength(1);
    expect(proposal.changes[0]).toMatchObject({
      kind: "move_time",
      activityId: "garden",
      before: { startTime: "09:00" },
      after: { startTime: "13:00" },
      travelDeltaMinutes: 0,
      reasonCodes: ["better_hourly_window"],
    });
    expect(proposal.changes[0]?.riskReduction ?? 0).toBeGreaterThan(0);
    expect(proposal.changes[0]?.riskAfter.score ?? 0).toBeGreaterThan(
      proposal.changes[0]?.riskBefore.score ?? 100,
    );
  });

  it("rejects a safer time candidate that overlaps another known activity", () => {
    const outdoor = activity("garden", "09:00");
    const blocker = activity("lunch-booking", "13:00", {
      durationMinutes: 120,
      environment: "indoor",
      weatherSensitivity: [],
      flexibility: "fixed",
      reservation: "required",
    });
    const proposal = solve([outdoor, blocker], weatherDay([9, 10, 11, 12, 15, 16]));

    expect(proposal.changes).toHaveLength(1);
    expect(proposal.changes[0]).toMatchObject({
      kind: "move_time",
      activityId: "garden",
      after: { startTime: "17:00" },
    });
    expect(proposal.unchangedFixedActivityIds).toContain("lunch-booking");
  });

  it("uses a lower-risk indoor fallback when no adequate safer time window exists", () => {
    const outdoor = activity("river-walk", "09:00");
    const fallback = activity("aquarium", "09:00", {
      title: "Aquarium",
      environment: "indoor",
      weatherSensitivity: [],
      category: "attraction",
      poiId: "aquarium-1",
      latitude: 35.66,
      longitude: 139.78,
    });
    const proposal = solve([outdoor], weatherDay(Array.from({ length: 16 }, (_, i) => i + 7)), [fallback]);

    expect(proposal.changes).toHaveLength(1);
    expect(proposal.changes[0]).toMatchObject({
      kind: "replace_activity",
      activityId: "river-walk",
      after: { title: "Aquarium", startTime: "09:00" },
      reasonCodes: ["indoor_fallback"],
    });
    expect(proposal.changes[0]?.travelDeltaMinutes).not.toBeNull();
  });

  it("never replaces a must-do activity even if an indoor fallback is safer", () => {
    const mustDo = activity("must-see-garden", "09:00", { priority: "must" });
    const fallback = activity("museum", "09:00", {
      environment: "indoor",
      weatherSensitivity: [],
      category: "attraction",
    });
    const proposal = solve(
      [mustDo],
      weatherDay(Array.from({ length: 16 }, (_, i) => i + 7)),
      [fallback],
    );

    expect(proposal.changes).toEqual([]);
  });

  it("does not generate optimistic changes without overlapping hourly coverage", () => {
    const proposal = solve([activity("garden", "09:00")], [hour(18)]);

    expect(proposal.changes).toEqual([]);
    expect(proposal.riskBefore).toBeNull();
    expect(proposal.riskAfter).toBeNull();
  });

  it("returns byte-for-byte equivalent proposal values for identical inputs", () => {
    const activities = [activity("garden", "09:00"), activity("cafe", "16:00", {
      environment: "indoor",
      weatherSensitivity: [],
      durationMinutes: 60,
    })];
    const hourly = weatherDay([9, 10]);

    expect(solve(activities, hourly)).toEqual(solve(activities, hourly));
  });
});
