import {
  getAuthUserId,
  handleAuthRequest,
  providerAvailability,
  runAuthMigrations,
  type AuthEnv,
} from "./auth";
import { createTrip, deleteTrip, listTrips, readTrip, updateTrip } from "./store";
import { parseLocale, readJsonBody, validateTripDocument } from "./validation";

export interface WorkerEnv extends AuthEnv {
  readonly INTERNAL_MIGRATION_TOKEN?: string;
  readonly INTERNAL_SMOKE_TOKEN?: string;
}

const DEFAULT_ORIGIN = "https://868656.xyz";

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
    "access-control-allow-headers": "content-type,authorization,x-wnr-smoke-user",
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

async function resolveUserId(request: Request, env: WorkerEnv): Promise<string | null> {
  if (await secretMatches(env.INTERNAL_SMOKE_TOKEN, request)) {
    const requested = request.headers.get("x-wnr-smoke-user") ?? "ci-smoke";
    return /^[a-zA-Z0-9_-]{2,64}$/u.test(requested) ? `internal:${requested}` : "internal:ci-smoke";
  }
  return getAuthUserId(request, env);
}

function tripIdFromPath(pathname: string): string | null {
  const match = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})$/u.exec(pathname);
  return match?.[1] ?? null;
}

async function handleTrips(request: Request, env: WorkerEnv): Promise<Response> {
  const userId = await resolveUserId(request, env);
  if (userId === null) return json(request, env, { error: { code: "UNAUTHORIZED" } }, 401);

  const url = new URL(request.url);
  if (url.pathname === "/api/v1/trips") {
    if (request.method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const items = await listTrips(env.DB, userId, Number.isFinite(limit) ? limit : 20);
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
      const created = await createTrip(env.DB, userId, locale, trip);
      return json(request, env, { data: created }, 201);
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
    const result = await updateTrip(env.DB, userId, tripId, Number(baseVersion), locale, trip);
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

  if (request.method === "DELETE") {
    const deleted = await deleteTrip(env.DB, userId, tripId);
    return deleted
      ? json(request, env, { data: { deleted: true } })
      : json(request, env, { error: { code: "NOT_FOUND" } }, 404);
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
      console.error(
        JSON.stringify({
          service: "trip-api",
          event: "request_failed",
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
      return json(request, env, { error: { code: "INTERNAL_ERROR" } }, 500);
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
