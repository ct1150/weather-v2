import { describe, expect, it } from "vitest";
import {
  buildDiscoveryFunnelContext,
  daysUntilDepartureBucket,
  discoveryTripLengthDays,
} from "./discovery-funnel";

const preferences = {
  intent: "dry" as const,
  from: "2026-08-25",
  to: "2026-08-27",
  rainProbabilityMax: 40,
  temperatureMinC: null,
  temperatureMaxC: 31,
  windSpeedMaxKph: null,
  partyProfile: null,
  theme: null,
};

const reachability = {
  originId: "sg-singapore" as const,
  mode: "flight" as const,
  maxTravelMinutes: 360 as const,
};

describe("discovery funnel dimensions", () => {
  it("builds bounded, non-identifying dimensions", () => {
    expect(
      buildDiscoveryFunnelContext({
        preferences,
        reachability,
        now: new Date("2026-08-19T18:00:00Z"),
      }),
    ).toEqual({
      origin_id: "sg-singapore",
      transport_mode: "flight",
      max_travel_minutes: 360,
      days_until_departure_bucket: "3-7d",
      trip_length_days: 3,
      rain_limit_set: true,
      wind_limit_set: false,
      temperature_limit_set: true,
    });
  });

  it("uses stable departure buckets and inclusive trip length", () => {
    const now = new Date("2026-08-19T23:59:59Z");
    expect(daysUntilDepartureBucket("2026-08-21", now)).toBe("0-2d");
    expect(daysUntilDepartureBucket("2026-08-26", now)).toBe("3-7d");
    expect(daysUntilDepartureBucket("2026-09-02", now)).toBe("8-14d");
    expect(daysUntilDepartureBucket("2026-09-03", now)).toBe("15d+");
    expect(discoveryTripLengthDays("2026-08-25", "2026-08-27")).toBe(3);
  });
});
