import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInMemoryD1 } from "@wnr/test-utils";
import type { D1DatabaseLike } from "@wnr/test-utils";

// Authoritative, ordered forward migration (DATA-MIGRATION-001). Applying it is the single
// production schema path; the test loads the real file so the migration stays the only DDL.
const MIGRATION = readFileSync(
  fileURLToPath(new URL("../migrations/0001_weather.sql", import.meta.url)),
  "utf8",
);

const TS = "2026-07-20T00:00:00Z";

function applyMigration(db: D1DatabaseLike): Promise<void> {
  return db.exec(MIGRATION);
}

async function seedCity(db: D1DatabaseLike): Promise<void> {
  await db
    .prepare(
      "INSERT INTO countries (id, iso2, iso3, default_timezone, slug, status, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind("pt", "PT", "PRT", "Europe/Lisbon", "portugal", "active", TS, TS)
    .run();
  await db
    .prepare(
      "INSERT INTO cities (id, country_id, slug, latitude, longitude, timezone, is_featured, status, search_weight, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind("lisbon", "pt", "lisbon", 38.7, -9.1, "Europe/Lisbon", 1, "active", 1.5, TS, TS)
    .run();
}

async function insertSnapshot(db: D1DatabaseLike, id: string, status = "pending"): Promise<void> {
  await db
    .prepare(
      "INSERT INTO weather_snapshots (id, provider, fetched_at, valid_from, valid_to, status, checksum, created_at) " +
        "VALUES (?, 'fake', ?, ?, ?, ?, 'ck', ?)",
    )
    .bind(id, TS, TS, TS, status, TS)
    .run();
}

describe("migrations — 0001 applies the full initial schema", () => {
  let db: D1DatabaseLike;

  beforeEach(async () => {
    db = createInMemoryD1();
    await applyMigration(db);
  });

  it("applies all statements without error and seeds the publication state row", async () => {
    const row = (await db
      .prepare("SELECT * FROM weather_publication_state WHERE state_key = 'weather'")
      .first()) as { bootstrapped: number } | null;
    expect(row).not.toBeNull();
    expect(row?.bootstrapped).toBe(0);
  });

  it("allows inserting a weather snapshot, daily, and hourly row", async () => {
    await seedCity(db);
    await insertSnapshot(db, "snap1");
    await db
      .prepare(
        "INSERT INTO weather_daily (snapshot_id, city_id, local_date, data_quality) VALUES (?, ?, ?, 'ok')",
      )
      .bind("snap1", "lisbon", "2026-07-20")
      .run();
    await db
      .prepare(
        "INSERT INTO weather_hourly (snapshot_id, city_id, local_time, data_quality) VALUES (?, ?, ?, 'ok')",
      )
      .bind("snap1", "lisbon", "2026-07-20T09:00:00")
      .run();
    const daily = await db
      .prepare("SELECT COUNT(*) AS c FROM weather_daily WHERE snapshot_id = ?")
      .bind("snap1")
      .first();
    expect((daily as { c: number }).c).toBe(1);
  });
});

describe("migrations — weather snapshot constraints", () => {
  let db: D1DatabaseLike;

  beforeEach(async () => {
    db = createInMemoryD1();
    await applyMigration(db);
    await seedCity(db);
  });

  it("rejects a duplicate (snapshot, city, date) daily row via composite primary key", async () => {
    await insertSnapshot(db, "snap1");
    const insert = () =>
      db
        .prepare(
          "INSERT INTO weather_daily (snapshot_id, city_id, local_date, data_quality) VALUES (?, ?, ?, 'ok')",
        )
        .bind("snap1", "lisbon", "2026-07-20")
        .run();
    await insert();
    await expect(insert()).rejects.toThrow();
  });

  it("rejects a duplicate (snapshot, city, time) hourly row via composite primary key", async () => {
    await insertSnapshot(db, "snap1");
    const insert = () =>
      db
        .prepare(
          "INSERT INTO weather_hourly (snapshot_id, city_id, local_time, data_quality) VALUES (?, ?, ?, 'ok')",
        )
        .bind("snap1", "lisbon", "2026-07-20T09:00:00")
        .run();
    await insert();
    await expect(insert()).rejects.toThrow();
  });

  it("enforces at most one active snapshot via the partial unique index", async () => {
    await insertSnapshot(db, "snapA", "active");
    await expect(insertSnapshot(db, "snapB", "active")).rejects.toThrow();
  });

  it("rejects an active pointer that references a non-active snapshot (trigger)", async () => {
    await insertSnapshot(db, "snapPending", "pending");
    await expect(
      db
        .prepare(
          "INSERT INTO active_weather_snapshot (pointer_key, snapshot_id, ranking_version, model_version, " +
            "publication_fencing_token, published_at, activated_at) VALUES ('weather', ?, 'rv1', 'mv1', 1, ?, ?)",
        )
        .bind("snapPending", TS, TS)
        .run(),
    ).rejects.toThrow(/active snapshot/);
  });
});

describe("migrations — publication state and pointer triggers", () => {
  let db: D1DatabaseLike;

  beforeEach(async () => {
    db = createInMemoryD1();
    await applyMigration(db);
    await seedCity(db);
    await insertSnapshot(db, "snap1");
  });

  it("rejects deleting the permanent publication state row", async () => {
    await expect(db.prepare("DELETE FROM weather_publication_state").run()).rejects.toThrow(
      /permanent/,
    );
  });

  it("rejects bootstrap without a valid active pointer (trigger)", async () => {
    // No pointer inserted yet: setting bootstrapped=1 must abort.
    await expect(
      db
        .prepare("UPDATE weather_publication_state SET bootstrapped = 1, updated_at = ? WHERE state_key = 'weather'")
        .bind(TS)
        .run(),
    ).rejects.toThrow(/bootstrap requires one active weather pointer/);
  });

  it("bootstrap transaction irreversibly reaches state 1 with exactly one pointer", async () => {
    await db.exec(`
      BEGIN IMMEDIATE;
      UPDATE weather_snapshots SET status = 'active' WHERE id = 'snap1';
      INSERT INTO active_weather_snapshot
        (pointer_key, snapshot_id, ranking_version, model_version, publication_fencing_token, published_at, activated_at)
        VALUES ('weather', 'snap1', 'rv1', 'mv1', 1, '${TS}', '${TS}');
      UPDATE weather_publication_state SET bootstrapped = 1, updated_at = '${TS}' WHERE state_key = 'weather';
      COMMIT;
    `);

    const state = (await db
      .prepare("SELECT bootstrapped FROM weather_publication_state WHERE state_key = 'weather'")
      .first()) as { bootstrapped: number };
    expect(state.bootstrapped).toBe(1);

    const pointers = await db
      .prepare("SELECT snapshot_id FROM active_weather_snapshot WHERE pointer_key = 'weather'")
      .all();
    expect(pointers.results).toHaveLength(1);

    // Irreversibility: cannot flip bootstrapped back to 0.
    await expect(
      db.prepare("UPDATE weather_publication_state SET bootstrapped = 0 WHERE state_key = 'weather'").run(),
    ).rejects.toThrow(/irreversible/);
  });

  it("replacement keeps exactly one pointer and supersedes the old snapshot", async () => {
    await db.exec(`
      BEGIN IMMEDIATE;
      UPDATE weather_snapshots SET status = 'active' WHERE id = 'snap1';
      INSERT INTO active_weather_snapshot
        (pointer_key, snapshot_id, ranking_version, model_version, publication_fencing_token, published_at, activated_at)
        VALUES ('weather', 'snap1', 'rv1', 'mv1', 1, '${TS}', '${TS}');
      UPDATE weather_publication_state SET bootstrapped = 1, updated_at = '${TS}' WHERE state_key = 'weather';
      COMMIT;
    `);

    await insertSnapshot(db, "snap2");
    await db.exec(`
      BEGIN IMMEDIATE;
      UPDATE weather_snapshots SET status = 'superseded' WHERE id = 'snap1';
      UPDATE weather_snapshots SET status = 'active' WHERE id = 'snap2';
      UPDATE active_weather_snapshot
        SET snapshot_id = 'snap2', ranking_version = 'rv1', model_version = 'mv1',
            publication_fencing_token = 2, published_at = '${TS}', activated_at = '${TS}'
        WHERE pointer_key = 'weather';
      COMMIT;
    `);

    const pointers = await db
      .prepare("SELECT snapshot_id FROM active_weather_snapshot WHERE pointer_key = 'weather'")
      .all();
    expect(pointers.results).toHaveLength(1);
    expect((pointers.results[0] as { snapshot_id: string }).snapshot_id).toBe("snap2");

    const old = (await db
      .prepare("SELECT status FROM weather_snapshots WHERE id = 'snap1'")
      .first()) as { status: string };
    expect(old.status).toBe("superseded");
  });
});

describe("migrations — sync_locks fencing triggers (DATA-OPERATIONS-001)", () => {
  let db: D1DatabaseLike;

  beforeEach(async () => {
    db = createInMemoryD1();
    await applyMigration(db);
  });

  it("rejects deletion of a lock row (permanent high-water mark)", async () => {
    await db
      .prepare("INSERT INTO sync_locks (key, holder, fencing_token, acquired_at, expires_at) VALUES (?, NULL, 0, NULL, NULL)")
      .bind("weather-publication")
      .run();
    await expect(db.prepare("DELETE FROM sync_locks WHERE key = ?").bind("weather-publication").run()).rejects.toThrow(
      /permanent/,
    );
  });

  it("rejects a decrease of the fencing token", async () => {
    await db
      .prepare(
        "INSERT INTO sync_locks (key, holder, fencing_token, acquired_at, expires_at) VALUES (?, 'h', 5, ?, ?)",
      )
      .bind("weather-publication", TS, TS)
      .run();
    await expect(
      db.prepare("UPDATE sync_locks SET fencing_token = 3 WHERE key = ?").bind("weather-publication").run(),
    ).rejects.toThrow(/cannot decrease/);
  });
});
