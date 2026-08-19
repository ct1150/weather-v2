import { describe, expect, it } from "vitest";
import { validateAnalyticsEvent } from "./events";

const common = {
  event_version: 1,
  occurred_at: "2026-08-09T15:40:00Z",
  locale: "en",
};

describe("Phase 9 conversion funnel analytics", () => {
  it("accepts the bounded aggregate funnel events", () => {
    const cases = [
      {
        ...common,
        event: "weather_discovery_view",
        route_template: "/discover",
      },
      {
        ...common,
        event: "destination_shortlisted",
        route_template: "/discover",
        destination_id: "jp-tokyo",
      },
      {
        ...common,
        event: "destination_selected",
        route_template: "/discover",
        destination_id: "jp-tokyo",
        position: 1,
      },
      {
        ...common,
        event: "trip_created",
        route_template: "/discover",
        destination_count: 2,
        source: "weather_discovery",
      },
      {
        ...common,
        event: "weather_insight_opened",
        route_template: "/trips/workspace",
      },
      {
        ...common,
        event: "replan_proposed",
        route_template: "/trips/workspace",
        change_count: 2,
        fallback_included: true,
      },
      {
        ...common,
        event: "replan_accepted",
        route_template: "/trips/workspace",
        change_count: 1,
      },
    ];

    for (const value of cases) {
      const result = validateAnalyticsEvent(value);
      expect(result.ok).toBe(true);
    }
  });

  it("rejects itinerary text and sensitive user/session/location fields", () => {
    for (const forbidden of [
      { activity_title: "Senso-ji" },
      { trip_title: "Family Tokyo trip" },
      { notes: "Grandma needs wheelchair access" },
      { latitude: 35.68 },
      { longitude: 139.76 },
      { email: "person@example.com" },
      { user_id: "u-123" },
      { session_id: "s-123" },
      { device_id: "d-123" },
    ]) {
      const result = validateAnalyticsEvent({
        ...common,
        event: "replan_proposed",
        route_template: "/trips/workspace",
        change_count: 1,
        fallback_included: false,
        ...forbidden,
      });
      expect(result).toMatchObject({ ok: false, error: { code: "privacy_field_present" } });
    }
  });

  it("discards unknown non-sensitive fields rather than forwarding them", () => {
    const result = validateAnalyticsEvent({
      ...common,
      event: "destination_shortlisted",
      route_template: "/discover",
      destination_id: "jp-tokyo",
      campaign: "summer-paid-campaign",
      arbitrary: 123,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        ...common,
        event: "destination_shortlisted",
        route_template: "/discover",
        destination_id: "jp-tokyo",
      },
    });
  });

  it("fails closed on unbounded or invalid funnel dimensions", () => {
    expect(
      validateAnalyticsEvent({
        ...common,
        event: "destination_shortlisted",
        route_template: "/discover",
        destination_id: "Tokyo / raw query",
      }).ok,
    ).toBe(false);
    expect(
      validateAnalyticsEvent({
        ...common,
        event: "destination_selected",
        route_template: "/discover",
        destination_id: "jp-tokyo",
        position: 4,
      }).ok,
    ).toBe(false);
    expect(
      validateAnalyticsEvent({
        ...common,
        event: "trip_created",
        route_template: "/discover",
        destination_count: 99,
        source: "weather_discovery",
      }).ok,
    ).toBe(false);
    expect(
      validateAnalyticsEvent({
        ...common,
        event: "replan_proposed",
        route_template: "/trips/workspace",
        change_count: 0,
        fallback_included: false,
      }).ok,
    ).toBe(false);
  });
});
