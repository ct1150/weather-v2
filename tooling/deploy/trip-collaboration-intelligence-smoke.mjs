#!/usr/bin/env node

import process from "node:process";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const tripUrl = arg("--trip-url").replace(/\/$/u, "");
const suffix = arg("--suffix", "phase4").replace(/[^a-zA-Z0-9_-]+/gu, "-");
const smokeToken = process.env.TRIP_SMOKE_TOKEN ?? "";
if (!tripUrl || !smokeToken) throw new Error("Phase 4 smoke requires --trip-url and TRIP_SMOKE_TOKEN");

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const ownerUser = `p4-owner-${suffix}-${runId}`;
const editorUser = `p4-editor-${suffix}-${runId}`;
const viewerUser = `p4-viewer-${suffix}-${runId}`;
const ownerEmail = `${ownerUser}@smoke.invalid`;
const editorEmail = `${editorUser}@smoke.invalid`;
const viewerEmail = `${viewerUser}@smoke.invalid`;
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

async function invite(role, user, email) {
  const invitation = await request(`/api/v1/trips/${tripId}/invites`, {
    method: "POST",
    headers: authHeaders(ownerUser, ownerEmail),
    body: { email, role, locale: "en" },
    expected: 201,
  });
  const token = invitation.data?.token ?? "";
  requireValue(/^inv_[a-f0-9]{64}$/u.test(token), `${role} token is invalid`);
  const accepted = await request("/api/v1/trip-invites/current/accept", {
    method: "POST",
    headers: authHeaders(user, email, { "x-wnr-invite-token": token }),
    expected: 201,
  });
  requireValue(accepted.data?.role === role, `${role} invitation was not accepted`);
}

async function cleanup() {
  if (!tripId) return;
  try {
    await request(`/api/v1/trips/${tripId}`, {
      method: "DELETE",
      headers: authHeaders(ownerUser, ownerEmail),
    });
  } catch {
    // Best-effort cleanup without hiding the original smoke failure.
  }
}

try {
  const health = await request("/health");
  for (const flag of ["collaborationActivity", "tripComments", "tripDecisions", "revisionDiff"]) {
    requireValue(health[flag] === true, `${flag} health flag is not enabled`);
  }

  const document = {
    version: 1,
    id: `phase4-${runId}`,
    title: `Phase 4 ${suffix} smoke`,
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

  const created = await request("/api/v1/trips", {
    method: "POST",
    headers: authHeaders(ownerUser, ownerEmail),
    body: { locale: "en", document },
    expected: 201,
  });
  tripId = created.data?.id ?? "";
  requireValue(tripId.startsWith("trip_"), "Phase 4 trip was not created");

  await invite("editor", editorUser, editorEmail);
  await invite("viewer", viewerUser, viewerEmail);

  const version2Document = {
    ...document,
    title: `Phase 4 ${suffix} Kyoto decision`,
    updatedAt: "2026-08-08T00:02:00.000Z",
    days: [
      {
        ...document.days[0],
        cityId: "jp-kyoto",
        cityName: "Kyoto",
        activities: ["08:30 Fushimi Inari"],
      },
    ],
  };
  const updated = await request(`/api/v1/trips/${tripId}`, {
    method: "PATCH",
    headers: authHeaders(editorUser, editorEmail),
    body: { baseVersion: 1, locale: "en", document: version2Document },
  });
  requireValue(updated.data?.version === 2, "Editor update did not create version 2");

  const diff = await request(`/api/v1/trips/${tripId}/revisions/2/diff`, {
    headers: authHeaders(viewerUser, viewerEmail),
  });
  const fields = (diff.data?.changes ?? []).map((item) => item.field);
  requireValue(diff.data?.fromVersion === 1 && diff.data?.toVersion === 2, "Revision diff versions are invalid");
  requireValue(fields.includes("trip.title"), "Revision diff missed title change");
  requireValue(fields.includes("day.destination"), "Revision diff missed destination change");
  requireValue(fields.includes("day.activities"), "Revision diff missed activities change");

  const comment = await request(`/api/v1/trips/${tripId}/comments`, {
    method: "POST",
    headers: authHeaders(editorUser, editorEmail),
    body: { body: "Move the outdoor stop earlier.", dayId: "day-1", revisionVersion: 2 },
    expected: 201,
  });
  const commentId = comment.data?.id ?? "";
  requireValue(commentId.startsWith("comment_"), "Comment was not created");

  const decision = await request(`/api/v1/trips/${tripId}/decisions`, {
    method: "POST",
    headers: authHeaders(editorUser, editorEmail),
    body: {
      title: "Start Fushimi Inari at 08:30",
      detail: "Reduce heat exposure and keep the afternoon flexible.",
      dayId: "day-1",
    },
    expected: 201,
  });
  const decisionId = decision.data?.id ?? "";
  requireValue(decisionId.startsWith("decision_"), "Decision was not created");

  const viewerComments = await request(`/api/v1/trips/${tripId}/comments`, {
    headers: authHeaders(viewerUser, viewerEmail),
  });
  requireValue(viewerComments.data?.items?.[0]?.id === commentId, "Viewer cannot read comments");
  const viewerDecisions = await request(`/api/v1/trips/${tripId}/decisions`, {
    headers: authHeaders(viewerUser, viewerEmail),
  });
  requireValue(viewerDecisions.data?.items?.[0]?.id === decisionId, "Viewer cannot read decisions");

  await request(`/api/v1/trips/${tripId}/comments`, {
    method: "POST",
    headers: authHeaders(viewerUser, viewerEmail),
    body: { body: "viewer write" },
    expected: 403,
  });
  await request(`/api/v1/trips/${tripId}/decisions`, {
    method: "POST",
    headers: authHeaders(viewerUser, viewerEmail),
    body: { title: "viewer decision", detail: "" },
    expected: 403,
  });
  await request(`/api/v1/trips/${tripId}/decisions/${decisionId}`, {
    method: "PATCH",
    headers: authHeaders(viewerUser, viewerEmail),
    body: { status: "resolved" },
    expected: 403,
  });

  const resolved = await request(`/api/v1/trips/${tripId}/decisions/${decisionId}`, {
    method: "PATCH",
    headers: authHeaders(editorUser, editorEmail),
    body: { status: "resolved" },
  });
  requireValue(resolved.data?.status === "resolved", "Editor could not resolve decision");
  requireValue(resolved.data?.resolvedByEmail === editorEmail, "Decision resolver identity is missing");

  await request(`/api/v1/trips/${tripId}/comments/${commentId}`, {
    method: "DELETE",
    headers: authHeaders(ownerUser, ownerEmail),
  });
  await request(`/api/v1/trips/${tripId}/decisions/${decisionId}`, {
    method: "DELETE",
    headers: authHeaders(ownerUser, ownerEmail),
  });

  const activity = await request(`/api/v1/trips/${tripId}/activity?limit=50`, {
    headers: authHeaders(viewerUser, viewerEmail),
  });
  const kinds = (activity.data?.items ?? []).map((item) => item.kind);
  for (const kind of [
    "revision",
    "comment_created",
    "decision_created",
    "decision_resolved",
    "comment_deleted",
    "decision_deleted",
  ]) {
    requireValue(kinds.includes(kind), `Activity feed missed ${kind}`);
  }

  await cleanup();
  tripId = "";
  console.log(`Phase 4 collaboration intelligence smoke passed (${suffix}).`);
} catch (error) {
  await cleanup();
  throw error;
}
