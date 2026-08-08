import { resolveTripAccess } from "./collaboration";
import { updateTrip, type UpdateTripResult } from "./store";
import { validateTripDocument, type TripLocale } from "./validation";

export interface TripRevisionSummary {
  readonly version: number;
  readonly operation: string;
  readonly createdAt: string;
}

interface RevisionRow {
  readonly version: number;
  readonly operation: string;
  readonly locale: TripLocale;
  readonly document_json: string;
  readonly created_at: string;
}

export async function listTripRevisions(
  db: D1Database,
  userId: string,
  tripId: string,
  limit = 30,
): Promise<ReadonlyArray<TripRevisionSummary> | null> {
  const access = await resolveTripAccess(db, userId, tripId);
  if (access === null) return null;
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const result = await db
    .prepare(
      "SELECT version, operation, locale, document_json, created_at FROM trip_revisions " +
        "WHERE trip_id = ? ORDER BY version DESC LIMIT ?",
    )
    .bind(tripId, safeLimit)
    .all<RevisionRow>();
  return result.results.map((row) => ({
    version: row.version,
    operation: row.operation,
    createdAt: row.created_at,
  }));
}

export type RestoreRevisionResult = UpdateTripResult | { readonly kind: "forbidden" };

export async function restoreTripRevision(
  db: D1Database,
  userId: string,
  tripId: string,
  targetVersion: number,
  baseVersion: number,
  now = new Date().toISOString(),
  actorEmail: string | null = null,
): Promise<RestoreRevisionResult> {
  const access = await resolveTripAccess(db, userId, tripId);
  if (access === null) return { kind: "missing" };
  if (access === "viewer") return { kind: "forbidden" };

  const revision = await db
    .prepare(
      "SELECT version, operation, locale, document_json, created_at FROM trip_revisions " +
        "WHERE trip_id = ? AND version = ? LIMIT 1",
    )
    .bind(tripId, targetVersion)
    .first<RevisionRow>();
  if (revision === null) return { kind: "missing" };

  const document = validateTripDocument(JSON.parse(revision.document_json) as unknown);
  if (document === null) throw new Error("REVISION_DOCUMENT_INVALID");
  return updateTrip(
    db,
    userId,
    tripId,
    baseVersion,
    revision.locale,
    document,
    now,
    `restore:${targetVersion}`,
    actorEmail,
  );
}
