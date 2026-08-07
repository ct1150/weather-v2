import type { TripLocale, ValidTripDocument } from "./validation";

export type TripListStatus = "active" | "archived" | "all";

export interface TripRow {
  readonly id: string;
  readonly owner_user_id: string;
  readonly title: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly status: "active" | "archived";
  readonly locale: TripLocale;
  readonly document_json: string;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface TripSummary {
  readonly id: string;
  readonly title: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly status: "active" | "archived";
  readonly locale: TripLocale;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TripRecord extends TripSummary {
  readonly document: Record<string, unknown>;
}

function summary(row: TripRow): TripSummary {
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    locale: row.locale,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function record(row: TripRow): TripRecord {
  return { ...summary(row), document: JSON.parse(row.document_json) as Record<string, unknown> };
}

export async function createTrip(
  db: D1Database,
  ownerUserId: string,
  locale: TripLocale,
  trip: ValidTripDocument,
  now = new Date().toISOString(),
): Promise<TripRecord> {
  const id = `trip_${crypto.randomUUID().replaceAll("-", "")}`;
  await db
    .prepare(
      "INSERT INTO trips (id, owner_user_id, title, start_date, end_date, status, locale, document_json, version, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, ?)",
    )
    .bind(
      id,
      ownerUserId,
      trip.title,
      trip.startDate,
      trip.endDate,
      locale,
      JSON.stringify(trip.document),
      now,
      now,
    )
    .run();
  const created = await readTrip(db, ownerUserId, id);
  if (created === null) throw new Error("TRIP_CREATE_READBACK_FAILED");
  return created;
}

export async function listTrips(
  db: D1Database,
  ownerUserId: string,
  limit = 20,
  status: TripListStatus = "all",
): Promise<ReadonlyArray<TripSummary>> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const select =
    "SELECT id, owner_user_id, title, start_date, end_date, status, locale, document_json, version, created_at, updated_at, deleted_at FROM trips ";
  const result =
    status === "all"
      ? await db
          .prepare(
            `${select}WHERE owner_user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?`,
          )
          .bind(ownerUserId, safeLimit)
          .all<TripRow>()
      : await db
          .prepare(
            `${select}WHERE owner_user_id = ? AND deleted_at IS NULL AND status = ? ORDER BY updated_at DESC LIMIT ?`,
          )
          .bind(ownerUserId, status, safeLimit)
          .all<TripRow>();
  return result.results.map(summary);
}

export async function readTrip(
  db: D1Database,
  ownerUserId: string,
  id: string,
): Promise<TripRecord | null> {
  const row = await db
    .prepare(
      "SELECT id, owner_user_id, title, start_date, end_date, status, locale, document_json, version, created_at, updated_at, deleted_at " +
        "FROM trips WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL",
    )
    .bind(id, ownerUserId)
    .first<TripRow>();
  return row === null ? null : record(row);
}

export type UpdateTripResult =
  | { readonly kind: "updated"; readonly trip: TripRecord }
  | { readonly kind: "conflict"; readonly currentVersion: number }
  | { readonly kind: "missing" };

export async function updateTrip(
  db: D1Database,
  ownerUserId: string,
  id: string,
  baseVersion: number,
  locale: TripLocale,
  trip: ValidTripDocument,
  now = new Date().toISOString(),
): Promise<UpdateTripResult> {
  const result = await db
    .prepare(
      "UPDATE trips SET title = ?, start_date = ?, end_date = ?, locale = ?, document_json = ?, version = version + 1, updated_at = ? " +
        "WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL AND version = ?",
    )
    .bind(
      trip.title,
      trip.startDate,
      trip.endDate,
      locale,
      JSON.stringify(trip.document),
      now,
      id,
      ownerUserId,
      baseVersion,
    )
    .run();

  if ((result.meta.changes ?? 0) > 0) {
    const updated = await readTrip(db, ownerUserId, id);
    if (updated === null) throw new Error("TRIP_UPDATE_READBACK_FAILED");
    return { kind: "updated", trip: updated };
  }

  const current = await db
    .prepare("SELECT version FROM trips WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL")
    .bind(id, ownerUserId)
    .first<{ readonly version: number }>();
  return current === null
    ? { kind: "missing" }
    : { kind: "conflict", currentVersion: current.version };
}

export async function deleteTrip(
  db: D1Database,
  ownerUserId: string,
  id: string,
  now = new Date().toISOString(),
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE trips SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL",
    )
    .bind(now, now, id, ownerUserId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
