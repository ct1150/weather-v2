import {
  createBlankWorkspace,
  normalizeWorkspace,
  type TripWorkspace,
  type TripWorkspaceDay,
} from "./workspace";

export interface TripDestinationInput {
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly date: string;
}

interface AddDestinationOptions {
  readonly now?: string;
  readonly blankTitle?: string;
}

function isBlankDay(day: TripWorkspaceDay): boolean {
  return day.cityId.length === 0 && day.activities.length === 0 && day.notes.length === 0;
}

/**
 * Add a weather-discovery destination without destroying an existing itinerary.
 * A pristine one-day workspace is reused; otherwise a new day is appended.
 */
export function addDestinationToWorkspace(
  workspace: TripWorkspace | null,
  destination: TripDestinationInput,
  options: AddDestinationOptions = {},
): TripWorkspace {
  const now = options.now ?? new Date().toISOString();
  const current =
    workspace ??
    createBlankWorkspace({ now, title: options.blankTitle ?? "My weather-aware trip" });
  const targetDate = /^\d{4}-\d{2}-\d{2}$/u.test(destination.date)
    ? destination.date
    : (current.days[0]?.date ?? now.slice(0, 10));
  const destinationDay = (day: TripWorkspaceDay, dayNumber: number): TripWorkspaceDay => ({
    ...day,
    dayNumber,
    date: targetDate,
    cityId: destination.cityId,
    cityName: destination.cityName,
    countryName: destination.countryName,
    theme: "city",
    flexible: true,
  });

  const reuseBlank =
    current.days.length === 1 && current.days[0] !== undefined && isBlankDay(current.days[0]);
  const days = reuseBlank
    ? [destinationDay(current.days[0]!, 1)]
    : [
        ...current.days,
        destinationDay(
          {
            id: `day-${Date.now().toString(36)}`,
            dayNumber: current.days.length + 1,
            date: targetDate,
            cityId: "",
            cityName: "",
            countryName: "",
            theme: "city",
            flexible: true,
            activities: [],
            notes: "",
          },
          current.days.length + 1,
        ),
      ];

  return normalizeWorkspace({ ...current, days, updatedAt: now }, now);
}
