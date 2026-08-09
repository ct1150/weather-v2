import { describe, expect, it } from "vitest";
import { parseCommercialOffers, resolveContextualAffiliateSurface } from "./contextual-affiliate";

const validOffer = {
  id: "tokyo-hotel-offer",
  providerId: "provider-a",
  category: "hotel",
  slot: "discovery.hotel",
  destinationId: "jp-tokyo",
  href: "https://travel.example/hotels/tokyo?campaign=wnr",
  dataState: "current",
  normalizedHostAllowlist: ["travel.example"],
  allowedPathPrefixes: ["/hotels/"],
};

const decidedContext = {
  stage: "discovery_decided" as const,
  destinationId: "jp-tokyo",
  hasDestinationDecision: true,
  hasTrip: true,
  hasStructuredActivities: false,
  carDependent: false,
  weatherAction: "none" as const,
  indoorFallbackAvailable: false,
  tripStartsWithinDays: null,
};

describe("contextual Affiliate product surface", () => {
  it("renders nothing when no offer catalog is configured", () => {
    expect(
      resolveContextualAffiliateSurface({
        context: decidedContext,
        locale: "en",
        rawOffers: "",
        enabledSlots: "discovery.hotel",
      }),
    ).toEqual([]);
  });

  it("renders nothing while the contextual slot kill-switch is disabled", () => {
    expect(
      resolveContextualAffiliateSurface({
        context: decidedContext,
        locale: "en",
        rawOffers: JSON.stringify([validOffer]),
        enabledSlots: "",
      }),
    ).toEqual([]);
  });

  it("resolves a valid contextual offer through the existing Affiliate allowlist", () => {
    const result = resolveContextualAffiliateSurface({
      context: decidedContext,
      locale: "zh-cn",
      rawOffers: JSON.stringify([validOffer]),
      enabledSlots: "discovery.hotel",
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: "tokyo-hotel-offer",
        providerId: "provider-a",
        category: "hotel",
        destinationId: "jp-tokyo",
        href: "https://travel.example/hotels/tokyo?campaign=wnr",
        rel: "sponsored nofollow noopener noreferrer",
        cta: "查看酒店",
      }),
    ]);
    expect(result[0]?.disclosure).toContain("推广链接");
  });

  it("suppresses a candidate whose outbound host is not allowlisted", () => {
    expect(
      resolveContextualAffiliateSurface({
        context: decidedContext,
        locale: "en",
        rawOffers: JSON.stringify([
          {
            ...validOffer,
            href: "https://evil.example/hotels/tokyo",
          },
        ]),
        enabledSlots: "discovery.hotel",
      }),
    ).toEqual([]);
  });

  it("suppresses stale/no-fill-style commercial data without leaving a surface", () => {
    for (const dataState of ["stale", "empty", "unauthorized"] as const) {
      expect(
        resolveContextualAffiliateSurface({
          context: decidedContext,
          locale: "en",
          rawOffers: JSON.stringify([{ ...validOffer, dataState }]),
          enabledSlots: "discovery.hotel",
        }),
      ).toEqual([]);
    }
  });

  it("does not let an offer force a category that the product context did not authorize", () => {
    const weatherContext = {
      ...decidedContext,
      stage: "weather_replan" as const,
      hasDestinationDecision: false,
      weatherAction: "indoor_fallback" as const,
      indoorFallbackAvailable: true,
    };
    const insuranceOffer = {
      ...validOffer,
      id: "weather-insurance",
      category: "insurance",
      slot: "weather.insurance",
    };

    expect(
      resolveContextualAffiliateSurface({
        context: weatherContext,
        locale: "en",
        rawOffers: JSON.stringify([insuranceOffer]),
        enabledSlots: "weather.insurance",
      }),
    ).toEqual([]);
  });

  it("fails closed on malformed catalog rows", () => {
    expect(parseCommercialOffers("not-json")).toEqual([]);
    expect(parseCommercialOffers(JSON.stringify([{ ...validOffer, destinationId: "Tokyo / raw" }]))).toEqual(
      [],
    );
    expect(
      parseCommercialOffers(
        JSON.stringify([{ ...validOffer, normalizedHostAllowlist: ["https://travel.example"] }]),
      ),
    ).toEqual([]);
  });
});
