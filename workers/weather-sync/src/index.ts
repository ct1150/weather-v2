// workers/weather-sync — hourly Cron ingestion + scoring + read-model writer.
//
// This is the runtime ingestion path allowed to contact weather providers. The static
// site may also fetch the same key-free provider during its controlled build, but never
// from an end-user browser. This worker exposes the standard Cloudflare module shape:
//   - `scheduled`: the hourly Cron entry (registered in production only; see wrangler.toml).
//   - `fetch`:    a manual trigger / health endpoint for ops and CI smoke profiling.
//                 It is NOT a user read path (satisfies PRD-INC-003 "no provider call on
//                 user reads" — end users only ever read the last active baked snapshot).

import type { D1DatabaseLike } from "@wnr/test-utils";
import type { KVNamespaceLike, SyncDeps } from "./sync.js";
import { runSync } from "./sync.js";
import { D1FenceLock } from "./d1-fence-lock.js";
import { createWeatherProvider, type WeatherProviderName } from "@wnr/weather";
import { parseRuntimeConfig, resolveProviderName, type RuntimeConfig } from "@wnr/config";

export * from "./sync.js";
export * from "./d1-fence-lock.js";

/** Minimal Cloudflare Worker environment bindings consumed by this entry (docs/15 §7). */
export interface WorkerEnv {
  /** D1 database binding — binding name `DB` (docs/15 §7). */
  readonly DB: D1DatabaseLike;
  /** KV namespace for the "sync health" signal — binding name `WEATHER_SYNC_KV`. */
  readonly WEATHER_SYNC_KV: KVNamespaceLike;
  /** Selects the weather adapter; mirrors `WEATHER_PRIMARY_PROVIDER` (docs/15 §7). */
  readonly WEATHER_PRIMARY_PROVIDER?: string;
}

/** Minimal shape of the Cloudflare Cron `scheduled` event we depend on. */
interface ScheduledEventLike {
  readonly cron: string;
  readonly scheduledTime: number;
}

/**
 * Build the `runSync` dependency set from the live Worker environment. Ingestion is
 * always enabled for this worker (it exists to ingest); the adapter is selected by
 * `WEATHER_PRIMARY_PROVIDER` (defaulting to the safe FAKE provider).
 */
function buildDeps(env: WorkerEnv): SyncDeps {
  let requested: WeatherProviderName = resolveProviderName(env.WEATHER_PRIMARY_PROVIDER) ?? "fake";
  if (requested === "weatherapi") {
    // Reserved but disabled this phase (no secret wiring) — never implicitly enable it.
    requested = "fake";
  }
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

export default {
  /** Manual trigger / health endpoint (not a user read path). */
  async fetch(_req: Request, env: WorkerEnv): Promise<Response> {
    try {
      const report = await runSync(buildDeps(env));
      return new Response(JSON.stringify(report), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },

  /** Hourly Cron entry (registered in production only). */
  async scheduled(_event: ScheduledEventLike, env: WorkerEnv): Promise<void> {
    await runSync(buildDeps(env));
  },
};
