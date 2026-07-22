// apps/web/src/e2e/critical-paths.test.ts
//
// End-to-end smoke of the MVP's CRITICAL USER PATHS (ENG-TEST-001,
// ENG-OBSERVABILITY-001, ENG-RELIABILITY-001, AGENT-DOD-001).
//
// These run in the node environment and exercise the real wiring across
// packages (web -> @wnr/analytics -> @wnr/config) without any browser
// or network:
//   1. Travel Radar homepage renders crawlable primary content for every
//      async state (ready / empty / error / stale) without JavaScript —
//      the core decision works server-side (PRD-FR-001, UX-STATE-001).
//   2. Security controls protect the critical read + redirect paths
//      (ENG-SECURITY-001, ENG-BOT-001): least-privilege headers,
//      L3 rate enforcement on the high-cardinality search path, SSRF
//      rejection of caller-supplied affiliate targets, and open-redirect
//      blocking.
//   3. Bounded input validation gates the search path (API-VALIDATION-001).
//   4. The affiliate kill-switch produces a zero-shift surface
//      (ARCH-FLAG-001 / GROW-AFF-001), and the analytics sink
//      accepts only allowlisted, privacy-safe events (GROW-ANALYTICS-001).
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TravelRadarPage } from "../app/page";
import type { TravelRadarViewModel, WindowControl } from "../app/view-models";
import {
  buildSecurityHeaders,
  RateLimiter,
  checkOutboundSsrf,
  checkRedirectSafety,
} from "../security/controls";
import { parseSearchQuery, parseSlug } from "../api/v1/schemas";
import { dispatchEvent, resolveAffiliateLink } from "@wnr/analytics";
import { DEFAULT_RUNTIME_CONFIG } from "@wnr/config";

function windowControls(): WindowControl[] {
  return [
    { window: "today", label: "Today", href: "/?w=today", selected: true, exactDates: ["Jul 21"] },
    {
      window: "tomorrow",
      label: "Tomorrow",
      href: "/?w=tomorrow",
      selected: false,
      exactDates: ["Jul 22"],
    },
  ];
}

function readyViewModel(): TravelRadarViewModel {
  return {
    window: "today",
    includedDates: ["2025-07-21"],
    cards: [
      {
        destination: {
          cityId: "city_tokyo",
          countrySlug: "jp",
          citySlug: "tokyo",
          cityName: "Tokyo",
          countryName: "Japan",
          path: "/jp/tokyo",
        },
        score: { value: 82, state: "available", confidence: 0.9, reasonCodes: ["LOW_RAIN_CHANCE"] },
        weather: {
          conditionLabel: "Clear",
          temperatureMin: 22,
          temperatureMax: 30,
          rainProbability: 10,
          observedAt: "2025-07-21T00:00:00Z",
        },
        reasonCodes: ["LOW_RAIN_CHANCE"],
      },
    ],
    freshness: {
      dataUpdatedAt: "2025-07-21T00:00:00Z",
      stale: false,
      updatedLabel: "Updated just now",
    },
    state: "ready",
  };
}

function viewModelWith(state: TravelRadarViewModel["state"]): TravelRadarViewModel {
  const base = readyViewModel();
  if (state === "stale") {
    // Cards stay visible, but the time-qualification is surfaced via
    // `freshness.stale` (UX-STATE-001) — the page keys the
    // "Stale data" label off that flag, not off `state`.
    return {
      ...base,
      state,
      freshness: { ...base.freshness, stale: true, updatedLabel: "Updated 2 hours ago" },
    };
  }
  return { ...base, state, cards: state === "ready" ? base.cards : [] };
}

function render(state: TravelRadarViewModel["state"]): string {
  return renderToStaticMarkup(
    createElement(TravelRadarPage, {
      viewModel: viewModelWith(state),
      windowControls: windowControls(),
    }),
  );
}

describe("critical path — Travel Radar homepage renders without JS", () => {
  it("ready: shows the recommendation and its decision fields", () => {
    const html = render("ready");
    expect(html).toContain("Where is NOT raining?");
    expect(html).toContain("Tokyo");
    expect(html).toContain("Japan");
    expect(html).toContain("/jp/tokyo");
    expect(html).toContain("82"); // Travel Score
    expect(html).toContain("Clear"); // condition
    expect(html).toContain("10%"); // rain chance
    expect(html).toContain("Updated just now"); // freshness
  });

  it("empty: shows the no-match message (no cards)", () => {
    const html = render("empty");
    expect(html).toContain("No destinations match this window yet.");
    expect(html).not.toContain("/jp/tokyo");
  });

  it("error: shows a safe, non-leaking error message", () => {
    const html = render("error");
    expect(html).toContain("load recommendations");
    expect(html).not.toContain("/jp/tokyo");
  });

  it("stale: labels time-qualified data instead of presenting it as live", () => {
    const html = render("stale");
    expect(html).toContain("Tokyo");
    expect(html).toContain("Stale data"); // visible time-qualification (UX-STATE-001)
  });
});

describe("critical path — security guards on read + redirect flows", () => {
  it("emits least-privilege security headers for the response", () => {
    const h = buildSecurityHeaders();
    expect(h["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("enforces the L3 (search) rate limit: 30 allowed, 31st rejected", () => {
    const r = new RateLimiter();
    let last = r.tryAcquire("L3", "reader-ip", 0);
    for (let i = 0; i < 29; i++) last = r.tryAcquire("L3", "reader-ip", 0);
    expect(last.allowed).toBe(true);
    const over = r.tryAcquire("L3", "reader-ip", 0);
    expect(over.allowed).toBe(false);
  });

  it("blocks a caller-supplied outbound target before any provider call (SSRF)", () => {
    const r = checkOutboundSsrf(
      "https://api.provider.com/v1/weather",
      [{ scheme: "https", host: "api.provider.com", ports: [443], pathPrefix: "/v1" }],
      { callerSupplied: true },
    );
    expect(r.ok).toBe(false);
  });

  it("blocks an open redirect to an external host", () => {
    const r = checkRedirectSafety("https://evil.example/x", {
      sameOriginHost: "wherenotrain.example",
      allowedHosts: ["partner.example"],
    });
    expect(r.ok).toBe(false);
  });
});

describe("critical path — bounded input validation on search", () => {
  it("accepts a 2..80 Unicode query and rejects too-short input", () => {
    expect(parseSearchQuery("tokyo").ok).toBe(true);
    expect(parseSearchQuery("a").ok).toBe(false); // < 2 scalars
    expect(parseSearchQuery("   ").ok).toBe(false); // whitespace only
  });

  it("accepts a canonical slug and rejects a malformed one", () => {
    expect(parseSlug("tokyo").ok).toBe(true);
    expect(parseSlug("Tokyo").ok).toBe(false); // uppercase rejected, not coerced
    expect(parseSlug("bad slug!").ok).toBe(false);
  });
});

describe("critical path — commercial kill-switch + privacy-safe telemetry", () => {
  it("produces a zero-shift affiliate surface when the slot is disabled", () => {
    const resolved = resolveAffiliateLink({
      providerId: "booking",
      category: "hotel",
      placement: "sidebar",
      disclosure: "We may earn a commission.",
      locale: "en",
      slot: "booking",
      config: DEFAULT_RUNTIME_CONFIG, // affiliates map empty -> slot disabled
      provider: {
        id: "booking",
        normalizedHostAllowlist: ["booking.com"],
        allowedPathPrefixes: ["/"],
      },
      href: "https://booking.com/x",
      dataState: "current",
      opensNewContext: true,
    });
    expect(resolved.shouldRender).toBe(false);
    expect(resolved.href).toBeNull();
    expect(resolved.reason).toBe("affiliate_slot_disabled");
  });

  it("forwards only allowlisted, privacy-safe analytics events", () => {
    const emitted: unknown[] = [];
    const sink = { emit: (e: unknown) => void emitted.push(e) };
    const ok = dispatchEvent(
      {
        event: "search_submitted",
        event_version: 1,
        occurred_at: "2025-07-21T00:00:00Z",
        route_template: "/[country]/[city]",
        locale: "en",
        destination_key: "tokyo",
        result_count: 12,
      },
      { sink, requestId: "req-1" },
    );
    expect(ok).toBe(true);
    expect(emitted).toHaveLength(1);

    // Raw, privacy-violating, or malformed events are rejected (never forwarded).
    const rejected = dispatchEvent(
      {
        event: "search_submitted",
        event_version: 1,
        occurred_at: "2025-07-21T00:00:00Z",
        route_template: "/[country]/[city]",
        locale: "en",
        destination_key: "Tokyo, Japan!",
        result_count: 12,
      },
      { sink, requestId: "req-2" },
    );
    expect(rejected).toBe(false);
    expect(emitted).toHaveLength(1); // nothing extra forwarded
  });
});
