export interface GrowthFunnelMetrics {
  readonly homepageViews: number;
  readonly countryClicks: number;
  readonly countryViews: number;
  readonly cityInteractions: number;
  readonly cityDetailViews: number;
  readonly shortlistActions: number;
  readonly countrySelectionRate: number | null;
  readonly mapInteractionRate: number | null;
  readonly cityDetailOpenRate: number | null;
  readonly retentionIntentRate: number | null;
}

export interface RankedGrowthItem {
  readonly id: string;
  readonly events: number;
}

export interface GrowthPeriodSnapshot {
  readonly days: 7 | 28;
  readonly metrics: GrowthFunnelMetrics;
  readonly topCountries: ReadonlyArray<RankedGrowthItem>;
  readonly topCities: ReadonlyArray<RankedGrowthItem>;
}

export interface DailyGrowthPoint extends GrowthFunnelMetrics {
  readonly date: string;
}

export interface GrowthComparison {
  readonly homepageViewsChangePct: number | null;
  readonly countrySelectionRateDelta: number | null;
  readonly mapInteractionRateDelta: number | null;
  readonly cityDetailOpenRateDelta: number | null;
  readonly retentionIntentRateDelta: number | null;
}

export interface GrowthDashboardSnapshot {
  readonly generatedAt: string;
  readonly sevenDays: GrowthPeriodSnapshot;
  readonly twentyEightDays: GrowthPeriodSnapshot;
  readonly dailyTrend: ReadonlyArray<DailyGrowthPoint>;
  readonly comparison: GrowthComparison;
  readonly alerts: ReadonlyArray<string>;
  readonly gate: {
    readonly state: "collecting" | "promising" | "ready_for_monetization_test";
    readonly passed: number;
    readonly total: number;
    readonly checks: ReadonlyArray<{
      readonly label: string;
      readonly passed: boolean;
      readonly value: string;
      readonly target: string;
    }>;
  };
}

const FUNNEL_SQL = `
SELECT
  COALESCE(SUM(CASE WHEN index1 = 'weather_discovery_view' AND blob2 = '/' THEN _sample_interval ELSE 0 END), 0) AS homepage_views,
  COALESCE(SUM(CASE WHEN index1 = 'search_result_clicked' AND blob2 = '/' AND blob8 = 'country' THEN _sample_interval ELSE 0 END), 0) AS country_clicks,
  COALESCE(SUM(CASE WHEN index1 = 'country_viewed' AND blob2 = '/[country]' THEN _sample_interval ELSE 0 END), 0) AS country_views,
  COALESCE(SUM(CASE WHEN index1 = 'city_viewed' AND blob2 = '/[country]' THEN _sample_interval ELSE 0 END), 0) AS city_interactions,
  COALESCE(SUM(CASE WHEN index1 = 'city_viewed' AND blob2 = '/[country]/[city]' THEN _sample_interval ELSE 0 END), 0) AS city_detail_views,
  COALESCE(SUM(CASE WHEN index1 = 'destination_shortlisted' AND blob2 = '/[country]' THEN _sample_interval ELSE 0 END), 0) AS shortlist_actions
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-' || ?1 || ' days')`;

const TOP_COUNTRIES_SQL = `
SELECT blob7 AS id, SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-' || ?1 || ' days')
  AND index1 = 'search_result_clicked'
  AND blob2 = '/'
  AND blob8 = 'country'
  AND blob7 <> ''
GROUP BY blob7
ORDER BY events DESC, id ASC
LIMIT 8`;

const TOP_CITIES_SQL = `
SELECT blob7 AS id, SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-' || ?1 || ' days')
  AND index1 = 'city_viewed'
  AND blob2 = '/[country]'
  AND blob7 <> ''
GROUP BY blob7
ORDER BY events DESC, id ASC
LIMIT 10`;

const DAILY_TREND_SQL = `
SELECT
  date(timestamp) AS day,
  COALESCE(SUM(CASE WHEN index1 = 'weather_discovery_view' AND blob2 = '/' THEN _sample_interval ELSE 0 END), 0) AS homepage_views,
  COALESCE(SUM(CASE WHEN index1 = 'search_result_clicked' AND blob2 = '/' AND blob8 = 'country' THEN _sample_interval ELSE 0 END), 0) AS country_clicks,
  COALESCE(SUM(CASE WHEN index1 = 'country_viewed' AND blob2 = '/[country]' THEN _sample_interval ELSE 0 END), 0) AS country_views,
  COALESCE(SUM(CASE WHEN index1 = 'city_viewed' AND blob2 = '/[country]' THEN _sample_interval ELSE 0 END), 0) AS city_interactions,
  COALESCE(SUM(CASE WHEN index1 = 'city_viewed' AND blob2 = '/[country]/[city]' THEN _sample_interval ELSE 0 END), 0) AS city_detail_views,
  COALESCE(SUM(CASE WHEN index1 = 'destination_shortlisted' AND blob2 = '/[country]' THEN _sample_interval ELSE 0 END), 0) AS shortlist_actions
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-27 days')
GROUP BY date(timestamp)
ORDER BY day ASC`;

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 10) / 10;
}

function metricsFromCounts(input: {
  readonly homepageViews: number;
  readonly countryClicks: number;
  readonly countryViews: number;
  readonly cityInteractions: number;
  readonly cityDetailViews: number;
  readonly shortlistActions: number;
}): GrowthFunnelMetrics {
  return {
    ...input,
    countrySelectionRate: percentage(input.countryClicks, input.homepageViews),
    mapInteractionRate: percentage(input.cityInteractions, input.countryViews),
    cityDetailOpenRate: percentage(input.cityDetailViews, input.cityInteractions),
    retentionIntentRate: percentage(input.shortlistActions, input.countryViews),
  };
}

function rankedRows(result: D1Result<Record<string, unknown>>): ReadonlyArray<RankedGrowthItem> {
  return result.results
    .map((row) => ({
      id: typeof row.id === "string" ? row.id : "",
      events: numberValue(row.events),
    }))
    .filter((row) => row.id.length > 0);
}

async function period(db: D1Database, days: 7 | 28): Promise<GrowthPeriodSnapshot> {
  const results = await db.batch<Record<string, unknown>>([
    db.prepare(FUNNEL_SQL).bind(days),
    db.prepare(TOP_COUNTRIES_SQL).bind(days),
    db.prepare(TOP_CITIES_SQL).bind(days),
  ]);
  const funnel = results[0];
  const countries = results[1];
  const cities = results[2];
  if (funnel === undefined || countries === undefined || cities === undefined) {
    throw new Error("GROWTH_DASHBOARD_QUERY_MISMATCH");
  }
  const row = funnel.results[0] ?? {};
  const metrics = metricsFromCounts({
    homepageViews: numberValue(row.homepage_views),
    countryClicks: numberValue(row.country_clicks),
    countryViews: numberValue(row.country_views),
    cityInteractions: numberValue(row.city_interactions),
    cityDetailViews: numberValue(row.city_detail_views),
    shortlistActions: numberValue(row.shortlist_actions),
  });
  return {
    days,
    metrics,
    topCountries: rankedRows(countries),
    topCities: rankedRows(cities),
  };
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dailyRows(
  result: D1Result<Record<string, unknown>>,
  now: Date,
): ReadonlyArray<DailyGrowthPoint> {
  const byDay = new Map<string, Record<string, unknown>>();
  for (const row of result.results) {
    if (typeof row.day === "string") byDay.set(row.day, row);
  }
  const points: DailyGrowthPoint[] = [];
  for (let offset = 27; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    const day = isoDay(date);
    const row = byDay.get(day) ?? {};
    points.push({
      date: day,
      ...metricsFromCounts({
        homepageViews: numberValue(row.homepage_views),
        countryClicks: numberValue(row.country_clicks),
        countryViews: numberValue(row.country_views),
        cityInteractions: numberValue(row.city_interactions),
        cityDetailViews: numberValue(row.city_detail_views),
        shortlistActions: numberValue(row.shortlist_actions),
      }),
    });
  }
  return points;
}

async function trend(db: D1Database, now: Date): Promise<ReadonlyArray<DailyGrowthPoint>> {
  const [result] = await db.batch<Record<string, unknown>>([db.prepare(DAILY_TREND_SQL)]);
  if (result === undefined) throw new Error("GROWTH_DASHBOARD_TREND_QUERY_MISMATCH");
  return dailyRows(result, now);
}

function aggregateDaily(points: ReadonlyArray<DailyGrowthPoint>): GrowthFunnelMetrics {
  return metricsFromCounts(
    points.reduce(
      (acc, point) => ({
        homepageViews: acc.homepageViews + point.homepageViews,
        countryClicks: acc.countryClicks + point.countryClicks,
        countryViews: acc.countryViews + point.countryViews,
        cityInteractions: acc.cityInteractions + point.cityInteractions,
        cityDetailViews: acc.cityDetailViews + point.cityDetailViews,
        shortlistActions: acc.shortlistActions + point.shortlistActions,
      }),
      {
        homepageViews: 0,
        countryClicks: 0,
        countryViews: 0,
        cityInteractions: 0,
        cityDetailViews: 0,
        shortlistActions: 0,
      },
    ),
  );
}

function buildComparison(points: ReadonlyArray<DailyGrowthPoint>): GrowthComparison {
  const current = aggregateDaily(points.slice(-7));
  const previous = aggregateDaily(points.slice(-14, -7));
  return {
    homepageViewsChangePct: percentChange(current.homepageViews, previous.homepageViews),
    countrySelectionRateDelta: delta(current.countrySelectionRate, previous.countrySelectionRate),
    mapInteractionRateDelta: delta(current.mapInteractionRate, previous.mapInteractionRate),
    cityDetailOpenRateDelta: delta(current.cityDetailOpenRate, previous.cityDetailOpenRate),
    retentionIntentRateDelta: delta(current.retentionIntentRate, previous.retentionIntentRate),
  };
}

function formatRate(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function buildGate(snapshot: GrowthPeriodSnapshot): GrowthDashboardSnapshot["gate"] {
  const metrics = snapshot.metrics;
  const checks = [
    {
      label: "28 天样本量",
      passed: metrics.homepageViews >= 300,
      value: `${metrics.homepageViews} 次首页浏览`,
      target: "≥ 300",
    },
    {
      label: "国家选择率",
      passed: (metrics.countrySelectionRate ?? 0) >= 20,
      value: formatRate(metrics.countrySelectionRate),
      target: "≥ 20%",
    },
    {
      label: "国家地图城市互动率",
      passed: (metrics.mapInteractionRate ?? 0) >= 30,
      value: formatRate(metrics.mapInteractionRate),
      target: "≥ 30%",
    },
    {
      label: "城市详情打开率",
      passed: (metrics.cityDetailOpenRate ?? 0) >= 15,
      value: formatRate(metrics.cityDetailOpenRate),
      target: "≥ 15%",
    },
    {
      label: "留存意图（加入对比/收藏）",
      passed: (metrics.retentionIntentRate ?? 0) >= 5,
      value: formatRate(metrics.retentionIntentRate),
      target: "≥ 5%",
    },
  ] as const;
  const passed = checks.filter((check) => check.passed).length;
  const state =
    metrics.homepageViews < 300
      ? "collecting"
      : passed >= 4
        ? "ready_for_monetization_test"
        : passed >= 3
          ? "promising"
          : "collecting";
  return { state, passed, total: checks.length, checks };
}

function buildAlerts(snapshot: GrowthPeriodSnapshot, comparison: GrowthComparison): string[] {
  const alerts: string[] = [];
  const m = snapshot.metrics;
  if (m.homepageViews < 300)
    alerts.push("样本量仍偏低：优先继续积累真实流量，不建议因短期比例波动频繁改版。");
  if ((m.countrySelectionRate ?? 0) < 20)
    alerts.push("国家选择率低于工作阈值：优先检查首页价值主张与国家入口是否足够清晰。");
  if ((m.mapInteractionRate ?? 0) < 30)
    alerts.push("地图互动率低于工作阈值：优先优化天气结论、地图可读性和城市点击动机。");
  if ((comparison.mapInteractionRateDelta ?? 0) <= -5)
    alerts.push("地图互动率较前 7 天下降超过 5 个百分点，建议优先排查近期产品或流量结构变化。");
  if ((comparison.countrySelectionRateDelta ?? 0) >= 5)
    alerts.push("国家选择率较前 7 天明显改善，可以复盘近期首页改动或流量来源变化。");
  if ((m.retentionIntentRate ?? 0) < 5)
    alerts.push("留存意图仍弱：暂不建议扩大商业化曝光，先验证收藏/对比是否真正有价值。");
  return alerts.slice(0, 5);
}

export async function buildGrowthDashboardSnapshot(
  db: D1Database,
  now = new Date(),
): Promise<GrowthDashboardSnapshot> {
  const [sevenDays, twentyEightDays, dailyTrend] = await Promise.all([
    period(db, 7),
    period(db, 28),
    trend(db, now),
  ]);
  const comparison = buildComparison(dailyTrend);
  return {
    generatedAt: now.toISOString(),
    sevenDays,
    twentyEightDays,
    dailyTrend,
    comparison,
    alerts: buildAlerts(twentyEightDays, comparison),
    gate: buildGate(twentyEightDays),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function metricCard(label: string, value: string, detail: string, focus: string): string {
  return `<article class="card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small><p class="card-focus">分析重点：${escapeHtml(focus)}</p></article>`;
}

function rankingBars(title: string, items: ReadonlyArray<RankedGrowthItem>): string {
  const max = Math.max(1, ...items.map((item) => item.events));
  const rows = items.length
    ? items
        .map(
          (item, index) =>
            `<div class="bar-row"><span>${index + 1}. ${escapeHtml(item.id)}</span><div class="bar-track"><i style="width:${Math.max(3, Math.round((item.events / max) * 100))}%"></i></div><strong>${item.events}</strong></div>`,
        )
        .join("")
    : '<p class="muted">暂无数据</p>';
  return `<section class="panel"><h2>${escapeHtml(title)}</h2><div class="bars">${rows}</div></section>`;
}

function focusStatus(passed: boolean): string {
  return passed ? "表现达标" : "需要关注";
}

function analysisFocus(snapshot: GrowthDashboardSnapshot): string {
  const m = snapshot.twentyEightDays.metrics;
  const items = [
    {
      title: "1. 先判断样本量是否足够",
      status: focusStatus(m.homepageViews >= 300),
      text:
        m.homepageViews >= 300
          ? `28 天已有 ${m.homepageViews} 次首页浏览，可以开始参考转化率判断产品方向。`
          : `28 天仅 ${m.homepageViews} 次首页浏览，当前优先积累真实流量，不要因小样本频繁改产品。`,
    },
    {
      title: "2. 看首页能否推动用户选国家",
      status: focusStatus((m.countrySelectionRate ?? 0) >= 20),
      text: `国家选择率 ${formatRate(m.countrySelectionRate)}，重点判断首页价值主张、国家入口和首屏是否足够清晰。`,
    },
    {
      title: "3. 看国家地图能否继续推动决策",
      status: focusStatus((m.mapInteractionRate ?? 0) >= 30),
      text: `地图城市互动率 ${formatRate(m.mapInteractionRate)}，重点判断天气信息是否足以让用户继续点击城市比较。`,
    },
    {
      title: "4. 看是否出现更深层决策与留存意图",
      status: focusStatus((m.retentionIntentRate ?? 0) >= 5),
      text: `城市详情打开率 ${formatRate(m.cityDetailOpenRate)}，留存意图 ${formatRate(m.retentionIntentRate)}。重点看用户是否从“浏览天气”进入“认真比较/保存目的地”。`,
    },
  ];
  return `<section class="focus"><div class="section-head"><div><p class="eyebrow">建议按顺序阅读</p><h2>当前分析重点</h2></div><span>优先看 28 天判断方向，7 天看近期变化</span></div><div class="focus-grid">${items
    .map(
      (item) =>
        `<article><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.status)}</span></div><p>${escapeHtml(item.text)}</p></article>`,
    )
    .join("")}</div></section>`;
}

function formatChange(value: number | null, suffix: string): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
}

function comparisonSection(comparison: GrowthComparison): string {
  const cards = [
    ["首页浏览", formatChange(comparison.homepageViewsChangePct, "%"), "最近 7 天 vs 前 7 天"],
    ["国家选择率", formatChange(comparison.countrySelectionRateDelta, "pp"), "转化率百分点变化"],
    ["地图互动率", formatChange(comparison.mapInteractionRateDelta, "pp"), "转化率百分点变化"],
    ["城市详情率", formatChange(comparison.cityDetailOpenRateDelta, "pp"), "转化率百分点变化"],
    ["留存意图", formatChange(comparison.retentionIntentRateDelta, "pp"), "转化率百分点变化"],
  ];
  return `<section><div class="section-head"><h2>最近 7 天环比前 7 天</h2><span>判断产品是在改善还是走弱</span></div><div class="compare-grid">${cards
    .map(
      ([label, value, detail]) =>
        `<article><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`,
    )
    .join("")}</div></section>`;
}

type LineSeries = {
  readonly key: keyof DailyGrowthPoint;
  readonly label: string;
  readonly color: string;
};

function lineChart(
  title: string,
  description: string,
  points: ReadonlyArray<DailyGrowthPoint>,
  series: ReadonlyArray<LineSeries>,
): string {
  const width = 980;
  const height = 260;
  const left = 42;
  const top = 18;
  const plotWidth = width - left - 18;
  const plotHeight = height - top - 38;
  const values = points.flatMap((point) => series.map((item) => Number(point[item.key] ?? 0)));
  const max = Math.max(1, ...values);
  const paths = series
    .map((item) => {
      const coords = points.map((point, index) => {
        const x = left + (index / Math.max(1, points.length - 1)) * plotWidth;
        const raw = Number(point[item.key] ?? 0);
        const y = top + plotHeight - (raw / max) * plotHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return `<polyline fill="none" stroke="${item.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${coords.join(" ")}"/>`;
    })
    .join("");
  const labels = series
    .map((item) => `<span><i style="background:${item.color}"></i>${escapeHtml(item.label)}</span>`)
    .join("");
  const start = points[0]?.date.slice(5) ?? "";
  const end = points.at(-1)?.date.slice(5) ?? "";
  return `<section class="panel chart-panel"><div class="chart-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><div class="legend">${labels}</div></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}"><line x1="${left}" y1="${top + plotHeight}" x2="${width - 18}" y2="${top + plotHeight}" stroke="#cbd5e1"/><line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#e2e8f0"/>${paths}<text x="${left}" y="${height - 8}" font-size="12" fill="#64748b">${start}</text><text x="${width - 52}" y="${height - 8}" font-size="12" fill="#64748b">${end}</text><text x="4" y="${top + 6}" font-size="12" fill="#64748b">${max.toFixed(0)}</text></svg></section>`;
}

function rateTrend(points: ReadonlyArray<DailyGrowthPoint>): string {
  return lineChart("28 天转化率趋势", "重点看比例是否持续改善，而不是只看 28 天平均值。", points, [
    { key: "countrySelectionRate", label: "国家选择率", color: "#2563eb" },
    { key: "mapInteractionRate", label: "地图互动率", color: "#0f766e" },
    { key: "cityDetailOpenRate", label: "城市详情率", color: "#9333ea" },
    { key: "retentionIntentRate", label: "留存意图", color: "#c2410c" },
  ]);
}

function volumeTrend(points: ReadonlyArray<DailyGrowthPoint>): string {
  return lineChart(
    "28 天事件量趋势",
    "判断增长来自真实流量提升，还是只是短期转化率波动。",
    points,
    [
      { key: "homepageViews", label: "首页浏览", color: "#2563eb" },
      { key: "countryClicks", label: "国家点击", color: "#0f766e" },
      { key: "cityInteractions", label: "城市互动", color: "#9333ea" },
      { key: "shortlistActions", label: "收藏/对比", color: "#c2410c" },
    ],
  );
}

function funnelSection(metrics: GrowthFunnelMetrics): string {
  const stages = [
    ["首页浏览", metrics.homepageViews],
    ["选择国家", metrics.countryClicks],
    ["地图城市互动", metrics.cityInteractions],
    ["城市详情", metrics.cityDetailViews],
    ["收藏/加入对比", metrics.shortlistActions],
  ] as const;
  const max = Math.max(1, metrics.homepageViews);
  const rows = stages
    .map(([label, value], index) => {
      const width = Math.max(12, Math.round((value / max) * 100));
      const previous = index === 0 ? null : (stages[index - 1]?.[1] ?? 0);
      const conversion = previous === null ? "起点" : formatRate(percentage(value, previous));
      return `<div class="funnel-row"><div><strong>${escapeHtml(label)}</strong><span>${value} 次事件 · ${conversion}</span></div><div class="funnel-bar" style="width:${width}%"></div></div>`;
    })
    .join("");
  return `<section class="panel"><div class="chart-head"><div><h2>28 天用户决策漏斗</h2><p>用于定位最大流失环节；事件级漏斗，不代表独立用户漏斗。</p></div></div><div class="funnel">${rows}</div></section>`;
}

function alertsSection(alerts: ReadonlyArray<string>): string {
  const rows = alerts.length
    ? alerts.map((alert) => `<li>${escapeHtml(alert)}</li>`).join("")
    : "<li>当前没有明显异常信号，继续观察 7 天与 28 天趋势。</li>";
  return `<section class="alerts"><div class="section-head"><h2>异常与机会点</h2><span>自动按工作阈值和 7 天环比生成</span></div><ul>${rows}</ul></section>`;
}

function periodSection(periodSnapshot: GrowthPeriodSnapshot): string {
  const m = periodSnapshot.metrics;
  return `<section><div class="section-head"><h2>最近 ${periodSnapshot.days} 天</h2><span>匿名事件聚合数据</span></div><div class="grid">${metricCard("首页浏览", String(m.homepageViews), "天气目的地首页", "看流量规模是否已经足够支持判断")}${metricCard("国家选择率", formatRate(m.countrySelectionRate), `${m.countryClicks} 次国家点击`, "看首屏是否成功把访客推进到国家地图")}${metricCard("地图互动率", formatRate(m.mapInteractionRate), `${m.cityInteractions} 次城市互动`, "看国家地图是否让用户愿意继续比较城市")}${metricCard("城市详情打开率", formatRate(m.cityDetailOpenRate), `${m.cityDetailViews} 次详情打开`, "看地图互动是否继续转化为更深层天气决策")}${metricCard("留存意图", formatRate(m.retentionIntentRate), `${m.shortlistActions} 次加入对比/收藏`, "看用户是否产生保存目的地、继续比较的意图")}</div><div class="rankings">${rankingBars("热门国家入口", periodSnapshot.topCountries)}${rankingBars("热门城市互动", periodSnapshot.topCities)}</div></section>`;
}

function gateLabel(state: GrowthDashboardSnapshot["gate"]["state"]): string {
  if (state === "ready_for_monetization_test") return "可以进入商业化小流量测试";
  if (state === "promising") return "产品信号初步积极";
  return "继续积累数据";
}

export function renderGrowthDashboardHtml(snapshot: GrowthDashboardSnapshot): string {
  const gateClass =
    snapshot.gate.state === "ready_for_monetization_test"
      ? "ready"
      : snapshot.gate.state === "promising"
        ? "promising"
        : "collecting";
  const checks = snapshot.gate.checks
    .map(
      (check) =>
        `<li><span>${check.passed ? "✓" : "○"} ${escapeHtml(check.label)}</span><strong>${escapeHtml(check.value)}</strong><small>目标 ${escapeHtml(check.target)}</small></li>`,
    )
    .join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Weather V2 增长分析看板</title><style>body{font-family:ui-sans-serif,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;background:#f6f7f9;color:#17202a}main{max-width:1180px;margin:auto;padding:32px 20px 64px}.hero{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:20px}.hero h1{margin:0;font-size:32px}.hero p,.section-head span,small,.muted{color:#64748b}.eyebrow{margin:0 0 6px;color:#64748b;font-size:13px}.focus{margin:0 0 28px}.focus .section-head{margin:0 0 14px}.focus-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.focus-grid article,.compare-grid article{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.focus-grid article>div{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.focus-grid article span{font-size:12px;white-space:nowrap;padding:3px 8px;border-radius:999px;background:#f1f5f9;color:#475569}.focus-grid p{margin:10px 0 0;color:#475569;font-size:14px;line-height:1.65}.gate{border-radius:20px;padding:20px;margin:20px 0 34px;background:white;border:1px solid #e2e8f0}.gate.ready{border-color:#86efac}.gate.promising{border-color:#fde68a}.gate h2{margin:0 0 12px}.gate ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}.gate li{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:16px;align-items:center;padding:10px 0;border-top:1px solid #eef2f7}.section-head{display:flex;justify-content:space-between;align-items:end;margin:30px 0 14px}.section-head h2{margin:0}.grid,.compare-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.compare-grid article{display:grid;gap:8px}.compare-grid strong{font-size:24px}.card,.panel{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.card{display:grid;gap:8px}.card strong{font-size:28px}.card-focus{font-size:12px;line-height:1.55;color:#475569;margin:2px 0 0;padding-top:8px;border-top:1px dashed #e2e8f0}.rankings,.chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.panel h2{font-size:16px;margin:0 0 6px}.chart-panel{overflow:hidden}.chart-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.chart-head p{margin:0;color:#64748b;font-size:13px}.legend{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:#475569}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:9px;height:9px;border-radius:50%;display:inline-block}.chart-panel svg{display:block;width:100%;height:auto;margin-top:10px}.bars{display:grid;gap:10px}.bar-row{display:grid;grid-template-columns:minmax(90px,150px) 1fr auto;gap:10px;align-items:center;font-size:13px}.bar-track{height:10px;background:#eef2f7;border-radius:999px;overflow:hidden}.bar-track i{display:block;height:100%;background:#64748b;border-radius:999px}.funnel{display:grid;gap:12px;margin-top:16px}.funnel-row{display:grid;gap:6px}.funnel-row>div:first-child{display:flex;justify-content:space-between;gap:12px;font-size:13px}.funnel-row span{color:#64748b}.funnel-bar{height:18px;background:#64748b;border-radius:6px;min-width:12%}.alerts{margin-top:28px}.alerts ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}.alerts li{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:12px 14px;color:#7c2d12;font-size:14px;line-height:1.55}.note{margin-top:28px;padding:16px;border-radius:14px;background:#eef2ff;color:#475569;font-size:13px;line-height:1.7}@media(max-width:720px){.hero{display:block}.focus-grid,.rankings,.chart-grid{grid-template-columns:1fr}.gate li{grid-template-columns:1fr auto}.gate li small{grid-column:1/-1}.chart-head{display:block}.legend{margin-top:10px}.bar-row{grid-template-columns:100px 1fr auto}}</style></head><body><main><header class="hero"><div><p>真实生产数据 · 事件级统计 · 非独立用户数</p><h1>Weather V2 增长分析看板</h1></div><small>生成时间 ${escapeHtml(snapshot.generatedAt)}</small></header>${analysisFocus(snapshot)}${comparisonSection(snapshot.comparison)}<div class="chart-grid">${volumeTrend(snapshot.dailyTrend)}${rateTrend(snapshot.dailyTrend)}</div><div class="chart-grid">${funnelSection(snapshot.twentyEightDays.metrics)}${rankingBars("28 天热门国家", snapshot.twentyEightDays.topCountries)}</div>${alertsSection(snapshot.alerts)}<section class="gate ${gateClass}"><p class="eyebrow">28 天产品验证 Gate</p><h2>${escapeHtml(gateLabel(snapshot.gate.state))}</h2><p>当前通过 ${snapshot.gate.passed}/${snapshot.gate.total} 项工作阈值。重点不是追求全部变绿，而是判断产品是否已经具备继续投入和商业化测试的基础。</p><ul>${checks}</ul></section>${periodSection(snapshot.sevenDays)}${periodSection(snapshot.twentyEightDays)}<p class="note"><strong>阅读说明：</strong>当前数据来自生产事件表，图表使用同一批真实事件按天聚合，不是 mock 或演示样本。所有比率都是“事件次数之间的比例”，不是用户或 Session Cohort；分析体系刻意不保存用户、Session 或设备标识。这里的“留存意图”指加入目的地对比/收藏相对于国家地图浏览的行为信号，不等同于真实次日/7 日留存。以上 Gate 是内部产品验证工作阈值，不是行业基准。Affiliate 数据暂不参与是否准备商业化的判断。城市详情打开埋点上线时间晚于地图互动埋点，因此切换后的前 28 天应优先参考 7 天趋势，避免被历史分母拉低。</p></main></body></html>`;
}

function parseBasicPassword(header: string | null): string | null {
  if (header === null || !header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    return separator >= 0 ? decoded.slice(separator + 1) : null;
  } catch {
    return null;
  }
}

export async function handleGrowthDashboardRequest(
  request: Request,
  input: { readonly db: D1Database; readonly password: string; readonly now?: Date },
): Promise<Response> {
  if (input.password.length < 12) return new Response("Not found", { status: 404 });
  const supplied = parseBasicPassword(request.headers.get("authorization"));
  if (supplied !== input.password) {
    return new Response("Authentication required", {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="Where Not Rain Growth", charset="UTF-8"' },
    });
  }
  const snapshot = await buildGrowthDashboardSnapshot(input.db, input.now ?? new Date());
  const url = new URL(request.url);
  if (url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify(snapshot), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response(renderGrowthDashboardHtml(snapshot), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
