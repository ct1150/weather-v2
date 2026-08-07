import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { describe, expect, it } from "vitest";

describe("phase 3 collaboration migration", () => {
  it("backfills one baseline revision for an existing phase 2 trip", async () => {
    const db = createInMemoryD1() as D1Database;
    for (const name of ["0001_trips.sql", "0002_trip_shares.sql"]) {
      await db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }

    const document = JSON.stringify({
      version: 1,
      id: "legacy",
      title: "Existing cloud trip",
      days: [],
    });
    await db
      .prepare(
        "INSERT INTO trips (id, owner_user_id, title, status, locale, document_json, version, created_at, updated_at) " +
          "VALUES (?, ?, ?, 'active', 'en', ?, 7, ?, ?)",
      )
      .bind(
        "trip_existing_phase2",
        "owner-a",
        "Existing cloud trip",
        document,
        "2026-08-07T00:00:00.000Z",
        "2026-08-08T00:00:00.000Z",
      )
      .run();

    await db.exec(
      readFileSync(new URL("../migrations/0003_collaboration.sql", import.meta.url), "utf8"),
    );

    const revision = await db
      .prepare(
        "SELECT trip_id, actor_user_id, version, operation, locale, document_json, created_at " +
          "FROM trip_revisions WHERE trip_id = ? LIMIT 1",
      )
      .bind("trip_existing_phase2")
      .first<{
        readonly trip_id: string;
        readonly actor_user_id: string;
        readonly version: number;
        readonly operation: string;
        readonly locale: string;
        readonly document_json: string;
        readonly created_at: string;
      }>();

    expect(revision).toMatchObject({
      trip_id: "trip_existing_phase2",
      actor_user_id: "owner-a",
      version: 7,
      operation: "baseline",
      locale: "en",
      document_json: document,
      created_at: "2026-08-08T00:00:00.000Z",
    });
  });
});
