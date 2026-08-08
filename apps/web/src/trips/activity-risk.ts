import type { TripActivity, TripWeatherSensitivity } from "./activity-intelligence";

export type ActivityRiskPartyProfile = "adults" | "family" | "senior";
export type ActivityRiskLevel = "low" | "medium" | "high" | "unknown";
export type ActivityRiskConfidence = "high" | "medium" | "unknown";

export type ActivityRiskReasonCode =
  | "missing_activity_time"
  | "invalid_activity_window"
  | "missing_hourly_coverage"
  | "rain_watch"
  | "rain_high"
  | "heat_watch"
  | "heat_high"
  | "cold_watch"
  | "cold_high"
  | "wind_watch"
  | "wind_high"
  | "uv_watch"
  | "uv_high"
  | "constraint_fixed"
  | "reservation_required";

export interface ActivityHourlyWeather {
  readonly cityId: string;
  readonly localTime: string;
  readonly weatherCode: number | null;
  readonly condition: string;
  readonly temperatureC: number | null;
  readonly apparentTemperatureC: number | null;
  readonly precipitationMm: number | null;
  readonly rainProbability: number | null;
  readonly humidity: number | null;
  readonly windSpeedKph: number | null;
  readonly windGustKph: number | null;
  readonly uvIndex: number | null;
  readonly cloudCover: number | null;
  readonly visibilityM: number | null;
  readonly dataQuality: string;
}

export interface ActivityRiskWindow {
  readonly startTime: string;
  readonly endTime: string;
}

export interface ActivityHourlyRisk {
  readonly activityId: string;
  readonly score: number | null;
  readonly level: ActivityRiskLevel;
  readonly affectedWindow: ActivityRiskWindow | null;
  readonly reasonCodes: ReadonlyArray<ActivityRiskReasonCode>;
  readonly moveMayReduceRisk: boolean;
  readonly fallbackAvailable: boolean;
  readonly confidence: ActivityRiskConfidence;
  readonly hourlyRowsUsed: number;
}

export interface AssessActivityHourlyRiskInput {
  readonly activity: TripActivity;
  readonly date: string;
  readonly hourly: ReadonlyArray<ActivityHourlyWeather>;
  readonly partyProfile: ActivityRiskPartyProfile;
}

interface ThresholdPair {
  readonly watch: number;
  readonly high: number;
}

const DEFAULT_DURATION_MINUTES = 120;

const HEAT_THRESHOLDS: Record<ActivityRiskPartyProfile, ThresholdPair> = {
  adults: { watch: 34, high: 38 },
  family: { watch: 31, high: 34 },
  senior: { watch: 29, high: 33 },
};

const COLD_THRESHOLDS: Record<ActivityRiskPartyProfile, ThresholdPair> = {
  adults: { watch: 8, high: 0 },
  family: { watch: 10, high: 4 },
  senior: { watch: 12, high: 6 },
};

const WIND_THRESHOLDS: Record<
  ActivityRiskPartyProfile,
  { readonly watch: number; readonly high: number; readonly gustWatch: number; readonly gustHigh: number }
> = {
  adults: { watch: 25, high: 35, gustWatch: 40, gustHigh: 50 },
  family: { watch: 22, high: 30, gustWatch: 36, gustHigh: 44 },
  senior: { watch: 20, high: 28, gustWatch: 34, gustHigh: 40 },
};

function parseClock(value: string | null): number | null {
  if (value === null) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock(minutes: number): string {
  if (minutes >= 1440) return "24:00";
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function resolveWindow(activity: TripActivity): { readonly start: number; readonly end: number } | null {
  const start = parseClock(activity.startTime);
  if (start === null) return null;
  const explicitEnd = parseClock(activity.endTime);
  if (activity.endTime !== null && explicitEnd === null) return { start, end: start };
  const end =
    explicitEnd ?? Math.min(1440, start + (activity.durationMinutes ?? DEFAULT_DURATION_MINUTES));
  return end > start ? { start, end } : { start, end: start };
}

function hourlyMinute(row: ActivityHourlyWeather, date: string): number | null {
  if (!row.localTime.startsWith(`${date}T`)) return null;
  const match = /T([01]\d|2[0-3]):([0-5]\d)$/u.exec(row.localTime);
  if (match?.[1] === undefined || match[2] === undefined) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function overlaps(rowMinute: number, start: number, end: number): boolean {
  return rowMinute < end && rowMinute + 60 > start;
}

function maximum(
  rows: ReadonlyArray<ActivityHourlyWeather>,
  pick: (row: ActivityHourlyWeather) => number | null,
): number | null {
  const values = rows.map(pick).filter((value): value is number => value !== null);
  return values.length === 0 ? null : Math.max(...values);
}

function minimum(
  rows: ReadonlyArray<ActivityHourlyWeather>,
  pick: (row: ActivityHourlyWeather) => number | null,
): number | null {
  const values = rows.map(pick).filter((value): value is number => value !== null);
  return values.length === 0 ? null : Math.min(...values);
}

function hasSensitivity(activity: TripActivity, sensitivity: TripWeatherSensitivity): boolean {
  return activity.weatherSensitivity.includes(sensitivity);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskLevel(score: number): Exclude<ActivityRiskLevel, "unknown"> {
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  return "high";
}

function unknownRisk(
  activity: TripActivity,
  reasonCode: "missing_activity_time" | "invalid_activity_window" | "missing_hourly_coverage",
  window: ActivityRiskWindow | null = null,
): ActivityHourlyRisk {
  return {
    activityId: activity.id,
    score: null,
    level: "unknown",
    affectedWindow: window,
    reasonCodes: [reasonCode],
    moveMayReduceRisk: false,
    fallbackAvailable: activity.alternatives.length > 0,
    confidence: "unknown",
    hourlyRowsUsed: 0,
  };
}

function expectedHourlyBuckets(start: number, end: number): number {
  return Math.floor((end - 1) / 60) - Math.floor(start / 60) + 1;
}

export function assessActivityHourlyRisk({
  activity,
  date,
  hourly,
  partyProfile,
}: AssessActivityHourlyRiskInput): ActivityHourlyRisk {
  if (activity.startTime === null) return unknownRisk(activity, "missing_activity_time");
  const window = resolveWindow(activity);
  if (window === null) return unknownRisk(activity, "missing_activity_time");
  const affectedWindow = {
    startTime: formatClock(window.start),
    endTime: formatClock(window.end),
  };
  if (window.end <= window.start) {
    return unknownRisk(activity, "invalid_activity_window", affectedWindow);
  }

  const matching = hourly
    .filter((row) => row.cityId === activity.cityId)
    .map((row) => ({ row, minute: hourlyMinute(row, date) }))
    .filter(
      (item): item is { readonly row: ActivityHourlyWeather; readonly minute: number } =>
        item.minute !== null && overlaps(item.minute, window.start, window.end),
    )
    .sort((left, right) => left.minute - right.minute)
    .map((item) => item.row);

  if (matching.length === 0) {
    return unknownRisk(activity, "missing_hourly_coverage", affectedWindow);
  }

  let score = 100;
  const reasonCodes: ActivityRiskReasonCode[] = [];

  if (hasSensitivity(activity, "rain")) {
    const rainProbability = maximum(matching, (row) => row.rainProbability);
    const precipitation = maximum(matching, (row) => row.precipitationMm);
    if ((rainProbability ?? 0) >= 75 || (precipitation ?? 0) >= 4) {
      score -= 55;
      reasonCodes.push("rain_high");
    } else if ((rainProbability ?? 0) >= 40 || (precipitation ?? 0) >= 1) {
      score -= 25;
      reasonCodes.push("rain_watch");
    }
  }

  if (hasSensitivity(activity, "heat")) {
    const apparentMaximum = maximum(
      matching,
      (row) => row.apparentTemperatureC ?? row.temperatureC,
    );
    const threshold = HEAT_THRESHOLDS[partyProfile];
    if (apparentMaximum !== null && apparentMaximum >= threshold.high) {
      score -= 35;
      reasonCodes.push("heat_high");
    } else if (apparentMaximum !== null && apparentMaximum >= threshold.watch) {
      score -= 18;
      reasonCodes.push("heat_watch");
    }
  }

  if (hasSensitivity(activity, "cold")) {
    const apparentMinimum = minimum(
      matching,
      (row) => row.apparentTemperatureC ?? row.temperatureC,
    );
    const threshold = COLD_THRESHOLDS[partyProfile];
    if (apparentMinimum !== null && apparentMinimum <= threshold.high) {
      score -= 35;
      reasonCodes.push("cold_high");
    } else if (apparentMinimum !== null && apparentMinimum <= threshold.watch) {
      score -= 18;
      reasonCodes.push("cold_watch");
    }
  }

  if (hasSensitivity(activity, "wind")) {
    const wind = maximum(matching, (row) => row.windSpeedKph);
    const gust = maximum(matching, (row) => row.windGustKph);
    const threshold = WIND_THRESHOLDS[partyProfile];
    if ((wind ?? 0) >= threshold.high || (gust ?? 0) >= threshold.gustHigh) {
      score -= 35;
      reasonCodes.push("wind_high");
    } else if ((wind ?? 0) >= threshold.watch || (gust ?? 0) >= threshold.gustWatch) {
      score -= 18;
      reasonCodes.push("wind_watch");
    }
  }

  if (hasSensitivity(activity, "uv")) {
    const uv = maximum(matching, (row) => row.uvIndex);
    if ((uv ?? 0) >= 9) {
      score -= 30;
      reasonCodes.push("uv_high");
    } else if ((uv ?? 0) >= 7) {
      score -= 15;
      reasonCodes.push("uv_watch");
    }
  }

  if (activity.flexibility === "fixed") reasonCodes.push("constraint_fixed");
  if (activity.reservation === "required") reasonCodes.push("reservation_required");

  const normalized = clampScore(score);
  const level = riskLevel(normalized);
  const movable = activity.flexibility !== "fixed" && activity.reservation !== "required";
  const expectedRows = expectedHourlyBuckets(window.start, window.end);
  const confidence: ActivityRiskConfidence =
    matching.length >= expectedRows && matching.every((row) => row.dataQuality === "good")
      ? "high"
      : "medium";

  return {
    activityId: activity.id,
    score: normalized,
    level,
    affectedWindow,
    reasonCodes,
    moveMayReduceRisk: movable && normalized < 75,
    fallbackAvailable: activity.alternatives.length > 0,
    confidence,
    hourlyRowsUsed: matching.length,
  };
}
