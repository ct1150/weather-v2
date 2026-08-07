import {
  createBlankWorkspace,
  normalizeWorkspace,
  type TripWorkspace,
  type TripWorkspaceDay,
} from "./workspace";

export interface TripDestinationIdentity {
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
}

export interface TripDestinationInput extends TripDestinationIdentity {
  readonly date: string;
}

interface AddDestinationOptions {
  readonly now?: string;
  readonly blankTitle?: string;
}

function isBlankDay(day: TripWorkspaceDay): boolean {
  return day.cityId.length === 0 && day.activities.length === 0 && day.notes.length === 0;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function blankDay(dayNumber: number, date: string): TripWorkspaceDay {
  return {
    id: `day-${Date.now().toString(36)}-${dayNumber}`,
    dayNumber,
    date,
    cityId: "",
    cityName: "",
    countryName: "",
    theme: "city",
    flexible: true,
    activities: [],
    notes: "",
  };
}

function withDestination(
  day: TripWorkspaceDay,
  dayNumber: number,
  date: string,
  destination: TripDestinationIdentity,
): TripWorkspaceDay {
  return {
    ...day,
    dayNumber,
    date,
    cityId: destination.cityId,
    cityName: destination.cityName,
    countryName: destination.countryName,
    theme: "city",
    flexible: true,
  };
}

/**
 * Add a weather-qualified destination for every selected travel date.
 * Existing itinerary content is preserved and an identical city/date pair is never duplicated.
 */
export function addDestinationRangeToWorkspace(
  workspace: TripWorkspace | null,
  destination: TripDestinationIdentity,
  dates: ReadonlyArray<string>,
  options: AddDestinationOptions = {},
): TripWorkspace {
  const now = options.now ?? new Date().toISOString();
  const current =
    workspace ??
    createBlankWorkspace({ now, title: options.blankTitle ?? "My weather-aware trip" });
  const uniqueDates = [...new Set(dates.filter(isIsoDate))].slice(0, 16);
  if (uniqueDates.length === 0) return current;

  const days = [...current.days];
  for (const date of uniqueDates) {
    if (days.some((day) => day.cityId === destination.cityId && day.date === date)) continue;

    const reusableIndex = days.findIndex(
      (day) => isBlankDay(day) && (days.length === 1 || day.date === date),
    );
    if (reusableIndex >= 0) {
      const reusable = days[reusableIndex];
      if (reusable !== undefined) {
        days[reusableIndex] = withDestination(reusable, reusableIndex + 1, date, destination);
        continue;
      }
    }

    if (days.length >= 16) break;
    const dayNumber = days.length + 1;
    days.push(withDestination(blankDay(dayNumber, date), dayNumber, date, destination));
  }

  const normalizedDays = days.map((day, index) => ({ ...day, dayNumber: index + 1 }));
  return normalizeWorkspace({ ...current, days: normalizedDays, updatedAt: now }, now);
}

/** Add one destination day while preserving the existing public API. */
export function addDestinationToWorkspace(
  workspace: TripWorkspace | null,
  destination: TripDestinationInput,
  options: AddDestinationOptions = {},
): TripWorkspace {
  return addDestinationRangeToWorkspace(
    workspace,
    {
      cityId: destination.cityId,
      cityName: destination.cityName,
      countryName: destination.countryName,
    },
    [destination.date],
    options,
  );
}
