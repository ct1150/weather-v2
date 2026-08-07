import type { TripLocale, ValidTripDocument } from "./validation";

export interface SharedTripRecord {
  readonly title: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly locale: TripLocale;
  readonly updatedAt: string;
  readonly document: Record<string, unknown>;
}

export interface ShareLink {
  readonly token: string;
  readonly tokenPrefix: string;
  readonly createdAt: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function createRawShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `shr_${toHex(bytes)}`;
}

async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export async function createShareLink(
  db: D1Database,
  ownerUserId: string,
  tripId: string,
  now = new Date().toISOString(),
): Promise<ShareLink | null> {
  const owned = await db
    .prepare(
      "SELECT id FROM trips WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tripId, ownerUserId)
    .first<{ readonly id: string }>();
  if (owned === null) return null;

  const token = createRawShareToken();
  const tokenHash = await hashShareToken(token);
  const tokenPrefix = token.slice(0, 12);
  const shareId = `share_${crypto.randomUUID().replaceAll("-", "")}`;

  await db.batch([
    db
      .prepare(
        "UPDATE trip_shares SET revoked_at = ? WHERE trip_id = ? AND owner_user_id = ? AND revoked_at IS NULL",
      )
      .bind(now, tripId, ownerUserId),
    db
      .prepare(
        "INSERT INTO trip_shares (id, trip_id, owner_user_id, token_hash, token_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(shareId, tripId, ownerUserId, tokenHash, tokenPrefix, now),
  ]);

  return { token, tokenPrefix, createdAt: now };
}

export async function revokeShareLink(
  db: D1Database,
  ownerUserId: string,
  tripId: string,
  now = new Date().toISOString(),
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE trip_shares SET revoked_at = ? WHERE trip_id = ? AND owner_user_id = ? AND revoked_at IS NULL",
    )
    .bind(now, tripId, ownerUserId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function readSharedTripByToken(
  db: D1Database,
  token: string,
): Promise<SharedTripRecord | null> {
  const tokenHash = await hashShareToken(token);
  const row = await db
    .prepare(
      "SELECT t.title, t.start_date, t.end_date, t.locale, t.updated_at, t.document_json " +
        "FROM trip_shares s JOIN trips t ON t.id = s.trip_id " +
        "WHERE s.token_hash = ? AND s.revoked_at IS NULL AND t.deleted_at IS NULL LIMIT 1",
    )
    .bind(tokenHash)
    .first<{
      readonly title: string;
      readonly start_date: string | null;
      readonly end_date: string | null;
      readonly locale: TripLocale;
      readonly updated_at: string;
      readonly document_json: string;
    }>();
  if (row === null) return null;
  return {
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    locale: row.locale,
    updatedAt: row.updated_at,
    document: JSON.parse(row.document_json) as Record<string, unknown>,
  };
}

export function validSharedDocument(
  shared: SharedTripRecord,
  validate: (input: unknown) => ValidTripDocument | null,
): ValidTripDocument | null {
  return validate(shared.document);
}
