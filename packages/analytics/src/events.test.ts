// @wnr/analytics — events.test.ts
// Covers GROW-ANALYTICS-001 (allowlist + privacy-safe), ENG-PRIVACY-001
// (no PII/raw query logging), ENG-OBSERVABILITY-001 (structured logs).
import { describe, it, expect, vi } from "vitest";
import {
  validateAnalyticsEvent,
  dispatchEvent,
  toStructuredLog,
  makeStructuredLog,
  type AnalyticsEvent,
  type AnalyticsSink,
} from "./events";

/** A fully valid search_submitted event used as a baseline. */
function baseSearch(): Record<string, unknown> {
  return {
    event: "search_submitted",
    event_version: 1,
    occurred_at: "2025-07-20T00:00:00Z",
    route_template: "/[country]/[city]",
    locale: "en",
    destination_key: "tokyo",
    result_count: 12,
  };
}

describe("validateAnalyticsEvent — allowed events", () => {
  it("accepts a valid search_submitted event", () => {
    const r = validateAnalyticsEvent(baseSearch());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.event).toBe("search_submitted");
      expect(r.value.destination_key).toBe("tokyo");
      expect(r.value.result_count).toBe(12);
    }
  });

  it("collapses an unmatched destination_key to 'other'", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), destination_key: "other" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.destination_key).toBe("other");
  });

  it("accepts search_result_clicked with valid fields", () => {
    const r = validateAnalyticsEvent({
      event: "search_result_clicked",
      event_version: 1,
      occurred_at: "2025-07-20T01:00:00Z",
      route_template: "/[country]/[city]",
      locale: "ja",
      destination_id: "city_tokyo",
      result_type: "city",
      position: 3,
    });
    expect(r.ok).toBe(true);
  });

  it("accepts city_viewed / country_viewed", () => {
    const city = validateAnalyticsEvent({
      event: "city_viewed",
      event_version: 1,
      occurred_at: "2025-07-20T02:00:00Z",
      route_template: "/[country]/[city]",
      locale: "en",
      city_id: "city_tokyo",
      country_code: "JP",
    });
    expect(city.ok).toBe(true);

    const country = validateAnalyticsEvent({
      event: "country_viewed",
      event_version: 1,
      occurred_at: "2025-07-20T02:01:00Z",
      route_template: "/[country]",
      locale: "en",
      country_code: "JP",
    });
    expect(country.ok).toBe(true);
  });

  it("accepts ranking_viewed / ranking_city_clicked", () => {
    const v = validateAnalyticsEvent({
      event: "ranking_viewed",
      event_version: 1,
      occurred_at: "2025-07-20T03:00:00Z",
      route_template: "/best-weekend",
      locale: "en",
      theme: "beach",
      window: "weekend",
    });
    expect(v.ok).toBe(true);

    const c = validateAnalyticsEvent({
      event: "ranking_city_clicked",
      event_version: 1,
      occurred_at: "2025-07-20T03:01:00Z",
      route_template: "/best-weekend",
      locale: "en",
      theme: "beach",
      window: "weekend",
      city_id: "city_tokyo",
      rank: 2,
    });
    expect(c.ok).toBe(true);
  });

  it("accepts affiliate_impression / affiliate_click with null destination", () => {
    const imp = validateAnalyticsEvent({
      event: "affiliate_impression",
      event_version: 1,
      occurred_at: "2025-07-20T04:00:00Z",
      route_template: "/[country]/[city]",
      locale: "en",
      provider_id: "booking",
      category: "hotel",
      placement: "sidebar",
      destination_id: null,
    });
    expect(imp.ok).toBe(true);
    if (imp.ok) expect(imp.value.destination_id).toBeNull();

    const clk = validateAnalyticsEvent({
      event: "affiliate_click",
      event_version: 1,
      occurred_at: "2025-07-20T04:01:00Z",
      route_template: "/[country]/[city]",
      locale: "en",
      provider_id: "booking",
      category: "hotel",
      placement: "sidebar",
      destination_id: "city_tokyo",
    });
    expect(clk.ok).toBe(true);
  });

  it("accepts ad_impression", () => {
    const r = validateAnalyticsEvent({
      event: "ad_impression",
      event_version: 1,
      occurred_at: "2025-07-20T05:00:00Z",
      route_template: "/",
      locale: "en",
      network_id: "adsense",
      placement: "between_sections",
    });
    expect(r.ok).toBe(true);
  });

  it("discards unknown extra fields (only bounded fields returned)", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), some_extra: "leak", debug: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const keys = Object.keys(r.value);
      expect(keys).not.toContain("some_extra");
      expect(keys).not.toContain("debug");
    }
  });
});

describe("validateAnalyticsEvent — rejection paths", () => {
  it("rejects non-object input", () => {
    expect(validateAnalyticsEvent(null).ok).toBe(false);
    expect(validateAnalyticsEvent(42).ok).toBe(false);
    expect(validateAnalyticsEvent([]).ok).toBe(false);
  });

  it("rejects unknown event names", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), event: "nuclear_launch" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("unknown_event");
  });

  it("rejects unsupported event_version", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), event_version: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("unsupported_version");
  });

  it("rejects invalid occurred_at (non-UTC / wrong format)", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), occurred_at: "2025-07-20 00:00:00" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invalid_occurred_at");
  });

  it("rejects unknown route_template (raw URL / query)", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), route_template: "/search?q=tokyo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invalid_route_template");
  });

  it("rejects invalid locale", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), locale: "fr" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invalid_locale");
  });

  it("rejects raw search free text in destination_key", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), destination_key: "Tokyo, Japan!" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("raw_search_term_rejected");
  });

  it("rejects outsider enum theme", () => {
    const r = validateAnalyticsEvent({
      event: "ranking_viewed",
      event_version: 1,
      occurred_at: "2025-07-20T03:00:00Z",
      route_template: "/best-weekend",
      locale: "en",
      theme: "skiing",
      window: "weekend",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invalid_theme");
  });

  it("rejects wrong-typed numeric field (result_count string)", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), result_count: "12" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invalid_result_count");
  });

  it("rejects negative result_count", () => {
    const r = validateAnalyticsEvent({ ...baseSearch(), result_count: -1 });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid country_code (lowercase / wrong length)", () => {
    const r = validateAnalyticsEvent({
      event: "country_viewed",
      event_version: 1,
      occurred_at: "2025-07-20T02:00:00Z",
      route_template: "/[country]",
      locale: "en",
      country_code: "jp",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invalid_country_code");
  });
});

describe("validateAnalyticsEvent — privacy rejection (ENG-PRIVACY-001)", () => {
  const privacyKeys = [
    "ip",
    "ip_address",
    "user_location",
    "latitude",
    "longitude",
    "email",
    "user_agent",
    "cookie",
    "authorization",
    "api_key",
    "secret",
    "password",
    "credential",
    "user_id",
    "session_id",
    "device_id",
    "phone",
    "user_name",
    "address",
  ];

  for (const key of privacyKeys) {
    it(`rejects event carrying privacy field "${key}"`, () => {
      const r = validateAnalyticsEvent({ ...baseSearch(), [key]: "x" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("privacy_field_present");
    });
  }
});

describe("dispatchEvent — non-blocking (GROW-ANALYTICS-001)", () => {
  it("emits a valid event and returns true", () => {
    const emit = vi.fn();
    const sink: AnalyticsSink = { emit };
    const ok = dispatchEvent(baseSearch(), { sink });
    expect(ok).toBe(true);
    expect(emit).toHaveBeenCalledTimes(1);
    const arg = emit.mock.calls[0]?.[0] as AnalyticsEvent;
    expect(arg.event).toBe("search_submitted");
  });

  it("routes invalid events to onRejected and returns false", () => {
    const emit = vi.fn();
    const rejected = vi.fn();
    const sink: AnalyticsSink = { emit };
    const ok = dispatchEvent({ ...baseSearch(), destination_key: "Tokyo!" }, { sink, onRejected: rejected });
    expect(ok).toBe(false);
    expect(emit).not.toHaveBeenCalled();
    expect(rejected).toHaveBeenCalledTimes(1);
    const log = rejected.mock.calls[0]?.[0];
    expect(log?.status).toBe("rejected");
    expect(typeof log?.errorCode).toBe("string");
  });

  it("swallows sink emit failures and still returns true", () => {
    const sink: AnalyticsSink = {
      emit() {
        throw new Error("network down");
      },
    };
    const ok = dispatchEvent(baseSearch(), { sink });
    expect(ok).toBe(true);
  });
});

describe("structured observability (ENG-OBSERVABILITY-001)", () => {
  it("makeStructuredLog carries bounded common fields", () => {
    const log = makeStructuredLog({
      level: "info",
      service: "analytics",
      event: "search_submitted",
      status: "emitted",
      errorCode: null,
      extra: { result_count: 12 },
    });
    expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u);
    expect(log.level).toBe("info");
    expect(log.service).toBe("analytics");
    expect(log.event).toBe("search_submitted");
    expect(log.status).toBe("emitted");
    expect(log.errorCode).toBeNull();
    expect(log.result_count).toBe(12);
  });

  it("toStructuredLog flattens only bounded event dimensions (no PII)", () => {
    const r = validateAnalyticsEvent(baseSearch());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const log = toStructuredLog(r.value, "req-123");
    expect(log.service).toBe("analytics");
    expect(log.requestId).toBe("req-123");
    expect(log.event).toBe("search_submitted");
    expect(log.destination_key).toBe("tokyo");
    expect(log.result_count).toBe(12);
    // No raw free text / PII ever attached.
    expect(Object.keys(log)).not.toContain("ip");
    expect(Object.keys(log)).not.toContain("user_agent");
  });
});
