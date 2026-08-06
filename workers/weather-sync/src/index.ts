// workers/weather-sync — scheduled ingestion plus protected operational trigger.
//
// End-user reads never reach this Worker. Public GET requests can only inspect
// `/health`; an immediate sync requires `POST /internal/sync` with a deployment-
// derived bearer token. Production still refreshes automatically through Cron.

import type { D1DatabaseLike } from "@wnr/test-utils";
import type { KVNamespaceLike, SyncDeps } from "./sync.js";
import { runSync } from "./sync.js";
import { D1FenceLock } from "./d1-fence-lock.js";
import { createWeatherProvider, type WeatherProviderName } from "@wnr/weather";
import { parseRuntimeConfig, resolveProviderName, type RuntimeConfig } from "@wnr/config";

export * from "./sync.js";
export * from "./d1-fence-lock.js";

export interface WorkerEnv {
  readonly DB: D1DatabaseLike;
  readonly WEATHER_SYNC_KV: KVNamespaceLike;
  readonly WEATHER_PRIMARY_PROVIDER?: string;
  /** SHA-256 derived deployment token. Never exposed to browser code. */
  readonly SYNC_TRIGGER_TOKEN?: string;
}

interface ScheduledEventLike {
  readonly cron: string;
  readonly scheduledTime: number;
}

function buildDeps(env: WorkerEnv): SyncDeps {
  let requested: WeatherProviderName = resolveProviderName(env.WEATHER_PRIMARY_PROVIDER) ?? "fake";
  if (requested === "weatherapi") requested = "fake";
  const provider = createWeatherProvider(requested);
  const config: RuntimeConfig = parseRuntimeConfig({ weatherProvider: true });
  return {
    db: env.DB,
    provider,
    lock: new D1FenceLock(env.DB),
    config,
    kv: env.WEATHER_SYNC_KV,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function digest(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([digest(left), digest(right)]);
  let difference = leftDigest.length ^ rightDigest.length;
  const length = Math.max(leftDigest.length, rightDigest.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftDigest[index] ?? 0) ^ (rightDigest[index] ?? 0);
  }
  return difference === 0;
}

async function isAuthorized(request: Request, env: WorkerEnv): Promise<boolean> {
  const expected = env.SYNC_TRIGGER_TOKEN;
  if (expected === undefined || expected.length < 32) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return supplied.length >= 32 && secureEqual(supplied, expected);
}

export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json(
      {
        ok: true,
        service: "weather-sync",
        scheduled: true,
        manualTriggerProtected: true,
      },
      200,
    );
  }

  if (url.pathname !== "/internal/sync") {
    return json({ ok: false, error: "RESOURCE_NOT_FOUND" }, 404);
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }
  if (!(await isAuthorized(request, env))) {
    return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  try {
    const report = await runSync(buildDeps(env));
    return json(report, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return json({ ok: false, error: message }, 500);
  }
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },

  async scheduled(_event: ScheduledEventLike, env: WorkerEnv): Promise<void> {
    await runSync(buildDeps(env));
  },
};
