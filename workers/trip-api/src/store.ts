import type { TripAccessRole } from "./collaboration";
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
  readonly access_role: TripAccessRole;
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
  readonly accessRole: TripAccessRole;
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
    accessRole: row.access_role,
  };
}

function record(row: TripRow): TripRecord {
  return { ...summary(row), document: JSON.parse(row.document_json) as Record<string, unknown> };
}

const tripSelect =
  "SELECT t.id, t.owner_user_id, t.title, t.start_date, t.end_date, t.status, t.locale, " +
  "t.document_json, t.version, t.created_at, t.updated_at, t.deleted_at, " +
  "CASE WHEN t.owner_user_id = ? THEN 'owner' ELSE m.role END AS access_role " +
  "FROM trips t LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ? ";

export async function createTrip(
  db: D1Database,
  ownerUserId: string,
  locale: TripLocale,
  trip: ValidTripDocument,
  now = new Date().toISOString(),
): Promise<TripRecord> {
  const id = `trip_${crypto.randomUUID().replaceAll("-", "")}`;
  const revisionId = `rev_${crypto.randomUUID().replaceAll("-", "")}`;
  const documentJson = JSON.stringify(trip.document);
  await db.batch([
    db
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
        documentJson,
        now,
        now,
      ),
    db
      .prepare(
        "INSERT INTO trip_revisions (id, trip_id, actor_user_id, version, operation, locale, document_json, created_at) " +
          "VALUES (?, ?, ?, 1, 'create', ?, ?, ?)",
      )
      .bind(revisionId, id, ownerUserId, locale, documentJson, now),
  ]);
  const created = await readTrip(db, ownerUserId, id);
  if (created === null) throw new Error("TRIP_CREATE_READBACK_FAILED");
  return created;
}

export async function listTrips(
  db: D1Database,
  userId: string,
  limit = 20,
  status: TripListStatus = "all",
): Promise<ReadonlyArray<TripSummary>> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const visible = "t.deleted_at IS NULL AND (t.owner_user_id = ? OR m.user_id = ?)";
  const result =
    status === "all"
      ? await db
          .prepare(`${tripSelect}WHERE ${visible} ORDER BY t.updated_at DESC LIMIT ?`)
          .bind(userId, userId, userId, userId, safeLimit)
          .all<TripRow>()
      : await db
          .prepare(
            `${tripSelect}WHERE ${visible} AND t.status = ? ORDER BY t.updated_at DESC LIMIT ?`,
          )
          .bind(userId, userId, userId, userId, status, safeLimit)
          .all<TripRow>();
  return result.results.map(summary);
}

export async function readTrip(
  db: D1Database,
  userId: string,
  id: string,
): Promise<TripRecord | null> {
  const row = await db
    .prepare(
      `${tripSelect}WHERE t.id = ? AND t.deleted_at IS NULL AND (t.owner_user_id = ? OR m.user_id = ?) LIMIT 1`,
    )
    .bind(userId, userId, id, userId, userId)
    .first<TripRow>();
  return row === null ? null : record(row);
}

export type UpdateTripResult =
  | { readonly kind: "updated"; readonly trip: TripRecord }
  | { readonly kind: "conflict"; readonly currentVersion: number }
  | { readonly kind: "forbidden" }
  | { readonly kind: "missing" };

export async function updateTrip(
  db: D1Database,
  userId: string,
  id: string,
  baseVersion: number,
  locale: TripLocale,
  trip: ValidTripDocument,
  now = new Date().toISOString(),
  operation = "update",
): Promise<UpdateTripResult> {
  const nextVersion = baseVersion + 1;
  const revisionId = `rev_${crypto.randomUUID().replaceAll("-", "")}`;
  const documentJson = JSON.stringify(trip.document);
  const results = await db.batch([
    db
      .prepare(
        "UPDATE trips SET title = ?, start_date = ?, end_date = ?, locale = ?, document_json = ?, version = version + 1, updated_at = ? " +
          "WHERE id = ? AND deleted_at IS NULL AND version = ? AND " +
          "(owner_user_id = ? OR EXISTS (SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ? AND role = 'editor'))",
      )
      .bind(
        trip.title,
        trip.startDate,
        trip.endDate,
        locale,
        documentJson,
        now,
        id,
        baseVersion,
        userId,
        id,
        userId,
      ),
    db
      .prepare(
        "INSERT INTO trip_revisions (id, trip_id, actor_user_id, version, operation, locale, document_json, created_at) " +
          "SELECT ?, id, ?, version, ?, locale, document_json, ? FROM trips " +
          "WHERE id = ? AND deleted_at IS NULL AND version = ? AND updated_at = ? " +
          "AND NOT EXISTS (SELECT 1 FROM trip_revisions r WHERE r.trip_id = trips.id AND r.version = trips.version)",
      )
      .bind(revisionId, userId, operation, now, id, nextVersion, now),
  ]);
  const updated = results[0];

  if (updated !== undefined && (updated.meta.changes ?? 0) > 0) {
    const tripRecord = await readTrip(db, userId, id);
    if (tripRecord === null) throw new Error("TRIP_UPDATE_READBACK_FAILED");
    return { kind: "updated", trip: tripRecord };
  }

  const current = await db
    .prepare(
      "SELECT t.version, t.owner_user_id, m.role FROM trips t " +
        "LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ? " +
        "WHERE t.id = ? AND t.deleted_at IS NULL LIMIT 1",
    )
    .bind(userId, id)
    .first<{
      readonly version: number;
      readonly owner_user_id: string;
      readonly role: "editor" | "viewer" | null;
    }>();
  if (current === null) return { kind: "missing" };
  if (current.owner_user_id !== userId && current.role === null) return { kind: "missing" };
  if (current.owner_user_id !== userId && current.role === "viewer") return { kind: "forbidden" };
  return { kind: "conflict", currentVersion: current.version };
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
