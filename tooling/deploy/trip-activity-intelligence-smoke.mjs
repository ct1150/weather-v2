#!/usr/bin/env node

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "trip-url": { type: "string" },
    suffix: { type: "string", default: "smoke" },
  },
});

const tripUrl = values["trip-url"]?.replace(/\/$/u, "");
const suffix = values.suffix ?? "smoke";
const token = process.env.TRIP_SMOKE_TOKEN ?? "";

if (!tripUrl || !token) {
  console.error("PHASE7-SMOKE: --trip-url and TRIP_SMOKE_TOKEN are required");
  process.exit(1);
}

const owner = `phase7-${suffix}`;
const ownerEmail = `${owner}@smoke.invalid`;
const now = new Date().toISOString();
const today = now.slice(0, 10);

function headers(extra = {}) {
  return {
    authorization: `Bearer ${token}`,
    "x-wnr-smoke-user": owner,
    "x-wnr-smoke-email": ownerEmail,
    "content-type": "application/json",
    ...extra,
  };
}

async function jsonRequest(path, init = {}, expected = 200) {
  const response = await fetch(`${tripUrl}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (response.status !== expected) {
    throw new Error(
      `${path} returned ${response.status}, expected ${expected}: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function activity(title, environment, poiId) {
  return {
    id: "activity-day-1-1",
    title,
    cityId: "jp-kyoto",
    startTime: "14:00",
    endTime: null,
    durationMinutes: 120,
    latitude: environment === "indoor" ? 34.9875 : 35.017,
    longitude: environment === "indoor" ? 135.7415 : 135.6713,
    category: environment === "indoor" ? "attraction" : "leisure",
    environment,
    weatherSensitivity: environment === "indoor" ? [] : ["rain", "heat", "cold", "wind", "uv"],
    flexibility: "movable",
    reservation: "none",
    priority: "preferred",
    poiId,
    alternatives: [],
    notes: "",
  };
}

function document(version, title, structured) {
  return {
    version: 2,
    id: `phase7-${suffix}-local`,
    title,
    partyProfile: "family",
    createdAt: now,
    updatedAt: now,
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: today,
        cityId: "jp-kyoto",
        cityName: "Kyoto",
        countryName: "Japan",
        theme: "outdoor",
        flexible: true,
        activities: [`14:00 ${structured.title}`],
        activityItems: [structured],
        notes: "",
      },
    ],
    smokeVersion: version,
  };
}

try {
  const health = await fetch(`${tripUrl}/health`);
  if (!health.ok) throw new Error(`health returned ${health.status}`);

  const originalActivity = activity(
    "Arashiyama Bamboo Grove",
    "outdoor",
    "jp-kyoto-arashiyama",
  );
  const created = await jsonRequest(
    "/api/v1/trips",
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        locale: "en",
        document: document(1, `Phase 7 ${suffix} smoke`, originalActivity),
      }),
    },
    201,
  );
  const tripId = created.data?.id;
  if (typeof tripId !== "string" || created.data?.document?.version !== 2) {
    throw new Error(`v2 trip create failed: ${JSON.stringify(created)}`);
  }
  if (created.data?.document?.days?.[0]?.activityItems?.[0]?.poiId !== "jp-kyoto-arashiyama") {
    throw new Error(`structured activity was not persisted: ${JSON.stringify(created)}`);
  }

  const indoorActivity = activity(
    "Kyoto Railway Museum",
    "indoor",
    "jp-kyoto-railway-museum",
  );
  const updated = await jsonRequest(
    `/api/v1/trips/${tripId}`,
    {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        baseVersion: 1,
        locale: "en",
        document: document(2, `Phase 7 ${suffix} smoke updated`, indoorActivity),
      }),
    },
    200,
  );
  if (updated.data?.version !== 2) throw new Error(`v2 update did not create revision 2`);

  const revisions = await jsonRequest(
    `/api/v1/trips/${tripId}/revisions?limit=30`,
    { headers: headers() },
    200,
  );
  if (!Array.isArray(revisions.data?.items) || revisions.data.items.length < 2) {
    throw new Error(`revision history missing v2 update: ${JSON.stringify(revisions)}`);
  }

  const diff = await jsonRequest(
    `/api/v1/trips/${tripId}/revisions/2/diff`,
    { headers: headers() },
    200,
  );
  const changes = diff.data?.changes;
  if (!Array.isArray(changes) || !changes.some((change) => change.field === "day.activityItems")) {
    throw new Error(`structured activity revision diff missing: ${JSON.stringify(diff)}`);
  }

  const malformed = document(3, "Malformed", {
    ...indoorActivity,
    environment: "underwater",
  });
  await jsonRequest(
    `/api/v1/trips/${tripId}`,
    {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ baseVersion: 2, locale: "en", document: malformed }),
    },
    400,
  );

  await jsonRequest(`/api/v1/trips/${tripId}`, { method: "DELETE", headers: headers() }, 200);

  console.log(
    `PHASE7-SMOKE: OK — ${suffix} Workspace v2 create/update, structured revision diff and validation verified`,
  );
} catch (error) {
  console.error(`PHASE7-SMOKE: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
