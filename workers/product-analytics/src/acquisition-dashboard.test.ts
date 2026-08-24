import { describe, expect, it, vi } from "vitest";
import { parseAcquisitionContext, renderAcquisitionDashboard } from "./acquisition-dashboard";

function result(rows: ReadonlyArray<Record<string, unknown>>): D1Result<Record<string, unknown>> {
  return { success: true, meta: {}, results: [...rows] } as D1Result<Record<string, unknown>>;
}

function db(): D1Database {
  const batch = vi.fn(async () => [
    result([
      {
        channel: "organic_search",
        events: 200,
        homepage_views: 100,
        country_clicks: 35,
        country_views: 30,
        city_interactions: 15,
        city_detail_views: 6,
        shortlist_actions: 3,
      },
      {
        channel: "direct",
        events: 120,
        homepage_views: 80,
        country_clicks: 16,
        country_views: 14,
        city_interactions: 4,
        city_detail_views: 1,
        shortlist_actions: 0,
      },
    ]),
    result([
      { day: "2026-08-23", channel: "organic_search", events: 40 },
      { day: "2026-08-24", channel: "organic_search", events: 55 },
      { day: "2026-08-24", channel: "direct", events: 20 },
    ]),
    result([
      {
        landing: "/",
        channel: "organic_search",
        events: 100,
        city_detail_views: 6,
        shortlist_actions: 3,
      },
    ]),
    result([{ host: "www.google.com", events: 95 }]),
  ]);
  const prepare = vi.fn(() => ({}));
  return { batch, prepare } as unknown as D1Database;
}

describe("acquisition dashboard", () => {
  it("rejects unbounded acquisition values without rejecting the product event", () => {
    expect(
      parseAcquisitionContext({
        acquisition_channel: "organic_search",
        referrer_host: "www.google.com",
        landing_route_template: "/",
        utm_source: "google",
        utm_medium: "organic",
        utm_campaign: "weather-seo",
      }),
    ).toEqual({
      acquisitionChannel: "organic_search",
      referrerHost: "www.google.com",
      landingRouteTemplate: "/",
      utmSource: "google",
      utmMedium: "organic",
      utmCampaign: "weather-seo",
    });
  });

  it("renders source trend, quality, landing and referrer analysis", async () => {
    const html = await renderAcquisitionDashboard(db());
    expect(html).toContain("用户来源分析");
    expect(html).toContain("28 天来源趋势");
    expect(html).toContain("来源质量");
    expect(html).toContain("Landing Page × Source");
    expect(html).toContain("www.google.com");
    expect(html).toContain("35%");
    expect(html).toContain("真实生产数据");
    expect(html).toContain("不包含任何 session/user/device ID");
  });
});
