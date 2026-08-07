import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest, type WorkerEnv } from "./index";

const smokeToken = "phase-3-smoke-token";

function workspace(title = "Collaborative Japan trip") {
  return {
    version: 1,
    id: "phase3-local",
    title,
    partyProfile: "family",
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
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
  email = "owner@example.com",
  authenticated = true,
): Request {
  const headers = new Headers(init.headers);
  if (authenticated) {
    headers.set("authorization", `Bearer ${smokeToken}`);
    headers.set("x-wnr-smoke-user", user);
    headers.set("x-wnr-smoke-email", email);
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

async function invite(
  env: WorkerEnv,
  tripId: string,
  email: string,
  role: "editor" | "viewer",
): Promise<string> {
  const response = await handleRequest(
    request(`/api/v1/trips/${tripId}/invites`, {
      method: "POST",
      body: JSON.stringify({ email, role, locale: "en" }),
    }),
    env,
  );
  expect(response.status).toBe(201);
  return (await json<{ data: { token: string } }>(response)).data.token;
}

async function accept(
  env: WorkerEnv,
  token: string,
  user: string,
  email: string,
): Promise<Response> {
  return handleRequest(
    request(
      "/api/v1/trip-invites/current/accept",
      { method: "POST", headers: { "x-wnr-invite-token": token } },
      user,
      email,
    ),
    env,
  );
}

describe("Trip API phase 3 collaboration", () => {
  let env: WorkerEnv;

  beforeEach(async () => {
    const db = createInMemoryD1() as D1Database;
    for (const name of ["0001_trips.sql", "0002_trip_shares.sql", "0003_collaboration.sql"]) {
      await db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }
    env = {
      DB: db,
      WEB_ORIGIN: "https://868656.xyz",
      AUTH_BASE_URL: "https://trip.example.test",
      INTERNAL_SMOKE_TOKEN: smokeToken,
    };
  });

  it("enforces owner/editor/viewer permissions and keeps invite plaintext out of D1", async () => {
    const trip = await createOwnerTrip(env);
    const editorToken = await invite(env, trip.id, "editor@example.com", "editor");
    expect(editorToken).toMatch(/^inv_[a-f0-9]{64}$/u);

    const storedInvite = await env.DB.prepare(
      "SELECT token_hash, token_prefix FROM trip_invites WHERE trip_id = ? LIMIT 1",
    )
      .bind(trip.id)
      .first<{ readonly token_hash: string; readonly token_prefix: string }>();
    expect(storedInvite?.token_hash).not.toContain(editorToken);
    expect(storedInvite?.token_prefix).toBe(editorToken.slice(0, 12));

    const preview = await handleRequest(
      request(
        "/api/v1/trip-invites/current",
        { headers: { "x-wnr-invite-token": editorToken } },
        "guest",
        "guest@example.com",
        false,
      ),
      env,
    );
    expect(preview.status).toBe(200);
    expect(await json(preview)).toMatchObject({
      data: { tripId: trip.id, email: "editor@example.com", role: "editor" },
    });

    const wrongEmail = await accept(env, editorToken, "editor-a", "wrong@example.com");
    expect(wrongEmail.status).toBe(403);

    const acceptedEditor = await accept(env, editorToken, "editor-a", "EDITOR@example.com");
    expect(acceptedEditor.status).toBe(201);
    expect(await json(acceptedEditor)).toMatchObject({
      data: { kind: "accepted", tripId: trip.id, role: "editor" },
    });

    const editorList = await handleRequest(
      request("/api/v1/trips?status=active", {}, "editor-a", "editor@example.com"),
      env,
    );
    expect(await json(editorList)).toMatchObject({
      data: { items: [{ id: trip.id, accessRole: "editor" }] },
    });

    const editorUpdate = await handleRequest(
      request(
        `/api/v1/trips/${trip.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            baseVersion: 1,
            locale: "en",
            document: workspace("Editor changed title"),
          }),
        },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(editorUpdate.status).toBe(200);
    expect(await json(editorUpdate)).toMatchObject({
      data: { version: 2, title: "Editor changed title", accessRole: "editor" },
    });

    const viewerToken = await invite(env, trip.id, "viewer@example.com", "viewer");
    expect((await accept(env, viewerToken, "viewer-a", "viewer@example.com")).status).toBe(201);

    const viewerRead = await handleRequest(
      request(`/api/v1/trips/${trip.id}`, {}, "viewer-a", "viewer@example.com"),
      env,
    );
    expect(viewerRead.status).toBe(200);
    expect(await json(viewerRead)).toMatchObject({ data: { accessRole: "viewer", version: 2 } });

    const viewerUpdate = await handleRequest(
      request(
        `/api/v1/trips/${trip.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            baseVersion: 2,
            locale: "en",
            document: workspace("Viewer must not write"),
          }),
        },
        "viewer-a",
        "viewer@example.com",
      ),
      env,
    );
    expect(viewerUpdate.status).toBe(403);

    const viewerArchive = await handleRequest(
      request(
        `/api/v1/trips/${trip.id}/status`,
        { method: "PATCH", body: JSON.stringify({ baseVersion: 2, status: "archived" }) },
        "viewer-a",
        "viewer@example.com",
      ),
      env,
    );
    expect(viewerArchive.status).toBe(404);

    const viewerShare = await handleRequest(
      request(`/api/v1/trips/${trip.id}/share`, { method: "POST" }, "viewer-a", "viewer@example.com"),
      env,
    );
    expect(viewerShare.status).toBe(404);

    const ownerMembers = await handleRequest(request(`/api/v1/trips/${trip.id}/members`), env);
    expect(ownerMembers.status).toBe(200);
    expect(await json(ownerMembers)).toMatchObject({
      data: {
        members: [
          { email: "editor@example.com", role: "editor" },
          { email: "viewer@example.com", role: "viewer" },
        ],
      },
    });
  });

  it("records immutable revisions and restores history as a new version", async () => {
    const trip = await createOwnerTrip(env);
    const editorToken = await invite(env, trip.id, "editor@example.com", "editor");
    expect((await accept(env, editorToken, "editor-a", "editor@example.com")).status).toBe(201);

    const changed = await handleRequest(
      request(
        `/api/v1/trips/${trip.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            baseVersion: 1,
            locale: "en",
            document: workspace("Version two"),
          }),
        },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(changed.status).toBe(200);

    const revisions = await handleRequest(
      request(`/api/v1/trips/${trip.id}/revisions`, {}, "editor-a", "editor@example.com"),
      env,
    );
    expect(await json(revisions)).toMatchObject({
      data: { items: [{ version: 2, operation: "update" }, { version: 1, operation: "create" }] },
    });

    const restored = await handleRequest(
      request(
        `/api/v1/trips/${trip.id}/revisions/1/restore`,
        { method: "POST", body: JSON.stringify({ baseVersion: 2 }) },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(restored.status).toBe(200);
    expect(await json(restored)).toMatchObject({
      data: { version: 3, title: "Collaborative Japan trip", accessRole: "editor" },
    });

    const staleRestore = await handleRequest(
      request(
        `/api/v1/trips/${trip.id}/revisions/2/restore`,
        { method: "POST", body: JSON.stringify({ baseVersion: 2 }) },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(staleRestore.status).toBe(409);

    const after = await handleRequest(
      request(`/api/v1/trips/${trip.id}/revisions`, {}, "editor-a", "editor@example.com"),
      env,
    );
    expect(await json(after)).toMatchObject({
      data: {
        items: [
          { version: 3, operation: "restore:1" },
          { version: 2, operation: "update" },
          { version: 1, operation: "create" },
        ],
      },
    });
  });

  it("lets only the owner manage roles, removals and pending invites", async () => {
    const trip = await createOwnerTrip(env);
    const editorToken = await invite(env, trip.id, "editor@example.com", "editor");
    expect((await accept(env, editorToken, "editor-a", "editor@example.com")).status).toBe(201);

    const ownerMembers = await handleRequest(request(`/api/v1/trips/${trip.id}/members`), env);
    const members = await json<{ data: { members: Array<{ userId: string }> } }>(ownerMembers);
    const editorUserId = members.data.members[0]!.userId;

    const editorCannotManage = await handleRequest(
      request(
        `/api/v1/trips/${trip.id}/members/${encodeURIComponent(editorUserId)}`,
        { method: "PATCH", body: JSON.stringify({ role: "viewer" }) },
        "editor-a",
        "editor@example.com",
      ),
      env,
    );
    expect(editorCannotManage.status).toBe(404);

    const demoted = await handleRequest(
      request(`/api/v1/trips/${trip.id}/members/${encodeURIComponent(editorUserId)}`, {
        method: "PATCH",
        body: JSON.stringify({ role: "viewer" }),
      }),
      env,
    );
    expect(demoted.status).toBe(200);

    const pendingToken = await invite(env, trip.id, "pending@example.com", "viewer");
    const pendingRows = await env.DB.prepare(
      "SELECT id FROM trip_invites WHERE token_prefix = ? AND revoked_at IS NULL LIMIT 1",
    )
      .bind(pendingToken.slice(0, 12))
      .all<{ readonly id: string }>();
    const pendingId = pendingRows.results[0]!.id;

    const revoked = await handleRequest(
      request(`/api/v1/trips/${trip.id}/invites/${pendingId}`, { method: "DELETE" }),
      env,
    );
    expect(revoked.status).toBe(200);

    const removed = await handleRequest(
      request(`/api/v1/trips/${trip.id}/members/${encodeURIComponent(editorUserId)}`, {
        method: "DELETE",
      }),
      env,
    );
    expect(removed.status).toBe(200);

    const formerMemberRead = await handleRequest(
      request(`/api/v1/trips/${trip.id}`, {}, "editor-a", "editor@example.com"),
      env,
    );
    expect(formerMemberRead.status).toBe(404);
  });
});
