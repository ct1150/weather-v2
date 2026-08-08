import { describe, expect, it } from "vitest";

import type { TripActivity } from "./activity-intelligence";
import { destinationLocalClock, nextExecutableActivity, resolveActiveTripDay } from "./today-mode";
import type { TripCityOption, TripWorkspace } from "./workspace";

function activity(
  id: string,
  startTime: string,
  overrides: Partial<TripActivity> = {},
): TripActivity {
  return {
    id,
    title: id,
    cityId: "jp-tokyo",
    startTime,
    endTime: null,
    durationMinutes: 120,
    latitude: null,
    longitude: null,
    category: "leisure",
    environment: "outdoor",
    weatherSensitivity: ["rain", "heat", "wind", "uv"],
    flexibility: "movable",
    reservation: "none",
    priority: "preferred",
    poiId: null,
    alternatives: [],
    notes: "",
    ...overrides,
  };
}

function workspace(): TripWorkspace {
  return {
    version: 2,
    id: "trip-today",
    title: "Tokyo day",
    partyProfile: "adults",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2026-08-09",
        cityId: "jp-tokyo",
        cityName: "Tokyo",
        countryName: "Japan",
        theme: "outdoor",
        flexible: true,
        activities: ["09:00 Garden", "13:00 Museum", "18:00 Train"],
        activityItems: [
          activity("garden", "09:00"),
          activity("museum", "13:00", {
            environment: "indoor",
            weatherSensitivity: [],
            durationMinutes: 90,
          }),
          activity("train", "18:00", {
            category: "transport",
            flexibility: "fixed",
            reservation: "required",
            durationMinutes: 60,
          }),
        ],
        notes: "",
      },
    ],
  };
}

const cities: ReadonlyArray<TripCityOption> = [
  {
    cityId: "jp-tokyo",
    countrySlug: "japan",
    citySlug: "tokyo",
    cityName: "Tokyo",
    countryName: "Japan",
    latitude: 35.68,
    longitude: 139.76,
    timezone: "Asia/Tokyo",
    featured: true,
  },
];

describe("Phase 8 Today Mode", () => {
  it("uses the destination timezone rather than the device timezone", () => {
    const now = new Date("2026-08-08T16:30:00.000Z");
    expect(destinationLocalClock(now, "Asia/Tokyo")).toEqual({
      date: "2026-08-09",
      time: "01:30",
      minutes: 90,
    });
    expect(resolveActiveTripDay(workspace(), cities, now)?.day.id).toBe("day-1");
  });

  it("returns no active day when the destination-local date does not match", () => {
    const now = new Date("2026-08-10T00:00:00.000Z");
    expect(resolveActiveTripDay(workspace(), cities, now)).toBeNull();
  });

  it("finds the current/next structured activity from destination-local time", () => {
    const items = workspace().days[0]?.activityItems ?? [];
    expect(nextExecutableActivity(items, 9 * 60 + 30)?.id).toBe("garden");
    expect(nextExecutableActivity(items, 11 * 60 + 30)?.id).toBe("museum");
    expect(nextExecutableActivity(items, 17 * 60 + 30)?.id).toBe("train");
    expect(nextExecutableActivity(items, 19 * 60 + 30)).toBeNull();
  });
});
