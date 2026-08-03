import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createInMemoryD1, type D1DatabaseLike } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import { handleRequest } from "./index.js";

const MIGRATION = readFileSync(
  fileURLToPath(new URL("../../../packages/db/migrations/0001_weather.sql", import.meta.url)),
  "utf8",
);
const PUBLISHED_AT = "2026-08-03T00:00:00.000Z";

async function seedPublishedRanking(db: D1DatabaseLike): Promise<void> {
  await db
    .prepare(
      "INSERT INTO countries (id, iso2, iso3, default_timezone, slug, status, created_at, updated_at) VALUES ('jp', 'JP', 'JPN', 'Asia/Tokyo', 'jp', 'active', ?, ?)",
    )
    .bind(PUBLISHED_AT, PUBLISHED_AT)
    .run();
  await db
    .prepare("INSERT INTO country_translations (country_id, locale, name) VALUES ('jp', 'en', 'Japan')")
    .run();
  await db
    .prepare(
      "INSERT INTO cities (id, country_id, slug, latitude, longitude, timezone, status, created_at, updated_at) VALUES ('tokyo', 'jp', 'tokyo', 35.6, 139.7, 'Asia/Tokyo', 'active', ?, ?)",
    )
    .bind(PUBLISHED_AT, PUBLISHED_AT)
    .run();
  await db
    .prepare("INSERT INTO city_translations (city_id, locale, name) VALUES ('tokyo', 'en', 'Tokyo')")
    .run();
  await db
    .prepare(
      "INSERT INTO weather_snapshots (id, provider, fetched_at, valid_from, valid_to, status, checksum, created_at) VALUES ('snapshot-1', 'open-meteo', ?, ?, ?, 'active', 'check', ?)",
    )
    .bind(PUBLISHED_AT, PUBLISHED_AT, PUBLISHED_AT, PUBLISHED_AT)
    .run();
  await db
    .prepare("INSERT INTO active_weather_snapshot (pointer_key, snapshot_id, ranking_version, model_version, publication_fencing_token, published_at, activated_at) VALUES ('weather', 'snapshot-1', 'rv1', 'mv1', 1, ?, ?)")
    .bind(PUBLISHED_AT, PUBLISHED_AT)
    .run();
  await db
    .prepare("INSERT INTO ranking_snapshots (id, snapshot_id, ranking_version, theme, time_window, region_key, generated_at, expires_at, model_version) VALUES ('ranking-1', 'snapshot-1', 'rv1', 'general', 'today', 'global', ?, ?, 'mv1')")
    .bind(PUBLISHED_AT, PUBLISHED_AT)
    .run();
  await db
    .prepare("INSERT INTO ranking_entries (ranking_id, city_id, rank, score, reason_codes_json) VALUES ('ranking-1', 'tokyo', 1, 88, '[\"LOW_RAIN_CHANCE\"]')")
    .run();
}

describe("weather-read public API", () => {
  let db: D1DatabaseLike;

  beforeEach(async () => {
    db = createInMemoryD1();
    await db.exec(MIGRATION);
  });

  it("serves only the active persisted ranking with no-store and fixed-origin CORS", async () => {
    await seedPublishedRanking(db);
    const response = await handleRequest(
      new Request("https://read.example/api/v1/rankings"),
      { DB: db, WEB_ORIGIN: "https://app.example" },
      new Date("2026-08-03T00:10:00.000Z"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example");
    await expect(response.json()).resolves.toMatchObject({
      data: {
        snapshotId: "snapshot-1",
        rankingVersion: "rv1",
        freshness: { stale: false },
        items: [{ cityId: "tokyo", cityName: "Tokyo", score: 88 }],
      },
    });
  });

  it("fails closed when no active publication exists", async () => {
    const response = await handleRequest(new Request("https://read.example/api/v1/rankings"), { DB: db });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "DATA_UNAVAILABLE" } });
  });

  it("rejects unsupported ranking filters instead of silently returning another dataset", async () => {
    const response = await handleRequest(new Request("https://read.example/api/v1/rankings?theme=beach"), { DB: db });
    expect(response.status).toBe(400);
  });
});
