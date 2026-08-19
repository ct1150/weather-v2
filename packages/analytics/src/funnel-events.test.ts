import { describe, expect, it } from "vitest";
import { projectAnalyticsEvent, validateAnalyticsEvent } from "./events";

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
        event: "discovery_query_submitted",
        route_template: "/discover",
        origin_id: "sg-singapore",
        transport_mode: "flight",
        max_travel_minutes: 360,
        days_until_departure_bucket: "3-7d",
        trip_length_days: 3,
        rain_limit_set: true,
        wind_limit_set: false,
        temperature_limit_set: false,
      },
      {
        ...common,
        event: "discovery_results_returned",
        route_template: "/discover",
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
      },
      {
        ...common,
        event: "discovery_no_results",
        route_template: "/discover",
        origin_id: "hk-hong-kong",
        transport_mode: "flight",
        max_travel_minutes: 240,
        days_until_departure_bucket: "0-2d",
        trip_length_days: 2,
        rain_limit_set: true,
        wind_limit_set: true,
        temperature_limit_set: true,
        reachable_count: 0,
        no_result_reason: "no_reachable",
      },
      {
        ...common,
        event: "search_saved",
        route_template: "/discover",
        origin_id: "tw-taipei",
        transport_mode: "any",
        max_travel_minutes: 480,
        days_until_departure_bucket: "8-14d",
        trip_length_days: 4,
        rain_limit_set: false,
        wind_limit_set: false,
        temperature_limit_set: false,
        shortlist_count: 2,
      },
      {
        ...common,
        event: "calendar_reminder_downloaded",
        route_template: "/discover",
        origin_id: "tw-taipei",
        transport_mode: "any",
        max_travel_minutes: 480,
        days_until_departure_bucket: "8-14d",
        trip_length_days: 4,
        rain_limit_set: false,
        wind_limit_set: false,
        temperature_limit_set: false,
        shortlist_count: 2,
        reminder_count: 3,
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

  it("projects discovery events into a stable Analytics Engine schema", () => {
    const result = validateAnalyticsEvent({
      ...common,
      event: "discovery_results_returned",
      route_template: "/discover",
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
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const point = projectAnalyticsEvent(result.value);
    expect(point.indexes).toEqual(["discovery_results_returned"]);
    expect(point.blobs).toHaveLength(15);
    expect(point.doubles).toHaveLength(12);
    expect(point.blobs.slice(0, 6)).toEqual([
      "en",
      "/discover",
      "sg-singapore",
      "flight",
      "3-7d",
      "",
    ]);
    expect(point.doubles.slice(0, 4)).toEqual([360, 3, 12, 3]);
  });

  it("rejects partial discovery context and invalid retention counts", () => {
    expect(
      validateAnalyticsEvent({
        ...common,
        event: "destination_selected",
        route_template: "/discover",
        destination_id: "jp-tokyo",
        position: 1,
        origin_id: "sg-singapore",
      }),
    ).toMatchObject({ ok: false, error: { code: "incomplete_discovery_context" } });
    expect(
      validateAnalyticsEvent({
        ...common,
        event: "search_saved",
        route_template: "/discover",
        origin_id: "sg-singapore",
        transport_mode: "flight",
        max_travel_minutes: 360,
        days_until_departure_bucket: "3-7d",
        trip_length_days: 3,
        rain_limit_set: false,
        wind_limit_set: false,
        temperature_limit_set: false,
        shortlist_count: 4,
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_shortlist_count" } });
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
