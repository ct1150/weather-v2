// Public, read-only weather API. This worker deliberately has no weather-provider,
// KV write, or sync dependency: clients can only observe the last activated D1 snapshot.

import type { D1DatabaseLike } from "@wnr/test-utils";

const DEFAULT_ORIGIN = "https://where-not-rain.pages.dev";
const MAX_AGE_MS = 60 * 60 * 1000;

export interface WorkerEnv {
  readonly DB: D1DatabaseLike;
  /** Exact public Pages origin. A deployment variable, never reflected from request input. */
  readonly WEB_ORIGIN?: string;
}

interface ActivePublicationRow {
  readonly snapshot_id: string;
  readonly ranking_version: string;
  readonly model_version: string;
  readonly published_at: string;
}

interface RankingRow {
  readonly rank: number;
  readonly city_id: string;
  readonly country_slug: string;
  readonly city_slug: string;
  readonly city_name: string;
  readonly country_name: string;
  readonly score: number;
  readonly reason_codes_json: string;
}

function headers(env: WorkerEnv): Record<string, string> {
  return {
    "access-control-allow-origin": env.WEB_ORIGIN ?? DEFAULT_ORIGIN,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "private, no-store",
    vary: "Origin",
  };
}

function json(body: unknown, status: number, env: WorkerEnv): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(env), "content-type": "application/json; charset=utf-8" },
  });
}

function parseReasons(value: string): ReadonlyArray<string> {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function isStale(dataUpdatedAt: string, now: Date): boolean {
  const updated = Date.parse(dataUpdatedAt);
  return Number.isNaN(updated) || updated > now.getTime() || now.getTime() - updated > MAX_AGE_MS;
}

async function readActivePublication(db: D1DatabaseLike): Promise<ActivePublicationRow | null> {
  return db
    .prepare(
      "SELECT p.snapshot_id, p.ranking_version, p.model_version, p.published_at " +
        "FROM active_weather_snapshot p JOIN weather_snapshots s ON s.id = p.snapshot_id " +
        "WHERE p.pointer_key = 'weather' AND s.status = 'active'",
    )
    .first<ActivePublicationRow>();
}

async function readTodayRanking(
  db: D1DatabaseLike,
  publication: ActivePublicationRow,
): Promise<ReadonlyArray<RankingRow>> {
  const result = await db
    .prepare(
      "SELECT e.rank, e.city_id, c.slug AS city_slug, co.slug AS country_slug, " +
        "ct.name AS city_name, cot.name AS country_name, e.score, e.reason_codes_json " +
        "FROM ranking_snapshots r " +
        "JOIN ranking_entries e ON e.ranking_id = r.id " +
        "JOIN cities c ON c.id = e.city_id " +
        "JOIN countries co ON co.id = c.country_id " +
        "JOIN city_translations ct ON ct.city_id = c.id AND ct.locale = 'en' " +
        "JOIN country_translations cot ON cot.country_id = co.id AND cot.locale = 'en' " +
        "WHERE r.snapshot_id = ? AND r.ranking_version = ? AND r.theme = 'general' " +
        "AND r.time_window = 'today' AND r.region_key = 'global' " +
        "ORDER BY e.rank ASC, e.city_id ASC",
    )
    .bind(publication.snapshot_id, publication.ranking_version)
    .all<RankingRow>();
  return result.results;
}

/** Handle a public request; exported separately for deterministic integration tests. */
export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  now = new Date(),
): Promise<Response> {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: headers(env) });
  if (request.method !== "GET") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405, env);

  const url = new URL(request.url);
  if (url.pathname !== "/api/v1/rankings")
    return json({ error: { code: "RESOURCE_NOT_FOUND" } }, 404, env);
  if ((url.searchParams.get("theme") ?? "general") !== "general") {
    return json({ error: { code: "INVALID_PARAMETER", field: "theme" } }, 400, env);
  }
  if ((url.searchParams.get("window") ?? "today") !== "today") {
    return json({ error: { code: "INVALID_PARAMETER", field: "window" } }, 400, env);
  }

  const publication = await readActivePublication(env.DB);
  if (publication === null) return json({ error: { code: "DATA_UNAVAILABLE" } }, 503, env);
  const ranking = await readTodayRanking(env.DB, publication);
  if (ranking.length === 0) return json({ error: { code: "DATA_UNAVAILABLE" } }, 503, env);

  const stale = isStale(publication.published_at, now);
  return json(
    {
      data: {
        snapshotId: publication.snapshot_id,
        rankingVersion: publication.ranking_version,
        modelVersion: publication.model_version,
        freshness: { dataUpdatedAt: publication.published_at, stale },
        theme: "general",
        window: "today",
        region: "global",
        locale: "en",
        items: ranking.map((item) => ({
          rank: item.rank,
          cityId: item.city_id,
          countrySlug: item.country_slug,
          citySlug: item.city_slug,
          cityName: item.city_name,
          countryName: item.country_name,
          score: item.score,
          scoreState: "available",
          reasonCodes: parseReasons(item.reason_codes_json),
        })),
      },
      meta: { generatedAt: now.toISOString(), dataUpdatedAt: publication.published_at, stale },
    },
    200,
    env,
  );
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
