// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { emitProductAnalytics, WNR_ANALYTICS_BROWSER_EVENT } from "./browser-events";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("browser analytics bridge", () => {
  it("dispatches only an already-validated bounded event", () => {
    const listener = vi.fn();
    window.addEventListener(WNR_ANALYTICS_BROWSER_EVENT, listener);
    const accepted = emitProductAnalytics({
      locale: "zh-hant",
      routeTemplate: "/discover",
      fields: { event: "destination_shortlisted", destination_id: "jp-tokyo" },
      now: new Date("2026-08-09T15:45:00Z"),
    });

    expect(accepted).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({
      event: "destination_shortlisted",
      event_version: 1,
      occurred_at: "2026-08-09T15:45:00.000Z",
      route_template: "/discover",
      locale: "zh-tw",
      destination_id: "jp-tokyo",
    });
    window.removeEventListener(WNR_ANALYTICS_BROWSER_EVENT, listener);
  });

  it("uses sendBeacon for a validated event when an endpoint is configured", () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });

    const accepted = emitProductAnalytics({
      locale: "en",
      routeTemplate: "/discover",
      fields: { event: "weather_discovery_view" },
      now: new Date("2026-08-09T15:45:00Z"),
      endpoint: "https://analytics.example.test/api/v1/product-events",
    });

    expect(accepted).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]?.[0]).toBe(
      "https://analytics.example.test/api/v1/product-events",
    );
    expect(sendBeacon.mock.calls[0]?.[1]).toBeInstanceOf(Blob);
  });

  it("falls back to a non-blocking keepalive request when sendBeacon declines", () => {
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => false),
    });
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);

    expect(
      emitProductAnalytics({
        locale: "en",
        routeTemplate: "/discover",
        fields: { event: "weather_discovery_view" },
        endpoint: "https://analytics.example.test/api/v1/product-events",
      }),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://analytics.example.test/api/v1/product-events",
      expect.objectContaining({ method: "POST", keepalive: true, credentials: "omit" }),
    );
  });

  it("rejects privacy-sensitive payloads before browser dispatch or transport", () => {
    const listener = vi.fn();
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });
    window.addEventListener(WNR_ANALYTICS_BROWSER_EVENT, listener);
    const accepted = emitProductAnalytics({
      locale: "en",
      routeTemplate: "/trips/workspace",
      fields: {
        event: "replan_proposed",
        change_count: 1,
        fallback_included: false,
        activity_title: "Private itinerary detail",
      },
      now: new Date("2026-08-09T15:45:00Z"),
      endpoint: "https://analytics.example.test/api/v1/product-events",
    });

    expect(accepted).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
    window.removeEventListener(WNR_ANALYTICS_BROWSER_EVENT, listener);
  });
});
