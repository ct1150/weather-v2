export type NotificationPreferenceState = "disabled" | "enabled" | "unsubscribed";
export type NotificationSeverity = "none" | "watch" | "action";
export type NotificationConfidence = "low" | "medium" | "high";
export type NotificationSeverityThreshold = "watch" | "action";

export interface NotificationQuietHours {
  /** Inclusive local minute-of-day, 0..1439. */
  readonly startMinute: number;
  /** Exclusive local minute-of-day, 0..1439. May wrap across midnight. */
  readonly endMinute: number;
}

export interface NotificationPreference {
  readonly state: NotificationPreferenceState;
  readonly severityThreshold: NotificationSeverityThreshold;
  readonly quietHours: NotificationQuietHours | null;
  readonly maxPerLocalDay: number;
}

export interface TripNotificationPreference {
  readonly monitoringEnabled: boolean;
}

export interface NotificationCandidate {
  readonly severity: NotificationSeverity;
  readonly impactScore: number;
  readonly confidence: NotificationConfidence;
  /** Destination-local minute-of-day, 0..1439. */
  readonly localMinuteOfDay: number;
  readonly sentCountToday: number;
}

export type NotificationEligibilityReason =
  | "eligible"
  | "global_disabled"
  | "unsubscribed"
  | "trip_monitoring_disabled"
  | "low_confidence"
  | "minor_weather_noise"
  | "below_severity_threshold"
  | "quiet_hours"
  | "daily_limit_reached"
  | "invalid_input";

export interface NotificationEligibility {
  readonly eligible: boolean;
  readonly reason: NotificationEligibilityReason;
}

/**
 * Conservative product defaults. They create no delivery side effect: the global state is off,
 * action-level weather is required, local quiet hours span 22:00–08:00, and at most one eligible
 * notification may pass readiness per destination-local day when a user later opts in.
 */
export const DEFAULT_NOTIFICATION_PREFERENCE: NotificationPreference = Object.freeze({
  state: "disabled",
  severityThreshold: "action",
  quietHours: Object.freeze({ startMinute: 22 * 60, endMinute: 8 * 60 }),
  maxPerLocalDay: 1,
});

export const DEFAULT_TRIP_NOTIFICATION_PREFERENCE: TripNotificationPreference = Object.freeze({
  monitoringEnabled: false,
});

function validMinute(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < 24 * 60;
}

function validCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validImpact(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function validPreference(preference: NotificationPreference): boolean {
  if (!Number.isInteger(preference.maxPerLocalDay) || preference.maxPerLocalDay < 1 || preference.maxPerLocalDay > 10) {
    return false;
  }
  const quiet = preference.quietHours;
  return quiet === null || (validMinute(quiet.startMinute) && validMinute(quiet.endMinute));
}

function inQuietHours(minute: number, quiet: NotificationQuietHours | null): boolean {
  if (quiet === null || quiet.startMinute === quiet.endMinute) return false;
  if (quiet.startMinute < quiet.endMinute) {
    return minute >= quiet.startMinute && minute < quiet.endMinute;
  }
  return minute >= quiet.startMinute || minute < quiet.endMinute;
}

function severityRank(value: NotificationSeverity | NotificationSeverityThreshold): number {
  switch (value) {
    case "none":
      return 0;
    case "watch":
      return 1;
    case "action":
      return 2;
  }
}

function severityConsistent(severity: NotificationSeverity, impactScore: number): boolean {
  if (severity === "none") return impactScore < 20;
  if (severity === "watch") return impactScore >= 20 && impactScore < 55;
  return impactScore >= 55;
}

/**
 * Pure readiness check. Passing this function means only that a future delivery layer may enqueue
 * the event; it never identifies a channel, address or provider and never sends anything.
 */
export function evaluateNotificationEligibility(input: {
  readonly preference: NotificationPreference;
  readonly tripPreference: TripNotificationPreference;
  readonly candidate: NotificationCandidate;
}): NotificationEligibility {
  const { preference, tripPreference, candidate } = input;

  if (
    !validPreference(preference) ||
    !validMinute(candidate.localMinuteOfDay) ||
    !validCount(candidate.sentCountToday) ||
    !validImpact(candidate.impactScore) ||
    !severityConsistent(candidate.severity, candidate.impactScore)
  ) {
    return { eligible: false, reason: "invalid_input" };
  }

  if (preference.state === "unsubscribed") return { eligible: false, reason: "unsubscribed" };
  if (preference.state !== "enabled") return { eligible: false, reason: "global_disabled" };
  if (!tripPreference.monitoringEnabled) {
    return { eligible: false, reason: "trip_monitoring_disabled" };
  }
  if (candidate.confidence === "low") return { eligible: false, reason: "low_confidence" };
  if (candidate.severity === "none" || candidate.impactScore < 20) {
    return { eligible: false, reason: "minor_weather_noise" };
  }
  if (severityRank(candidate.severity) < severityRank(preference.severityThreshold)) {
    return { eligible: false, reason: "below_severity_threshold" };
  }
  if (inQuietHours(candidate.localMinuteOfDay, preference.quietHours)) {
    return { eligible: false, reason: "quiet_hours" };
  }
  if (candidate.sentCountToday >= preference.maxPerLocalDay) {
    return { eligible: false, reason: "daily_limit_reached" };
  }
  return { eligible: true, reason: "eligible" };
}
