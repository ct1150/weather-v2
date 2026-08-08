import {
  createTripComment,
  createTripDecision,
  deleteTripComment,
  deleteTripDecision,
  listTripActivity,
  listTripComments,
  listTripDecisions,
  updateTripDecisionStatus,
} from "./collaboration-intelligence";
import { readTripRevisionDiff } from "./revision-diff";
import { readJsonBody } from "./validation";

export interface CollaborationIdentity {
  readonly userId: string;
  readonly email: string;
}

export interface CollaborationRouteResult {
  readonly status: number;
  readonly body: unknown;
}

function ok(data: unknown, status = 200): CollaborationRouteResult {
  return { status, body: { data } };
}

function error(code: string, status: number): CollaborationRouteResult {
  return { status, body: { error: { code } } };
}

function boundedString(value: unknown, max: number, allowEmpty = false): string | null {
  if (typeof value !== "string" || value.length > max) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 || allowEmpty ? trimmed : null;
}

function optionalDayId(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return boundedString(value, 128) ?? undefined;
}

function tripCollection(
  pathname: string,
  resource: "activity" | "comments" | "decisions",
): string | null {
  const match = new RegExp(
    `^/api/v1/trips/([a-zA-Z0-9_-]{8,96})/${resource}$`,
    "u",
  ).exec(pathname);
  return match?.[1] ?? null;
}

function tripItem(
  pathname: string,
  resource: "comments" | "decisions",
  prefix: "comment_" | "decision_",
): { readonly tripId: string; readonly itemId: string } | null {
  const match = new RegExp(
    `^/api/v1/trips/([a-zA-Z0-9_-]{8,96})/${resource}/(${prefix}[a-zA-Z0-9_-]{16,128})$`,
    "u",
  ).exec(pathname);
  return match?.[1] && match[2] ? { tripId: match[1], itemId: match[2] } : null;
}

function revisionDiffPath(
  pathname: string,
): { readonly tripId: string; readonly version: number } | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/revisions\/(\d+)\/diff$/u.exec(
    pathname,
  );
  if (!match?.[1] || !match[2]) return null;
  const version = Number(match[2]);
  return Number.isInteger(version) && version > 0 ? { tripId: match[1], version } : null;
}

export async function handleCollaborationIntelligenceRoute(
  request: Request,
  db: D1Database,
  identity: CollaborationIdentity,
): Promise<CollaborationRouteResult | null> {
  const url = new URL(request.url);

  const activityTripId = tripCollection(url.pathname, "activity");
  if (activityTripId !== null) {
    if (request.method !== "GET") return error("METHOD_NOT_ALLOWED", 405);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const items = await listTripActivity(
      db,
      identity.userId,
      activityTripId,
      Number.isFinite(limit) ? limit : 50,
    );
    return items === null ? error("NOT_FOUND", 404) : ok({ items });
  }

  const commentsTripId = tripCollection(url.pathname, "comments");
  if (commentsTripId !== null) {
    if (request.method === "GET") {
      const items = await listTripComments(db, identity.userId, commentsTripId);
      return items === null ? error("NOT_FOUND", 404) : ok({ items });
    }
    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return error("INVALID_BODY", 400);
      }
      const object = body as Record<string, unknown>;
      const commentBody = boundedString(object.body, 1500);
      const dayId = optionalDayId(object.dayId);
      const revisionVersion =
        object.revisionVersion === undefined || object.revisionVersion === null
          ? null
          : Number(object.revisionVersion);
      if (
        commentBody === null ||
        dayId === undefined ||
        (revisionVersion !== null && (!Number.isInteger(revisionVersion) || revisionVersion < 1))
      ) {
        return error("INVALID_COMMENT", 400);
      }
      const result = await createTripComment(
        db,
        identity.userId,
        identity.email,
        commentsTripId,
        commentBody,
        dayId,
        revisionVersion,
      );
      if (result.kind === "missing") return error("NOT_FOUND", 404);
      if (result.kind === "forbidden") return error("FORBIDDEN", 403);
      return ok(result.comment, 201);
    }
    return error("METHOD_NOT_ALLOWED", 405);
  }

  const commentItem = tripItem(url.pathname, "comments", "comment_");
  if (commentItem !== null) {
    if (request.method !== "DELETE") return error("METHOD_NOT_ALLOWED", 405);
    const result = await deleteTripComment(
      db,
      identity.userId,
      identity.email,
      commentItem.tripId,
      commentItem.itemId,
    );
    if (result === "missing") return error("NOT_FOUND", 404);
    if (result === "forbidden") return error("FORBIDDEN", 403);
    return ok({ deleted: true });
  }

  const decisionsTripId = tripCollection(url.pathname, "decisions");
  if (decisionsTripId !== null) {
    if (request.method === "GET") {
      const items = await listTripDecisions(db, identity.userId, decisionsTripId);
      return items === null ? error("NOT_FOUND", 404) : ok({ items });
    }
    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return error("INVALID_BODY", 400);
      }
      const object = body as Record<string, unknown>;
      const title = boundedString(object.title, 160);
      const detail = boundedString(object.detail ?? "", 2000, true);
      const dayId = optionalDayId(object.dayId);
      if (title === null || detail === null || dayId === undefined) {
        return error("INVALID_DECISION", 400);
      }
      const result = await createTripDecision(
        db,
        identity.userId,
        identity.email,
        decisionsTripId,
        title,
        detail,
        dayId,
      );
      if (result.kind === "missing") return error("NOT_FOUND", 404);
      if (result.kind === "forbidden") return error("FORBIDDEN", 403);
      return ok(result.decision, 201);
    }
    return error("METHOD_NOT_ALLOWED", 405);
  }

  const decisionItem = tripItem(url.pathname, "decisions", "decision_");
  if (decisionItem !== null) {
    if (request.method === "PATCH") {
      const body = await readJsonBody(request);
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return error("INVALID_BODY", 400);
      }
      const status = (body as Record<string, unknown>).status;
      if (status !== "open" && status !== "resolved") return error("INVALID_STATUS", 400);
      const result = await updateTripDecisionStatus(
        db,
        identity.userId,
        identity.email,
        decisionItem.tripId,
        decisionItem.itemId,
        status,
      );
      if (result.kind === "missing") return error("NOT_FOUND", 404);
      if (result.kind === "forbidden") return error("FORBIDDEN", 403);
      return ok(result.decision);
    }
    if (request.method === "DELETE") {
      const result = await deleteTripDecision(
        db,
        identity.userId,
        identity.email,
        decisionItem.tripId,
        decisionItem.itemId,
      );
      if (result === "missing") return error("NOT_FOUND", 404);
      if (result === "forbidden") return error("FORBIDDEN", 403);
      return ok({ deleted: true });
    }
    return error("METHOD_NOT_ALLOWED", 405);
  }

  const diffRoute = revisionDiffPath(url.pathname);
  if (diffRoute !== null) {
    if (request.method !== "GET") return error("METHOD_NOT_ALLOWED", 405);
    const diff = await readTripRevisionDiff(db, identity.userId, diffRoute.tripId, diffRoute.version);
    return diff === null ? error("NOT_FOUND", 404) : ok(diff);
  }

  return null;
}
