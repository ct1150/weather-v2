import { describe, expect, it, vi } from "vitest";
import { handleProductAnalyticsRequest } from "./index";

const endpoint = "https://analytics.868656.xyz/api/v1/product-events";
const allowedOrigin = "https://868656.xyz";
const event = {
  event: "discovery_results_returned",
  event_version: 1,
  occurred_at: "2026-08-19T12:00:00.000Z",
  route_template: "/discover",
  locale: "en",
  origin_id: "sg-singapore",
  transport_mode: "flight",
  max_travel_minutes: 360,
  days_until_departure_bucket: "3-7d",
  trip_length_days: 3,
  rain_limit_set: true,
  wind_limit_set: false,
  temperature_limit_set: false,
  reachable_count: 12,
  result_count: 3,
};

function dependencies() {
  const writeDataPoint = vi.fn();
  return {
    writeDataPoint,
    dependencies: {
      webOrigin: allowedOrigin,
      now: () => new Date("2026-08-19T12:01:00.000Z"),
      writeDataPoint,
    },
  };
}

function post(value: unknown, origin = allowedOrigin): Request {
  return new Request(endpoint, {
    method: "POST",
    headers: { origin, "content-type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(value),
  });
}

describe("product analytics Worker", () => {
  it("accepts one validated event and writes a bounded data point", async () => {
    const test = dependencies();
    const response = await handleProductAnalyticsRequest(post(event), test.dependencies);
    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
    expect(test.writeDataPoint).toHaveBeenCalledTimes(1);
    expect(test.writeDataPoint.mock.calls[0]?.[0]).toMatchObject({
      indexes: ["discovery_results_returned"],
    });
  });

  it("rejects an unapproved origin before storage", async () => {
    const test = dependencies();
    const response = await handleProductAnalyticsRequest(
      post(event, "https://evil.example"),
      test.dependencies,
    );
    expect(response.status).toBe(403);
    expect(test.writeDataPoint).not.toHaveBeenCalled();
  });

  it("rejects privacy fields, stale timestamps and oversized bodies", async () => {
    const privacy = dependencies();
    expect(
      (
        await handleProductAnalyticsRequest(
          post({ ...event, email: "private@example.com" }),
          privacy.dependencies,
        )
      ).status,
    ).toBe(400);
    expect(privacy.writeDataPoint).not.toHaveBeenCalled();

    const stale = dependencies();
    expect(
      (
        await handleProductAnalyticsRequest(
          post({ ...event, occurred_at: "2026-08-17T12:00:00.000Z" }),
          stale.dependencies,
        )
      ).status,
    ).toBe(400);

    const oversized = dependencies();
    const response = await handleProductAnalyticsRequest(
      new Request(endpoint, {
        method: "POST",
        headers: {
          origin: allowedOrigin,
          "content-type": "text/plain",
          "content-length": "9000",
        },
        body: JSON.stringify(event),
      }),
      oversized.dependencies,
    );
    expect(response.status).toBe(413);
  });

  it("exposes health and restrictive preflight responses", async () => {
    const test = dependencies();
    const health = await handleProductAnalyticsRequest(
      new Request("https://analytics.868656.xyz/health"),
      test.dependencies,
    );
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, service: "product-analytics" });

    const options = await handleProductAnalyticsRequest(
      new Request(endpoint, { method: "OPTIONS", headers: { origin: allowedOrigin } }),
      test.dependencies,
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
  });
});
