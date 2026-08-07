import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createTrip, deleteTrip, listTrips, readTrip, updateTrip } from "./store";
import { validateTripDocument } from "./validation";

const document = {
  version: 1,
  id: "local-trip-1",
  title: "Japan family trip",
  partyProfile: "family",
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
      activities: ["09:00 Asakusa"],
      notes: "",
    },
  ],
} as const;

describe("trip store", () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createInMemoryD1() as D1Database;
    const migration = readFileSync(
      new URL("../migrations/0001_trips.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
  });

  it("creates, lists and reads only the owner's cloud trip", async () => {
    const valid = validateTripDocument(document);
    expect(valid).not.toBeNull();
    const created = await createTrip(db, "user-a", "en", valid!, "2026-08-07T01:00:00.000Z");
    expect(created.version).toBe(1);
    expect(created.document.title).toBe("Japan family trip");
    expect(await listTrips(db, "user-a")).toHaveLength(1);
    expect(await listTrips(db, "user-b")).toHaveLength(0);
    expect(await readTrip(db, "user-b", created.id)).toBeNull();
  });

  it("filters archived trips in D1 before applying the list limit", async () => {
    const valid = validateTripDocument(document)!;
    const archived = await createTrip(db, "user-a", "en", valid, "2026-08-01T00:00:00.000Z");
    await db.prepare("UPDATE trips SET status = 'archived' WHERE id = ?").bind(archived.id).run();

    for (let index = 0; index < 50; index += 1) {
      await createTrip(
        db,
        "user-a",
        "en",
        valid,
        `2026-08-07T${String(index % 24).padStart(2, "0")}:${String(index).padStart(2, "0")}:00.000Z`,
      );
    }

    const archivedTrips = await listTrips(db, "user-a", 50, "archived");
    expect(archivedTrips).toHaveLength(1);
    expect(archivedTrips[0]?.id).toBe(archived.id);
  });

  it("uses optimistic concurrency and never silently overwrites", async () => {
    const valid = validateTripDocument(document)!;
    const created = await createTrip(db, "user-a", "en", valid, "2026-08-07T01:00:00.000Z");
    const changed = validateTripDocument({ ...document, title: "Updated Japan trip" })!;

    const first = await updateTrip(
      db,
      "user-a",
      created.id,
      1,
      "en",
      changed,
      "2026-08-07T02:00:00.000Z",
    );
    expect(first.kind).toBe("updated");
    if (first.kind === "updated") expect(first.trip.version).toBe(2);

    const stale = await updateTrip(
      db,
      "user-a",
      created.id,
      1,
      "en",
      valid,
      "2026-08-07T03:00:00.000Z",
    );
    expect(stale).toEqual({ kind: "conflict", currentVersion: 2 });
  });

  it("soft deletes without exposing the trip afterwards", async () => {
    const created = await createTrip(
      db,
      "user-a",
      "en",
      validateTripDocument(document)!,
      "2026-08-07T01:00:00.000Z",
    );
    expect(await deleteTrip(db, "user-a", created.id, "2026-08-07T04:00:00.000Z")).toBe(true);
    expect(await readTrip(db, "user-a", created.id)).toBeNull();
  });
});
