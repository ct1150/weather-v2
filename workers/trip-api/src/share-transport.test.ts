import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest, type WorkerEnv } from "./index";
import { createShareLink } from "./sharing";
import { createTrip } from "./store";
import { validateTripDocument } from "./validation";

const smokeToken = "phase-2-header-smoke";
const document = {
  version: 1,
  id: "header-share-trip",
  title: "Header share trip",
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

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://trip.example.test${path}`, init);
}

describe("header-based share token transport", () => {
  let env: WorkerEnv;
  let shareToken: string;

  beforeEach(async () => {
    const db = createInMemoryD1() as D1Database;
    for (const name of [
      "0001_trips.sql",
      "0002_trip_shares.sql",
      "0003_collaboration.sql",
      "0004_collaboration_intelligence.sql",
    ]) {
      await db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }
    env = {
      DB: db,
      WEB_ORIGIN: "https://868656.xyz",
      AUTH_BASE_URL: "https://trip.example.test",
      INTERNAL_SMOKE_TOKEN: smokeToken,
    };
    const trip = await createTrip(db, "owner-a", "en", validateTripDocument(document)!);
    shareToken = (await createShareLink(db, "owner-a", trip.id))!.token;
  });

  it("reads a public share without putting the bearer token in the URL", async () => {
    const response = await handleRequest(
      request("/api/v1/shared-trips/current", {
        headers: { "x-wnr-share-token": shareToken },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.url).not.toContain(shareToken);
    expect(await response.json()).toMatchObject({ data: { title: "Header share trip" } });
  });

  it("requires both the share header and an authenticated owner for copy", async () => {
    const missingHeader = await handleRequest(request("/api/v1/shared-trips/current"), env);
    expect(missingHeader.status).toBe(404);

    const anonymousCopy = await handleRequest(
      request("/api/v1/shared-trips/current/copy", {
        method: "POST",
        headers: { "x-wnr-share-token": shareToken },
      }),
      env,
    );
    expect(anonymousCopy.status).toBe(401);

    const copied = await handleRequest(
      request("/api/v1/shared-trips/current/copy", {
        method: "POST",
        headers: {
          "x-wnr-share-token": shareToken,
          authorization: `Bearer ${smokeToken}`,
          "x-wnr-smoke-user": "copy-user",
        },
      }),
      env,
    );
    expect(copied.status).toBe(201);
    expect(await copied.json()).toMatchObject({ data: { title: "Header share trip", version: 1 } });
  });
});
