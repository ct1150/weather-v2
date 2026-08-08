import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest, type WorkerEnv } from "./index";

const smokeToken = "phase-4-smoke-token";

function workspace(title = "Phase 4 Japan", cityName = "Tokyo", activities = ["09:00 Asakusa"]) {
  return {
    version: 1,
    id: "phase4-local",
    title,
    partyProfile: "family",
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:01:00.000Z",
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2026-08-12",
        cityId: cityName === "Kyoto" ? "jp-kyoto" : "jp-tokyo",
        cityName,
        countryName: "Japan",
        theme: "city",
        flexible: true,
        activities,
        notes: "",
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

describe("Trip API phase 4 collaboration intelligence", () => {
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

  it("records document activity and returns structured revision diffs", async () => {
    const tripId = await createTrip(env);
    await addMember(env, tripId, "editor", "editor-a", "editor@example.com");

    const updated = await handleRequest(
      request(
        `/api/v1/trips/${tripId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            baseVersion: 1,
            locale: "en",
            document: workspace("Kyoto focus", "Kyoto", ["10:00 Fushimi Inari"]),
          }),
        },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(updated.status).toBe(200);

    const diff = await handleRequest(
      request(`/api/v1/trips/${tripId}/revisions/2/diff`, {}, "editor-a", "editor@example.com"),
      env,
    );
    expect(diff.status).toBe(200);
    const diffPayload = await body<{
      data: { fromVersion: number; toVersion: number; changes: Array<{ field: string }> };
    }>(diff);
    expect(diffPayload.data.fromVersion).toBe(1);
    expect(diffPayload.data.toVersion).toBe(2);
    expect(diffPayload.data.changes.map((item) => item.field)).toEqual(
      expect.arrayContaining(["trip.title", "day.destination", "day.activities"]),
    );

    const activity = await handleRequest(
      request(`/api/v1/trips/${tripId}/activity`, {}, "editor-a", "editor@example.com"),
      env,
    );
    expect(await body(activity)).toMatchObject({
      data: {
        items: [
          { kind: "revision", actorEmail: "editor@example.com", payload: { version: 2 } },
          { kind: "revision", actorEmail: "owner@example.com", payload: { version: 1 } },
        ],
      },
    });
  });

  it("supports contextual comments and decision records with viewer read-only access", async () => {
    const tripId = await createTrip(env);
    await addMember(env, tripId, "editor", "editor-a", "editor@example.com");
    await addMember(env, tripId, "viewer", "viewer-a", "viewer@example.com");

    const commentResponse = await handleRequest(
      request(
        `/api/v1/trips/${tripId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ body: "Move outdoor time earlier?", dayId: "day-1", revisionVersion: 1 }),
        },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(commentResponse.status).toBe(201);
    const comment = (await body<{ data: { id: string } }>(commentResponse)).data;

    const decisionResponse = await handleRequest(
      request(
        `/api/v1/trips/${tripId}/decisions`,
        {
          method: "POST",
          body: JSON.stringify({
            title: "Start Asakusa before 09:00",
            detail: "Avoid the hottest hour and leave indoor backup after lunch.",
            dayId: "day-1",
          }),
        },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(decisionResponse.status).toBe(201);
    const decision = (await body<{ data: { id: string } }>(decisionResponse)).data;

    const viewerComments = await handleRequest(
      request(`/api/v1/trips/${tripId}/comments`, {}, "viewer-a", "viewer@example.com"),
      env,
    );
    expect(viewerComments.status).toBe(200);
    expect(await body(viewerComments)).toMatchObject({
      data: { items: [{ id: comment.id, dayId: "day-1", revisionVersion: 1 }] },
    });

    const viewerDecision = await handleRequest(
      request(`/api/v1/trips/${tripId}/decisions`, {}, "viewer-a", "viewer@example.com"),
      env,
    );
    expect(viewerDecision.status).toBe(200);

    const viewerCommentWrite = await handleRequest(
      request(
        `/api/v1/trips/${tripId}/comments`,
        { method: "POST", body: JSON.stringify({ body: "viewer write" }) },
        "viewer-a",
        "viewer@example.com",
      ),
      env,
    );
    expect(viewerCommentWrite.status).toBe(403);

    const resolved = await handleRequest(
      request(
        `/api/v1/trips/${tripId}/decisions/${decision.id}`,
        { method: "PATCH", body: JSON.stringify({ status: "resolved" }) },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(resolved.status).toBe(200);
    expect(await body(resolved)).toMatchObject({
      data: { status: "resolved", resolvedByEmail: "editor@example.com" },
    });

    const viewerResolve = await handleRequest(
      request(
        `/api/v1/trips/${tripId}/decisions/${decision.id}`,
        { method: "PATCH", body: JSON.stringify({ status: "open" }) },
        "viewer-a",
        "viewer@example.com",
      ),
      env,
    );
    expect(viewerResolve.status).toBe(403);

    const editorDeleteComment = await handleRequest(
      request(
        `/api/v1/trips/${tripId}/comments/${comment.id}`,
        { method: "DELETE" },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(editorDeleteComment.status).toBe(403);

    const ownerDeleteComment = await handleRequest(
      request(`/api/v1/trips/${tripId}/comments/${comment.id}`, { method: "DELETE" }),
      env,
    );
    expect(ownerDeleteComment.status).toBe(200);

    const ownerDeleteDecision = await handleRequest(
      request(`/api/v1/trips/${tripId}/decisions/${decision.id}`, { method: "DELETE" }),
      env,
    );
    expect(ownerDeleteDecision.status).toBe(200);

    const activity = await handleRequest(
      request(`/api/v1/trips/${tripId}/activity`, {}, "viewer-a", "viewer@example.com"),
      env,
    );
    const activityPayload = await body<{ data: { items: Array<{ kind: string }> } }>(activity);
    expect(activityPayload.data.items.map((item) => item.kind)).toEqual(
      expect.arrayContaining([
        "comment_created",
        "decision_created",
        "decision_resolved",
        "comment_deleted",
        "decision_deleted",
      ]),
    );
  });

  it("keeps collaboration intelligence private from non-members", async () => {
    const tripId = await createTrip(env);
    const response = await handleRequest(
      request(`/api/v1/trips/${tripId}/activity`, {}, "stranger", "stranger@example.com"),
      env,
    );
    expect(response.status).toBe(404);
  });

  it("advertises phase 4 capabilities", async () => {
    const response = await handleRequest(new Request("https://trip.example.test/health"), env);
    expect(await body(response)).toMatchObject({
      collaborationActivity: true,
      tripComments: true,
      tripDecisions: true,
      revisionDiff: true,
    });
  });
});
