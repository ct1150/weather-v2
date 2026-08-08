import type { D1Database } from "@cloudflare/workers-types";
import {
  convertWeatherInsightToDecision,
  listTripWeatherInsights,
  refreshTripWeather,
  type WeatherReadBinding,
} from "./weather-intelligence-service";

export interface WeatherIntelligenceIdentity {
  readonly userId: string;
  readonly email: string;
}

export interface WeatherIntelligenceRouteEnv {
  readonly DB: D1Database;
  readonly WEATHER_READ?: WeatherReadBinding;
}

export interface WeatherIntelligenceRouteResult {
  readonly status: number;
  readonly body: unknown;
}

function ok(data: unknown, status = 200): WeatherIntelligenceRouteResult {
  return { status, body: { data } };
}

function error(code: string, status: number): WeatherIntelligenceRouteResult {
  return { status, body: { error: { code } } };
}

function collectionPath(pathname: string): { readonly tripId: string; readonly action: "list" | "refresh" } | null {
  const list = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/weather-insights$/u.exec(pathname);
  if (list?.[1]) return { tripId: list[1], action: "list" };
  const refresh = /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/weather-refresh$/u.exec(pathname);
  return refresh?.[1] ? { tripId: refresh[1], action: "refresh" } : null;
}

function decisionPath(
  pathname: string,
): { readonly tripId: string; readonly insightId: string } | null {
  const match =
    /^\/api\/v1\/trips\/([a-zA-Z0-9_-]{8,96})\/weather-insights\/(weather_insight_[a-zA-Z0-9_-]{16,128})\/decision$/u.exec(
      pathname,
    );
  return match?.[1] && match[2] ? { tripId: match[1], insightId: match[2] } : null;
}

export async function handleWeatherIntelligenceRoute(
  request: Request,
  env: WeatherIntelligenceRouteEnv,
  identity: WeatherIntelligenceIdentity,
): Promise<WeatherIntelligenceRouteResult | null> {
  const url = new URL(request.url);
  const collection = collectionPath(url.pathname);
  if (collection !== null) {
    if (collection.action === "list") {
      if (request.method !== "GET") return error("METHOD_NOT_ALLOWED", 405);
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const items = await listTripWeatherInsights(
        env.DB,
        identity.userId,
        collection.tripId,
        Number.isFinite(limit) ? limit : 50,
      );
      return items === null ? error("NOT_FOUND", 404) : ok({ items });
    }

    if (request.method !== "POST") return error("METHOD_NOT_ALLOWED", 405);
    if (env.WEATHER_READ === undefined) return error("WEATHER_SERVICE_UNAVAILABLE", 503);
    const result = await refreshTripWeather(
      env.DB,
      env.WEATHER_READ,
      identity.userId,
      collection.tripId,
    );
    if (result.kind === "missing") return error("NOT_FOUND", 404);
    if (result.kind === "forbidden") return error("FORBIDDEN", 403);
    return ok(result.report);
  }

  const decision = decisionPath(url.pathname);
  if (decision !== null) {
    if (request.method !== "POST") return error("METHOD_NOT_ALLOWED", 405);
    const result = await convertWeatherInsightToDecision(
      env.DB,
      identity.userId,
      identity.email,
      decision.tripId,
      decision.insightId,
    );
    if (result.kind === "missing") return error("NOT_FOUND", 404);
    if (result.kind === "forbidden") return error("FORBIDDEN", 403);
    return ok({ decisionId: result.decisionId, existing: result.existing }, result.existing ? 200 : 201);
  }

  return null;
}
