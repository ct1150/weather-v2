#!/usr/bin/env node

import process from "node:process";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const tripUrl = arg("--trip-url").replace(/\/$/u, "");
const suffix = arg("--suffix", "smoke").replace(/[^a-zA-Z0-9_-]+/gu, "-");
const smokeToken = process.env.TRIP_SMOKE_TOKEN ?? "";

if (!tripUrl || !smokeToken) {
  throw new Error("trip-collaboration-smoke requires --trip-url and TRIP_SMOKE_TOKEN");
}

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const ownerUser = `phase3-owner-${suffix}-${runId}`;
const editorUser = `phase3-editor-${suffix}-${runId}`;
const viewerUser = `phase3-viewer-${suffix}-${runId}`;
const ownerEmail = `${ownerUser}@smoke.invalid`;
const editorEmail = `${editorUser}@smoke.invalid`;
const viewerEmail = `${viewerUser}@smoke.invalid`;
const pendingEmail = `phase3-pending-${suffix}-${runId}@smoke.invalid`;
let tripId = "";

function authHeaders(user, email, extra = {}) {
  return {
    authorization: `Bearer ${smokeToken}`,
    "x-wnr-smoke-user": user,
    "x-wnr-smoke-email": email,
    ...extra,
  };
}

async function request(path, { method = "GET", headers = {}, body, expected = 200 } = {}) {
  const response = await fetch(`${tripUrl}${path}`, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status !== expected) {
    throw new Error(`${method} ${path} returned ${response.status}; expected ${expected}`);
  }
  return payload;
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  if (!tripId) return;
  try {
    await request(`/api/v1/trips/${tripId}`, {
      method: "DELETE",
      headers: authHeaders(ownerUser, ownerEmail),
      expected: 200,
    });
  } catch {
    // Best-effort cleanup. Never hide the original smoke failure.
  }
}

try {
  const health = await request("/health");
  requireValue(health.cloudTrip === true, "cloudTrip health flag is not enabled");
  requireValue(health.cloudSharing === true, "cloudSharing health flag is not enabled");
  requireValue(health.cloudCollaboration === true, "cloudCollaboration health flag is not enabled");
  requireValue(health.revisionHistory === true, "revisionHistory health flag is not enabled");

  const document = {
    version: 1,
    id: `phase3-${runId}`,
    title: `Phase 3 ${suffix} collaboration smoke`,
    partyProfile: "adults",
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

  const created = await request("/api/v1/trips", {
    method: "POST",
    headers: authHeaders(ownerUser, ownerEmail),
    body: { locale: "en", document },
    expected: 201,
  });
  tripId = created.data?.id ?? "";
  requireValue(tripId.startsWith("trip_"), "owner trip was not created");
  requireValue(created.data?.version === 1, "owner trip did not start at version 1");
  requireValue(created.data?.accessRole === "owner", "owner access role missing");

  const editorInvite = await request(`/api/v1/trips/${tripId}/invites`, {
    method: "POST",
    headers: authHeaders(ownerUser, ownerEmail),
    body: { email: editorEmail, role: "editor", locale: "en" },
    expected: 201,
  });
  const editorToken = editorInvite.data?.token ?? "";
  requireValue(/^inv_[a-f0-9]{64}$/u.test(editorToken), "editor invite token is invalid");

  const invitePreview = await request("/api/v1/trip-invites/current", {
    headers: { "x-wnr-invite-token": editorToken },
  });
  requireValue(invitePreview.data?.tripId === tripId, "invite preview trip mismatch");
  requireValue(invitePreview.data?.email === editorEmail, "invite preview email mismatch");
  requireValue(invitePreview.data?.role === "editor", "invite preview role mismatch");

  await request("/api/v1/trip-invites/current/accept", {
    method: "POST",
    headers: authHeaders(editorUser, `wrong-${editorEmail}`, {
      "x-wnr-invite-token": editorToken,
    }),
    expected: 403,
  });

  const acceptedEditor = await request("/api/v1/trip-invites/current/accept", {
    method: "POST",
    headers: authHeaders(editorUser, editorEmail, { "x-wnr-invite-token": editorToken }),
    expected: 201,
  });
  requireValue(acceptedEditor.data?.role === "editor", "editor invite was not accepted");

  const editorTrips = await request("/api/v1/trips?status=active&limit=50", {
    headers: authHeaders(editorUser, editorEmail),
  });
  const editorTrip = editorTrips.data?.items?.find((item) => item.id === tripId);
  requireValue(editorTrip?.accessRole === "editor", "editor trip is missing from My Trips");

  const editorDocument = {
    ...document,
    title: `Phase 3 ${suffix} editor update`,
    updatedAt: "2026-08-08T00:01:00.000Z",
  };
  const editorUpdate = await request(`/api/v1/trips/${tripId}`, {
    method: "PATCH",
    headers: authHeaders(editorUser, editorEmail),
    body: { baseVersion: 1, locale: "en", document: editorDocument },
  });
  requireValue(editorUpdate.data?.version === 2, "editor update did not create version 2");
  requireValue(editorUpdate.data?.accessRole === "editor", "editor update lost access role");

  const viewerInvite = await request(`/api/v1/trips/${tripId}/invites`, {
    method: "POST",
    headers: authHeaders(ownerUser, ownerEmail),
    body: { email: viewerEmail, role: "viewer", locale: "en" },
    expected: 201,
  });
  const viewerToken = viewerInvite.data?.token ?? "";
  requireValue(/^inv_[a-f0-9]{64}$/u.test(viewerToken), "viewer invite token is invalid");

  const acceptedViewer = await request("/api/v1/trip-invites/current/accept", {
    method: "POST",
    headers: authHeaders(viewerUser, viewerEmail, { "x-wnr-invite-token": viewerToken }),
    expected: 201,
  });
  requireValue(acceptedViewer.data?.role === "viewer", "viewer invite was not accepted");

  await request(`/api/v1/trips/${tripId}`, {
    method: "PATCH",
    headers: authHeaders(viewerUser, viewerEmail),
    body: { baseVersion: 2, locale: "en", document: { ...document, title: "viewer write" } },
    expected: 403,
  });

  await request(`/api/v1/trips/${tripId}/members`, {
    headers: authHeaders(editorUser, editorEmail),
    expected: 404,
  });
  await request(`/api/v1/trips/${tripId}`, {
    method: "DELETE",
    headers: authHeaders(editorUser, editorEmail),
    expected: 404,
  });

  const revisionsBeforeRestore = await request(`/api/v1/trips/${tripId}/revisions?limit=30`, {
    headers: authHeaders(editorUser, editorEmail),
  });
  requireValue(revisionsBeforeRestore.data?.items?.[0]?.version === 2, "revision 2 is missing");
  requireValue(revisionsBeforeRestore.data?.items?.[1]?.version === 1, "revision 1 is missing");

  const restored = await request(`/api/v1/trips/${tripId}/revisions/1/restore`, {
    method: "POST",
    headers: authHeaders(editorUser, editorEmail),
    body: { baseVersion: 2 },
  });
  requireValue(restored.data?.version === 3, "revision restore did not create version 3");
  requireValue(restored.data?.title === document.title, "revision restore did not restore version 1");

  await request(`/api/v1/trips/${tripId}/revisions/2/restore`, {
    method: "POST",
    headers: authHeaders(editorUser, editorEmail),
    body: { baseVersion: 2 },
    expected: 409,
  });

  const ownerMembers = await request(`/api/v1/trips/${tripId}/members`, {
    headers: authHeaders(ownerUser, ownerEmail),
  });
  requireValue(ownerMembers.data?.members?.length === 2, "owner does not see both collaborators");

  const pendingInvite = await request(`/api/v1/trips/${tripId}/invites`, {
    method: "POST",
    headers: authHeaders(ownerUser, ownerEmail),
    body: { email: pendingEmail, role: "viewer", locale: "en" },
    expected: 201,
  });
  const pendingInviteId = pendingInvite.data?.id ?? "";
  requireValue(pendingInviteId.startsWith("invite_"), "pending invite id missing");
  await request(`/api/v1/trips/${tripId}/invites/${pendingInviteId}`, {
    method: "DELETE",
    headers: authHeaders(ownerUser, ownerEmail),
  });

  const revisionsAfterRestore = await request(`/api/v1/trips/${tripId}/revisions?limit=30`, {
    headers: authHeaders(viewerUser, viewerEmail),
  });
  requireValue(revisionsAfterRestore.data?.items?.[0]?.version === 3, "restored revision is missing");
  requireValue(
    revisionsAfterRestore.data?.items?.[0]?.operation === "restore:1",
    "restore operation metadata is missing",
  );

  await cleanup();
  tripId = "";
  console.log(`Phase 3 collaboration smoke passed (${suffix}).`);
} catch (error) {
  await cleanup();
  throw error;
}
