// packages/analytics/src/affiliate-adapter.test.ts
//
// Provider-neutral Affiliate + zero-shift ad adapters
// (PRD-FR-011, GROW-AFF-001, GROW-ADS-001, ARCH-FLAG-001,
// VISION-BUSINESS-001).

import { DEFAULT_RUNTIME_CONFIG, parseRuntimeConfig } from "@wnr/config";
import { describe, expect, it } from "vitest";

import {
  buildAffiliateImpression,
  buildAffiliateClick,
  isCommercialCategory,
  isPlacement,
  parseAffiliateHref,
  resolveAdPlacement,
  resolveAffiliateLink,
  type AffiliateProviderConfig,
  type RuntimeConfig,
} from "./affiliate-adapter";

const BOOKING: AffiliateProviderConfig = {
  id: "booking",
  normalizedHostAllowlist: ["booking.com"],
  allowedPathPrefixes: ["/hotel/", "/search"],
};

const ENABLED: RuntimeConfig = parseRuntimeConfig({
  affiliates: { booking: { enabled: true } },
});

describe("Affiliate category / placement allowlist (GROW-AFF-001 / GROW-ADS-001)", () => {
  it("accepts known categories and rejects unknown ones", () => {
    expect(isCommercialCategory("hotel")).toBe(true);
    expect(isCommercialCategory("insurance")).toBe(true);
    expect(isCommercialCategory("spam")).toBe(false);
  });

  it("accepts only the five canonical placements", () => {
    expect(isPlacement("homepage")).toBe(true);
    expect(isPlacement("between_sections")).toBe(true);
    expect(isPlacement("popup")).toBe(false);
    expect(isPlacement("interstitial")).toBe(false);
  });
});

describe("Affiliate href allowlist (GROW-AFF-001 / ENG-SECURITY-001)", () => {
  it("accepts an https host + approved path", () => {
    const r = parseAffiliateHref("https://booking.com/hotel/abc", BOOKING);
    expect(r.ok).toBe(true);
  });

  it("rejects a non-https scheme", () => {
    const r = parseAffiliateHref("http://booking.com/hotel/abc", BOOKING);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("scheme_not_https");
  });

  it("rejects a host outside the allowlist (caller target)", () => {
    const r = parseAffiliateHref("https://expedia.com/hotel/abc", BOOKING);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("host_not_allowlisted");
  });

  it("rejects a path outside the approved policy", () => {
    const r = parseAffiliateHref("https://booking.com/flights/abc", BOOKING);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("path_not_approved");
  });

  it("rejects a malformed URL", () => {
    const r = parseAffiliateHref("not-a-url", BOOKING);
    expect(r.ok).toBe(false);
  });
});

describe("Affiliate resolution + kill-switch (ARCH-FLAG-001 / GROW-AFF-001)", () => {
  it("suppresses a disabled slot with zero misleading output", () => {
    const r = resolveAffiliateLink({
      providerId: "booking",
      category: "hotel",
      placement: "city_page",
      disclosure: "Sponsored",
      locale: "en",
      slot: "booking",
      config: DEFAULT_RUNTIME_CONFIG,
      provider: BOOKING,
      href: "https://booking.com/hotel/abc",
      dataState: "current",
      opensNewContext: false,
    });
    expect(r.shouldRender).toBe(false);
    expect(r.blockedByFlag).toBe(true);
    expect(r.reason).toBe("affiliate_slot_disabled");
    expect(r.href).toBeNull();
    expect(r.disclosure).toBeNull();
  });

  it("suppresses stale / empty / unauthorized data", () => {
    const base = {
      providerId: "booking" as const,
      category: "hotel" as const,
      placement: "city_page" as const,
      disclosure: "Sponsored",
      locale: "en" as const,
      slot: "booking",
      config: ENABLED,
      provider: BOOKING,
      href: "https://booking.com/hotel/abc",
      opensNewContext: false,
    };
    expect(resolveAffiliateLink({ ...base, dataState: "stale" }).reason).toBe("stale_data");
    expect(resolveAffiliateLink({ ...base, dataState: "empty" }).reason).toBe("empty_data");
    expect(resolveAffiliateLink({ ...base, dataState: "unauthorized" }).reason).toBe(
      "unauthorized_data",
    );
  });

  it("renders a valid, allowlisted, disclosed surface", () => {
    const r = resolveAffiliateLink({
      providerId: "booking",
      category: "hotel",
      placement: "city_page",
      disclosure: "Sponsored — we may earn a commission.",
      locale: "en",
      slot: "booking",
      config: ENABLED,
      provider: BOOKING,
      href: "https://booking.com/hotel/abc",
      dataState: "current",
      opensNewContext: false,
    });
    expect(r.shouldRender).toBe(true);
    expect(r.href).toBe("https://booking.com/hotel/abc");
    expect(r.rel.split(" ")).toContain("sponsored");
    expect(r.rel.split(" ")).toContain("nofollow");
    expect(r.disclosure).toBe("Sponsored — we may earn a commission.");
  });

  it("adds noopener noreferrer only for a new browsing context", () => {
    const r = resolveAffiliateLink({
      providerId: "booking",
      category: "hotel",
      placement: "city_page",
      disclosure: "Sponsored",
      locale: "en",
      slot: "booking",
      config: ENABLED,
      provider: BOOKING,
      href: "https://booking.com/hotel/abc",
      dataState: "current",
      opensNewContext: true,
    });
    expect(r.rel.split(" ")).toContain("noopener");
    expect(r.rel.split(" ")).toContain("noreferrer");
  });

  it("rejects an invalid target even when the slot is enabled", () => {
    const r = resolveAffiliateLink({
      providerId: "booking",
      category: "hotel",
      placement: "city_page",
      disclosure: "Sponsored",
      locale: "en",
      slot: "booking",
      config: ENABLED,
      provider: BOOKING,
      href: "https://evil.example/hotel/abc",
      dataState: "current",
      opensNewContext: false,
    });
    expect(r.shouldRender).toBe(false);
    expect(r.reason).toBe("host_not_allowlisted");
  });
});

describe("Localized disclosure, no invented evidence (PRD-FR-011)", () => {
  it("preserves the caller-localized disclosure verbatim", () => {
    const base = {
      providerId: "booking" as const,
      category: "hotel" as const,
      placement: "city_page" as const,
      locale: "en" as const,
      slot: "booking",
      config: ENABLED,
      provider: BOOKING,
      href: "https://booking.com/hotel/abc",
      dataState: "current" as const,
      opensNewContext: false,
    };
    const en = resolveAffiliateLink({ ...base, disclosure: "Some links are sponsored." });
    const ja = resolveAffiliateLink({
      ...base,
      disclosure: "一部のリンクはスポンサーです。",
      locale: "ja",
    });
    expect(en.disclosure).toBe("Some links are sponsored.");
    expect(ja.disclosure).toBe("一部のリンクはスポンサーです。");
  });

  it("invents no price, rating, review, or recommendation evidence", () => {
    const r = resolveAffiliateLink({
      providerId: "booking",
      category: "hotel",
      placement: "city_page",
      disclosure: "Sponsored",
      locale: "en",
      slot: "booking",
      config: ENABLED,
      provider: BOOKING,
      href: "https://booking.com/hotel/abc",
      dataState: "current",
      opensNewContext: false,
    });
    const serialized = JSON.stringify(r);
    for (const forbidden of ["price", "rating", "review", "discount", "recommendation"]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("Zero-shift advertising (GROW-ADS-001)", () => {
  it("suppresses disabled ads with zero CLS", () => {
    const r = resolveAdPlacement({
      placement: "homepage",
      config: DEFAULT_RUNTIME_CONFIG,
      hasFill: true,
      locale: "en",
    });
    expect(r.shouldRender).toBe(false);
    expect(r.reason).toBe("ads_disabled");
    expect(r.contributesCls).toBe(0);
  });

  it("suppresses a no-fill decision with zero CLS", () => {
    const cfg = parseRuntimeConfig({ advertising: { enabled: true } });
    const r = resolveAdPlacement({
      placement: "sidebar",
      config: cfg,
      hasFill: false,
      locale: "en",
    });
    expect(r.shouldRender).toBe(false);
    expect(r.reason).toBe("no_fill");
    expect(r.contributesCls).toBe(0);
  });

  it("renders a filled, enabled ad with zero CLS", () => {
    const cfg = parseRuntimeConfig({ advertising: { enabled: true } });
    const r = resolveAdPlacement({
      placement: "between_sections",
      config: cfg,
      hasFill: true,
      locale: "en",
    });
    expect(r.shouldRender).toBe(true);
    expect(r.contributesCls).toBe(0);
  });
});

describe("Allowlisted affiliate events (GROW-AFF-001)", () => {
  it("builds an impression event with the exact allowlisted shape", () => {
    const e = buildAffiliateImpression({
      providerId: "booking",
      category: "hotel",
      placement: "city_page",
      destinationId: "TYO",
    });
    expect(e).toEqual({
      event: "affiliate_impression",
      event_version: 1,
      provider_id: "booking",
      category: "hotel",
      placement: "city_page",
      destination_id: "TYO",
    });
  });

  it("preserves a null destination id on a click event", () => {
    const e = buildAffiliateClick({
      providerId: "booking",
      category: "activities",
      placement: "article",
      destinationId: null,
    });
    expect(e.event).toBe("affiliate_click");
    expect(e.event_version).toBe(1);
    expect(e.destination_id).toBeNull();
    expect(JSON.stringify(e).toLowerCase()).not.toContain("redirect");
  });
});

describe("Vision: commercial surfaces stay subordinate (VISION-BUSINESS-001)", () => {
  it("renders no commercial surface when every capability is disabled", () => {
    const aff = resolveAffiliateLink({
      providerId: "booking",
      category: "hotel",
      placement: "city_page",
      disclosure: "Sponsored",
      locale: "en",
      slot: "booking",
      config: DEFAULT_RUNTIME_CONFIG,
      provider: BOOKING,
      href: "https://booking.com/hotel/abc",
      dataState: "current",
      opensNewContext: false,
    });
    const ad = resolveAdPlacement({
      placement: "homepage",
      config: DEFAULT_RUNTIME_CONFIG,
      hasFill: true,
      locale: "en",
    });
    expect(aff.shouldRender).toBe(false);
    expect(ad.shouldRender).toBe(false);
  });

  it("never treats an unallowlisted provider as launched", () => {
    const r = resolveAffiliateLink({
      providerId: "unknown-provider",
      category: "hotel",
      placement: "city_page",
      disclosure: "Sponsored",
      locale: "en",
      slot: "booking",
      config: ENABLED,
      provider: BOOKING,
      href: "https://unknown-provider.example/hotel/abc",
      dataState: "current",
      opensNewContext: false,
    });
    expect(r.shouldRender).toBe(false);
    expect(r.reason).toBe("host_not_allowlisted");
  });
});
