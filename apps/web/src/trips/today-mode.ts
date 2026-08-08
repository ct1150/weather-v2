import type { TripActivity } from "./activity-intelligence";
import type { TripCityOption, TripWorkspace, TripWorkspaceDay } from "./workspace";

export interface DestinationLocalClock {
  readonly date: string;
  readonly time: string;
  readonly minutes: number;
}

export interface ActiveTripDay {
  readonly day: TripWorkspaceDay;
  readonly city: TripCityOption;
  readonly timezone: string;
  readonly localClock: DestinationLocalClock;
}

function parts(now: Date, timezone: string): Record<string, string> {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(
    formatted
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value] as const),
  );
}

export function destinationLocalClock(now: Date, timezone: string): DestinationLocalClock {
  const value = parts(now, timezone);
  const year = value.year ?? "0000";
  const month = value.month ?? "00";
  const day = value.day ?? "00";
  const hour = value.hour ?? "00";
  const minute = value.minute ?? "00";
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    minutes: Number(hour) * 60 + Number(minute),
  };
}

export function resolveActiveTripDay(
  workspace: TripWorkspace,
  cities: ReadonlyArray<TripCityOption>,
  now = new Date(),
): ActiveTripDay | null {
  const byId = new Map(cities.map((city) => [city.cityId, city]));
  for (const day of workspace.days) {
    const city = byId.get(day.cityId);
    if (city === undefined) continue;
    const localClock = destinationLocalClock(now, city.timezone);
    if (localClock.date !== day.date) continue;
    return { day, city, timezone: city.timezone, localClock };
  }
  return null;
}

function clockMinutes(value: string | null): number | null {
  if (value === null) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function intervalEnd(activity: TripActivity, start: number): number {
  const explicit = clockMinutes(activity.endTime);
  if (explicit !== null && explicit > start) return explicit;
  return Math.min(24 * 60, start + (activity.durationMinutes ?? 120));
}

export function nextExecutableActivity(
  activities: ReadonlyArray<TripActivity>,
  localMinutes: number,
): TripActivity | null {
  const candidates = activities
    .map((activity) => {
      const start = clockMinutes(activity.startTime);
      if (start === null) return null;
      const end = intervalEnd(activity, start);
      if (end <= localMinutes) return null;
      return { activity, start };
    })
    .filter(
      (item): item is { readonly activity: TripActivity; readonly start: number } => item !== null,
    )
    .sort(
      (left, right) =>
        left.start - right.start || left.activity.id.localeCompare(right.activity.id),
    );
  return candidates[0]?.activity ?? null;
}

export function fixedExecutionActivities(day: TripWorkspaceDay): ReadonlyArray<TripActivity> {
  return (day.activityItems ?? []).filter(
    (activity) =>
      activity.flexibility === "fixed" ||
      activity.reservation === "required" ||
      activity.category === "transport",
  );
}
