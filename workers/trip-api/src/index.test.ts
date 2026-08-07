import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest, safeLogPath, type WorkerEnv } from "./index";

const smokeToken = "cloud-trip-smoke-token-for-tests";

function workspace(title = "Japan family trip") {
  return {
    version: 1,
    id: "local-trip-1",
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

describe("Trip API", () => {
  let env: WorkerEnv;

  beforeEach(async () => {
    const db = createInMemoryD1() as D1Database;
    const migration = readFileSync(
      new URL("../migrations/0001_trips.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    env = {
      DB: db,
      WEB_ORIGIN: "https://868656.xyz",
      AUTH_BASE_URL: "https://trip.example.test",
      INTERNAL_SMOKE_TOKEN: smokeToken,
    };
  });

  it("rejects anonymous access without uploading guest data", async () => {
    const response = await handleRequest(request("/api/v1/trips", {}, "guest", false), env);
    expect(response.status).toBe(401);
    expect(await json(response)).toEqual({ error: { code: "UNAUTHORIZED" } });
  });

  it("creates, reads and lists a cloud trip for the authenticated owner", async () => {
    const createdResponse = await handleRequest(
      request("/api/v1/trips", {
        method: "POST",
        body: JSON.stringify({ locale: "en", document: workspace() }),
      }),
      env,
    );
    expect(createdResponse.status).toBe(201);
    const created = await json<{ data: { id: string; version: number } }>(createdResponse);
    expect(created.data.version).toBe(1);

    const readResponse = await handleRequest(request(`/api/v1/trips/${created.data.id}`), env);
    expect(readResponse.status).toBe(200);
    expect(await json<{ data: { document: { title: string } } }>(readResponse)).toMatchObject({
      data: { document: { title: "Japan family trip" } },
    });

    const listResponse = await handleRequest(request("/api/v1/trips"), env);
    expect(await json<{ data: { items: unknown[] } }>(listResponse)).toMatchObject({
      data: { items: [{ id: created.data.id, version: 1 }] },
    });
  });

  it("hides another user's trip and returns 409 for stale writes", async () => {
    const createdResponse = await handleRequest(
      request("/api/v1/trips", {
        method: "POST",
        body: JSON.stringify({ locale: "en", document: workspace() }),
      }),
      env,
    );
    const created = await json<{ data: { id: string } }>(createdResponse);

    const otherUser = await handleRequest(
      request(`/api/v1/trips/${created.data.id}`, {}, "owner-b"),
      env,
    );
    expect(otherUser.status).toBe(404);

    const firstUpdate = await handleRequest(
      request(`/api/v1/trips/${created.data.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          baseVersion: 1,
          locale: "en",
          document: workspace("Japan family trip v2"),
        }),
      }),
      env,
    );
    expect(firstUpdate.status).toBe(200);
    expect(await json<{ data: { version: number } }>(firstUpdate)).toMatchObject({
      data: { version: 2 },
    });

    const staleUpdate = await handleRequest(
      request(`/api/v1/trips/${created.data.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          baseVersion: 1,
          locale: "en",
          document: workspace("Stale edit"),
        }),
      }),
      env,
    );
    expect(staleUpdate.status).toBe(409);
    expect(await json(staleUpdate)).toEqual({
      error: { code: "VERSION_CONFLICT", currentVersion: 2 },
    });
  });

  it("soft deletes only the owner's trip", async () => {
    const createdResponse = await handleRequest(
      request("/api/v1/trips", {
        method: "POST",
        body: JSON.stringify({ locale: "en", document: workspace() }),
      }),
      env,
    );
    const created = await json<{ data: { id: string } }>(createdResponse);

    const denied = await handleRequest(
      request(`/api/v1/trips/${created.data.id}`, { method: "DELETE" }, "owner-b"),
      env,
    );
    expect(denied.status).toBe(404);

    const deleted = await handleRequest(
      request(`/api/v1/trips/${created.data.id}`, { method: "DELETE" }),
      env,
    );
    expect(deleted.status).toBe(200);

    const readAfterDelete = await handleRequest(request(`/api/v1/trips/${created.data.id}`), env);
    expect(readAfterDelete.status).toBe(404);
  });

  it("redacts bearer share tokens from error log paths", () => {
    const token = `shr_${"a".repeat(64)}`;
    expect(safeLogPath(`/api/v1/shared-trips/${token}`)).toBe(
      "/api/v1/shared-trips/[redacted]",
    );
    expect(safeLogPath(`/api/v1/shared-trips/${token}/copy`)).toBe(
      "/api/v1/shared-trips/[redacted]/copy",
    );
    expect(safeLogPath("/api/v1/trips/trip_example")).toBe("/api/v1/trips/trip_example");
  });
});
