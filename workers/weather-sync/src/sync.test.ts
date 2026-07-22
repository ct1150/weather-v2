import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInMemoryD1, FakeFenceLock } from "@wnr/test-utils";
import type { D1DatabaseLike, D1PreparedStatementLike } from "@wnr/test-utils";
import { FakeWeatherProvider } from "@wnr/weather";
import { DEFAULT_RUNTIME_CONFIG } from "@wnr/config";
import { runSync, LockHeldError, ProviderIngestionDisabledError, type SyncDeps } from "./sync.js";

const MIGRATION = readFileSync(
  fileURLToPath(new URL("../../../packages/db/migrations/0001_weather.sql", import.meta.url)),
  "utf8",
);

const TS = "2026-07-20T00:00:00Z";

let counter = 0;
const makeId = (): string => `id-${++counter}`;

function enabledConfig() {
  return { ...DEFAULT_RUNTIME_CONFIG, weatherProvider: { enabled: true } };
}
function disabledConfig() {
  return { ...DEFAULT_RUNTIME_CONFIG, weatherProvider: { enabled: false } };
}

async function seedCity(db: D1DatabaseLike, id: string, slug: string, featured: boolean): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO countries (id, iso2, iso3, default_timezone, slug, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind("pt", "PT", "PRT", "Europe/Lisbon", "portugal", "active", TS, TS)
    .run();
  await db
    .prepare(
      "INSERT INTO cities (id, country_id, slug, latitude, longitude, timezone, is_featured, status, search_weight, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1.5, ?, ?)",
    )
    .bind(id, "pt", slug, 38.7, -9.1, "Europe/Lisbon", featured ? 1 : 0, TS, TS)
    .run();
}

/** D1 wrapper that throws when a prepared query matches a predicate (recovery testing). */
class FailingDb implements D1DatabaseLike {
  constructor(
    private readonly inner: D1DatabaseLike,
    private readonly failWhen: (query: string) => boolean,
  ) {}

  prepare(query: string): D1PreparedStatementLike {
    const inner = this.inner.prepare(query);
    if (this.failWhen(query)) {
      return {
        bind: (...values: ReadonlyArray<unknown>) => {
          inner.bind(...values);
          return {
            run: async () => {
              throw new Error("injected failure");
            },
            first: async () => null,
            all: async () => ({ results: [] }),
            raw: async () => [],
          } as D1PreparedStatementLike;
        },
      } as D1PreparedStatementLike;
    }
    return inner;
  }

  exec(query: string): Promise<unknown> {
    return this.inner.exec(query);
  }

  batch(statements: ReadonlyArray<D1PreparedStatementLike>): Promise<ReadonlyArray<unknown>> {
    return this.inner.batch(statements);
  }
}

describe("runSync — fenced ingestion and activation", () => {
  let db: D1DatabaseLike;
  let lock: FakeFenceLock;
  let deps: SyncDeps;

  beforeEach(async () => {
    counter = 0;
    db = createInMemoryD1();
    await db.exec(MIGRATION);
    await seedCity(db, "lisbon", "lisbon", true);
    await seedCity(db, "porto", "porto", false);
    lock = new FakeFenceLock();
    deps = { db, provider: new FakeWeatherProvider(), lock, config: enabledConfig() };
  });

  it("bootstrap run activates, persists weather, and releases the lock", async () => {
    const report = await runSync(deps, { now: () => new Date(TS), days: 7, startDate: "2026-07-20", makeSnapshotId: makeId });

    expect(report.status).toBe("success");
    expect(report.activated).toBe(true);
    expect(report.snapshotId).not.toBeNull();
    expect(report.citiesOk).toBe(2);

    const state = (await db.prepare("SELECT bootstrapped FROM weather_publication_state WHERE state_key='weather'").first()) as { bootstrapped: number };
    expect(state.bootstrapped).toBe(1);

    const pointers = await db.prepare("SELECT snapshot_id FROM active_weather_snapshot WHERE pointer_key='weather'").all();
    expect(pointers.results).toHaveLength(1);

    const daily = (await db.prepare("SELECT COUNT(*) AS c FROM weather_daily").first()) as { c: number };
    expect(daily.c).toBe(14); // 2 cities * 7 days
    const hourly = (await db.prepare("SELECT COUNT(*) AS c FROM weather_hourly").first()) as { c: number };
    expect(hourly.c).toBe(14 * 24);

    const run = (await db.prepare("SELECT status, cities_ok, cities_failed FROM sync_runs WHERE id=?").bind(report.runId).first()) as { status: string; cities_ok: number; cities_failed: number };
    expect(run.status).toBe("success");
    expect(run.cities_ok).toBe(2);

    // Lock released: holder cleared, high-water token preserved.
    expect(lock.getToken("weather-sync")).toBeGreaterThan(0);
  });

  it("replacement run keeps exactly one pointer and supersedes the old snapshot", async () => {
    const first = await runSync(deps, { now: () => new Date(TS), days: 7, startDate: "2026-07-20", makeSnapshotId: makeId });
    const second = await runSync(deps, { now: () => new Date(TS), days: 7, startDate: "2026-07-21", makeSnapshotId: makeId });

    expect(second.activated).toBe(true);
    expect(second.snapshotId).not.toBe(first.snapshotId);

    const pointers = await db.prepare("SELECT snapshot_id FROM active_weather_snapshot WHERE pointer_key='weather'").all();
    expect(pointers.results).toHaveLength(1);
    expect((pointers.results[0] as { snapshot_id: string }).snapshot_id).toBe(second.snapshotId);

    const snapshots = (await db.prepare("SELECT status, COUNT(*) AS c FROM weather_snapshots GROUP BY status").all()) as { results: ReadonlyArray<{ status: string; c: number }> };
    const byStatus = new Map(snapshots.results.map((r) => [r.status, r.c]));
    expect(byStatus.get("active")).toBe(1);
    expect(byStatus.get("superseded")).toBe(1);
  });

  it("aborts before locking when provider ingestion is disabled", async () => {
    await expect(
      runSync({ ...deps, config: disabledConfig() }, { makeSnapshotId: makeId }),
    ).rejects.toBeInstanceOf(ProviderIngestionDisabledError);
    expect(lock.getToken("weather-sync")).toBe(0);
  });

  it("aborts without activating when the fence lock is already held", async () => {
    const pre = await lock.acquire("weather-sync", "other-holder", 900000, Date.parse(TS));
    expect(pre.acquired).toBe(true);

    await expect(
      runSync(deps, { now: () => new Date(TS), makeSnapshotId: makeId }),
    ).rejects.toBeInstanceOf(LockHeldError);

    // The original holder is undisturbed.
    const stillHeld = await lock.acquire("weather-sync", "third", 900000, Date.parse(TS));
    expect(stillHeld.acquired).toBe(false);
  });

  it("rejects the candidate and stays unbootstrapped when a featured city fails", async () => {
    // A provider that fails for one specific city.
    const flaky = {
      id: "fake",
      async fetchForecast(req: { cityId: string }) {
        if (req.cityId === "lisbon") throw new Error("boom");
        return new FakeWeatherProvider().fetchForecast(req as never);
      },
      async healthCheck() {
        return { ok: true, providerId: "fake", latencyMs: 0, checkedAt: TS };
      },
    };

    const report = await runSync(
      { ...deps, provider: flaky as never },
      { now: () => new Date(TS), days: 7, startDate: "2026-07-20", makeSnapshotId: makeId },
    );

    expect(report.status).toBe("partial");
    expect(report.activated).toBe(false);
    expect(report.snapshotId).toBeNull();
    expect(report.citiesFailed).toBe(1);

    const state = (await db.prepare("SELECT bootstrapped FROM weather_publication_state WHERE state_key='weather'").first()) as { bootstrapped: number };
    expect(state.bootstrapped).toBe(0);

    const failures = (await db.prepare("SELECT COUNT(*) AS c FROM sync_failures WHERE run_id=?").bind(report.runId).first()) as { c: number };
    expect(failures.c).toBe(1);
  });

  it("releases the lock even when activation fails mid-transaction", async () => {
    const failingDb = new FailingDb(db, (q) => q.includes("active_weather_snapshot"));
    await expect(
      runSync({ ...deps, db: failingDb }, { now: () => new Date(TS), days: 7, startDate: "2026-07-20", makeSnapshotId: makeId }),
    ).rejects.toThrow();

    // Lock must be released despite the failure.
    const reacquire = await lock.acquire("weather-sync", "recovery", 900000, Date.parse(TS));
    expect(reacquire.acquired).toBe(true);
  });
});
