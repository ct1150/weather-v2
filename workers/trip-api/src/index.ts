import {
  getAuthIdentity,
  handleAuthRequest,
  providerAvailability,
  runAuthMigrations,
  sendTripInviteEmail,
  type AuthEnv,
  type AuthIdentity,
} from "./auth";
import {
  acceptTripInvite,
  createTripInvite,
  listTripCollaborators,
  normalizeInviteEmail,
  readTripInviteByToken,
  removeTripMember,
  revokeTripInvite,
  updateTripMemberRole,
  type CollaborationRole,
} from "./collaboration";
import { handleCollaborationIntelligenceRoute } from "./collaboration-intelligence-routes";
import { validateReplanDocumentChange } from "./replan-apply";
import { listTripRevisions, restoreTripRevision } from "./revisions";
import { createShareLink, readSharedTripByToken, revokeShareLink } from "./sharing";
import { updateTripStatus, type TripStatus } from "./status";
import { createTrip, deleteTrip, listTrips, readTrip, updateTrip } from "./store";
import { parseLocale, readJsonBody, validateTripDocument, type TripLocale } from "./validation";
import { handleWeatherIntelligenceRoute } from "./weather-intelligence-routes";
import {
  runScheduledWeatherMonitor,
  type WeatherReadBinding,
} from "./weather-intelligence-service";

export interface WorkerEnv extends AuthEnv {
  readonly INTERNAL_MIGRATION_TOKEN?: string;
  readonly INTERNAL_SMOKE_TOKEN?: string;
  readonly WEATHER_READ?: WeatherReadBinding;
}

const DEFAULT_ORIGIN = "https://868656.xyz";
const SHARE_TOKEN_PATTERN = /^shr_[a-f0-9]{64}$/u;
const INVITE_TOKEN_PATTERN = /^inv_[a-f0-9]{64}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function allowedOrigin(request: Request, env: WorkerEnv): string {
  const origin = request.headers.get("origin");
  const configured = env.WEB_ORIGIN ?? DEFAULT_ORIGIN;
  if (origin === configured || origin === DEFAULT_ORIGIN || origin === "http://localhost:3000") {
    return origin;
  }
  return configured;
}

function corsHeaders(request: Request, env: WorkerEnv): Record<string, string> {
  return {
    "access-control-allow-origin": allowedOrigin(request, env),
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers":
      "content-type,authorization,x-wnr-smoke-user,x-wnr-smoke-email,x-wnr-share-token,x-wnr-invite-token",
    "cache-control": "private, no-store",
    vary: "Origin",
  };
}

function json(request: Request, env: WorkerEnv, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request, env), "content-type": "application/json; charset=utf-8" },
  });
}

function withCors(request: Request, env: WorkerEnv, response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function secretMatches(expected: string | undefined, request: Request): Promise<boolean> {
  if (!expected) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const actual = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    difference |= a[index]! ^ b[index]!;
  }
  return difference === 0;
}

async function resolveIdentity(request: Request, env: WorkerEnv): Promise<AuthIdentity | null> {
  if (await secretMatches(env.INTERNAL_SMOKE_TOKEN, request)) {
    const requested = request.headers.get("x-wnr-smoke-user") ?? "ci-smoke";
    const safeUser = /^[a-zA-Z0-9_-]{2,64}$/u.test(requested) ? requested : "ci-smoke";
    const requestedEmail = normalizeInviteEmail(
      request.headers.get("x-wnr-smoke-email") ?? `${safeUser}@smoke.invalid`,
    );
    return {
      userId: `internal:${safeUser}`,
      email: EMAIL_PATTERN.test(requestedEmail) ? requestedEmail : `${safeUser}@smoke.invalid`,
    };
  }
  return getAuthIdentity(request, env);
}

function tripIdFromPath(pathname: string): string | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})$/u.exec(pathname);
  return match?.[1] ?? null;
}

function tripReplanApplyIdFromPath(pathname: string): string | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/replan\/apply$/u.exec(pathname);
  return match?.[1] ?? null;
}

function tripStatusIdFromPath(pathname: string): string | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/status$/u.exec(pathname);
  return match?.[1] ?? null;
}

function tripShareIdFromPath(pathname: string): string | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/share$/u.exec(pathname);
  return match?.[1] ?? null;
}

function tripMembersIdFromPath(pathname: string): string | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/members$/u.exec(pathname);
  return match?.[1] ?? null;
}

function tripInvitesIdFromPath(pathname: string): string | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/invites$/u.exec(pathname);
  return match?.[1] ?? null;
}

function tripInviteItemFromPath(
  pathname: string,
): { readonly tripId: string; readonly inviteId: string } | null {
  const match =
    /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/invites\/(invite_[a-zA-Z0-9_-]{16,128})$/u.exec(
      pathname,
    );
  return match?.[1] && match[2] ? { tripId: match[1], inviteId: match[2] } : null;
}

function tripMemberItemFromPath(
  pathname: string,
): { readonly tripId: string; readonly userId: string } | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/members\/([a-zA-Z0-9:_-]{2,128})$/u.exec(
    pathname,
  );
  return match?.[1] && match[2] ? { tripId: match[1], userId: match[2] } : null;
}

function tripRevisionsIdFromPath(pathname: string): string | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/revisions$/u.exec(pathname);
  return match?.[1] ?? null;
}

function tripRevisionRestoreFromPath(
  pathname: string,
): { readonly tripId: string; readonly version: number } | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/revisions\/(\d+)\/restore$/u.exec(
    pathname,
  );
  if (!match?.[1] || !match[2]) return null;
  const version = Number(match[2]);
  return Number.isInteger(version) && version > 0 ? { tripId: match[1], version } : null;
}

function sharedTripRoute(
  request: Request,
): { readonly token: string; readonly copy: boolean } | null {
  const pathname = new URL(request.url).pathname;
  const current = /^\/api\/v1\/shared-trips\/current(\/copy)?$/u.exec(pathname);
  if (current !== null) {
    const token = request.headers.get("x-wnr-share-token") ?? "";
    return SHARE_TOKEN_PATTERN.test(token) ? { token, copy: current[1] === "/copy" } : null;
  }

  const legacy = /^\/api\/v1\/shared-trips\/(shr_[a-f0-9]{64})(\/copy)?$/u.exec(pathname);
  if (legacy?.[1] === undefined || !SHARE_TOKEN_PATTERN.test(legacy[1])) return null;
  return { token: legacy[1], copy: legacy[2] === "/copy" };
}

function inviteRoute(
  request: Request,
): { readonly token: string; readonly accept: boolean } | null {
  const pathname = new URL(request.url).pathname;
  const current = /^\/api\/v1\/trip-invites\/current(\/accept)?$/u.exec(pathname);
  if (current === null) return null;
  const token = request.headers.get("x-wnr-invite-token") ?? "";
  return INVITE_TOKEN_PATTERN.test(token) ? { token, accept: current[1] === "/accept" } : null;
}

export function safeLogPath(pathname: string): string {
  if (pathname.startsWith("/api/v1/shared-trips/")) {
    return pathname.endsWith("/copy")
      ? "/api/v1/shared-trips/[redacted]/copy"
      : "/api/v1/shared-trips/[redacted]";
  }
  return pathname;
}

function invitePath(locale: TripLocale): string {
  if (locale === "zh-cn") return "/zh-cn/trips/invite";
  if (locale === "zh-hant") return "/zh-hant/trips/invite";
  return "/trips/invite";
}

async function handleTripInvites(request: Request, env: WorkerEnv): Promise<Response> {
  const route = inviteRoute(request);
  if (route === null) return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
  const preview = await readTripInviteByToken(env.DB, route.token);
  if (preview === null) return json(request, env, { error: { code: "NOT_FOUND" } }, 404);

  if (!route.accept && request.method === "GET") {
    return json(request, env, { data: preview });
  }

  if (route.accept && request.method === "POST") {
    const identity = await resolveIdentity(request, env);
    if (identity === null) return json(request, env, { error: { code: "UNAUTHORIZED" } }, 401);
    const accepted = await acceptTripInvite(env.DB, route.token, identity.userId, identity.email);
    if (accepted.kind === "email_mismatch") {
      return json(request, env, { error: { code: "INVITE_EMAIL_MISMATCH" } }, 403);
    }
    if (accepted.kind === "missing") {
      return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    return json(request, env, { data: accepted }, 201);
  }

  return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
}

async function handleTrips(request: Request, env: WorkerEnv): Promise<Response> {
  const identity = await resolveIdentity(request, env);
  if (identity === null) return json(request, env, { error: { code: "UNAUTHORIZED" } }, 401);
  const userId = identity.userId;
  const url = new URL(request.url);

  const phase5 = await handleWeatherIntelligenceRoute(request, env, identity);
  if (phase5 !== null) return json(request, env, phase5.body, phase5.status);

  const phase4 = await handleCollaborationIntelligenceRoute(request, env.DB, identity);
  if (phase4 !== null) return json(request, env, phase4.body, phase4.status);

  if (url.pathname === "/api/v1/trips") {
    if (request.method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const requestedStatus = url.searchParams.get("status");
      const status =
        requestedStatus === "active" || requestedStatus === "archived" ? requestedStatus : "all";
      const items = await listTrips(env.DB, userId, Number.isFinite(limit) ? limit : 50, status);
      return json(request, env, { data: { items } });
    }
    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return json(request, env, { error: { code: "INVALID_BODY" } }, 400);
      }
      const object = body as Record<string, unknown>;
      const locale = parseLocale(object.locale ?? "en");
      const trip = validateTripDocument(object.document);
      if (locale === null || trip === null) {
        return json(request, env, { error: { code: "INVALID_TRIP" } }, 400);
      }
      const created = await createTrip(
        env.DB,
        userId,
        locale,
        trip,
        new Date().toISOString(),
        identity.email,
      );
      return json(request, env, { data: created }, 201);
    }
    return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  }

  const memberListTripId = tripMembersIdFromPath(url.pathname);
  if (memberListTripId !== null) {
    if (request.method !== "GET") {
      return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
    }
    const collaborators = await listTripCollaborators(env.DB, userId, memberListTripId);
    return collaborators === null
      ? json(request, env, { error: { code: "NOT_FOUND" } }, 404)
      : json(request, env, { data: collaborators });
  }

  const inviteListTripId = tripInvitesIdFromPath(url.pathname);
  if (inviteListTripId !== null) {
    if (request.method !== "POST") {
      return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
    }
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json(request, env, { error: { code: "INVALID_BODY" } }, 400);
    }
    const object = body as Record<string, unknown>;
    const email = typeof object.email === "string" ? normalizeInviteEmail(object.email) : "";
    const role = object.role;
    const locale = parseLocale(object.locale ?? "en");
    if (
      !EMAIL_PATTERN.test(email) ||
      email.length > 254 ||
      (role !== "editor" && role !== "viewer") ||
      locale === null
    ) {
      return json(request, env, { error: { code: "INVALID_INVITE" } }, 400);
    }
    const trip = await readTrip(env.DB, userId, inviteListTripId);
    if (trip === null || trip.accessRole !== "owner") {
      return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    const created = await createTripInvite(
      env.DB,
      userId,
      inviteListTripId,
      email,
      role as CollaborationRole,
    );
    if (created === null) return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    const origin = env.WEB_ORIGIN ?? DEFAULT_ORIGIN;
    const inviteUrl = `${origin}${invitePath(locale)}#token=${encodeURIComponent(created.token)}`;
    let emailSent = false;
    try {
      emailSent = await sendTripInviteEmail(env, email, trip.title, created.role, inviteUrl);
    } catch {
      emailSent = false;
    }
    return json(request, env, { data: { ...created, emailSent } }, 201);
  }

  const inviteItem = tripInviteItemFromPath(url.pathname);
  if (inviteItem !== null) {
    if (request.method !== "DELETE") {
      return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
    }
    const revoked = await revokeTripInvite(env.DB, userId, inviteItem.tripId, inviteItem.inviteId);
    return revoked
      ? json(request, env, { data: { revoked: true } })
      : json(request, env, { error: { code: "NOT_FOUND" } }, 404);
  }

  const memberItem = tripMemberItemFromPath(url.pathname);
  if (memberItem !== null) {
    if (request.method === "PATCH") {
      const body = await readJsonBody(request);
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return json(request, env, { error: { code: "INVALID_BODY" } }, 400);
      }
      const role = (body as Record<string, unknown>).role;
      if (role !== "editor" && role !== "viewer") {
        return json(request, env, { error: { code: "INVALID_ROLE" } }, 400);
      }
      const updated = await updateTripMemberRole(
        env.DB,
        userId,
        memberItem.tripId,
        memberItem.userId,
        role,
      );
      return updated
        ? json(request, env, { data: { updated: true, role } })
        : json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    if (request.method === "DELETE") {
      const removed = await removeTripMember(env.DB, userId, memberItem.tripId, memberItem.userId);
      return removed
        ? json(request, env, { data: { removed: true } })
        : json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  }

  const revisionListTripId = tripRevisionsIdFromPath(url.pathname);
  if (revisionListTripId !== null) {
    if (request.method !== "GET") {
      return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
    }
    const limit = Number(url.searchParams.get("limit") ?? "30");
    const revisions = await listTripRevisions(
      env.DB,
      userId,
      revisionListTripId,
      Number.isFinite(limit) ? limit : 30,
    );
    return revisions === null
      ? json(request, env, { error: { code: "NOT_FOUND" } }, 404)
      : json(request, env, { data: { items: revisions } });
  }

  const revisionRestore = tripRevisionRestoreFromPath(url.pathname);
  if (revisionRestore !== null) {
    if (request.method !== "POST") {
      return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
    }
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json(request, env, { error: { code: "INVALID_BODY" } }, 400);
    }
    const baseVersion = (body as Record<string, unknown>).baseVersion;
    if (!Number.isInteger(baseVersion) || Number(baseVersion) < 1) {
      return json(request, env, { error: { code: "INVALID_VERSION" } }, 400);
    }
    const result = await restoreTripRevision(
      env.DB,
      userId,
      revisionRestore.tripId,
      revisionRestore.version,
      Number(baseVersion),
      new Date().toISOString(),
      identity.email,
    );
    if (result.kind === "missing") {
      return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    if (result.kind === "forbidden") {
      return json(request, env, { error: { code: "FORBIDDEN" } }, 403);
    }
    if (result.kind === "conflict") {
      return json(
        request,
        env,
        { error: { code: "VERSION_CONFLICT", currentVersion: result.currentVersion } },
        409,
      );
    }
    return json(request, env, { data: result.trip });
  }

  const replanTripId = tripReplanApplyIdFromPath(url.pathname);
  if (replanTripId !== null) {
    if (request.method !== "POST") {
      return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
    }
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json(request, env, { error: { code: "INVALID_BODY" } }, 400);
    }
    const object = body as Record<string, unknown>;
    const baseVersion = object.baseVersion;
    const locale = parseLocale(object.locale ?? "en");
    const trip = validateTripDocument(object.document);
    const weatherSnapshotId = object.weatherSnapshotId;
    const selectedChangeIds = object.selectedChangeIds;
    const selectedValid =
      Array.isArray(selectedChangeIds) &&
      selectedChangeIds.length <= 32 &&
      selectedChangeIds.every(
        (item): item is string => typeof item === "string" && /^[a-zA-Z0-9:_-]{1,160}$/u.test(item),
      ) &&
      new Set(selectedChangeIds).size === selectedChangeIds.length;
    if (
      !Number.isInteger(baseVersion) ||
      Number(baseVersion) < 1 ||
      locale === null ||
      trip === null ||
      trip.document.version !== 2 ||
      typeof weatherSnapshotId !== "string" ||
      !/^[a-zA-Z0-9._:-]{4,160}$/u.test(weatherSnapshotId) ||
      !selectedValid
    ) {
      return json(request, env, { error: { code: "INVALID_REPLAN" } }, 400);
    }

    const current = await readTrip(env.DB, userId, replanTripId);
    if (current === null) {
      return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    if (current.accessRole === "viewer") {
      return json(request, env, { error: { code: "FORBIDDEN" } }, 403);
    }
    if (current.version !== Number(baseVersion)) {
      return json(
        request,
        env,
        { error: { code: "VERSION_CONFLICT", currentVersion: current.version } },
        409,
      );
    }

    const validation = validateReplanDocumentChange(
      current.document,
      trip.document,
      selectedChangeIds as ReadonlyArray<string>,
    );
    if (!validation.ok) {
      return json(
        request,
        env,
        { error: { code: "INVALID_REPLAN", reason: validation.code } },
        400,
      );
    }

    const result = await updateTrip(
      env.DB,
      userId,
      replanTripId,
      Number(baseVersion),
      locale,
      trip,
      new Date().toISOString(),
      "replan",
      identity.email,
      {
        weatherSnapshotId,
        selectedChangeIds: validation.changedActivityIds,
      },
    );
    if (result.kind === "missing") {
      return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    if (result.kind === "forbidden") {
      return json(request, env, { error: { code: "FORBIDDEN" } }, 403);
    }
    if (result.kind === "conflict") {
      return json(
        request,
        env,
        { error: { code: "VERSION_CONFLICT", currentVersion: result.currentVersion } },
        409,
      );
    }
    return json(request, env, { data: result.trip });
  }

  const statusTripId = tripStatusIdFromPath(url.pathname);
  if (statusTripId !== null) {
    if (request.method !== "PATCH") {
      return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
    }
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json(request, env, { error: { code: "INVALID_BODY" } }, 400);
    }
    const object = body as Record<string, unknown>;
    const baseVersion = object.baseVersion;
    const status = object.status;
    if (
      !Number.isInteger(baseVersion) ||
      Number(baseVersion) < 1 ||
      (status !== "active" && status !== "archived")
    ) {
      return json(request, env, { error: { code: "INVALID_STATUS" } }, 400);
    }
    const result = await updateTripStatus(
      env.DB,
      userId,
      statusTripId,
      Number(baseVersion),
      status as TripStatus,
    );
    if (result.kind === "missing") {
      return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    if (result.kind === "conflict") {
      return json(
        request,
        env,
        { error: { code: "VERSION_CONFLICT", currentVersion: result.currentVersion } },
        409,
      );
    }
    return json(request, env, { data: result.trip });
  }

  const shareTripId = tripShareIdFromPath(url.pathname);
  if (shareTripId !== null) {
    if (request.method === "POST") {
      const created = await createShareLink(env.DB, userId, shareTripId);
      return created === null
        ? json(request, env, { error: { code: "NOT_FOUND" } }, 404)
        : json(request, env, { data: created }, 201);
    }
    if (request.method === "DELETE") {
      const revoked = await revokeShareLink(env.DB, userId, shareTripId);
      return json(request, env, { data: { revoked } });
    }
    return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  }

  const tripId = tripIdFromPath(url.pathname);
  if (tripId === null) return json(request, env, { error: { code: "NOT_FOUND" } }, 404);

  if (request.method === "GET") {
    const trip = await readTrip(env.DB, userId, tripId);
    return trip === null
      ? json(request, env, { error: { code: "NOT_FOUND" } }, 404)
      : json(request, env, { data: trip });
  }

  if (request.method === "PATCH") {
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json(request, env, { error: { code: "INVALID_BODY" } }, 400);
    }
    const object = body as Record<string, unknown>;
    const baseVersion = object.baseVersion;
    const locale = parseLocale(object.locale ?? "en");
    const trip = validateTripDocument(object.document);
    if (
      !Number.isInteger(baseVersion) ||
      Number(baseVersion) < 1 ||
      locale === null ||
      trip === null
    ) {
      return json(request, env, { error: { code: "INVALID_TRIP" } }, 400);
    }
    const result = await updateTrip(
      env.DB,
      userId,
      tripId,
      Number(baseVersion),
      locale,
      trip,
      new Date().toISOString(),
      "update",
      identity.email,
    );
    if (result.kind === "missing") {
      return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    if (result.kind === "forbidden") {
      return json(request, env, { error: { code: "FORBIDDEN" } }, 403);
    }
    if (result.kind === "conflict") {
      return json(
        request,
        env,
        { error: { code: "VERSION_CONFLICT", currentVersion: result.currentVersion } },
        409,
      );
    }
    return json(request, env, { data: result.trip });
  }

  if (request.method === "DELETE") {
    const deleted = await deleteTrip(env.DB, userId, tripId);
    return deleted
      ? json(request, env, { data: { deleted: true } })
      : json(request, env, { error: { code: "NOT_FOUND" } }, 404);
  }

  return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
}

async function handleSharedTrips(request: Request, env: WorkerEnv): Promise<Response> {
  const route = sharedTripRoute(request);
  if (route === null) return json(request, env, { error: { code: "NOT_FOUND" } }, 404);

  const shared = await readSharedTripByToken(env.DB, route.token);
  if (shared === null) return json(request, env, { error: { code: "NOT_FOUND" } }, 404);

  if (!route.copy && request.method === "GET") {
    return json(request, env, { data: shared });
  }

  if (route.copy && request.method === "POST") {
    const identity = await resolveIdentity(request, env);
    if (identity === null) return json(request, env, { error: { code: "UNAUTHORIZED" } }, 401);
    const trip = validateTripDocument(shared.document);
    if (trip === null) return json(request, env, { error: { code: "INVALID_SHARED_TRIP" } }, 409);
    const copied = await createTrip(
      env.DB,
      identity.userId,
      shared.locale,
      trip,
      new Date().toISOString(),
      identity.email,
    );
    return json(request, env, { data: copied }, 201);
  }

  return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
}

async function handleAuthMigration(request: Request, env: WorkerEnv): Promise<Response> {
  if (!(await secretMatches(env.INTERNAL_MIGRATION_TOKEN, request))) {
    return json(request, env, { error: { code: "UNAUTHORIZED" } }, 401);
  }
  const migrated = await runAuthMigrations(env);
  return migrated
    ? json(request, env, { data: { migrated: true } })
    : json(request, env, { error: { code: "AUTH_NOT_CONFIGURED" } }, 503);
}

export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  const url = new URL(request.url);

  if (url.pathname === "/health" && request.method === "GET") {
    return json(request, env, {
      ok: true,
      service: "trip-api",
      providers: providerAvailability(env),
      cloudTrip: true,
      cloudSharing: true,
      cloudCollaboration: true,
      revisionHistory: true,
      collaborationActivity: true,
      tripComments: true,
      tripDecisions: true,
      revisionDiff: true,
      workspaceV2: true,
      activityIntelligence: true,
      structuredActivityRevisionDiff: true,
      adaptiveReplanningApply: true,
      weatherIntelligence: true,
      weatherChangeDetection: true,
      weatherInsightDecisions: true,
      weatherMonitorBound: env.WEATHER_READ !== undefined,
    });
  }

  if (url.pathname === "/internal/migrate-auth" && request.method === "POST") {
    return handleAuthMigration(request, env);
  }

  if (url.pathname.startsWith("/api/auth/")) {
    const response = await handleAuthRequest(request, env);
    return response === null
      ? json(request, env, { error: { code: "AUTH_NOT_CONFIGURED" } }, 503)
      : withCors(request, env, response);
  }

  if (url.pathname.startsWith("/api/v1/shared-trips/")) {
    return handleSharedTrips(request, env);
  }

  if (url.pathname.startsWith("/api/v1/trip-invites/")) {
    return handleTripInvites(request, env);
  }

  if (url.pathname === "/api/v1/trips" || url.pathname.startsWith("/api/v1/trips/")) {
    return handleTrips(request, env);
  }

  return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const pathname = new URL(request.url).pathname;
      console.error(
        JSON.stringify({
          service: "trip-api",
          event: "request_failed",
          path: safeLogPath(pathname),
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
      return json(request, env, { error: { code: "INTERNAL_ERROR" } }, 500);
    }
  },

  async scheduled(controller: ScheduledController, env: WorkerEnv): Promise<void> {
    if (env.WEATHER_READ === undefined) {
      console.warn(
        JSON.stringify({
          service: "trip-api",
          event: "weather_monitor_skipped",
          reason: "binding_missing",
        }),
      );
      return;
    }
    const report = await runScheduledWeatherMonitor(
      env.DB,
      env.WEATHER_READ,
      new Date(controller.scheduledTime),
    );
    console.log(
      JSON.stringify({ service: "trip-api", event: "weather_monitor_completed", ...report }),
    );
  },
} satisfies ExportedHandler<WorkerEnv>;
