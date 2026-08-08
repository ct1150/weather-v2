import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import { handleRequest, type WorkerEnv } from "./index";

const smokeToken = "phase-8-replan-smoke-token";

function activity(id: string, title: string, startTime: string) {
  return {
    id,
    title,
    cityId: "jp-tokyo",
    startTime,
    endTime: null,
    durationMinutes: 120,
    latitude: 35.68,
    longitude: 139.76,
    category: "leisure",
    environment: "outdoor",
    weatherSensitivity: ["rain", "heat", "wind"],
    flexibility: "movable",
    reservation: "none",
    priority: "preferred",
    poiId: null,
    alternatives: [],
    notes: "",
  };
}

function workspace(startTime = "09:00", title = "Tokyo weather trip") {
  return {
    version: 2,
    id: "phase8-local",
    title,
    partyProfile: "family",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: startTime === "09:00" ? "2026-08-09T00:01:00.000Z" : "2026-08-09T00:02:00.000Z",
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2026-08-10",
        cityId: "jp-tokyo",
        cityName: "Tokyo",
        countryName: "Japan",
        theme: "outdoor",
        flexible: true,
        activities: [`${startTime} garden`, "14:00 museum"],
        activityItems: [
          activity("garden", "garden", startTime),
          {
            ...activity("museum", "museum", "14:00"),
            environment: "indoor",
            weatherSensitivity: [],
          },
        ],
        notes: "hotel by 19:00",
      },
    ],
  };
}

function request(
  path: string,
  init: RequestInit = {},
  user = "owner-a",
  email = "owner@example.com",
): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${smokeToken}`);
  headers.set("x-wnr-smoke-user", user);
  headers.set("x-wnr-smoke-email", email);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(`https://trip.example.test${path}`, { ...init, headers });
}

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function createTrip(env: WorkerEnv): Promise<string> {
  const response = await handleRequest(
    request("/api/v1/trips", {
      method: "POST",
      body: JSON.stringify({ locale: "en", document: workspace() }),
    }),
    env,
  );
  expect(response.status).toBe(201);
  return (await body<{ data: { id: string } }>(response)).data.id;
}

async function addMember(
  env: WorkerEnv,
  tripId: string,
  role: "editor" | "viewer",
  user: string,
  email: string,
): Promise<void> {
  const invited = await handleRequest(
    request(`/api/v1/trips/${tripId}/invites`, {
      method: "POST",
      body: JSON.stringify({ email, role, locale: "en" }),
    }),
    env,
  );
  const token = (await body<{ data: { token: string } }>(invited)).data.token;
  const accepted = await handleRequest(
    request(
      "/api/v1/trip-invites/current/accept",
      { method: "POST", headers: { "x-wnr-invite-token": token } },
      user,
      email,
    ),
    env,
  );
  expect(accepted.status).toBe(201);
}

function applyBody(baseVersion = 1, document = workspace("11:00"), selectedChangeIds = ["garden"]) {
  return JSON.stringify({
    baseVersion,
    locale: "en",
    document,
    weatherSnapshotId: "snapshot-phase8-001",
    selectedChangeIds,
  });
}

describe("Phase 8 replan apply boundary", () => {
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

  it("applies an explicitly approved owner replan through normal revision/activity records", async () => {
    const tripId = await createTrip(env);
    const response = await handleRequest(
      request(`/api/v1/trips/${tripId}/replan/apply`, {
        method: "POST",
        body: applyBody(),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({
      data: {
        version: 2,
        document: {
          days: [{ activityItems: [{ id: "garden", startTime: "11:00" }] }],
        },
      },
    });

    const revisions = await handleRequest(request(`/api/v1/trips/${tripId}/revisions?limit=10`), env);
    expect(await body(revisions)).toMatchObject({
      data: { items: [{ version: 2, operation: "replan" }, { version: 1, operation: "create" }] },
    });

    const activityFeed = await handleRequest(request(`/api/v1/trips/${tripId}/activity`), env);
    expect(await body(activityFeed)).toMatchObject({
      data: {
        items: [
          {
            kind: "revision",
            payload: {
              version: 2,
              operation: "replan",
              weatherSnapshotId: "snapshot-phase8-001",
              selectedChangeIds: ["garden"],
            },
          },
        ],
      },
    });
  });

  it("allows editors but rejects viewers at the server boundary", async () => {
    const tripId = await createTrip(env);
    await addMember(env, tripId, "editor", "editor-a", "editor@example.com");
    await addMember(env, tripId, "viewer", "viewer-a", "viewer@example.com");

    const editorResponse = await handleRequest(
      request(
        `/api/v1/trips/${tripId}/replan/apply`,
        { method: "POST", body: applyBody() },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(editorResponse.status).toBe(200);

    const secondTripId = await createTrip(env);
    await addMember(env, secondTripId, "viewer", "viewer-b", "viewer-b@example.com");
    const viewerResponse = await handleRequest(
      request(
        `/api/v1/trips/${secondTripId}/replan/apply`,
        { method: "POST", body: applyBody() },
        "viewer-b",
        "viewer-b@example.com",
      ),
      env,
    );
    expect(viewerResponse.status).toBe(403);
  });

  it("rejects stale baseVersion with the current version", async () => {
    const tripId = await createTrip(env);
    const first = await handleRequest(
      request(`/api/v1/trips/${tripId}/replan/apply`, { method: "POST", body: applyBody() }),
      env,
    );
    expect(first.status).toBe(200);

    const stale = await handleRequest(
      request(`/api/v1/trips/${tripId}/replan/apply`, { method: "POST", body: applyBody(1) }),
      env,
    );
    expect(stale.status).toBe(409);
    expect(await body(stale)).toMatchObject({
      error: { code: "VERSION_CONFLICT", currentVersion: 2 },
    });
  });

  it("rejects unrelated document edits, mismatched selections and no-op apply", async () => {
    const tripId = await createTrip(env);
    const renamed = workspace("11:00", "Sneaky rename");

    const unrelated = await handleRequest(
      request(`/api/v1/trips/${tripId}/replan/apply`, {
        method: "POST",
        body: applyBody(1, renamed),
      }),
      env,
    );
    expect(unrelated.status).toBe(400);
    expect(await body(unrelated)).toMatchObject({
      error: { code: "INVALID_REPLAN", reason: "trip_metadata_changed" },
    });

    const mismatch = await handleRequest(
      request(`/api/v1/trips/${tripId}/replan/apply`, {
        method: "POST",
        body: applyBody(1, workspace("11:00"), ["museum"]),
      }),
      env,
    );
    expect(mismatch.status).toBe(400);
    expect(await body(mismatch)).toMatchObject({
      error: { code: "INVALID_REPLAN", reason: "selected_change_mismatch" },
    });

    const noOp = await handleRequest(
      request(`/api/v1/trips/${tripId}/replan/apply`, {
        method: "POST",
        body: applyBody(1, workspace(), []),
      }),
      env,
    );
    expect(noOp.status).toBe(400);
    expect(await body(noOp)).toMatchObject({
      error: { code: "INVALID_REPLAN", reason: "no_changes" },
    });
  });

  it("advertises the Phase 8 apply capability", async () => {
    const response = await handleRequest(new Request("https://trip.example.test/health"), env);
    expect(await body(response)).toMatchObject({
      adaptiveReplanningApply: true,
    });
  });
});
