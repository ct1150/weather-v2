import { normalizeInviteEmail, resolveTripAccess, type TripAccessRole } from "./collaboration";

export type TripActivityKind =
  | "revision"
  | "comment_created"
  | "comment_deleted"
  | "decision_created"
  | "decision_resolved"
  | "decision_reopened"
  | "decision_deleted";

export interface TripActivityItem {
  readonly id: string;
  readonly kind: TripActivityKind;
  readonly actorUserId: string;
  readonly actorEmail: string | null;
  readonly payload: Record<string, unknown>;
  readonly createdAt: string;
}

export interface TripComment {
  readonly id: string;
  readonly authorUserId: string;
  readonly authorEmail: string;
  readonly body: string;
  readonly dayId: string | null;
  readonly revisionVersion: number | null;
  readonly createdAt: string;
}

export interface TripDecision {
  readonly id: string;
  readonly createdByUserId: string;
  readonly createdByEmail: string;
  readonly title: string;
  readonly detail: string;
  readonly dayId: string | null;
  readonly status: "open" | "resolved";
  readonly resolvedByUserId: string | null;
  readonly resolvedByEmail: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ActivityRow {
  readonly id: string;
  readonly actor_user_id: string;
  readonly actor_email_normalized: string | null;
  readonly kind: TripActivityKind;
  readonly payload_json: string;
  readonly created_at: string;
}

interface CommentRow {
  readonly id: string;
  readonly author_user_id: string;
  readonly author_email_normalized: string;
  readonly body: string;
  readonly day_id: string | null;
  readonly revision_version: number | null;
  readonly created_at: string;
}

interface DecisionRow {
  readonly id: string;
  readonly created_by_user_id: string;
  readonly created_by_email_normalized: string;
  readonly title: string;
  readonly detail: string;
  readonly day_id: string | null;
  readonly status: "open" | "resolved";
  readonly resolved_by_user_id: string | null;
  readonly resolved_by_email_normalized: string | null;
  readonly resolved_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

function parsePayload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function canWrite(role: TripAccessRole | null): boolean {
  return role === "owner" || role === "editor";
}

export async function appendTripActivity(
  db: D1Database,
  tripId: string,
  actorUserId: string,
  actorEmail: string | null,
  kind: TripActivityKind,
  payload: Record<string, unknown>,
  now = new Date().toISOString(),
): Promise<void> {
  const id = `act_${crypto.randomUUID().replaceAll("-", "")}`;
  await db
    .prepare(
      "INSERT INTO trip_activity (id, trip_id, actor_user_id, actor_email_normalized, kind, payload_json, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      tripId,
      actorUserId,
      actorEmail === null ? null : normalizeInviteEmail(actorEmail),
      kind,
      JSON.stringify(payload),
      now,
    )
    .run();
}

export async function listTripActivity(
  db: D1Database,
  userId: string,
  tripId: string,
  limit = 50,
): Promise<ReadonlyArray<TripActivityItem> | null> {
  if ((await resolveTripAccess(db, userId, tripId)) === null) return null;
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const result = await db
    .prepare(
      "SELECT id, actor_user_id, actor_email_normalized, kind, payload_json, created_at " +
        "FROM trip_activity WHERE trip_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .bind(tripId, safeLimit)
    .all<ActivityRow>();
  return result.results.map((row) => ({
    id: row.id,
    kind: row.kind,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email_normalized,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
  }));
}

export async function listTripComments(
  db: D1Database,
  userId: string,
  tripId: string,
  limit = 80,
): Promise<ReadonlyArray<TripComment> | null> {
  if ((await resolveTripAccess(db, userId, tripId)) === null) return null;
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const result = await db
    .prepare(
      "SELECT id, author_user_id, author_email_normalized, body, day_id, revision_version, created_at " +
        "FROM trip_comments WHERE trip_id = ? AND deleted_at IS NULL " +
        "ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .bind(tripId, safeLimit)
    .all<CommentRow>();
  return result.results.map((row) => ({
    id: row.id,
    authorUserId: row.author_user_id,
    authorEmail: row.author_email_normalized,
    body: row.body,
    dayId: row.day_id,
    revisionVersion: row.revision_version,
    createdAt: row.created_at,
  }));
}

export type CreateCommentResult =
  | { readonly kind: "created"; readonly comment: TripComment }
  | { readonly kind: "forbidden" }
  | { readonly kind: "missing" };

export async function createTripComment(
  db: D1Database,
  userId: string,
  email: string,
  tripId: string,
  body: string,
  dayId: string | null,
  revisionVersion: number | null,
  now = new Date().toISOString(),
): Promise<CreateCommentResult> {
  const access = await resolveTripAccess(db, userId, tripId);
  if (access === null) return { kind: "missing" };
  if (!canWrite(access)) return { kind: "forbidden" };
  const id = `comment_${crypto.randomUUID().replaceAll("-", "")}`;
  const normalizedEmail = normalizeInviteEmail(email);
  const activityId = `act_${crypto.randomUUID().replaceAll("-", "")}`;
  await db.batch([
    db
      .prepare(
        "INSERT INTO trip_comments (id, trip_id, author_user_id, author_email_normalized, body, day_id, revision_version, created_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, tripId, userId, normalizedEmail, body, dayId, revisionVersion, now),
    db
      .prepare(
        "INSERT INTO trip_activity (id, trip_id, actor_user_id, actor_email_normalized, kind, payload_json, created_at) " +
          "VALUES (?, ?, ?, ?, 'comment_created', ?, ?)",
      )
      .bind(
        activityId,
        tripId,
        userId,
        normalizedEmail,
        JSON.stringify({ commentId: id, dayId, revisionVersion }),
        now,
      ),
  ]);
  return {
    kind: "created",
    comment: {
      id,
      authorUserId: userId,
      authorEmail: normalizedEmail,
      body,
      dayId,
      revisionVersion,
      createdAt: now,
    },
  };
}

export async function deleteTripComment(
  db: D1Database,
  userId: string,
  email: string,
  tripId: string,
  commentId: string,
  now = new Date().toISOString(),
): Promise<"deleted" | "forbidden" | "missing"> {
  const access = await resolveTripAccess(db, userId, tripId);
  if (access === null) return "missing";
  if (access !== "owner") return "forbidden";
  const result = await db
    .prepare(
      "UPDATE trip_comments SET deleted_at = ? WHERE id = ? AND trip_id = ? AND deleted_at IS NULL",
    )
    .bind(now, commentId, tripId)
    .run();
  if ((result.meta.changes ?? 0) === 0) return "missing";
  await appendTripActivity(db, tripId, userId, email, "comment_deleted", { commentId }, now);
  return "deleted";
}

export async function listTripDecisions(
  db: D1Database,
  userId: string,
  tripId: string,
  limit = 80,
): Promise<ReadonlyArray<TripDecision> | null> {
  if ((await resolveTripAccess(db, userId, tripId)) === null) return null;
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const result = await db
    .prepare(
      "SELECT id, created_by_user_id, created_by_email_normalized, title, detail, day_id, status, " +
        "resolved_by_user_id, resolved_by_email_normalized, resolved_at, created_at, updated_at " +
        "FROM trip_decisions WHERE trip_id = ? AND deleted_at IS NULL " +
        "ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, updated_at DESC, id DESC LIMIT ?",
    )
    .bind(tripId, safeLimit)
    .all<DecisionRow>();
  return result.results.map((row) => ({
    id: row.id,
    createdByUserId: row.created_by_user_id,
    createdByEmail: row.created_by_email_normalized,
    title: row.title,
    detail: row.detail,
    dayId: row.day_id,
    status: row.status,
    resolvedByUserId: row.resolved_by_user_id,
    resolvedByEmail: row.resolved_by_email_normalized,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export type DecisionMutationResult =
  | { readonly kind: "ok"; readonly decision: TripDecision }
  | { readonly kind: "forbidden" }
  | { readonly kind: "missing" };

export async function createTripDecision(
  db: D1Database,
  userId: string,
  email: string,
  tripId: string,
  title: string,
  detail: string,
  dayId: string | null,
  now = new Date().toISOString(),
): Promise<DecisionMutationResult> {
  const access = await resolveTripAccess(db, userId, tripId);
  if (access === null) return { kind: "missing" };
  if (!canWrite(access)) return { kind: "forbidden" };
  const id = `decision_${crypto.randomUUID().replaceAll("-", "")}`;
  const normalizedEmail = normalizeInviteEmail(email);
  const activityId = `act_${crypto.randomUUID().replaceAll("-", "")}`;
  await db.batch([
    db
      .prepare(
        "INSERT INTO trip_decisions (id, trip_id, created_by_user_id, created_by_email_normalized, title, detail, day_id, status, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
      )
      .bind(id, tripId, userId, normalizedEmail, title, detail, dayId, now, now),
    db
      .prepare(
        "INSERT INTO trip_activity (id, trip_id, actor_user_id, actor_email_normalized, kind, payload_json, created_at) " +
          "VALUES (?, ?, ?, ?, 'decision_created', ?, ?)",
      )
      .bind(activityId, tripId, userId, normalizedEmail, JSON.stringify({ decisionId: id, title, dayId }), now),
  ]);
  return {
    kind: "ok",
    decision: {
      id,
      createdByUserId: userId,
      createdByEmail: normalizedEmail,
      title,
      detail,
      dayId,
      status: "open",
      resolvedByUserId: null,
      resolvedByEmail: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export async function updateTripDecisionStatus(
  db: D1Database,
  userId: string,
  email: string,
  tripId: string,
  decisionId: string,
  status: "open" | "resolved",
  now = new Date().toISOString(),
): Promise<DecisionMutationResult> {
  const access = await resolveTripAccess(db, userId, tripId);
  if (access === null) return { kind: "missing" };
  if (!canWrite(access)) return { kind: "forbidden" };
  const normalizedEmail = normalizeInviteEmail(email);
  const result = await db
    .prepare(
      "UPDATE trip_decisions SET status = ?, resolved_by_user_id = ?, resolved_by_email_normalized = ?, " +
        "resolved_at = ?, updated_at = ? WHERE id = ? AND trip_id = ? AND deleted_at IS NULL",
    )
    .bind(
      status,
      status === "resolved" ? userId : null,
      status === "resolved" ? normalizedEmail : null,
      status === "resolved" ? now : null,
      now,
      decisionId,
      tripId,
    )
    .run();
  if ((result.meta.changes ?? 0) === 0) return { kind: "missing" };
  await appendTripActivity(
    db,
    tripId,
    userId,
    normalizedEmail,
    status === "resolved" ? "decision_resolved" : "decision_reopened",
    { decisionId },
    now,
  );
  const decisions = await listTripDecisions(db, userId, tripId, 100);
  const decision = decisions?.find((item) => item.id === decisionId);
  return decision === undefined ? { kind: "missing" } : { kind: "ok", decision };
}

export async function deleteTripDecision(
  db: D1Database,
  userId: string,
  email: string,
  tripId: string,
  decisionId: string,
  now = new Date().toISOString(),
): Promise<"deleted" | "forbidden" | "missing"> {
  const access = await resolveTripAccess(db, userId, tripId);
  if (access === null) return "missing";
  if (access !== "owner") return "forbidden";
  const result = await db
    .prepare(
      "UPDATE trip_decisions SET deleted_at = ?, updated_at = ? WHERE id = ? AND trip_id = ? AND deleted_at IS NULL",
    )
    .bind(now, now, decisionId, tripId)
    .run();
  if ((result.meta.changes ?? 0) === 0) return "missing";
  await appendTripActivity(db, tripId, userId, email, "decision_deleted", { decisionId }, now);
  return "deleted";
}
