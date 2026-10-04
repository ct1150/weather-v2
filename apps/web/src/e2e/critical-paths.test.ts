import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dispatchEvent, resolveAffiliateLink } from "@wnr/analytics";
import { DEFAULT_RUNTIME_CONFIG } from "@wnr/config";
import { TravelRadarPage } from "../app/page";
import { parseSearchQuery, parseSlug } from "../api/v1/schemas";
import {
  buildSecurityHeaders,
  checkOutboundSsrf,
  checkRedirectSafety,
  RateLimiter,
} from "../security/controls";

const countryLinks = [
  {
    countryId: "JP",
    slug: "jp",
    name: "Japan",
    path: "/jp",
    summary: "Compare Japan's popular destinations on one weather map.",
    cityCount: 8,
    cityNames: ["Sapporo", "Osaka", "Tokyo", "Okinawa"],
    weatherScore: 82,
    weatherStatus: "excellent" as const,
  },
] as const;

function renderHome(): string {
  return renderToStaticMarkup(createElement(TravelRadarPage, { countryLinks }));
}

describe("critical path — time-driven homepage renders without JavaScript", () => {
  it("renders the weather-period controls, real-map enhancement and crawlable country links", () => {
    const html = renderHome();
    expect(html).toContain("Pick the dates. See where it stays drier.");
    expect(html).toContain("Next 7 days");
    expect(html).toContain("This weekend");
    expect(html).toContain("Custom dates");
    expect(html).toContain("data-home-weather-window");
    expect(html).toContain("World travel weather overview");
    expect(html).toContain("data-world-weather-map-canvas");
    expect(html).not.toContain("world-weather-country-shape");
    expect(html).toContain("Japan");
    expect(html).toContain("Sapporo · Osaka · Tokyo");
    expect(html).toContain('href="/jp"');
    expect(html).not.toContain('href="/discover"');
    expect(html).not.toContain("Starting city");
    expect(html).not.toContain("Max one-way planning time");
  });
});

describe("critical path — security guards on read and redirect flows", () => {
  it("emits least-privilege security headers", () => {
    const headers = buildSecurityHeaders();
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("enforces the L3 search rate limit", () => {
    const limiter = new RateLimiter();
    let last = limiter.tryAcquire("L3", "reader-ip", 0);
    for (let index = 0; index < 29; index += 1) {
      last = limiter.tryAcquire("L3", "reader-ip", 0);
    }
    expect(last.allowed).toBe(true);
    expect(limiter.tryAcquire("L3", "reader-ip", 0).allowed).toBe(false);
  });

  it("blocks caller-supplied outbound targets", () => {
    const result = checkOutboundSsrf(
      "https://api.provider.com/v1/weather",
      [{ scheme: "https", host: "api.provider.com", ports: [443], pathPrefix: "/v1" }],
      { callerSupplied: true },
    );
    expect(result.ok).toBe(false);
  });

  it("blocks an open redirect", () => {
    const result = checkRedirectSafety("https://evil.example/x", {
      sameOriginHost: "wherenotrain.example",
      allowedHosts: ["partner.example"],
    });
    expect(result.ok).toBe(false);
  });
});

describe("critical path — bounded input validation", () => {
  it("accepts bounded Unicode search text and rejects too-short input", () => {
    expect(parseSearchQuery("tokyo").ok).toBe(true);
    expect(parseSearchQuery("a").ok).toBe(false);
    expect(parseSearchQuery("   ").ok).toBe(false);
  });

  it("accepts canonical slugs and rejects malformed slugs", () => {
    expect(parseSlug("tokyo").ok).toBe(true);
    expect(parseSlug("Tokyo").ok).toBe(false);
    expect(parseSlug("bad slug!").ok).toBe(false);
  });
});

describe("critical path — commercial kill switch and privacy-safe telemetry", () => {
  it("produces a zero-shift affiliate surface when disabled", () => {
    const resolved = resolveAffiliateLink({
      providerId: "booking",
      category: "hotel",
      placement: "sidebar",
      disclosure: "We may earn a commission.",
      locale: "en",
      slot: "booking",
      config: DEFAULT_RUNTIME_CONFIG,
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

  it("accepts bounded country-map telemetry and rejects privacy violations", () => {
    const emitted: unknown[] = [];
    const sink = { emit: (event: unknown) => void emitted.push(event) };
    const accepted = dispatchEvent(
      {
        event: "country_viewed",
        event_version: 1,
        occurred_at: "2026-08-20T00:00:00Z",
        route_template: "/[country]",
        locale: "en",
        country_code: "JP",
      },
      { sink, requestId: "req-country" },
    );
    expect(accepted).toBe(true);
    expect(emitted).toHaveLength(1);

    const rejected = dispatchEvent(
      {
        event: "country_viewed",
        event_version: 1,
        occurred_at: "2026-08-20T00:00:00Z",
        route_template: "/[country]",
        locale: "en",
        country_code: "JP",
        email: "private@example.com",
      },
      { sink, requestId: "req-private" },
    );
    expect(rejected).toBe(false);
    expect(emitted).toHaveLength(1);
  });
});
