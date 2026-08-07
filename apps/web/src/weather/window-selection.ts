import type { Window } from "../api/v1/schemas";

function weekday(localDate: string): number | null {
  const date = new Date(`${localDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay();
}

/**
 * Resolve product time windows from the forecast's real calendar dates instead
 * of assuming fixed array offsets. This keeps "this weekend" and "next week"
 * semantically correct regardless of which weekday the forecast starts on.
 */
export function windowIndicesForDates(
  localDates: ReadonlyArray<string>,
  window: Window,
): ReadonlyArray<number> {
  if (window === "today") return localDates.length > 0 ? [0] : [];
  if (window === "tomorrow") return localDates.length > 1 ? [1] : [];

  if (window === "weekend") {
    const firstWeekendIndex = localDates.findIndex((date) => {
      const day = weekday(date);
      return day === 6 || day === 0;
    });
    if (firstWeekendIndex < 0) return [];

    const firstDay = weekday(localDates[firstWeekendIndex] ?? "");
    if (firstDay === 0) return [firstWeekendIndex];

    const sundayIndex = firstWeekendIndex + 1;
    return weekday(localDates[sundayIndex] ?? "") === 0
      ? [firstWeekendIndex, sundayIndex]
      : [firstWeekendIndex];
  }

  const nextMondayIndex = localDates.findIndex((date, index) => index > 0 && weekday(date) === 1);
  if (nextMondayIndex < 0) return [];
  return localDates.map((_, index) => index).slice(nextMondayIndex);
}
