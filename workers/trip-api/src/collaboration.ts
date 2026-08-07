export type CollaborationRole = "editor" | "viewer";
export type TripAccessRole = "owner" | CollaborationRole;

export interface TripInviteLink {
  readonly id: string;
  readonly token: string;
  readonly tokenPrefix: string;
  readonly email: string;
  readonly role: CollaborationRole;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface TripInvitePreview {
  readonly id: string;
  readonly tripId: string;
  readonly tripTitle: string;
  readonly email: string;
  readonly role: CollaborationRole;
  readonly expiresAt: string;
}

export interface TripMemberView {
  readonly userId: string;
  readonly email: string;
  readonly role: CollaborationRole;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PendingInviteView {
  readonly id: string;
  readonly email: string;
  readonly role: CollaborationRole;
  readonly tokenPrefix: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface CollaboratorList {
  readonly ownerUserId: string;
  readonly members: ReadonlyArray<TripMemberView>;
  readonly invites: ReadonlyArray<PendingInviteView>;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function createRawInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `inv_${toHex(bytes)}`;
}

async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function resolveTripAccess(
  db: D1Database,
  userId: string,
  tripId: string,
): Promise<TripAccessRole | null> {
  const row = await db
    .prepare(
      "SELECT t.owner_user_id, m.role FROM trips t " +
        "LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ? " +
        "WHERE t.id = ? AND t.deleted_at IS NULL LIMIT 1",
    )
    .bind(userId, tripId)
    .first<{ readonly owner_user_id: string; readonly role: CollaborationRole | null }>();
  if (row === null) return null;
  if (row.owner_user_id === userId) return "owner";
  return row.role === "editor" || row.role === "viewer" ? row.role : null;
}

export async function createTripInvite(
  db: D1Database,
  ownerUserId: string,
  tripId: string,
  email: string,
  role: CollaborationRole,
  now = new Date().toISOString(),
): Promise<TripInviteLink | null> {
  const owned = await db
    .prepare(
      "SELECT id FROM trips WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tripId, ownerUserId)
    .first<{ readonly id: string }>();
  if (owned === null) return null;

  const normalizedEmail = normalizeInviteEmail(email);
  const token = createRawInviteToken();
  const tokenHash = await hashInviteToken(token);
  const tokenPrefix = token.slice(0, 12);
  const inviteId = `invite_${crypto.randomUUID().replaceAll("-", "")}`;
  const expiresAt = new Date(Date.parse(now) + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.batch([
    db
      .prepare(
        "UPDATE trip_invites SET revoked_at = ? " +
          "WHERE trip_id = ? AND email_normalized = ? AND accepted_at IS NULL AND revoked_at IS NULL",
      )
      .bind(now, tripId, normalizedEmail),
    db
      .prepare(
        "INSERT INTO trip_invites " +
          "(id, trip_id, owner_user_id, email_normalized, role, token_hash, token_prefix, created_at, expires_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        inviteId,
        tripId,
        ownerUserId,
        normalizedEmail,
        role,
        tokenHash,
        tokenPrefix,
        now,
        expiresAt,
      ),
  ]);

  return {
    id: inviteId,
    token,
    tokenPrefix,
    email: normalizedEmail,
    role,
    createdAt: now,
    expiresAt,
  };
}

export async function readTripInviteByToken(
  db: D1Database,
  token: string,
  now = new Date().toISOString(),
): Promise<TripInvitePreview | null> {
  const tokenHash = await hashInviteToken(token);
  const row = await db
    .prepare(
      "SELECT i.id, i.trip_id, t.title, i.email_normalized, i.role, i.expires_at " +
        "FROM trip_invites i JOIN trips t ON t.id = i.trip_id " +
        "WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.revoked_at IS NULL " +
        "AND i.expires_at > ? AND t.deleted_at IS NULL LIMIT 1",
    )
    .bind(tokenHash, now)
    .first<{
      readonly id: string;
      readonly trip_id: string;
      readonly title: string;
      readonly email_normalized: string;
      readonly role: CollaborationRole;
      readonly expires_at: string;
    }>();
  if (row === null) return null;
  return {
    id: row.id,
    tripId: row.trip_id,
    tripTitle: row.title,
    email: row.email_normalized,
    role: row.role,
    expiresAt: row.expires_at,
  };
}

export type AcceptInviteResult =
  | { readonly kind: "accepted"; readonly tripId: string; readonly role: CollaborationRole }
  | { readonly kind: "missing" }
  | { readonly kind: "email_mismatch"; readonly expectedEmail: string };

export async function acceptTripInvite(
  db: D1Database,
  token: string,
  userId: string,
  email: string,
  now = new Date().toISOString(),
): Promise<AcceptInviteResult> {
  const invite = await readTripInviteByToken(db, token, now);
  if (invite === null) return { kind: "missing" };
  const normalizedEmail = normalizeInviteEmail(email);
  if (normalizedEmail !== invite.email) {
    return { kind: "email_mismatch", expectedEmail: invite.email };
  }

  await db.batch([
    db
      .prepare(
        "INSERT INTO trip_members (trip_id, user_id, email_normalized, role, invited_by_user_id, created_at, updated_at) " +
          "SELECT i.trip_id, ?, i.email_normalized, i.role, i.owner_user_id, ?, ? FROM trip_invites i " +
          "JOIN trips t ON t.id = i.trip_id " +
          "WHERE i.id = ? AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > ? " +
          "AND i.email_normalized = ? AND t.deleted_at IS NULL " +
          "ON CONFLICT(trip_id, user_id) DO UPDATE SET " +
          "email_normalized = excluded.email_normalized, role = excluded.role, updated_at = excluded.updated_at",
      )
      .bind(userId, now, now, invite.id, now, normalizedEmail),
    db
      .prepare(
        "UPDATE trip_invites SET accepted_at = ?, accepted_user_id = ? " +
          "WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ? AND email_normalized = ?",
      )
      .bind(now, userId, invite.id, now, normalizedEmail),
  ]);

  const accepted = await db
    .prepare("SELECT accepted_user_id FROM trip_invites WHERE id = ? LIMIT 1")
    .bind(invite.id)
    .first<{ readonly accepted_user_id: string | null }>();
  return accepted?.accepted_user_id === userId
    ? { kind: "accepted", tripId: invite.tripId, role: invite.role }
    : { kind: "missing" };
}

export async function listTripCollaborators(
  db: D1Database,
  ownerUserId: string,
  tripId: string,
  now = new Date().toISOString(),
): Promise<CollaboratorList | null> {
  const owned = await db
    .prepare(
      "SELECT owner_user_id FROM trips WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tripId, ownerUserId)
    .first<{ readonly owner_user_id: string }>();
  if (owned === null) return null;

  const [members, invites] = await Promise.all([
    db
      .prepare(
        "SELECT user_id, email_normalized, role, created_at, updated_at FROM trip_members " +
          "WHERE trip_id = ? ORDER BY created_at ASC",
      )
      .bind(tripId)
      .all<{
        readonly user_id: string;
        readonly email_normalized: string;
        readonly role: CollaborationRole;
        readonly created_at: string;
        readonly updated_at: string;
      }>(),
    db
      .prepare(
        "SELECT id, email_normalized, role, token_prefix, created_at, expires_at FROM trip_invites " +
          "WHERE trip_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ? " +
          "ORDER BY created_at DESC",
      )
      .bind(tripId, now)
      .all<{
        readonly id: string;
        readonly email_normalized: string;
        readonly role: CollaborationRole;
        readonly token_prefix: string;
        readonly created_at: string;
        readonly expires_at: string;
      }>(),
  ]);

  return {
    ownerUserId,
    members: members.results.map((row) => ({
      userId: row.user_id,
      email: row.email_normalized,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    invites: invites.results.map((row) => ({
      id: row.id,
      email: row.email_normalized,
      role: row.role,
      tokenPrefix: row.token_prefix,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })),
  };
}

export async function updateTripMemberRole(
  db: D1Database,
  ownerUserId: string,
  tripId: string,
  memberUserId: string,
  role: CollaborationRole,
  now = new Date().toISOString(),
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE trip_members SET role = ?, updated_at = ? WHERE trip_id = ? AND user_id = ? " +
        "AND EXISTS (SELECT 1 FROM trips WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL)",
    )
    .bind(role, now, tripId, memberUserId, tripId, ownerUserId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function removeTripMember(
  db: D1Database,
  ownerUserId: string,
  tripId: string,
  memberUserId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "DELETE FROM trip_members WHERE trip_id = ? AND user_id = ? " +
        "AND EXISTS (SELECT 1 FROM trips WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL)",
    )
    .bind(tripId, memberUserId, tripId, ownerUserId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function revokeTripInvite(
  db: D1Database,
  ownerUserId: string,
  tripId: string,
  inviteId: string,
  now = new Date().toISOString(),
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE trip_invites SET revoked_at = ? WHERE id = ? AND trip_id = ? AND owner_user_id = ? " +
        "AND accepted_at IS NULL AND revoked_at IS NULL " +
        "AND EXISTS (SELECT 1 FROM trips WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL)",
    )
    .bind(now, inviteId, tripId, ownerUserId, tripId, ownerUserId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
