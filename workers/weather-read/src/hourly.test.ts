import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createInMemoryD1, type D1DatabaseLike } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import { handleRequest } from "./index.js";

const MIGRATION = readFileSync(
  fileURLToPath(new URL("../../../packages/db/migrations/0001_weather.sql", import.meta.url)),
  "utf8",
);
const PUBLISHED_AT = "2026-08-08T00:00:00.000Z";

async function seedHourlySnapshot(db: D1DatabaseLike): Promise<void> {
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
      "INSERT INTO cities (id, country_id, slug, latitude, longitude, timezone, is_featured, status, created_at, updated_at) VALUES " +
        "('tokyo', 'jp', 'tokyo', 35.6, 139.7, 'Asia/Tokyo', 1, 'active', ?, ?), " +
        "('kyoto', 'jp', 'kyoto', 35.0, 135.7, 'Asia/Tokyo', 1, 'active', ?, ?)",
    )
    .bind(PUBLISHED_AT, PUBLISHED_AT, PUBLISHED_AT, PUBLISHED_AT)
    .run();
  await db
    .prepare(
      "INSERT INTO city_translations (city_id, locale, name) VALUES " +
        "('tokyo', 'en', 'Tokyo'), ('tokyo', 'zh', '东京'), " +
        "('kyoto', 'en', 'Kyoto'), ('kyoto', 'zh', '京都')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO weather_snapshots (id, provider, fetched_at, valid_from, valid_to, status, checksum, created_at) VALUES " +
        "('snapshot-old', 'open-meteo', ?, ?, ?, 'superseded', 'old-check', ?), " +
        "('snapshot-hourly', 'open-meteo', ?, ?, ?, 'active', 'hourly-check', ?)",
    )
    .bind(
      PUBLISHED_AT,
      PUBLISHED_AT,
      "2026-08-10T00:00:00.000Z",
      PUBLISHED_AT,
      PUBLISHED_AT,
      PUBLISHED_AT,
      "2026-08-10T00:00:00.000Z",
      PUBLISHED_AT,
    )
    .run();
  await db
    .prepare(
      "INSERT INTO active_weather_snapshot (pointer_key, snapshot_id, ranking_version, model_version, publication_fencing_token, published_at, activated_at) VALUES ('weather', 'snapshot-hourly', 'rv1', 'mv1', 1, ?, ?)",
    )
    .bind(PUBLISHED_AT, PUBLISHED_AT)
    .run();

  await db
    .prepare(
      "INSERT INTO weather_hourly (snapshot_id, city_id, local_time, weather_code, temperature_c, apparent_temperature_c, precipitation_mm, precipitation_probability, humidity, wind_speed_kph, wind_gust_kph, uv_index, cloud_cover, visibility_m, data_quality) VALUES " +
        "('snapshot-old', 'tokyo', '2026-08-08T10:00', 61, 18, 18, 12, 95, 90, 30, 48, 1, 95, 3000, 'good'), " +
        "('snapshot-hourly', 'tokyo', '2026-08-08T09:00', 2, 28, 31, 0, 15, 68, 8, 14, 5, 40, 18000, 'good'), " +
        "('snapshot-hourly', 'tokyo', '2026-08-08T10:00', 61, 29, 33, 1.8, 72, 74, 18, 30, 7, 78, 11000, 'good'), " +
        "('snapshot-hourly', 'tokyo', '2026-08-08T11:00', 80, 30, 35, 0.8, 55, 72, 16, 27, 8, 70, 13000, 'good')",
    )
    .run();
}

describe("Phase 8 trip hourly weather read", () => {
  let db: D1DatabaseLike;

  beforeEach(async () => {
    db = createInMemoryD1();
    await db.exec(MIGRATION);
    await seedHourlySnapshot(db);
  });

  it("returns the active snapshot's bounded local-hour window and explicit coverage", async () => {
    const response = await handleRequest(
      new Request(
        "https://read.example/api/v1/trip-hourly?cityIds=tokyo,kyoto&date=2026-08-08&startHour=9&endHour=10&locale=zh-cn",
      ),
      { DB: db },
      new Date("2026-08-08T00:10:00.000Z"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: {
        snapshotId: "snapshot-hourly",
        locale: "zh-cn",
        date: "2026-08-08",
        startHour: 9,
        endHour: 10,
        requestedCityIds: ["tokyo", "kyoto"],
        coverage: {
          availableCityIds: ["tokyo"],
          unavailableCityIds: ["kyoto"],
        },
        items: [
          {
            cityId: "tokyo",
            localTime: "2026-08-08T09:00",
            condition: "多云",
            rainProbability: 15,
            temperatureC: 28,
          },
          {
            cityId: "tokyo",
            localTime: "2026-08-08T10:00",
            condition: "雨",
            rainProbability: 72,
            temperatureC: 29,
          },
        ],
      },
    });
  });

  it("defaults to the full local day without crossing into another date", async () => {
    const response = await handleRequest(
      new Request("https://read.example/api/v1/trip-hourly?cityIds=tokyo&date=2026-08-08"),
      { DB: db },
      new Date("2026-08-08T00:10:00.000Z"),
    );
    const payload = (await response.json()) as {
      readonly data?: {
        readonly startHour?: number;
        readonly endHour?: number;
        readonly items?: unknown[];
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data?.startHour).toBe(0);
    expect(payload.data?.endHour).toBe(23);
    expect(payload.data?.items).toHaveLength(3);
  });

  it("fails closed for invalid hour windows and more than four cities", async () => {
    const badWindow = await handleRequest(
      new Request(
        "https://read.example/api/v1/trip-hourly?cityIds=tokyo&date=2026-08-08&startHour=18&endHour=8",
      ),
      { DB: db },
    );
    const badHour = await handleRequest(
      new Request(
        "https://read.example/api/v1/trip-hourly?cityIds=tokyo&date=2026-08-08&startHour=24",
      ),
      { DB: db },
    );
    const tooManyCities = await handleRequest(
      new Request(
        "https://read.example/api/v1/trip-hourly?cityIds=tokyo,kyoto,osaka,seoul,jeju&date=2026-08-08",
      ),
      { DB: db },
    );

    expect(badWindow.status).toBe(400);
    expect(badHour.status).toBe(400);
    expect(tooManyCities.status).toBe(400);
  });

  it("returns unknown coverage rather than optimistic synthetic weather when hourly rows are missing", async () => {
    const response = await handleRequest(
      new Request(
        "https://read.example/api/v1/trip-hourly?cityIds=kyoto&date=2026-08-08&locale=en",
      ),
      { DB: db },
      new Date("2026-08-08T00:10:00.000Z"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        coverage: { availableCityIds: [], unavailableCityIds: ["kyoto"] },
        items: [],
      },
    });
  });
});
