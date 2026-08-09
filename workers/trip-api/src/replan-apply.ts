export type ReplanDocumentValidationCode =
  | "workspace_v2_required"
  | "trip_metadata_changed"
  | "day_structure_changed"
  | "day_metadata_changed"
  | "activity_structure_changed"
  | "legacy_projection_changed"
  | "no_changes"
  | "selected_change_mismatch";

export type ReplanDocumentValidationResult =
  | { readonly ok: true; readonly changedActivityIds: ReadonlyArray<string> }
  | { readonly ok: false; readonly code: ReplanDocumentValidationCode };

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stringArray(value: unknown): ReadonlyArray<string> | null {
  return Array.isArray(value) && value.every((item): item is string => typeof item === "string")
    ? value
    : null;
}

function activities(value: Record<string, unknown>): ReadonlyArray<Record<string, unknown>> | null {
  if (!Array.isArray(value.activityItems)) return null;
  const rows = value.activityItems.map(object);
  return rows.every((row): row is Record<string, unknown> => row !== null) ? rows : null;
}

function tripMetadataSame(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
): boolean {
  return (
    current.id === proposed.id &&
    current.title === proposed.title &&
    current.partyProfile === proposed.partyProfile &&
    current.createdAt === proposed.createdAt
  );
}

function dayMetadataSame(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
): boolean {
  return (
    current.id === proposed.id &&
    current.dayNumber === proposed.dayNumber &&
    current.date === proposed.date &&
    current.cityId === proposed.cityId &&
    current.cityName === proposed.cityName &&
    current.countryName === proposed.countryName &&
    current.theme === proposed.theme &&
    current.flexible === proposed.flexible &&
    current.notes === proposed.notes
  );
}

function sameStringSet(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((item, index) => item === rightSorted[index]);
}

export function validateReplanDocumentChange(
  currentValue: unknown,
  proposedValue: unknown,
  selectedChangeIds: ReadonlyArray<string>,
): ReplanDocumentValidationResult {
  const current = object(currentValue);
  const proposed = object(proposedValue);
  if (current === null || proposed === null || current.version !== 2 || proposed.version !== 2) {
    return { ok: false, code: "workspace_v2_required" };
  }
  if (!tripMetadataSame(current, proposed)) {
    return { ok: false, code: "trip_metadata_changed" };
  }
  if (!Array.isArray(current.days) || !Array.isArray(proposed.days)) {
    return { ok: false, code: "day_structure_changed" };
  }
  if (current.days.length !== proposed.days.length) {
    return { ok: false, code: "day_structure_changed" };
  }

  const changedActivityIds: string[] = [];

  for (let dayIndex = 0; dayIndex < current.days.length; dayIndex += 1) {
    const currentDay = object(current.days[dayIndex]);
    const proposedDay = object(proposed.days[dayIndex]);
    if (currentDay === null || proposedDay === null) {
      return { ok: false, code: "day_structure_changed" };
    }
    if (!dayMetadataSame(currentDay, proposedDay)) {
      return { ok: false, code: "day_metadata_changed" };
    }

    const currentActivities = activities(currentDay);
    const proposedActivities = activities(proposedDay);
    if (currentActivities === null || proposedActivities === null) {
      return { ok: false, code: "workspace_v2_required" };
    }
    if (currentActivities.length !== proposedActivities.length) {
      return { ok: false, code: "activity_structure_changed" };
    }

    const currentLegacy = stringArray(currentDay.activities);
    const proposedLegacy = stringArray(proposedDay.activities);
    if (
      currentLegacy === null ||
      proposedLegacy === null ||
      currentLegacy.length !== currentActivities.length ||
      proposedLegacy.length !== proposedActivities.length
    ) {
      return { ok: false, code: "activity_structure_changed" };
    }

    for (let activityIndex = 0; activityIndex < currentActivities.length; activityIndex += 1) {
      const currentActivity = currentActivities[activityIndex]!;
      const proposedActivity = proposedActivities[activityIndex]!;
      const currentId = currentActivity.id;
      const proposedId = proposedActivity.id;
      if (
        typeof currentId !== "string" ||
        typeof proposedId !== "string" ||
        currentId !== proposedId
      ) {
        return { ok: false, code: "activity_structure_changed" };
      }
      const changed = !same(currentActivity, proposedActivity);
      if (changed) changedActivityIds.push(currentId);
      if (!changed && currentLegacy[activityIndex] !== proposedLegacy[activityIndex]) {
        return { ok: false, code: "legacy_projection_changed" };
      }
    }
  }

  if (changedActivityIds.length === 0) return { ok: false, code: "no_changes" };
  if (!sameStringSet(changedActivityIds, selectedChangeIds)) {
    return { ok: false, code: "selected_change_mismatch" };
  }
  return { ok: true, changedActivityIds };
}
