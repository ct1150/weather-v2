// workers/weather-sync — fenced hourly ingestion and activation (ARCH-DATAFLOW-001,
// ARCH-RECOVERY-001, DATA-OPERATIONS-001, ENG-RELIABILITY-001).
//
// This is the ONLY path allowed to import @wnr/weather and contact providers. A run:
//   1. aborts early if provider ingestion is killed (ARCH-FLAG-001);
//   2. acquires the owner-aware D1 fence lock (15-min TTL) and aborts if already held;
//   3. freezes the enabled/featured city set E/F at run start;
//   4. fetches and normalizes each city via the provider, isolating failures;
//   5. transactionally persists a PENDING snapshot with its daily/hourly rows;
//   6. activates (bootstrap when unbootstrapped, replace otherwise) under a D1 batch
//   7. releases the lock in all terminal paths (success, partial, or failure).
// A candidate is rejected when no city validated or any featured city failed, so the
// active publication identity can never point at a partial generation.

import type { D1DatabaseLike } from "@wnr/test-utils";
import type { WeatherProvider } from "@wnr/weather";
import type { RuntimeConfig } from "@wnr/config";
import type { NormalizedDaily, NormalizedHourly } from "@wnr/weather";

const LOCK_KEY = "weather-sync";
const LOCK_TTL_MS = 15 * 60 * 1000;
const RANKING_VERSION = "rv1";
const MODEL_VERSION = "mv1";

/** Owner-aware fence lock port. Mirrors the D1 sync_locks contract (DATA-OPERATIONS-001). */
export interface FenceLock {
  acquire(
    key: string,
    holder: string,
    ttlMs: number,
    nowMs: number,
  ): Promise<{ acquired: boolean; token: number }>;
  release(key: string, holder: string, token: number): Promise<boolean>;
  getToken(key: string): number;
}

/**
 * Narrow KV binding port used for the "sync health" signal. Mirrors the Cloudflare
 * KV `put` shape we rely on (a single string value per key, namespaced per environment).
 * Optional: when absent (e.g. local/preview without a binding) the health write is skipped.
 */
export interface KVNamespaceLike {
  put(key: string, value: string): Promise<unknown>;
}

export interface EnabledCity {
  readonly id: string;
  readonly slug: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly isFeatured: boolean;
}

export interface SyncDeps {
  readonly db: D1DatabaseLike;
  readonly provider: WeatherProvider;
  readonly lock: FenceLock;
  readonly config: RuntimeConfig;
  /** Optional KV binding for the "sync health" signal (preview/production isolated). */
  readonly kv?: KVNamespaceLike;
}

export interface SyncOptions {
  readonly runId?: string;
  readonly holder?: string;
  readonly now?: () => Date;
  /** Forecast horizon in city-local days. */
  readonly days?: number;
  /** Inclusive city-local start date (YYYY-MM-DD). */
  readonly startDate?: string;
  /** Id generator for runs/snapshots; injectable for deterministic tests. */
  readonly makeSnapshotId?: () => string;
}

export interface SyncReport {
  readonly runId: string;
  readonly status: "success" | "partial" | "failed";
  readonly snapshotId: string | null;
  readonly citiesOk: number;
  readonly citiesFailed: number;
  readonly activated: boolean;
  readonly fencingToken: number;
}

export class ProviderIngestionDisabledError extends Error {
  constructor() {
    super("Weather-provider ingestion is disabled by runtime configuration");
    this.name = "ProviderIngestionDisabledError";
  }
}

export class LockHeldError extends Error {
  constructor(key: string) {
    super(`Fence lock "${key}" is already held`);
    this.name = "LockHeldError";
  }
}

function utcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`expected string for ${field}`);
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number") throw new Error(`expected number for ${field}`);
  return value;
}

async function readEnabledCities(db: D1DatabaseLike): Promise<ReadonlyArray<EnabledCity>> {
  const res = await db
    .prepare(
      "SELECT id, slug, latitude, longitude, timezone, is_featured FROM cities WHERE status = 'active'",
    )
    .all();
  const rows = res.results as ReadonlyArray<Record<string, unknown>>;
  return rows.map((r) => ({
    id: asString(r.id, "id"),
    slug: asString(r.slug, "slug"),
    latitude: asNumber(r.latitude, "latitude"),
    longitude: asNumber(r.longitude, "longitude"),
    timezone: asString(r.timezone, "timezone"),
    isFeatured: asNumber(r.is_featured, "is_featured") !== 0,
  }));
}

async function isBootstrapped(db: D1DatabaseLike): Promise<boolean> {
  const row = (await db
    .prepare("SELECT bootstrapped FROM weather_publication_state WHERE state_key = 'weather'")
    .first()) as { bootstrapped: number } | null;
  return row != null && row.bootstrapped === 1;
}

async function insertRun(
  db: D1DatabaseLike,
  runId: string,
  startedAt: string,
  status: string,
  providerId: string,
  enabledCount: number,
  featuredCount: number,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO sync_runs (id, started_at, finished_at, status, provider, provider_switched, " +
        "enabled_cities_at_start, featured_cities_at_start, cities_ok, cities_failed, duration_ms) " +
        "VALUES (?, ?, NULL, ?, ?, 0, ?, ?, 0, 0, NULL)",
    )
    .bind(runId, startedAt, status, providerId, enabledCount, featuredCount)
    .run();
}

async function insertRunScope(
  db: D1DatabaseLike,
  runId: string,
  cities: ReadonlyArray<EnabledCity>,
): Promise<void> {
  for (const c of cities) {
    await db
      .prepare(
        "INSERT INTO sync_run_city_scope (run_id, city_id, is_featured_at_start, valid_7day) VALUES (?, ?, ?, 0)",
      )
      .bind(runId, c.id, c.isFeatured ? 1 : 0)
      .run();
  }
}

async function insertSyncFailure(
  db: D1DatabaseLike,
  runId: string,
  cityId: string | null,
  code: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO sync_failures (id, run_id, city_id, error_code, detail, created_at) VALUES (?, ?, ?, ?, 'sanitized', ?)",
    )
    .bind(`sf-${runId}-${cityId ?? "none"}`, runId, cityId, code, new Date(0).toISOString())
    .run();
}

async function updateRun(
  db: D1DatabaseLike,
  runId: string,
  finishedAt: string,
  status: string,
  citiesOk: number,
  citiesFailed: number,
  valid7: number,
  featuredValid: number,
): Promise<void> {
  await db
    .prepare(
      "UPDATE sync_runs SET finished_at = ?, status = ?, cities_ok = ?, cities_failed = ?, " +
        "cities_valid_7day = ?, featured_cities_valid_7day = ? WHERE id = ?",
    )
    .bind(finishedAt, status, citiesOk, citiesFailed, valid7, featuredValid, runId)
    .run();
}

function buildDailyInsert(
  db: D1DatabaseLike,
  snapshotId: string,
  cityId: string,
  d: NormalizedDaily,
): ReturnType<D1DatabaseLike["prepare"]> {
  return db
    .prepare(
      "INSERT INTO weather_daily (snapshot_id, city_id, local_date, weather_code, temp_min_c, temp_max_c, " +
        "apparent_min_c, apparent_max_c, precipitation_mm, precipitation_probability_max, humidity_mean, " +
        "wind_speed_max_kph, wind_gust_max_kph, uv_index_max, cloud_cover_mean, visibility_mean_m, " +
        "sunrise_local, sunset_local, data_quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')",
    )
    .bind(
      snapshotId,
      cityId,
      d.localDate,
      d.weatherCode,
      d.tempMinC,
      d.tempMaxC,
      d.apparentMinC,
      d.apparentMaxC,
      d.precipitationMm,
      d.precipitationProbabilityMax,
      d.humidityMean,
      d.windSpeedMaxKph,
      d.windGustMaxKph,
      d.uvIndexMax,
      d.cloudCoverMean,
      d.visibilityMeanM,
      d.sunriseLocal,
      d.sunsetLocal,
    );
}

function buildHourlyInsert(
  db: D1DatabaseLike,
  snapshotId: string,
  cityId: string,
  h: NormalizedHourly,
): ReturnType<D1DatabaseLike["prepare"]> {
  return db
    .prepare(
      "INSERT INTO weather_hourly (snapshot_id, city_id, local_time, weather_code, temperature_c, " +
        "apparent_temperature_c, precipitation_mm, precipitation_probability, humidity, wind_speed_kph, " +
        "wind_gust_kph, uv_index, cloud_cover, visibility_m, data_quality) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')",
    )
    .bind(
      snapshotId,
      cityId,
      h.localTime,
      h.weatherCode,
      h.temperatureC,
      h.apparentTemperatureC,
      h.precipitationMm,
      h.precipitationProbability,
      h.humidity,
      h.windSpeedKph,
      h.windGustKph,
      h.uvIndex,
      h.cloudCover,
      h.visibilityM,
    );
}

interface PendingRow {
  readonly cityId: string;
  readonly day: NormalizedDaily;
}

/**
 * Run many prepared statements atomically in chunks. Cloudflare D1's `batch()` accepts
 * at most 100 statements per call, so larger sets are split. This replaces the old
 * `BEGIN IMMEDIATE` / `COMMIT` SQL-transaction pattern, which D1 rejects with
 * "please use ... transactionSync() APIs instead of the SQL BEGIN TRANSACTION".
 * Each chunk is atomic; a thrown error aborts the whole persist/activate.
 */
const MAX_D1_BATCH = 100;
async function runBatched(
  db: D1DatabaseLike,
  statements: ReadonlyArray<ReturnType<D1DatabaseLike["prepare"]>>,
): Promise<void> {
  for (let i = 0; i < statements.length; i += MAX_D1_BATCH) {
    await db.batch(statements.slice(i, i + MAX_D1_BATCH));
  }
}

async function persistCandidate(
  db: D1DatabaseLike,
  snapshotId: string,
  nowIso: string,
  validFrom: string,
  validTo: string,
  checksum: string,
  providerId: string,
  dailyRows: ReadonlyArray<PendingRow>,
  hourlyRows: ReadonlyArray<{ readonly cityId: string; readonly hour: NormalizedHourly }>,
): Promise<void> {
  const statements: Array<ReturnType<D1DatabaseLike["prepare"]>> = [
    db
      .prepare(
        "INSERT INTO weather_snapshots (id, provider, fetched_at, valid_from, valid_to, status, checksum, created_at) " +
          "VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
      )
      .bind(snapshotId, providerId, nowIso, validFrom, validTo, checksum, nowIso),
  ];
  for (const { cityId, day } of dailyRows)
    statements.push(buildDailyInsert(db, snapshotId, cityId, day));
  for (const { cityId, hour } of hourlyRows)
    statements.push(buildHourlyInsert(db, snapshotId, cityId, hour));
  await runBatched(db, statements);
}

async function activate(
  db: D1DatabaseLike,
  snapshotId: string,
  nowIso: string,
  bootstrapped: boolean,
  token: number,
): Promise<void> {
  const statements: Array<ReturnType<D1DatabaseLike["prepare"]>> = [];
  if (!bootstrapped) {
    statements.push(
      db.prepare("UPDATE weather_snapshots SET status = 'active' WHERE id = ?").bind(snapshotId),
    );
    statements.push(
      db
        .prepare(
          "INSERT INTO active_weather_snapshot (pointer_key, snapshot_id, ranking_version, model_version, " +
            "publication_fencing_token, published_at, activated_at) VALUES ('weather', ?, ?, ?, ?, ?, ?)",
        )
        .bind(snapshotId, RANKING_VERSION, MODEL_VERSION, token, nowIso, nowIso),
    );
    statements.push(
      db
        .prepare(
          "UPDATE weather_publication_state SET bootstrapped = 1, updated_at = ? WHERE state_key = 'weather'",
        )
        .bind(nowIso),
    );
  } else {
    statements.push(
      db.prepare(
        "UPDATE weather_snapshots SET status = 'superseded' WHERE id = (" +
          "SELECT snapshot_id FROM active_weather_snapshot WHERE pointer_key = 'weather')",
      ),
    );
    statements.push(
      db.prepare("UPDATE weather_snapshots SET status = 'active' WHERE id = ?").bind(snapshotId),
    );
    statements.push(
      db
        .prepare(
          "UPDATE active_weather_snapshot SET snapshot_id = ?, ranking_version = ?, model_version = ?, " +
            "publication_fencing_token = ?, published_at = ?, activated_at = ? WHERE pointer_key = 'weather'",
        )
        .bind(snapshotId, RANKING_VERSION, MODEL_VERSION, token, nowIso, nowIso),
    );
  }
  await runBatched(db, statements);
}

/**
 * Run one fenced ingestion + activation cycle. Always releases the fence lock on every
 * terminal path. Returns a report; throws only on infrastructure failures (disabled
 * ingestion, held lock, or an unexpected DB error after acquisition).
 */
export async function runSync(deps: SyncDeps, options: SyncOptions = {}): Promise<SyncReport> {
  const now = options.now ?? (() => new Date());
  const nowDate = now();
  const nowMs = nowDate.getTime();
  const nowIso = nowDate.toISOString();
  const makeId = options.makeSnapshotId ?? (() => globalThis.crypto.randomUUID());

  if (!deps.config.weatherProvider.enabled) {
    throw new ProviderIngestionDisabledError();
  }

  const runId = options.runId ?? makeId();
  const holder = options.holder ?? runId;

  const acquire = await deps.lock.acquire(LOCK_KEY, holder, LOCK_TTL_MS, nowMs);
  if (!acquire.acquired) {
    throw new LockHeldError(LOCK_KEY);
  }
  const token = acquire.token;
  const locked = true;

  try {
    const cities = await readEnabledCities(deps.db);
    const featured = cities.filter((c) => c.isFeatured);
    await insertRun(
      deps.db,
      runId,
      nowIso,
      "running",
      deps.provider.id,
      cities.length,
      featured.length,
    );
    await insertRunScope(deps.db, runId, cities);

    const days = options.days ?? 7;
    const startDate = options.startDate ?? utcDate(nowDate);

    const validCityIds = new Set<string>();
    let citiesFailed = 0;
    const dailyRows: PendingRow[] = [];
    const hourlyRows: { cityId: string; hour: NormalizedHourly }[] = [];

    for (const city of cities) {
      try {
        const forecasts = await deps.provider.fetchForecast({
          cityId: city.id,
          latitude: city.latitude,
          longitude: city.longitude,
          timezone: city.timezone,
          days,
          startDate,
        });
        const forecast = forecasts[0];
        if (!forecast) throw new Error("provider returned no forecast");
        for (const d of forecast.days) {
          dailyRows.push({ cityId: city.id, day: d });
          for (const h of d.hourly) hourlyRows.push({ cityId: city.id, hour: h });
        }
        validCityIds.add(city.id);
      } catch {
        citiesFailed += 1;
        await insertSyncFailure(deps.db, runId, city.id, "PROVIDER_ERROR");
      }
    }

    const citiesOk = validCityIds.size;
    const featuredFailed = featured.some((c) => !validCityIds.has(c.id));

    // Candidate gate: never activate a partial generation.
    if (citiesOk === 0 || featuredFailed) {
      const status: "failed" | "partial" = citiesOk === 0 ? "failed" : "partial";
      await updateRun(deps.db, runId, nowIso, status, citiesOk, citiesFailed, 0, 0);
      return {
        runId,
        status,
        snapshotId: null,
        citiesOk,
        citiesFailed,
        activated: false,
        fencingToken: token,
      };
    }

    const snapshotId = makeId();
    const validToDate = new Date(nowMs + days * 24 * 60 * 60 * 1000);
    const checksum = `ck-${citiesOk}-${dailyRows.length}-${hourlyRows.length}`;
    await persistCandidate(
      deps.db,
      snapshotId,
      nowIso,
      nowIso,
      validToDate.toISOString(),
      checksum,
      deps.provider.id,
      dailyRows,
      hourlyRows,
    );

    const bootstrapped = await isBootstrapped(deps.db);
    await activate(deps.db, snapshotId, nowIso, bootstrapped, token);

    // Write the (environment-isolated) KV "sync health" signal only after a successful
    // activation. Skipped when no KV binding is present (e.g. local/preview without one).
    // The signal is best-effort (docs/15 §1.3): a KV write failure MUST NOT roll back an
    // already-successful sync/activation, nor make runSync throw.
    if (deps.kv) {
      try {
        await deps.kv.put(
          "sync-health",
          JSON.stringify({ lastSuccessAt: nowIso, provider: deps.provider.id, status: "ok" }),
        );
      } catch (kvErr) {
        console.error("sync-health KV write failed (non-fatal):", kvErr);
      }
    }

    const valid7 = cities.filter((c) => validCityIds.has(c.id) && days >= 7).length;
    const featuredValid = featured.filter((c) => validCityIds.has(c.id)).length;
    await updateRun(
      deps.db,
      runId,
      nowIso,
      "success",
      citiesOk,
      citiesFailed,
      valid7,
      featuredValid,
    );

    return {
      runId,
      status: "success",
      snapshotId,
      citiesOk,
      citiesFailed,
      activated: true,
      fencingToken: token,
    };
  } catch (err) {
    try {
      await updateRun(deps.db, runId, nowIso, "failed", 0, 0, 0, 0);
    } catch {
      // Best-effort; the outer error is what matters.
    }
    throw err;
  } finally {
    if (locked) {
      await deps.lock.release(LOCK_KEY, holder, token);
    }
  }
}
