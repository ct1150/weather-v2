import { readTrip, type TripRecord } from "./store";

export type TripStatus = "active" | "archived";
export type UpdateTripStatusResult =
  | { readonly kind: "updated"; readonly trip: TripRecord }
  | { readonly kind: "conflict"; readonly currentVersion: number }
  | { readonly kind: "missing" };

export async function updateTripStatus(
  db: D1Database,
  ownerUserId: string,
  id: string,
  baseVersion: number,
  status: TripStatus,
  now = new Date().toISOString(),
): Promise<UpdateTripStatusResult> {
  const result = await db
    .prepare(
      "UPDATE trips SET status = ?, version = version + 1, updated_at = ? " +
        "WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL AND version = ?",
    )
    .bind(status, now, id, ownerUserId, baseVersion)
    .run();

  if ((result.meta.changes ?? 0) > 0) {
    const updated = await readTrip(db, ownerUserId, id);
    if (updated === null) throw new Error("TRIP_STATUS_READBACK_FAILED");
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

export function statusOf(trip: TripRecord): TripStatus {
  return trip.status;
}
