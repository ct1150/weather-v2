import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createShareLink, readSharedTripByToken, revokeShareLink } from "./sharing";
import { createTrip } from "./store";
import { validateTripDocument } from "./validation";

const document = {
  version: 1,
  id: "local-share-test",
  title: "Share-safe Japan trip",
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

describe("trip sharing store", () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createInMemoryD1() as D1Database;
    for (const name of ["0001_trips.sql", "0002_trip_shares.sql", "0003_collaboration.sql"]) {
      await db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }
  });

  it("stores only the token hash and resolves the public trip", async () => {
    const trip = await createTrip(db, "owner-a", "en", validateTripDocument(document)!);
    const share = await createShareLink(db, "owner-a", trip.id, "2026-08-07T01:00:00.000Z");
    expect(share).not.toBeNull();
    expect(share!.token).toMatch(/^shr_[a-f0-9]{64}$/u);

    const row = await db
      .prepare("SELECT token_hash, token_prefix FROM trip_shares WHERE trip_id = ?")
      .bind(trip.id)
      .first<{ readonly token_hash: string; readonly token_prefix: string }>();
    expect(row).not.toBeNull();
    expect(row!.token_hash).toHaveLength(64);
    expect(row!.token_hash).not.toBe(share!.token);
    expect(row!.token_prefix).toBe(share!.tokenPrefix);

    const publicTrip = await readSharedTripByToken(db, share!.token);
    expect(publicTrip).toMatchObject({
      title: "Share-safe Japan trip",
      locale: "en",
      document: { title: "Share-safe Japan trip" },
    });
  });

  it("regenerates one active link and supports explicit revoke", async () => {
    const trip = await createTrip(db, "owner-a", "en", validateTripDocument(document)!);
    const first = await createShareLink(db, "owner-a", trip.id, "2026-08-07T01:00:00.000Z");
    const second = await createShareLink(db, "owner-a", trip.id, "2026-08-07T02:00:00.000Z");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!.token).not.toBe(first!.token);
    expect(await readSharedTripByToken(db, first!.token)).toBeNull();
    expect(await readSharedTripByToken(db, second!.token)).not.toBeNull();

    expect(await revokeShareLink(db, "owner-a", trip.id, "2026-08-07T03:00:00.000Z")).toBe(true);
    expect(await readSharedTripByToken(db, second!.token)).toBeNull();
  });

  it("never lets a different owner create or revoke a share", async () => {
    const trip = await createTrip(db, "owner-a", "en", validateTripDocument(document)!);
    expect(await createShareLink(db, "owner-b", trip.id)).toBeNull();
    const share = await createShareLink(db, "owner-a", trip.id);
    expect(share).not.toBeNull();
    expect(await revokeShareLink(db, "owner-b", trip.id)).toBe(false);
    expect(await readSharedTripByToken(db, share!.token)).not.toBeNull();
  });
});
