import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCE,
  DEFAULT_TRIP_NOTIFICATION_PREFERENCE,
  evaluateNotificationEligibility,
  type NotificationCandidate,
  type NotificationPreference,
  type TripNotificationPreference,
} from "./notification-readiness";

const actionCandidate: NotificationCandidate = {
  severity: "action",
  impactScore: 70,
  confidence: "high",
  localMinuteOfDay: 10 * 60,
  sentCountToday: 0,
};

const enabled: NotificationPreference = {
  state: "enabled",
  severityThreshold: "action",
  quietHours: { startMinute: 22 * 60, endMinute: 8 * 60 },
  maxPerLocalDay: 1,
};

const monitored: TripNotificationPreference = { monitoringEnabled: true };

function evaluate(
  candidate: NotificationCandidate = actionCandidate,
  preference: NotificationPreference = enabled,
  tripPreference: TripNotificationPreference = monitored,
) {
  return evaluateNotificationEligibility({ preference, tripPreference, candidate });
}

describe("notification readiness", () => {
  it("defaults globally and per-trip to off", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCE).toMatchObject({
      state: "disabled",
      severityThreshold: "action",
      maxPerLocalDay: 1,
    });
    expect(DEFAULT_TRIP_NOTIFICATION_PREFERENCE).toEqual({ monitoringEnabled: false });
    expect(evaluate(actionCandidate, DEFAULT_NOTIFICATION_PREFERENCE, monitored)).toEqual({
      eligible: false,
      reason: "global_disabled",
    });
    expect(evaluate(actionCandidate, enabled, DEFAULT_TRIP_NOTIFICATION_PREFERENCE)).toEqual({
      eligible: false,
      reason: "trip_monitoring_disabled",
    });
  });

  it("treats explicit unsubscribe as stronger than normal disabled state", () => {
    expect(evaluate(actionCandidate, { ...enabled, state: "unsubscribed" })).toEqual({
      eligible: false,
      reason: "unsubscribed",
    });
  });

  it("blocks low-confidence weather even when severity is action", () => {
    expect(evaluate({ ...actionCandidate, confidence: "low" })).toEqual({
      eligible: false,
      reason: "low_confidence",
    });
  });

  it("blocks minor weather noise and respects the severity threshold", () => {
    expect(
      evaluate({
        ...actionCandidate,
        severity: "none",
        impactScore: 12,
        confidence: "high",
      }),
    ).toEqual({ eligible: false, reason: "minor_weather_noise" });

    expect(
      evaluate({
        ...actionCandidate,
        severity: "watch",
        impactScore: 35,
        confidence: "medium",
      }),
    ).toEqual({ eligible: false, reason: "below_severity_threshold" });

    expect(
      evaluate(
        { ...actionCandidate, severity: "watch", impactScore: 35, confidence: "medium" },
        { ...enabled, severityThreshold: "watch" },
      ),
    ).toEqual({ eligible: true, reason: "eligible" });
  });

  it("enforces quiet hours that wrap across midnight", () => {
    for (const localMinuteOfDay of [22 * 60, 23 * 60 + 59, 0, 7 * 60 + 59]) {
      expect(evaluate({ ...actionCandidate, localMinuteOfDay })).toEqual({
        eligible: false,
        reason: "quiet_hours",
      });
    }
    for (const localMinuteOfDay of [8 * 60, 12 * 60, 21 * 60 + 59]) {
      expect(evaluate({ ...actionCandidate, localMinuteOfDay })).toEqual({
        eligible: true,
        reason: "eligible",
      });
    }
  });

  it("supports ordinary non-wrapping quiet hours", () => {
    const preference = { ...enabled, quietHours: { startMinute: 12 * 60, endMinute: 14 * 60 } };
    expect(evaluate({ ...actionCandidate, localMinuteOfDay: 13 * 60 }, preference)).toEqual({
      eligible: false,
      reason: "quiet_hours",
    });
    expect(evaluate({ ...actionCandidate, localMinuteOfDay: 14 * 60 }, preference)).toEqual({
      eligible: true,
      reason: "eligible",
    });
  });

  it("enforces the destination-local daily cap", () => {
    expect(evaluate({ ...actionCandidate, sentCountToday: 1 })).toEqual({
      eligible: false,
      reason: "daily_limit_reached",
    });
    expect(
      evaluate(
        { ...actionCandidate, sentCountToday: 1 },
        { ...enabled, maxPerLocalDay: 2 },
      ),
    ).toEqual({ eligible: true, reason: "eligible" });
  });

  it("fails closed when severity and impact are inconsistent or input bounds are invalid", () => {
    for (const candidate of [
      { ...actionCandidate, severity: "action" as const, impactScore: 40 },
      { ...actionCandidate, severity: "watch" as const, impactScore: 70 },
      { ...actionCandidate, localMinuteOfDay: 1440 },
      { ...actionCandidate, sentCountToday: -1 },
      { ...actionCandidate, impactScore: 101 },
    ]) {
      expect(evaluate(candidate)).toEqual({ eligible: false, reason: "invalid_input" });
    }
  });

  it("has no delivery channel or address/provider fields", () => {
    const keys = Object.keys(DEFAULT_NOTIFICATION_PREFERENCE);
    expect(keys).not.toEqual(
      expect.arrayContaining(["email", "pushToken", "endpoint", "provider", "phone", "address"]),
    );
    expect(evaluate()).toEqual({ eligible: true, reason: "eligible" });
  });
});
