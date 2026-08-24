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

export interface GrowthDashboardSnapshot {
  readonly generatedAt: string;
  readonly sevenDays: GrowthPeriodSnapshot;
  readonly twentyEightDays: GrowthPeriodSnapshot;
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

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
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
  const homepageViews = numberValue(row.homepage_views);
  const countryClicks = numberValue(row.country_clicks);
  const countryViews = numberValue(row.country_views);
  const cityInteractions = numberValue(row.city_interactions);
  const cityDetailViews = numberValue(row.city_detail_views);
  const shortlistActions = numberValue(row.shortlist_actions);
  return {
    days,
    metrics: {
      homepageViews,
      countryClicks,
      countryViews,
      cityInteractions,
      cityDetailViews,
      shortlistActions,
      countrySelectionRate: percentage(countryClicks, homepageViews),
      mapInteractionRate: percentage(cityInteractions, countryViews),
      cityDetailOpenRate: percentage(cityDetailViews, cityInteractions),
      retentionIntentRate: percentage(shortlistActions, countryViews),
    },
    topCountries: rankedRows(countries),
    topCities: rankedRows(cities),
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

export async function buildGrowthDashboardSnapshot(
  db: D1Database,
  now = new Date(),
): Promise<GrowthDashboardSnapshot> {
  const [sevenDays, twentyEightDays] = await Promise.all([period(db, 7), period(db, 28)]);
  return {
    generatedAt: now.toISOString(),
    sevenDays,
    twentyEightDays,
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

function ranking(title: string, items: ReadonlyArray<RankedGrowthItem>): string {
  const rows = items.length
    ? items
        .map(
          (item, index) =>
            `<tr><td>${index + 1}</td><td>${escapeHtml(item.id)}</td><td>${item.events}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="3">暂无数据</td></tr>';
  return `<section class="panel"><h2>${escapeHtml(title)}</h2><table><thead><tr><th>#</th><th>目的地</th><th>事件数</th></tr></thead><tbody>${rows}</tbody></table></section>`;
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

function periodSection(periodSnapshot: GrowthPeriodSnapshot): string {
  const m = periodSnapshot.metrics;
  return `<section><div class="section-head"><h2>最近 ${periodSnapshot.days} 天</h2><span>匿名事件聚合数据</span></div><div class="grid">${metricCard("首页浏览", String(m.homepageViews), "天气目的地首页", "看流量规模是否已经足够支持判断")}${metricCard("国家选择率", formatRate(m.countrySelectionRate), `${m.countryClicks} 次国家点击`, "看首屏是否成功把访客推进到国家地图")}${metricCard("地图互动率", formatRate(m.mapInteractionRate), `${m.cityInteractions} 次城市互动`, "看国家地图是否让用户愿意继续比较城市")}${metricCard("城市详情打开率", formatRate(m.cityDetailOpenRate), `${m.cityDetailViews} 次详情打开`, "看地图互动是否继续转化为更深层天气决策")}${metricCard("留存意图", formatRate(m.retentionIntentRate), `${m.shortlistActions} 次加入对比/收藏`, "看用户是否产生保存目的地、继续比较的意图")}</div><div class="rankings">${ranking("热门国家入口", periodSnapshot.topCountries)}${ranking("热门城市互动", periodSnapshot.topCities)}</div></section>`;
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
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Weather V2 增长分析看板</title><style>body{font-family:ui-sans-serif,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;background:#f6f7f9;color:#17202a}main{max-width:1180px;margin:auto;padding:32px 20px 64px}.hero{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:20px}.hero h1{margin:0;font-size:32px}.hero p,.section-head span,small{color:#64748b}.eyebrow{margin:0 0 6px;color:#64748b;font-size:13px}.focus{margin:0 0 28px}.focus .section-head{margin:0 0 14px}.focus-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.focus-grid article{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.focus-grid article>div{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.focus-grid article span{font-size:12px;white-space:nowrap;padding:3px 8px;border-radius:999px;background:#f1f5f9;color:#475569}.focus-grid p{margin:10px 0 0;color:#475569;font-size:14px;line-height:1.65}.gate{border-radius:20px;padding:20px;margin:20px 0 34px;background:white;border:1px solid #e2e8f0}.gate.ready{border-color:#86efac}.gate.promising{border-color:#fde68a}.gate h2{margin:0 0 12px}.gate ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}.gate li{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:16px;align-items:center;padding:10px 0;border-top:1px solid #eef2f7}.section-head{display:flex;justify-content:space-between;align-items:end;margin:30px 0 14px}.section-head h2{margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.card,.panel{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.card{display:grid;gap:8px}.card strong{font-size:28px}.card-focus{font-size:12px;line-height:1.55;color:#475569;margin:2px 0 0;padding-top:8px;border-top:1px dashed #e2e8f0}.rankings{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-top:14px}.panel h2{font-size:16px;margin:0 0 12px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:8px;border-top:1px solid #eef2f7}th{color:#64748b;font-weight:600}.note{margin-top:28px;padding:16px;border-radius:14px;background:#eef2ff;color:#475569;font-size:13px;line-height:1.7}@media(max-width:720px){.hero{display:block}.focus-grid{grid-template-columns:1fr}.gate li{grid-template-columns:1fr auto}.gate li small{grid-column:1/-1}.rankings{grid-template-columns:1fr}}</style></head><body><main><header class="hero"><div><p>内部使用 · 隐私安全的匿名聚合分析</p><h1>Weather V2 增长分析看板</h1></div><small>生成时间 ${escapeHtml(snapshot.generatedAt)}</small></header>${analysisFocus(snapshot)}<section class="gate ${gateClass}"><p class="eyebrow">28 天产品验证 Gate</p><h2>${escapeHtml(gateLabel(snapshot.gate.state))}</h2><p>当前通过 ${snapshot.gate.passed}/${snapshot.gate.total} 项工作阈值。重点不是追求全部变绿，而是判断产品是否已经具备继续投入和商业化测试的基础。</p><ul>${checks}</ul></section>${periodSection(snapshot.sevenDays)}${periodSection(snapshot.twentyEightDays)}<p class="note"><strong>阅读说明：</strong>当前比率是“事件次数之间的比例”，不是用户或 Session Cohort。分析体系刻意不保存用户、Session 或设备标识，因此这里的“留存意图”指加入目的地对比/收藏相对于国家地图浏览的行为信号，不等同于真实次日/7 日留存。以上 Gate 是内部产品验证工作阈值，不是行业基准。Affiliate 数据暂不参与是否准备商业化的判断。城市详情打开埋点上线时间晚于地图互动埋点，因此切换后的前 28 天应优先参考 7 天趋势，避免被历史分母拉低。</p></main></body></html>`;
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
