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

function trendRows(): ReadonlyArray<Record<string, unknown>> {
  const rows: Record<string, unknown>[] = [];
  const start = new Date("2026-07-28T00:00:00.000Z");
  for (let index = 0; index < 28; index += 1) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const recent = index >= 21;
    rows.push({
      day: date.toISOString().slice(0, 10),
      homepage_views: recent ? 50 : 40,
      country_clicks: recent ? 15 : 8,
      country_views: recent ? 14 : 10,
      city_interactions: recent ? 7 : 3,
      city_detail_views: recent ? 2 : 1,
      shortlist_actions: recent ? 2 : 0,
    });
  }
  return rows;
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
  const batch = vi.fn(async (statements: ReadonlyArray<unknown>) => {
    if (statements.length === 1) return [result(trendRows())];
    return [
      result([metrics]),
      result([
        { id: "jp", events: 120 },
        { id: "th", events: 80 },
      ]),
      result([
        { id: "tokyo", events: 60 },
        { id: "bangkok", events: 45 },
      ]),
    ];
  });
  const prepare = vi.fn(() => {
    const statement = {
      bind: vi.fn(() => statement),
    };
    return statement;
  });
  return { batch, prepare } as unknown as D1Database;
}

describe("growth dashboard", () => {
  it("builds 7/28 day snapshots, real daily trend and comparison diagnostics", async () => {
    const snapshot = await buildGrowthDashboardSnapshot(
      dbWithPeriods(),
      new Date("2026-08-24T08:00:00.000Z"),
    );
    expect(snapshot.sevenDays.metrics.countrySelectionRate).toBe(30);
    expect(snapshot.twentyEightDays.metrics.mapInteractionRate).toBe(50);
    expect(snapshot.twentyEightDays.metrics.cityDetailOpenRate).toBe(25);
    expect(snapshot.twentyEightDays.metrics.retentionIntentRate).toBe(10);
    expect(snapshot.twentyEightDays.topCountries[0]).toEqual({ id: "jp", events: 120 });
    expect(snapshot.dailyTrend).toHaveLength(28);
    expect(snapshot.dailyTrend.at(-1)).toMatchObject({
      date: "2026-08-24",
      homepageViews: 50,
      countryClicks: 15,
      countrySelectionRate: 30,
    });
    expect(snapshot.comparison.homepageViewsChangePct).toBe(25);
    expect(snapshot.comparison.countrySelectionRateDelta).toBe(10);
    expect(snapshot.gate.state).toBe("ready_for_monetization_test");
    expect(snapshot.gate.passed).toBe(5);
  });

  it("fills missing trend days with zero-valued production aggregates", async () => {
    const db = dbWithPeriods();
    const batch = db.batch as unknown as ReturnType<typeof vi.fn>;
    batch.mockImplementation(async (statements: ReadonlyArray<unknown>) => {
      if (statements.length === 1) {
        return [
          result([
            {
              day: "2026-08-24",
              homepage_views: 10,
              country_clicks: 2,
              country_views: 2,
              city_interactions: 1,
              city_detail_views: 0,
              shortlist_actions: 0,
            },
          ]),
        ];
      }
      return [result([{}]), result([]), result([])];
    });
    const snapshot = await buildGrowthDashboardSnapshot(db, new Date("2026-08-24T08:00:00.000Z"));
    expect(snapshot.dailyTrend).toHaveLength(28);
    expect(snapshot.dailyTrend[0]?.homepageViews).toBe(0);
    expect(snapshot.dailyTrend.at(-1)?.homepageViews).toBe(10);
  });

  it("keeps low-volume products in collecting state and emits focus alerts", async () => {
    const snapshot = await buildGrowthDashboardSnapshot(
      dbWithPeriods({
        homepageViews: 120,
        countryClicks: 10,
        countryViews: 100,
        cityInteractions: 10,
      }),
      new Date("2026-08-24T08:00:00.000Z"),
    );
    expect(snapshot.gate.state).toBe("collecting");
    expect(snapshot.gate.checks[0]?.passed).toBe(false);
    expect(snapshot.alerts.some((alert) => alert.includes("样本量"))).toBe(true);
  });

  it("renders Chinese noindex HTML with charts, funnel and production-data guidance", async () => {
    const snapshot = await buildGrowthDashboardSnapshot(
      dbWithPeriods(),
      new Date("2026-08-24T08:00:00.000Z"),
    );
    const html = renderGrowthDashboardHtml(snapshot);
    expect(html).toContain("Weather V2 增长分析看板");
    expect(html).toContain("当前分析重点");
    expect(html).toContain("28 天事件量趋势");
    expect(html).toContain("28 天转化率趋势");
    expect(html).toContain("28 天用户决策漏斗");
    expect(html).toContain("最近 7 天环比前 7 天");
    expect(html).toContain("真实生产数据 · 事件级统计 · 非独立用户数");
    expect(html).toContain("<svg");
    expect(html).toContain('name="robots" content="noindex,nofollow"');
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
      { db, password: "a-strong-dashboard-password", now: new Date("2026-08-24T08:00:00.000Z") },
    );
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("cache-control")).toBe("no-store");
    expect(await authorized.json()).toMatchObject({
      gate: { state: "ready_for_monetization_test" },
      dailyTrend: expect.any(Array),
      comparison: { homepageViewsChangePct: 25 },
    });
  });
});
