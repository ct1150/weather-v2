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
    .prepare(
      "INSERT INTO country_translations (country_id, locale, name) VALUES ('jp', 'en', 'Japan'), ('jp', 'zh', '日本')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO cities (id, country_id, slug, latitude, longitude, timezone, is_featured, status, created_at, updated_at) VALUES ('tokyo', 'jp', 'tokyo', 35.6, 139.7, 'Asia/Tokyo', 1, 'active', ?, ?)",
    )
    .bind(PUBLISHED_AT, PUBLISHED_AT)
    .run();
  await db
    .prepare(
      "INSERT INTO city_translations (city_id, locale, name) VALUES ('tokyo', 'en', 'Tokyo'), ('tokyo', 'zh', '东京')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO weather_snapshots (id, provider, fetched_at, valid_from, valid_to, status, checksum, created_at) VALUES ('snapshot-1', 'open-meteo', ?, ?, ?, 'active', 'check', ?)",
    )
    .bind(PUBLISHED_AT, PUBLISHED_AT, "2026-08-10T00:00:00.000Z", PUBLISHED_AT)
    .run();
  await db
    .prepare(
      "INSERT INTO active_weather_snapshot (pointer_key, snapshot_id, ranking_version, model_version, publication_fencing_token, published_at, activated_at) VALUES ('weather', 'snapshot-1', 'rv1', 'mv1', 1, ?, ?)",
    )
    .bind(PUBLISHED_AT, PUBLISHED_AT)
    .run();
  await db
    .prepare(
      "INSERT INTO ranking_snapshots (id, snapshot_id, ranking_version, theme, time_window, region_key, generated_at, expires_at, model_version) VALUES ('ranking-1', 'snapshot-1', 'rv1', 'general', 'today', 'global', ?, ?, 'mv1')",
    )
    .bind(PUBLISHED_AT, PUBLISHED_AT)
    .run();
  await db
    .prepare(
      "INSERT INTO ranking_entries (ranking_id, city_id, rank, score, reason_codes_json) VALUES ('ranking-1', 'tokyo', 1, 88, '[\"LOW_RAIN_CHANCE\"]')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO weather_daily (snapshot_id, city_id, local_date, weather_code, temp_min_c, temp_max_c, precipitation_mm, precipitation_probability_max, wind_speed_max_kph, wind_gust_max_kph, uv_index_max, cloud_cover_mean, visibility_mean_m, sunrise_local, sunset_local, data_quality) VALUES ('snapshot-1', 'tokyo', '2026-08-08', 2, 24, 31, 0.4, 20, 14, 22, 8, 45, 18000, '05:00', '18:40', 'good'), ('snapshot-1', 'tokyo', '2026-08-09', 61, 23, 29, 8.2, 75, 20, 34, 5, 82, 9000, '05:01', '18:39', 'good')",
    )
    .run();
}

describe("weather-read public API", () => {
  let db: D1DatabaseLike;

  beforeEach(async () => {
    db = createInMemoryD1();
    await db.exec(MIGRATION);
  });

  it("exposes a lightweight read-only health endpoint without querying a publication", async () => {
    const response = await handleRequest(new Request("https://read.example/health"), { DB: db });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "weather-read",
      readOnly: true,
    });
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

  it("returns the supported trip city catalog in the requested locale", async () => {
    await seedPublishedRanking(db);
    const response = await handleRequest(
      new Request("https://read.example/api/v1/trip-cities?locale=zh-cn"),
      { DB: db },
      new Date("2026-08-03T00:10:00.000Z"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        locale: "zh-cn",
        items: [
          {
            cityId: "tokyo",
            cityName: "东京",
            countryName: "日本",
            featured: true,
          },
        ],
      },
    });
  });

  it("returns a bounded multi-day trip forecast from the active snapshot", async () => {
    await seedPublishedRanking(db);
    const response = await handleRequest(
      new Request(
        "https://read.example/api/v1/trip-forecast?cityIds=tokyo&from=2026-08-08&to=2026-08-09&locale=zh-cn",
      ),
      { DB: db },
      new Date("2026-08-03T00:10:00.000Z"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        snapshotId: "snapshot-1",
        requestedCityIds: ["tokyo"],
        freshness: { stale: false },
        items: [
          {
            cityId: "tokyo",
            date: "2026-08-08",
            condition: "多云",
            rainProbability: 20,
          },
          {
            cityId: "tokyo",
            date: "2026-08-09",
            condition: "雨",
            rainProbability: 75,
          },
        ],
      },
    });
  });

  it("rejects invalid trip forecast ranges and unbounded city lists", async () => {
    const badRange = await handleRequest(
      new Request(
        "https://read.example/api/v1/trip-forecast?cityIds=tokyo&from=2026-08-01&to=2026-09-01",
      ),
      { DB: db },
    );
    const badCities = await handleRequest(
      new Request(
        "https://read.example/api/v1/trip-forecast?cityIds=&from=2026-08-01&to=2026-08-02",
      ),
      { DB: db },
    );

    expect(badRange.status).toBe(400);
    expect(badCities.status).toBe(400);
  });

  it("fails closed when no active publication exists", async () => {
    const response = await handleRequest(new Request("https://read.example/api/v1/rankings"), {
      DB: db,
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "DATA_UNAVAILABLE" } });
  });

  it("keeps a six-hour publication fresh but marks it stale after the retry margin", async () => {
    await seedPublishedRanking(db);
    const withinCadence = await handleRequest(
      new Request("https://read.example/api/v1/rankings"),
      { DB: db },
      new Date("2026-08-03T06:59:59.000Z"),
    );
    const beyondMargin = await handleRequest(
      new Request("https://read.example/api/v1/rankings"),
      { DB: db },
      new Date("2026-08-03T07:00:01.000Z"),
    );

    await expect(withinCadence.json()).resolves.toMatchObject({ meta: { stale: false } });
    await expect(beyondMargin.json()).resolves.toMatchObject({ meta: { stale: true } });
  });

  it("rejects unsupported ranking filters instead of silently returning another dataset", async () => {
    const response = await handleRequest(
      new Request("https://read.example/api/v1/rankings?theme=beach"),
      { DB: db },
    );
    expect(response.status).toBe(400);
  });
});
