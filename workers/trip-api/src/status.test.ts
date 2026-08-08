import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { updateTripStatus } from "./status";
import { createTrip, listTrips } from "./store";
import { validateTripDocument } from "./validation";

const document = {
  version: 1,
  id: "local-status-test",
  title: "Archive test trip",
  partyProfile: "adults",
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      date: "2026-08-12",
      cityId: "jp-tokyo",
      cityName: "Tokyo",
      countryName: "Japan",
      theme: "city",
      flexible: true,
      activities: [],
      notes: "",
    },
  ],
} as const;

describe("trip status updates", () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createInMemoryD1() as D1Database;
    for (const name of [
      "0001_trips.sql",
      "0002_trip_shares.sql",
      "0003_collaboration.sql",
      "0004_collaboration_intelligence.sql",
    ]) {
      await db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }
  });

  it("archives and restores with optimistic version checks", async () => {
    const trip = await createTrip(db, "owner-a", "en", validateTripDocument(document)!);
    const archived = await updateTripStatus(
      db,
      "owner-a",
      trip.id,
      1,
      "archived",
      "2026-08-07T01:00:00.000Z",
    );
    expect(archived.kind).toBe("updated");
    if (archived.kind === "updated") {
      expect(archived.trip.status).toBe("archived");
      expect(archived.trip.version).toBe(2);
    }

    const stale = await updateTripStatus(db, "owner-a", trip.id, 1, "active");
    expect(stale).toEqual({ kind: "conflict", currentVersion: 2 });

    const restored = await updateTripStatus(db, "owner-a", trip.id, 2, "active");
    expect(restored.kind).toBe("updated");
    expect((await listTrips(db, "owner-a"))[0]).toMatchObject({ status: "active", version: 3 });
  });

  it("hides trip existence from another owner", async () => {
    const trip = await createTrip(db, "owner-a", "en", validateTripDocument(document)!);
    expect(await updateTripStatus(db, "owner-b", trip.id, 1, "archived")).toEqual({
      kind: "missing",
    });
  });
});
