import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { describe, expect, it } from "vitest";

const migrations = [
  "0001_trips.sql",
  "0002_trip_shares.sql",
  "0003_collaboration.sql",
  "0004_collaboration_intelligence.sql",
  "0005_weather_intelligence.sql",
];

describe("Phase 5 weather intelligence migration", () => {
  it("creates durable observation and insight tables with snapshot idempotency", async () => {
    const db = createInMemoryD1() as D1Database;
    for (const name of migrations) {
      await db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }

    const tables = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('trip_weather_observations', 'trip_weather_insights') ORDER BY name",
      )
      .all<{ readonly name: string }>();
    expect(tables.results.map((row) => row.name)).toEqual([
      "trip_weather_insights",
      "trip_weather_observations",
    ]);

    const indexes = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_trip_weather_observations_latest', 'idx_trip_weather_insights_trip_created', 'idx_trip_weather_insights_open') ORDER BY name",
      )
      .all<{ readonly name: string }>();
    expect(indexes.results.map((row) => row.name)).toEqual([
      "idx_trip_weather_insights_open",
      "idx_trip_weather_insights_trip_created",
      "idx_trip_weather_observations_latest",
    ]);
  });
});
