import { resolveTripAccess } from "./collaboration";

export type RevisionChangeKind = "added" | "removed" | "changed";

export interface RevisionChange {
  readonly kind: RevisionChangeKind;
  readonly field:
    | "trip.title"
    | "trip.partyProfile"
    | "day"
    | "day.date"
    | "day.destination"
    | "day.theme"
    | "day.flexible"
    | "day.activities"
    | "day.notes";
  readonly dayId: string | null;
  readonly dayNumber: number | null;
  readonly before: unknown;
  readonly after: unknown;
}

export interface TripRevisionDiff {
  readonly fromVersion: number | null;
  readonly toVersion: number;
  readonly changes: ReadonlyArray<RevisionChange>;
}

interface RevisionRow {
  readonly version: number;
  readonly document_json: string;
}

interface TripDay {
  readonly id: string;
  readonly dayNumber: number;
  readonly date: string;
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly theme: string;
  readonly flexible: boolean;
  readonly activities: ReadonlyArray<string>;
  readonly notes: string;
}

interface TripDocument {
  readonly title?: unknown;
  readonly partyProfile?: unknown;
  readonly days?: unknown;
}

function asDay(value: unknown): TripDay | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.dayNumber !== "number") return null;
  return {
    id: row.id,
    dayNumber: row.dayNumber,
    date: typeof row.date === "string" ? row.date : "",
    cityId: typeof row.cityId === "string" ? row.cityId : "",
    cityName: typeof row.cityName === "string" ? row.cityName : "",
    countryName: typeof row.countryName === "string" ? row.countryName : "",
    theme: typeof row.theme === "string" ? row.theme : "",
    flexible: row.flexible === true,
    activities: Array.isArray(row.activities)
      ? row.activities.filter((item): item is string => typeof item === "string")
      : [],
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}

function parseDocument(value: string): TripDocument {
  const parsed = JSON.parse(value) as unknown;
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as TripDocument)
    : {};
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pushChanged(
  changes: RevisionChange[],
  field: RevisionChange["field"],
  before: unknown,
  after: unknown,
  day: TripDay | null = null,
): void {
  if (same(before, after)) return;
  changes.push({
    kind: "changed",
    field,
    dayId: day?.id ?? null,
    dayNumber: day?.dayNumber ?? null,
    before,
    after,
  });
}

export function diffRevisionDocuments(
  beforeDocument: TripDocument | null,
  afterDocument: TripDocument,
): ReadonlyArray<RevisionChange> {
  const changes: RevisionChange[] = [];
  if (beforeDocument === null) {
    changes.push({
      kind: "added",
      field: "day",
      dayId: null,
      dayNumber: null,
      before: null,
      after: "initial_version",
    });
    return changes;
  }

  pushChanged(changes, "trip.title", beforeDocument.title ?? null, afterDocument.title ?? null);
  pushChanged(
    changes,
    "trip.partyProfile",
    beforeDocument.partyProfile ?? null,
    afterDocument.partyProfile ?? null,
  );

  const beforeDays = Array.isArray(beforeDocument.days)
    ? beforeDocument.days.map(asDay).filter((item): item is TripDay => item !== null)
    : [];
  const afterDays = Array.isArray(afterDocument.days)
    ? afterDocument.days.map(asDay).filter((item): item is TripDay => item !== null)
    : [];
  const beforeById = new Map(beforeDays.map((day) => [day.id, day]));
  const afterById = new Map(afterDays.map((day) => [day.id, day]));

  for (const day of beforeDays) {
    if (!afterById.has(day.id)) {
      changes.push({
        kind: "removed",
        field: "day",
        dayId: day.id,
        dayNumber: day.dayNumber,
        before: day,
        after: null,
      });
    }
  }

  for (const day of afterDays) {
    const previous = beforeById.get(day.id);
    if (previous === undefined) {
      changes.push({
        kind: "added",
        field: "day",
        dayId: day.id,
        dayNumber: day.dayNumber,
        before: null,
        after: day,
      });
      continue;
    }
    pushChanged(changes, "day.date", previous.date, day.date, day);
    pushChanged(
      changes,
      "day.destination",
      { cityId: previous.cityId, cityName: previous.cityName, countryName: previous.countryName },
      { cityId: day.cityId, cityName: day.cityName, countryName: day.countryName },
      day,
    );
    pushChanged(changes, "day.theme", previous.theme, day.theme, day);
    pushChanged(changes, "day.flexible", previous.flexible, day.flexible, day);
    pushChanged(changes, "day.activities", previous.activities, day.activities, day);
    pushChanged(changes, "day.notes", previous.notes, day.notes, day);
  }

  return changes;
}

export async function readTripRevisionDiff(
  db: D1Database,
  userId: string,
  tripId: string,
  toVersion: number,
): Promise<TripRevisionDiff | null> {
  if ((await resolveTripAccess(db, userId, tripId)) === null) return null;
  const to = await db
    .prepare(
      "SELECT version, document_json FROM trip_revisions WHERE trip_id = ? AND version = ? LIMIT 1",
    )
    .bind(tripId, toVersion)
    .first<RevisionRow>();
  if (to === null) return null;
  const from = await db
    .prepare(
      "SELECT version, document_json FROM trip_revisions WHERE trip_id = ? AND version < ? ORDER BY version DESC LIMIT 1",
    )
    .bind(tripId, toVersion)
    .first<RevisionRow>();
  return {
    fromVersion: from?.version ?? null,
    toVersion: to.version,
    changes: diffRevisionDocuments(
      from === null ? null : parseDocument(from.document_json),
      parseDocument(to.document_json),
    ),
  };
}
