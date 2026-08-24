import { describe, expect, it, vi } from "vitest";
import {
  buildGrowthDashboardSnapshot,
  handleGrowthDashboardRequest,
  renderGrowthDashboardHtml,
} from "./growth-dashboard";

function result(rows: ReadonlyArray<Record<string, unknown>>): D1Result<Record<string, unknown>> {
  return {
    success: true,
    meta: {},
    results: [...rows],
  } as D1Result<Record<string, unknown>>;
}

function dbWithPeriods(input?: {
  readonly homepageViews?: number;
  readonly countryClicks?: number;
  readonly countryViews?: number;
  readonly cityInteractions?: number;
  readonly cityDetailViews?: number;
  readonly shortlistActions?: number;
}): D1Database {
  const metrics = {
    homepage_views: input?.homepageViews ?? 1000,
    country_clicks: input?.countryClicks ?? 300,
    country_views: input?.countryViews ?? 280,
    city_interactions: input?.cityInteractions ?? 140,
    city_detail_views: input?.cityDetailViews ?? 35,
    shortlist_actions: input?.shortlistActions ?? 28,
  };
  const batch = vi.fn(async () => [
    result([metrics]),
    result([
      { id: "jp", events: 120 },
      { id: "th", events: 80 },
    ]),
    result([
      { id: "tokyo", events: 60 },
      { id: "bangkok", events: 45 },
    ]),
  ]);
  return { batch } as unknown as D1Database;
}

describe("growth dashboard", () => {
  it("builds 7/28 day funnel snapshots and a monetization-test gate", async () => {
    const snapshot = await buildGrowthDashboardSnapshot(
      dbWithPeriods(),
      new Date("2026-08-24T08:00:00.000Z"),
    );
    expect(snapshot.sevenDays.metrics.countrySelectionRate).toBe(30);
    expect(snapshot.twentyEightDays.metrics.mapInteractionRate).toBe(50);
    expect(snapshot.twentyEightDays.metrics.cityDetailOpenRate).toBe(25);
    expect(snapshot.twentyEightDays.metrics.retentionIntentRate).toBe(10);
    expect(snapshot.twentyEightDays.topCountries[0]).toEqual({ id: "jp", events: 120 });
    expect(snapshot.gate.state).toBe("ready_for_monetization_test");
    expect(snapshot.gate.passed).toBe(5);
  });

  it("keeps low-volume products in collecting state", async () => {
    const snapshot = await buildGrowthDashboardSnapshot(
      dbWithPeriods({ homepageViews: 120, countryClicks: 50 }),
    );
    expect(snapshot.gate.state).toBe("collecting");
    expect(snapshot.gate.checks[0]?.passed).toBe(false);
  });

  it("renders noindex HTML and explains anonymous-event limitations", async () => {
    const snapshot = await buildGrowthDashboardSnapshot(dbWithPeriods());
    const html = renderGrowthDashboardHtml(snapshot);
    expect(html).toContain("Weather V2 Growth Dashboard");
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(html).toContain("event-count ratios");
    expect(html).not.toContain("Affiliate revenue");
  });

  it("fails closed without a configured password and requires Basic auth", async () => {
    const db = dbWithPeriods();
    const disabled = await handleGrowthDashboardRequest(
      new Request("https://analytics.868656.xyz/growth"),
      { db, password: "" },
    );
    expect(disabled.status).toBe(404);

    const unauthorized = await handleGrowthDashboardRequest(
      new Request("https://analytics.868656.xyz/growth"),
      { db, password: "a-strong-dashboard-password" },
    );
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toContain("Basic");

    const authorization = `Basic ${btoa("owner:a-strong-dashboard-password")}`;
    const authorized = await handleGrowthDashboardRequest(
      new Request("https://analytics.868656.xyz/growth?format=json", {
        headers: { authorization },
      }),
      { db, password: "a-strong-dashboard-password" },
    );
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("cache-control")).toBe("no-store");
    expect(await authorized.json()).toMatchObject({
      gate: { state: "ready_for_monetization_test" },
    });
  });
});
