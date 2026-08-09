import { describe, expect, it, vi } from "vitest";
import { emitProductAnalytics, WNR_ANALYTICS_BROWSER_EVENT } from "./browser-events";

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

  it("rejects privacy-sensitive payloads before browser dispatch", () => {
    const listener = vi.fn();
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
    });

    expect(accepted).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(WNR_ANALYTICS_BROWSER_EVENT, listener);
  });
});
