import { readFileSync } from "node:fs";
import { createInMemoryD1 } from "@wnr/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest, type WorkerEnv } from "./index";
import type { WeatherReadBinding } from "./weather-intelligence-service";

const smokeToken = "phase-5-smoke-token";

function workspace() {
  return {
    version: 1,
    id: "phase5-local",
    title: "Phase 5 Japan",
    partyProfile: "family",
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:01:00.000Z",
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
): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${smokeToken}`);
  headers.set("x-wnr-smoke-user", user);
  headers.set("x-wnr-smoke-email", email);
  if (init.body !== undefined && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  return new Request(`https://trip.example.test${path}`, { ...init, headers });
}

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function weatherResponse(
  snapshotId: string,
  dataUpdatedAt: string,
  rainProbability: number,
  precipitationMm: number,
): Response {
  return Response.json({
    data: {
      snapshotId,
      freshness: { dataUpdatedAt, stale: false },
      items: [
        {
          cityId: "jp-tokyo",
          date: "2026-08-12",
          temperatureMinC: 24,
          temperatureMaxC: 31,
          precipitationMm,
          rainProbability,
          windSpeedKph: 14,
          windGustKph: 22,
          uvIndex: 7,
        },
      ],
    },
  });
}

class FakeWeatherRead implements WeatherReadBinding {
  private index = 0;
  constructor(private readonly responses: ReadonlyArray<Response>) {}

  async fetch(): Promise<Response> {
    const response = this.responses[Math.min(this.index, this.responses.length - 1)];
    this.index += 1;
    if (response === undefined) throw new Error("missing fake weather response");
    return response.clone();
  }
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

async function addViewer(env: WorkerEnv, tripId: string): Promise<void> {
  const invited = await handleRequest(
    request(`/api/v1/trips/${tripId}/invites`, {
      method: "POST",
      body: JSON.stringify({ email: "viewer@example.com", role: "viewer", locale: "en" }),
    }),
    env,
  );
  const token = (await body<{ data: { token: string } }>(invited)).data.token;
  const accepted = await handleRequest(
    request(
      "/api/v1/trip-invites/current/accept",
      { method: "POST", headers: { "x-wnr-invite-token": token } },
      "viewer-a",
      "viewer@example.com",
    ),
    env,
  );
  expect(accepted.status).toBe(201);
}

describe("Trip API phase 5 weather intelligence", () => {
  let env: WorkerEnv;

  beforeEach(async () => {
    const db = createInMemoryD1() as D1Database;
    for (const name of [
      "0001_trips.sql",
      "0002_trip_shares.sql",
      "0003_collaboration.sql",
      "0004_collaboration_intelligence.sql",
      "0005_weather_intelligence.sql",
    ]) {
      await db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }
    env = {
      DB: db,
      WEB_ORIGIN: "https://868656.xyz",
      AUTH_BASE_URL: "https://trip.example.test",
      INTERNAL_SMOKE_TOKEN: smokeToken,
      WEATHER_READ: new FakeWeatherRead([
        weatherResponse("weather-snapshot-1", "2026-08-08T00:00:00.000Z", 10, 0.2),
        weatherResponse("weather-snapshot-2", "2026-08-08T06:00:00.000Z", 82, 10),
        weatherResponse("weather-snapshot-2", "2026-08-08T06:00:00.000Z", 82, 10),
      ]),
    };
  });

  it("creates a silent baseline, emits one actionable deterioration insight and stays idempotent", async () => {
    const tripId = await createTrip(env);

    const baseline = await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-refresh`, { method: "POST" }),
      env,
    );
    expect(baseline.status).toBe(200);
    expect(await body(baseline)).toMatchObject({
      data: { baselinesCreated: 1, observationsCreated: 1, insightsCreated: 0 },
    });

    const deterioration = await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-refresh`, { method: "POST" }),
      env,
    );
    expect(deterioration.status).toBe(200);
    expect(await body(deterioration)).toMatchObject({
      data: { observationsCreated: 1, insightsCreated: 1, actionableInsightsCreated: 1 },
    });

    const insights = await handleRequest(request(`/api/v1/trips/${tripId}/weather-insights`), env);
    expect(insights.status).toBe(200);
    const payload = await body<{
      data: {
        items: Array<{
          id: string;
          severity: string;
          recommendation: string;
          reasonCodes: string[];
        }>;
      };
    }>(insights);
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0]).toMatchObject({
      severity: "action",
      recommendation: "activate_plan_b",
    });
    expect(payload.data.items[0]?.reasonCodes).toEqual(
      expect.arrayContaining(["RAIN_PROBABILITY_JUMP", "HEAVY_RAIN_THRESHOLD"]),
    );

    const retry = await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-refresh`, { method: "POST" }),
      env,
    );
    expect(await body(retry)).toMatchObject({
      data: { observationsCreated: 0, insightsCreated: 0 },
    });

    const afterRetry = await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-insights`),
      env,
    );
    expect((await body<{ data: { items: unknown[] } }>(afterRetry)).data.items).toHaveLength(1);
  });

  it("keeps viewers read-only and converts an insight to exactly one Phase 4 decision", async () => {
    const tripId = await createTrip(env);
    await addViewer(env, tripId);
    await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-refresh`, { method: "POST" }),
      env,
    );
    await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-refresh`, { method: "POST" }),
      env,
    );

    const viewerList = await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-insights`, {}, "viewer-a", "viewer@example.com"),
      env,
    );
    expect(viewerList.status).toBe(200);
    const insightId = (await body<{ data: { items: Array<{ id: string }> } }>(viewerList)).data
      .items[0]!.id;

    const viewerRefresh = await handleRequest(
      request(
        `/api/v1/trips/${tripId}/weather-refresh`,
        { method: "POST" },
        "viewer-a",
        "viewer@example.com",
      ),
      env,
    );
    expect(viewerRefresh.status).toBe(403);

    const viewerDecision = await handleRequest(
      request(
        `/api/v1/trips/${tripId}/weather-insights/${insightId}/decision`,
        { method: "POST" },
        "viewer-a",
        "viewer@example.com",
      ),
      env,
    );
    expect(viewerDecision.status).toBe(403);

    const converted = await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-insights/${insightId}/decision`, { method: "POST" }),
      env,
    );
    expect(converted.status).toBe(201);
    const decisionId = (await body<{ data: { decisionId: string } }>(converted)).data.decisionId;

    const convertedAgain = await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-insights/${insightId}/decision`, { method: "POST" }),
      env,
    );
    expect(convertedAgain.status).toBe(200);
    expect(await body(convertedAgain)).toMatchObject({ data: { decisionId, existing: true } });

    const decisions = await handleRequest(request(`/api/v1/trips/${tripId}/decisions`), env);
    const decisionPayload = await body<{ data: { items: Array<{ id: string; dayId: string }> } }>(
      decisions,
    );
    expect(decisionPayload.data.items.filter((item) => item.id === decisionId)).toHaveLength(1);
    expect(decisionPayload.data.items.find((item) => item.id === decisionId)).toMatchObject({
      dayId: "day-1",
    });
  });

  it("hides private weather intelligence from non-members and advertises phase 5 capabilities", async () => {
    const tripId = await createTrip(env);
    const hidden = await handleRequest(
      request(`/api/v1/trips/${tripId}/weather-insights`, {}, "stranger", "stranger@example.com"),
      env,
    );
    expect(hidden.status).toBe(404);

    const health = await handleRequest(new Request("https://trip.example.test/health"), env);
    expect(await body(health)).toMatchObject({
      weatherIntelligence: true,
      weatherChangeDetection: true,
      weatherInsightDecisions: true,
    });
  });
});
