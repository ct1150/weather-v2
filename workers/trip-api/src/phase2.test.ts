import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest, type WorkerEnv } from "./index";

const smokeToken = "phase-2-smoke-token";

function workspace(title = "Phase 2 Japan trip") {
  return {
    version: 1,
    id: "phase2-local",
    title,
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
  };
}

function request(
  path: string,
  init: RequestInit = {},
  user = "owner-a",
  authenticated = true,
): Request {
  const headers = new Headers(init.headers);
  if (authenticated) {
    headers.set("authorization", `Bearer ${smokeToken}`);
    headers.set("x-wnr-smoke-user", user);
  }
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(`https://trip.example.test${path}`, { ...init, headers });
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function createOwnerTrip(env: WorkerEnv): Promise<{ id: string; version: number }> {
  const response = await handleRequest(
    request("/api/v1/trips", {
      method: "POST",
      body: JSON.stringify({ locale: "en", document: workspace() }),
    }),
    env,
  );
  expect(response.status).toBe(201);
  return (await json<{ data: { id: string; version: number } }>(response)).data;
}

describe("Trip API phase 2", () => {
  let env: WorkerEnv;

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
  });

  it("archives, restores and filters My Trips", async () => {
    const trip = await createOwnerTrip(env);
    const archived = await handleRequest(
      request(`/api/v1/trips/${trip.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ baseVersion: 1, status: "archived" }),
      }),
      env,
    );
    expect(archived.status).toBe(200);
    expect(await json(archived)).toMatchObject({ data: { status: "archived", version: 2 } });

    const activeList = await handleRequest(request("/api/v1/trips?status=active&limit=50"), env);
    expect(await json<{ data: { items: unknown[] } }>(activeList)).toEqual({ data: { items: [] } });

    const archivedList = await handleRequest(
      request("/api/v1/trips?status=archived&limit=50"),
      env,
    );
    expect(await json<{ data: { items: Array<{ id: string }> } }>(archivedList)).toMatchObject({
      data: { items: [{ id: trip.id }] },
    });

    const staleRestore = await handleRequest(
      request(`/api/v1/trips/${trip.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ baseVersion: 1, status: "active" }),
      }),
      env,
    );
    expect(staleRestore.status).toBe(409);

    const restored = await handleRequest(
      request(`/api/v1/trips/${trip.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ baseVersion: 2, status: "active" }),
      }),
      env,
    );
    expect(restored.status).toBe(200);
    expect(await json(restored)).toMatchObject({ data: { status: "active", version: 3 } });
  });

  it("creates a public read-only link, revokes the old link and copies independently", async () => {
    const trip = await createOwnerTrip(env);
    const firstShareResponse = await handleRequest(
      request(`/api/v1/trips/${trip.id}/share`, { method: "POST" }),
      env,
    );
    expect(firstShareResponse.status).toBe(201);
    const firstShare = await json<{ data: { token: string } }>(firstShareResponse);

    const publicRead = await handleRequest(
      request(`/api/v1/shared-trips/${firstShare.data.token}`, {}, "guest", false),
      env,
    );
    expect(publicRead.status).toBe(200);
    expect(await json(publicRead)).toMatchObject({
      data: { title: "Phase 2 Japan trip", document: { title: "Phase 2 Japan trip" } },
    });

    const anonymousCopy = await handleRequest(
      request(
        `/api/v1/shared-trips/${firstShare.data.token}/copy`,
        { method: "POST" },
        "guest",
        false,
      ),
      env,
    );
    expect(anonymousCopy.status).toBe(401);

    const secondShareResponse = await handleRequest(
      request(`/api/v1/trips/${trip.id}/share`, { method: "POST" }),
      env,
    );
    const secondShare = await json<{ data: { token: string } }>(secondShareResponse);
    expect(secondShare.data.token).not.toBe(firstShare.data.token);

    const oldRead = await handleRequest(
      request(`/api/v1/shared-trips/${firstShare.data.token}`, {}, "guest", false),
      env,
    );
    expect(oldRead.status).toBe(404);

    const copiedResponse = await handleRequest(
      request(`/api/v1/shared-trips/${secondShare.data.token}/copy`, { method: "POST" }, "owner-b"),
      env,
    );
    expect(copiedResponse.status).toBe(201);
    const copied = await json<{ data: { id: string; version: number; title: string } }>(
      copiedResponse,
    );
    expect(copied.data.id).not.toBe(trip.id);
    expect(copied.data.version).toBe(1);
    expect(copied.data.title).toBe("Phase 2 Japan trip");

    const ownerBList = await handleRequest(request("/api/v1/trips?limit=50", {}, "owner-b"), env);
    expect(await json<{ data: { items: Array<{ id: string }> } }>(ownerBList)).toMatchObject({
      data: { items: [{ id: copied.data.id }] },
    });
  });
});
