import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { describe, expect, it } from "vitest";

describe("phase 4 collaboration intelligence migration", () => {
  it("backfills revision activity and is safe to re-run", async () => {
    const db = createInMemoryD1() as D1Database;
    for (const name of [
      "0001_trips.sql",
      "0002_trip_shares.sql",
      "0003_collaboration.sql",
      "0004_collaboration_intelligence.sql",
    ]) {
      await db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }

    await db
      .prepare(
        "INSERT INTO trips (id, owner_user_id, title, status, locale, document_json, version, created_at, updated_at) " +
          "VALUES (?, ?, ?, 'active', 'en', ?, 2, ?, ?)",
      )
      .bind(
        "trip_phase4_existing",
        "owner-a",
        "Existing collaborative trip",
        JSON.stringify({ version: 1, id: "legacy", title: "Existing", days: [] }),
        "2026-08-07T00:00:00.000Z",
        "2026-08-08T00:00:00.000Z",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO trip_revisions (id, trip_id, actor_user_id, version, operation, locale, document_json, created_at) VALUES (?, ?, ?, 2, 'update', 'en', ?, ?)",
      )
      .bind(
        "rev_phase4_existing",
        "trip_phase4_existing",
        "editor-a",
        JSON.stringify({ version: 1, id: "legacy", title: "Existing", days: [] }),
        "2026-08-08T00:00:00.000Z",
      )
      .run();

    const migration = readFileSync(
      new URL("../migrations/0004_collaboration_intelligence.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);

    const activity = await db
      .prepare(
        "SELECT kind, revision_version, payload_json FROM trip_activity WHERE trip_id = ? ORDER BY revision_version",
      )
      .bind("trip_phase4_existing")
      .all<{
        readonly kind: string;
        readonly revision_version: number;
        readonly payload_json: string;
      }>();
    expect(activity.results).toHaveLength(1);
    expect(activity.results[0]).toMatchObject({ kind: "revision", revision_version: 2 });
    expect(JSON.parse(activity.results[0]!.payload_json)).toEqual({
      version: 2,
      operation: "update",
    });

    const tables = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('trip_activity','trip_comments','trip_decisions') ORDER BY name",
      )
      .all<{ readonly name: string }>();
    expect(tables.results.map((row) => row.name)).toEqual([
      "trip_activity",
      "trip_comments",
      "trip_decisions",
    ]);
  });
});
