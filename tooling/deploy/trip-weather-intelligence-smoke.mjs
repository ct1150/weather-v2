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
  console.error("PHASE5-SMOKE: --trip-url and TRIP_SMOKE_TOKEN are required");
  process.exit(1);
}

const owner = `phase5-${suffix}`;
const ownerEmail = `${owner}@smoke.invalid`;
const viewer = `phase5-viewer-${suffix}`;
const viewerEmail = `${viewer}@smoke.invalid`;
const today = new Date().toISOString().slice(0, 10);

function headers(user = owner, email = ownerEmail, extra = {}) {
  return {
    authorization: `Bearer ${token}`,
    "x-wnr-smoke-user": user,
    "x-wnr-smoke-email": email,
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

try {
  const healthResponse = await fetch(`${tripUrl}/health`);
  if (!healthResponse.ok) throw new Error(`health returned ${healthResponse.status}`);
  const health = await healthResponse.json();
  if (
    health.weatherIntelligence !== true ||
    health.weatherChangeDetection !== true ||
    health.weatherInsightDecisions !== true ||
    health.weatherMonitorBound !== true
  ) {
    throw new Error(`Phase 5 health flags are not ready: ${JSON.stringify(health)}`);
  }

  const created = await jsonRequest(
    "/api/v1/trips",
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        locale: "en",
        document: {
          version: 1,
          id: `phase5-${suffix}-local`,
          title: `Phase 5 ${suffix} smoke`,
          partyProfile: "family",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          days: [
            {
              id: "day-1",
              dayNumber: 1,
              date: today,
              cityId: "jp-tokyo",
              cityName: "Tokyo",
              countryName: "Japan",
              theme: "city",
              flexible: true,
              activities: ["09:00 Asakusa"],
              notes: "",
            },
          ],
        },
      }),
    },
    201,
  );
  const tripId = created.data?.id;
  if (typeof tripId !== "string") throw new Error("trip create did not return an id");

  const baseline = await jsonRequest(
    `/api/v1/trips/${tripId}/weather-refresh`,
    { method: "POST", headers: headers() },
    200,
  );
  if (typeof baseline.data?.snapshotId !== "string" || baseline.data.baselinesCreated !== 1) {
    throw new Error(`weather baseline was not created: ${JSON.stringify(baseline)}`);
  }

  const firstInsights = await jsonRequest(
    `/api/v1/trips/${tripId}/weather-insights`,
    { headers: headers() },
    200,
  );
  if (!Array.isArray(firstInsights.data?.items) || firstInsights.data.items.length !== 0) {
    throw new Error(`first observation must stay silent: ${JSON.stringify(firstInsights)}`);
  }

  const retry = await jsonRequest(
    `/api/v1/trips/${tripId}/weather-refresh`,
    { method: "POST", headers: headers() },
    200,
  );
  if (retry.data?.snapshotId === baseline.data.snapshotId && retry.data.observationsCreated !== 0) {
    throw new Error(`same snapshot was not idempotent: ${JSON.stringify(retry)}`);
  }

  const invited = await jsonRequest(
    `/api/v1/trips/${tripId}/invites`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email: viewerEmail, role: "viewer", locale: "en" }),
    },
    201,
  );
  const inviteToken = invited.data?.token;
  if (typeof inviteToken !== "string") throw new Error("viewer invite did not return a token");

  await jsonRequest(
    "/api/v1/trip-invites/current/accept",
    {
      method: "POST",
      headers: headers(viewer, viewerEmail, { "x-wnr-invite-token": inviteToken }),
    },
    201,
  );

  await jsonRequest(
    `/api/v1/trips/${tripId}/weather-insights`,
    { headers: headers(viewer, viewerEmail) },
    200,
  );
  await jsonRequest(
    `/api/v1/trips/${tripId}/weather-refresh`,
    { method: "POST", headers: headers(viewer, viewerEmail) },
    403,
  );
  await jsonRequest(
    `/api/v1/trips/${tripId}/weather-insights/weather_insight_0000000000000000/decision`,
    { method: "POST", headers: headers(viewer, viewerEmail) },
    403,
  );

  await jsonRequest(`/api/v1/trips/${tripId}`, { method: "DELETE", headers: headers() }, 200);

  console.log(
    `PHASE5-SMOKE: OK — ${suffix} weather baseline, service binding, idempotency and Viewer permissions verified`,
  );
} catch (error) {
  console.error(`PHASE5-SMOKE: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
