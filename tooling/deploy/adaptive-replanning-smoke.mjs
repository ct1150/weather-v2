#!/usr/bin/env node

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "trip-url": { type: "string" },
    "read-url": { type: "string" },
    suffix: { type: "string", default: "smoke" },
  },
});

const tripUrl = values["trip-url"]?.replace(/\/$/u, "");
const readUrl = values["read-url"]?.replace(/\/$/u, "");
const suffix = values.suffix ?? "smoke";
const token = process.env.TRIP_SMOKE_TOKEN ?? "";

if (!tripUrl || !readUrl || !token) {
  console.error("PHASE8-SMOKE: --trip-url, --read-url and TRIP_SMOKE_TOKEN are required");
  process.exit(1);
}

const owner = `phase8-owner-${suffix}`;
const ownerEmail = `${owner}@smoke.invalid`;
const editor = `phase8-editor-${suffix}`;
const editorEmail = `${editor}@smoke.invalid`;
const viewer = `phase8-viewer-${suffix}`;
const viewerEmail = `${viewer}@smoke.invalid`;
const now = new Date().toISOString();
const today = now.slice(0, 10);
let tripId = null;

function headers(user = owner, email = ownerEmail, extra = {}) {
  return {
    authorization: `Bearer ${token}`,
    "x-wnr-smoke-user": user,
    "x-wnr-smoke-email": email,
    "content-type": "application/json",
    ...extra,
  };
}

async function jsonRequest(base, path, init = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (response.status !== expected) {
    throw new Error(
      `${path} returned ${response.status}, expected ${expected}: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function activity(id, title, startTime, options = {}) {
  return {
    id,
    title,
    cityId: "jp-tokyo",
    startTime,
    endTime: null,
    durationMinutes: options.durationMinutes ?? 60,
    latitude: options.latitude ?? 35.6812,
    longitude: options.longitude ?? 139.7671,
    category: options.category ?? "leisure",
    environment: options.environment ?? "outdoor",
    weatherSensitivity: options.weatherSensitivity ?? ["rain", "heat", "wind", "uv"],
    flexibility: options.flexibility ?? "movable",
    reservation: options.reservation ?? "none",
    priority: options.priority ?? "preferred",
    poiId: options.poiId ?? null,
    alternatives: [],
    notes: "",
  };
}

function document(startTime, updatedAt = now) {
  const garden = activity("garden", "Weather-sensitive garden", startTime);
  const train = activity("fixed-train", "Fixed airport train", "18:00", {
    category: "transport",
    environment: "indoor",
    weatherSensitivity: [],
    flexibility: "fixed",
    reservation: "required",
    priority: "must",
  });
  return {
    version: 2,
    id: `phase8-${suffix}-local`,
    title: `Phase 8 ${suffix} adaptive smoke`,
    partyProfile: "family",
    createdAt: now,
    updatedAt,
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: today,
        cityId: "jp-tokyo",
        cityName: "Tokyo",
        countryName: "Japan",
        theme: "outdoor",
        flexible: true,
        activities: [`${startTime} Weather-sensitive garden`, "18:00 Fixed airport train"],
        activityItems: [garden, train],
        notes: "Fixed train must remain unchanged.",
      },
    ],
  };
}

async function inviteMember(role, user, email) {
  const invited = await jsonRequest(
    tripUrl,
    `/api/v1/trips/${tripId}/invites`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, role, locale: "en" }),
    },
    201,
  );
  const inviteToken = invited.data?.token;
  if (typeof inviteToken !== "string") throw new Error(`${role} invite did not return a token`);
  await jsonRequest(
    tripUrl,
    "/api/v1/trip-invites/current/accept",
    {
      method: "POST",
      headers: headers(user, email, { "x-wnr-invite-token": inviteToken }),
    },
    201,
  );
}

function hourText(localTime) {
  const match = /T(\d{2}):/u.exec(localTime);
  return match?.[1] ? `${match[1]}:00` : null;
}

try {
  const health = await jsonRequest(tripUrl, "/health");
  if (
    health.workspaceV2 !== true ||
    health.activityIntelligence !== true ||
    health.adaptiveReplanningApply !== true
  ) {
    throw new Error(`Phase 8 health capabilities are not ready: ${JSON.stringify(health)}`);
  }

  const hourly = await jsonRequest(
    readUrl,
    `/api/v1/trip-hourly?cityIds=jp-tokyo&date=${today}&startHour=8&endHour=12&locale=en`,
  );
  const weatherSnapshotId = hourly.data?.snapshotId;
  const rows = Array.isArray(hourly.data?.items) ? hourly.data.items : [];
  if (
    typeof weatherSnapshotId !== "string" ||
    !hourly.data?.coverage?.availableCityIds?.includes("jp-tokyo") ||
    rows.length < 2
  ) {
    throw new Error(`real hourly Tokyo coverage is unavailable: ${JSON.stringify(hourly)}`);
  }

  const ordered = rows
    .map((row) => ({
      ...row,
      startTime: hourText(row.localTime),
      rain: typeof row.rainProbability === "number" ? row.rainProbability : 101,
    }))
    .filter((row) => row.startTime !== null)
    .sort((left, right) => left.localTime.localeCompare(right.localTime));
  if (ordered.length < 2) throw new Error("not enough bounded hourly rows for deterministic smoke proposal");
  const originalStart = ordered[0].startTime;
  const later = ordered.slice(1).sort((left, right) => left.rain - right.rain || left.localTime.localeCompare(right.localTime));
  const ownerTarget = later[0]?.startTime;
  if (typeof originalStart !== "string" || typeof ownerTarget !== "string") {
    throw new Error("could not derive deterministic same-day later proposal from real hourly rows");
  }

  const created = await jsonRequest(
    tripUrl,
    "/api/v1/trips",
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ locale: "en", document: document(originalStart) }),
    },
    201,
  );
  tripId = created.data?.id;
  if (typeof tripId !== "string") throw new Error("Workspace v2 create did not return a trip id");

  const ownerApplied = await jsonRequest(
    tripUrl,
    `/api/v1/trips/${tripId}/replan/apply`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        baseVersion: 1,
        locale: "en",
        document: document(ownerTarget, new Date().toISOString()),
        weatherSnapshotId,
        selectedChangeIds: ["garden"],
      }),
    },
    200,
  );
  if (ownerApplied.data?.version !== 2) throw new Error("Owner replan did not create version 2");
  const ownerItems = ownerApplied.data?.document?.days?.[0]?.activityItems;
  if (ownerItems?.[0]?.startTime !== ownerTarget || ownerItems?.[1]?.startTime !== "18:00") {
    throw new Error(`Owner replan changed the wrong activity: ${JSON.stringify(ownerApplied)}`);
  }

  await inviteMember("editor", editor, editorEmail);
  await inviteMember("viewer", viewer, viewerEmail);

  const ownerTargetMinutes = Number(ownerTarget.slice(0, 2)) * 60;
  const editorTargetMinutes = Math.min(17 * 60, ownerTargetMinutes + 60);
  const editorTarget = `${String(Math.floor(editorTargetMinutes / 60)).padStart(2, "0")}:00`;
  if (editorTarget === ownerTarget) throw new Error("could not derive a second later editor target");

  const editorApplied = await jsonRequest(
    tripUrl,
    `/api/v1/trips/${tripId}/replan/apply`,
    {
      method: "POST",
      headers: headers(editor, editorEmail),
      body: JSON.stringify({
        baseVersion: 2,
        locale: "en",
        document: document(editorTarget, new Date().toISOString()),
        weatherSnapshotId,
        selectedChangeIds: ["garden"],
      }),
    },
    200,
  );
  if (editorApplied.data?.version !== 3) throw new Error("Editor replan did not create version 3");
  if (editorApplied.data?.document?.days?.[0]?.activityItems?.[1]?.startTime !== "18:00") {
    throw new Error("Editor replan moved the fixed transport activity");
  }

  await jsonRequest(
    tripUrl,
    `/api/v1/trips/${tripId}/replan/apply`,
    {
      method: "POST",
      headers: headers(viewer, viewerEmail),
      body: JSON.stringify({
        baseVersion: 3,
        locale: "en",
        document: document("17:00", new Date().toISOString()),
        weatherSnapshotId,
        selectedChangeIds: ["garden"],
      }),
    },
    403,
  );

  const stale = await jsonRequest(
    tripUrl,
    `/api/v1/trips/${tripId}/replan/apply`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        baseVersion: 1,
        locale: "en",
        document: document("17:00", new Date().toISOString()),
        weatherSnapshotId,
        selectedChangeIds: ["garden"],
      }),
    },
    409,
  );
  if (stale.error?.currentVersion !== 3) {
    throw new Error(`stale replan did not report current version 3: ${JSON.stringify(stale)}`);
  }

  const revisions = await jsonRequest(
    tripUrl,
    `/api/v1/trips/${tripId}/revisions?limit=10`,
    { headers: headers() },
  );
  const revisionItems = revisions.data?.items;
  if (
    !Array.isArray(revisionItems) ||
    revisionItems[0]?.version !== 3 ||
    revisionItems[0]?.operation !== "replan" ||
    revisionItems[1]?.version !== 2 ||
    revisionItems[1]?.operation !== "replan"
  ) {
    throw new Error(`normal replan revision history is missing: ${JSON.stringify(revisions)}`);
  }

  const activityFeed = await jsonRequest(
    tripUrl,
    `/api/v1/trips/${tripId}/activity?limit=20`,
    { headers: headers() },
  );
  const latestReplan = activityFeed.data?.items?.find(
    (item) => item.kind === "revision" && item.payload?.operation === "replan",
  );
  if (
    latestReplan?.payload?.weatherSnapshotId !== weatherSnapshotId ||
    !Array.isArray(latestReplan?.payload?.selectedChangeIds) ||
    latestReplan.payload.selectedChangeIds[0] !== "garden"
  ) {
    throw new Error(`replan audit is missing real weather snapshot context: ${JSON.stringify(activityFeed)}`);
  }

  await jsonRequest(
    tripUrl,
    `/api/v1/trips/${tripId}`,
    { method: "DELETE", headers: headers() },
    200,
  );
  tripId = null;

  console.log(
    `PHASE8-SMOKE: OK — ${suffix} real hourly snapshot -> deterministic later proposal -> Owner/Editor apply -> fixed constraint -> Viewer/stale guard -> normal revision audit verified`,
  );
} catch (error) {
  if (tripId !== null) {
    try {
      await jsonRequest(
        tripUrl,
        `/api/v1/trips/${tripId}`,
        { method: "DELETE", headers: headers() },
        200,
      );
    } catch {
      // Best-effort cleanup must not hide the original failure.
    }
  }
  console.error(`PHASE8-SMOKE: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
