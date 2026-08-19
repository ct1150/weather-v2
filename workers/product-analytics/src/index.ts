import { projectAnalyticsEvent, validateAnalyticsEvent } from "@wnr/analytics";

const MAX_BODY_BYTES = 8192;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface ProductAnalyticsDependencies {
  readonly webOrigin: string;
  readonly now: () => Date;
  readonly writeDataPoint: (point: {
    indexes: string[];
    blobs: string[];
    doubles: number[];
  }) => void;
}

function corsHeaders(origin: string | null, allowedOrigin: string): Headers {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    vary: "Origin",
  });
  if (origin === allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
    headers.set("access-control-max-age", "86400");
  }
  return headers;
}

function json(
  value: unknown,
  status: number,
  origin: string | null,
  allowedOrigin: string,
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: corsHeaders(origin, allowedOrigin),
  });
}

async function readBoundedText(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let output = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      output += decoder.decode(value, { stream: true });
    }
    output += decoder.decode();
    return output;
  } finally {
    reader.releaseLock();
  }
}

function eventTimeIsAcceptable(occurredAt: string, now: Date): boolean {
  const eventTime = Date.parse(occurredAt);
  const current = now.getTime();
  return (
    Number.isFinite(eventTime) &&
    eventTime >= current - MAX_EVENT_AGE_MS &&
    eventTime <= current + MAX_FUTURE_SKEW_MS
  );
}

export async function handleProductAnalyticsRequest(
  request: Request,
  dependencies: ProductAnalyticsDependencies,
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");

  if (request.method === "GET" && url.pathname === "/health") {
    return json(
      { ok: true, service: "product-analytics", schemaVersion: 1, binding: true },
      200,
      origin,
      dependencies.webOrigin,
    );
  }

  if (request.method === "OPTIONS" && url.pathname === "/api/v1/product-events") {
    if (origin !== dependencies.webOrigin) {
      return json({ ok: false, error: "origin_not_allowed" }, 403, origin, dependencies.webOrigin);
    }
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin, dependencies.webOrigin),
    });
  }

  if (request.method !== "POST" || url.pathname !== "/api/v1/product-events") {
    return json({ ok: false, error: "not_found" }, 404, origin, dependencies.webOrigin);
  }
  if (origin !== dependencies.webOrigin) {
    return json({ ok: false, error: "origin_not_allowed" }, 403, origin, dependencies.webOrigin);
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "text/plain" && contentType !== "application/json") {
    return json(
      { ok: false, error: "unsupported_media_type" },
      415,
      origin,
      dependencies.webOrigin,
    );
  }

  const body = await readBoundedText(request, MAX_BODY_BYTES);
  if (body === null) {
    return json({ ok: false, error: "payload_too_large" }, 413, origin, dependencies.webOrigin);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, origin, dependencies.webOrigin);
  }
  const validated = validateAnalyticsEvent(raw);
  if (!validated.ok) {
    return json({ ok: false, error: validated.error.code }, 400, origin, dependencies.webOrigin);
  }
  if (!eventTimeIsAcceptable(validated.value.occurred_at, dependencies.now())) {
    return json(
      { ok: false, error: "event_time_out_of_range" },
      400,
      origin,
      dependencies.webOrigin,
    );
  }

  dependencies.writeDataPoint(projectAnalyticsEvent(validated.value));
  return json({ ok: true, accepted: true }, 202, origin, dependencies.webOrigin);
}

export default {
  fetch(request, env) {
    return handleProductAnalyticsRequest(request, {
      webOrigin: env.WEB_ORIGIN,
      now: () => new Date(),
      writeDataPoint: (point) => env.PRODUCT_EVENTS.writeDataPoint(point),
    });
  },
} satisfies ExportedHandler<Env>;
