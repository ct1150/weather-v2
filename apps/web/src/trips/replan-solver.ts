import type { TripActivity } from "./activity-intelligence";
import {
  assessActivityHourlyRisk,
  type ActivityHourlyRisk,
  type ActivityHourlyWeather,
  type ActivityRiskPartyProfile,
} from "./activity-risk";
import { routeMatrixMinutes, type RouteCostMatrix } from "./route-intelligence";

export type ReplanChangeKind = "move_time" | "replace_activity";
export type ReplanReasonCode = "better_hourly_window" | "indoor_fallback";

export interface ReplanChange {
  readonly kind: ReplanChangeKind;
  readonly activityId: string;
  readonly before: TripActivity;
  readonly after: TripActivity;
  readonly riskBefore: ActivityHourlyRisk;
  readonly riskAfter: ActivityHourlyRisk;
  readonly riskReduction: number;
  readonly reasonCodes: ReadonlyArray<ReplanReasonCode>;
  /** Added relocation time. Uses routed minutes when supplied, geometric fallback otherwise. */
  readonly travelDeltaMinutes: number | null;
}

export interface ReplanProposalDraft {
  readonly weatherSnapshotId: string;
  readonly date: string;
  readonly changes: ReadonlyArray<ReplanChange>;
  readonly unchangedFixedActivityIds: ReadonlyArray<string>;
  readonly riskBefore: number | null;
  readonly riskAfter: number | null;
  readonly travelDeltaMinutes: number | null;
  readonly reasonCodes: ReadonlyArray<ReplanReasonCode>;
}

export interface BuildDeterministicReplanInput {
  readonly date: string;
  readonly weatherSnapshotId: string;
  readonly activities: ReadonlyArray<TripActivity>;
  readonly hourly: ReadonlyArray<ActivityHourlyWeather>;
  readonly fallbackActivities?: ReadonlyArray<TripActivity>;
  readonly routeCostMatrix?: RouteCostMatrix;
  readonly partyProfile: ActivityRiskPartyProfile;
}

interface Interval {
  readonly start: number;
  readonly end: number;
}

interface CandidateChange {
  readonly change: ReplanChange;
  readonly shiftMinutes: number;
}

const MIN_RISK_IMPROVEMENT = 15;
const EARLIEST_SHIFT_HOUR = 7;
const LATEST_ACTIVITY_END_HOUR = 23;
const DEFAULT_DURATION_MINUTES = 120;
const APPROX_CITY_SPEED_KPH = 20;

function clockMinutes(value: string | null): number | null {
  if (value === null) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function clockText(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function activityDuration(activity: TripActivity): number | null {
  const start = clockMinutes(activity.startTime);
  if (start === null) return null;
  const end = clockMinutes(activity.endTime);
  if (activity.endTime !== null) return end !== null && end > start ? end - start : null;
  return activity.durationMinutes !== null && activity.durationMinutes > 0
    ? activity.durationMinutes
    : DEFAULT_DURATION_MINUTES;
}

function activityInterval(activity: TripActivity): Interval | null {
  const start = clockMinutes(activity.startTime);
  const duration = activityDuration(activity);
  if (start === null || duration === null || duration <= 0) return null;
  const end = start + duration;
  return end <= 24 * 60 ? { start, end } : null;
}

function overlaps(left: Interval, right: Interval): boolean {
  return left.start < right.end && right.start < left.end;
}

function isHardLocked(activity: TripActivity): boolean {
  return (
    activity.flexibility === "fixed" ||
    activity.reservation === "required" ||
    activity.category === "transport"
  );
}

function assess(activity: TripActivity, input: BuildDeterministicReplanInput): ActivityHourlyRisk {
  return assessActivityHourlyRisk({
    activity,
    date: input.date,
    hourly: input.hourly,
    partyProfile: input.partyProfile,
  });
}

function shiftedActivity(
  activity: TripActivity,
  startMinutes: number,
  duration: number,
): TripActivity {
  const nextEnd = startMinutes + duration;
  return {
    ...activity,
    startTime: clockText(startMinutes),
    endTime: activity.endTime === null ? null : clockText(nextEnd),
  };
}

function replacementActivity(source: TripActivity, fallback: TripActivity): TripActivity {
  return {
    ...fallback,
    id: source.id,
    startTime: source.startTime,
    endTime: source.endTime,
    durationMinutes: fallback.durationMinutes ?? source.durationMinutes,
    priority: source.priority,
    flexibility: source.flexibility,
    reservation: fallback.reservation,
  };
}

function intervalsOfOthers(
  activities: ReadonlyArray<TripActivity>,
  activityId: string,
): ReadonlyArray<Interval> {
  return activities
    .filter((activity) => activity.id !== activityId)
    .map(activityInterval)
    .filter((interval): interval is Interval => interval !== null);
}

function hasConflict(candidate: TripActivity, others: ReadonlyArray<Interval>): boolean {
  const interval = activityInterval(candidate);
  return interval === null || others.some((other) => overlaps(interval, other));
}

function riskReduction(before: ActivityHourlyRisk, after: ActivityHourlyRisk): number | null {
  if (before.score === null || after.score === null) return null;
  return after.score - before.score;
}

function findTimeMove(
  activity: TripActivity,
  beforeRisk: ActivityHourlyRisk,
  input: BuildDeterministicReplanInput,
): CandidateChange | null {
  if (isHardLocked(activity) || !beforeRisk.moveMayReduceRisk) return null;
  const originalStart = clockMinutes(activity.startTime);
  const duration = activityDuration(activity);
  if (originalStart === null || duration === null) return null;

  const others = intervalsOfOthers(input.activities, activity.id);
  const firstCandidateHour = Math.max(EARLIEST_SHIFT_HOUR, Math.ceil(originalStart / 60));
  const candidates: CandidateChange[] = [];

  for (let hour = firstCandidateHour; hour < LATEST_ACTIVITY_END_HOUR; hour += 1) {
    const candidateStart = hour * 60;
    if (candidateStart <= originalStart) continue;
    if (candidateStart + duration > LATEST_ACTIVITY_END_HOUR * 60) continue;
    const after = shiftedActivity(activity, candidateStart, duration);
    if (hasConflict(after, others)) continue;
    const afterRisk = assess(after, input);
    const reduction = riskReduction(beforeRisk, afterRisk);
    if (reduction === null || reduction < MIN_RISK_IMPROVEMENT) continue;
    candidates.push({
      shiftMinutes: candidateStart - originalStart,
      change: {
        kind: "move_time",
        activityId: activity.id,
        before: activity,
        after,
        riskBefore: beforeRisk,
        riskAfter: afterRisk,
        riskReduction: reduction,
        reasonCodes: ["better_hourly_window"],
        travelDeltaMinutes: 0,
      },
    });
  }

  candidates.sort(
    (left, right) =>
      right.change.riskReduction - left.change.riskReduction ||
      left.shiftMinutes - right.shiftMinutes ||
      (left.change.after.startTime ?? "").localeCompare(right.change.after.startTime ?? ""),
  );
  return candidates[0] ?? null;
}

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function geometricRelocationMinutes(source: TripActivity, fallback: TripActivity): number | null {
  if (
    source.latitude === null ||
    source.longitude === null ||
    fallback.latitude === null ||
    fallback.longitude === null
  ) {
    return null;
  }
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(fallback.latitude - source.latitude);
  const longitudeDelta = radians(fallback.longitude - source.longitude);
  const sourceLatitude = radians(source.latitude);
  const fallbackLatitude = radians(fallback.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(sourceLatitude) * Math.cos(fallbackLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const distanceKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0, Math.round((distanceKm / APPROX_CITY_SPEED_KPH) * 60));
}

function relocationMinutes(
  source: TripActivity,
  fallback: TripActivity,
  input: BuildDeterministicReplanInput,
): number | null {
  const routed = routeMatrixMinutes(input.routeCostMatrix, source.id, fallback.id);
  return routed ?? geometricRelocationMinutes(source, fallback);
}

function findFallbackReplacement(
  activity: TripActivity,
  beforeRisk: ActivityHourlyRisk,
  input: BuildDeterministicReplanInput,
): CandidateChange | null {
  if (isHardLocked(activity) || activity.priority === "must") return null;
  const others = intervalsOfOthers(input.activities, activity.id);
  const candidates: CandidateChange[] = [];

  for (const fallback of input.fallbackActivities ?? []) {
    if (
      fallback.id === activity.id ||
      fallback.cityId !== activity.cityId ||
      fallback.category === "transport" ||
      fallback.category === "hotel" ||
      fallback.flexibility === "fixed" ||
      fallback.reservation === "required"
    ) {
      continue;
    }
    const after = replacementActivity(activity, fallback);
    if (hasConflict(after, others)) continue;
    const afterRisk = assess(after, input);
    const reduction = riskReduction(beforeRisk, afterRisk);
    if (reduction === null || reduction < MIN_RISK_IMPROVEMENT) continue;
    candidates.push({
      shiftMinutes: 0,
      change: {
        kind: "replace_activity",
        activityId: activity.id,
        before: activity,
        after,
        riskBefore: beforeRisk,
        riskAfter: afterRisk,
        riskReduction: reduction,
        reasonCodes: ["indoor_fallback"],
        travelDeltaMinutes: relocationMinutes(activity, fallback, input),
      },
    });
  }

  candidates.sort((left, right) => {
    if (right.change.riskReduction !== left.change.riskReduction) {
      return right.change.riskReduction - left.change.riskReduction;
    }
    const leftTravel = left.change.travelDeltaMinutes ?? Number.POSITIVE_INFINITY;
    const rightTravel = right.change.travelDeltaMinutes ?? Number.POSITIVE_INFINITY;
    return (
      leftTravel - rightTravel ||
      left.change.after.title.localeCompare(right.change.after.title) ||
      left.change.after.poiId?.localeCompare(right.change.after.poiId ?? "") ||
      0
    );
  });
  return candidates[0] ?? null;
}

function aggregateRisk(risks: ReadonlyArray<ActivityHourlyRisk>): number | null {
  if (risks.length === 0 || risks.some((risk) => risk.score === null)) return null;
  return Math.round(risks.reduce((total, risk) => total + (risk.score ?? 0), 0) / risks.length);
}

function totalTravelDelta(changes: ReadonlyArray<ReplanChange>): number | null {
  if (changes.some((change) => change.travelDeltaMinutes === null)) return null;
  return changes.reduce((total, change) => total + (change.travelDeltaMinutes ?? 0), 0);
}

export function buildDeterministicReplan(
  input: BuildDeterministicReplanInput,
): ReplanProposalDraft {
  const beforeRisks = input.activities.map((activity) => assess(activity, input));
  const changes: ReplanChange[] = [];
  const unchangedFixedActivityIds: string[] = [];
  const afterById = new Map<string, TripActivity>();

  input.activities.forEach((activity, index) => {
    const beforeRisk = beforeRisks[index];
    if (beforeRisk === undefined) return;
    if (isHardLocked(activity)) {
      unchangedFixedActivityIds.push(activity.id);
      return;
    }
    if (beforeRisk.score === null || beforeRisk.score >= 75) return;

    const move = findTimeMove(activity, beforeRisk, input);
    const selected = move ?? findFallbackReplacement(activity, beforeRisk, input);
    if (selected === null) return;
    changes.push(selected.change);
    afterById.set(activity.id, selected.change.after);
  });

  const afterRisks = input.activities.map((activity) =>
    assess(afterById.get(activity.id) ?? activity, input),
  );
  const reasonCodes = [
    ...new Set(changes.flatMap((change) => change.reasonCodes)),
  ] as ReadonlyArray<ReplanReasonCode>;

  return {
    weatherSnapshotId: input.weatherSnapshotId,
    date: input.date,
    changes,
    unchangedFixedActivityIds,
    riskBefore: aggregateRisk(beforeRisks),
    riskAfter: aggregateRisk(afterRisks),
    travelDeltaMinutes: totalTravelDelta(changes),
    reasonCodes,
  };
}
