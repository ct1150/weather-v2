export type AcquisitionChannel =
  | "direct"
  | "organic_search"
  | "referral"
  | "social"
  | "paid"
  | "email"
  | "other";

export interface AcquisitionContext {
  readonly acquisitionChannel: AcquisitionChannel;
  readonly referrerHost: string;
  readonly landingRouteTemplate: string;
  readonly utmSource: string;
  readonly utmMedium: string;
  readonly utmCampaign: string;
}

interface SourceQualityRow {
  readonly channel: string;
  readonly events: number;
  readonly homepageViews: number;
  readonly countryClicks: number;
  readonly countryViews: number;
  readonly cityInteractions: number;
  readonly cityDetailViews: number;
  readonly shortlistActions: number;
}

interface DailySourceRow {
  readonly day: string;
  readonly channel: string;
  readonly events: number;
}

interface LandingRow {
  readonly landing: string;
  readonly channel: string;
  readonly events: number;
  readonly cityDetailViews: number;
  readonly shortlistActions: number;
}

const CHANNELS: ReadonlyArray<AcquisitionChannel> = [
  "direct",
  "organic_search",
  "referral",
  "social",
  "paid",
  "email",
  "other",
];

const TOKEN_RE = /^[a-z0-9._-]{0,96}$/u;
const ROUTE_RE = /^\/(?:|\[country\]|\[country\]\/\[city\]|discover|trips\/workspace)$/u;

export function parseAcquisitionContext(raw: Record<string, unknown>): AcquisitionContext {
  const channel = raw.acquisition_channel;
  const token = (key: string, max: number): string => {
    const value = raw[key];
    if (typeof value !== "string" || value.length > max || !TOKEN_RE.test(value)) return "";
    return value;
  };
  const landing = raw.landing_route_template;
  return {
    acquisitionChannel: CHANNELS.includes(channel as AcquisitionChannel)
      ? (channel as AcquisitionChannel)
      : "direct",
    referrerHost: token("referrer_host", 96),
    landingRouteTemplate:
      typeof landing === "string" && ROUTE_RE.test(landing) ? landing : "",
    utmSource: token("utm_source", 64),
    utmMedium: token("utm_medium", 64),
    utmCampaign: token("utm_campaign", 64),
  };
}

export function stripAcquisitionFields(raw: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...raw };
  delete copy.acquisition_channel;
  delete copy.referrer_host;
  delete copy.landing_route_template;
  delete copy.utm_source;
  delete copy.utm_medium;
  delete copy.utm_campaign;
  return copy;
}

function n(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function pct(a: number, b: number): string {
  return b <= 0 ? "—" : `${Math.round((a / b) * 1000) / 10}%`;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const SOURCE_QUALITY_SQL = `
SELECT acquisition_channel AS channel,
  SUM(_sample_interval) AS events,
  SUM(CASE WHEN index1='weather_discovery_view' AND blob2='/' THEN _sample_interval ELSE 0 END) AS homepage_views,
  SUM(CASE WHEN index1='search_result_clicked' AND blob2='/' AND blob8='country' THEN _sample_interval ELSE 0 END) AS country_clicks,
  SUM(CASE WHEN index1='country_viewed' AND blob2='/[country]' THEN _sample_interval ELSE 0 END) AS country_views,
  SUM(CASE WHEN index1='city_viewed' AND blob2='/[country]' THEN _sample_interval ELSE 0 END) AS city_interactions,
  SUM(CASE WHEN index1='city_viewed' AND blob2='/[country]/[city]' THEN _sample_interval ELSE 0 END) AS city_detail_views,
  SUM(CASE WHEN index1='destination_shortlisted' AND blob2='/[country]' THEN _sample_interval ELSE 0 END) AS shortlist_actions
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now','-28 days') AND acquisition_channel <> ''
GROUP BY acquisition_channel
ORDER BY homepage_views DESC, events DESC`;

const DAILY_SOURCE_SQL = `
SELECT date(timestamp) AS day, acquisition_channel AS channel, SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now','-28 days') AND acquisition_channel <> ''
GROUP BY date(timestamp), acquisition_channel
ORDER BY day ASC, events DESC`;

const LANDING_SQL = `
SELECT landing_route_template AS landing, acquisition_channel AS channel,
  SUM(_sample_interval) AS events,
  SUM(CASE WHEN index1='city_viewed' AND blob2='/[country]/[city]' THEN _sample_interval ELSE 0 END) AS city_detail_views,
  SUM(CASE WHEN index1='destination_shortlisted' AND blob2='/[country]' THEN _sample_interval ELSE 0 END) AS shortlist_actions
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now','-28 days') AND landing_route_template <> ''
GROUP BY landing_route_template, acquisition_channel
ORDER BY events DESC
LIMIT 20`;

const REFERRER_SQL = `
SELECT referrer_host AS host, SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now','-28 days') AND referrer_host <> ''
GROUP BY referrer_host ORDER BY events DESC LIMIT 12`;

function qualityRows(result: D1Result<Record<string, unknown>>): SourceQualityRow[] {
  return result.results.map((row) => ({
    channel: typeof row.channel === "string" ? row.channel : "other",
    events: n(row.events),
    homepageViews: n(row.homepage_views),
    countryClicks: n(row.country_clicks),
    countryViews: n(row.country_views),
    cityInteractions: n(row.city_interactions),
    cityDetailViews: n(row.city_detail_views),
    shortlistActions: n(row.shortlist_actions),
  }));
}

function lineChart(rows: DailySourceRow[]): string {
  const byChannel = new Map<string, DailySourceRow[]>();
  for (const row of rows) {
    const list = byChannel.get(row.channel) ?? [];
    list.push(row);
    byChannel.set(row.channel, list);
  }
  const top = [...byChannel.entries()]
    .sort((a, b) => b[1].reduce((s, r) => s + r.events, 0) - a[1].reduce((s, r) => s + r.events, 0))
    .slice(0, 5);
  const max = Math.max(1, ...rows.map((row) => row.events));
  const days = [...new Set(rows.map((row) => row.day))];
  const width = 900;
  const height = 260;
  const plotW = 840;
  const plotH = 200;
  const palette = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#0891b2"];
  const paths = top
    .map(([channel, items], index) => {
      const map = new Map(items.map((item) => [item.day, item.events]));
      const points = days
        .map((day, i) => {
          const x = 40 + (days.length <= 1 ? 0 : (i / (days.length - 1)) * plotW);
          const y = 20 + plotH - ((map.get(day) ?? 0) / max) * plotH;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      return `<polyline fill="none" stroke="${palette[index]}" stroke-width="2.5" points="${points}"/><span class="legend"><i style="background:${palette[index]}"></i>${esc(channel)}</span>`;
    })
    .join("");
  if (rows.length === 0) return '<div class="empty">来源数据正在从本次发布后开始积累。</div>';
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="28 天来源事件趋势"><line x1="40" y1="220" x2="880" y2="220" stroke="#cbd5e1"/><line x1="40" y1="20" x2="40" y2="220" stroke="#cbd5e1"/>${paths.replaceAll(/<span.*?<\/span>/gu, "")}</svg><div class="legends">${top.map(([c], i) => `<span><i style="background:${palette[i]}"></i>${esc(c)}</span>`).join("")}</div></div>`;
}

export async function renderAcquisitionDashboard(db: D1Database): Promise<string> {
  const [qualityResult, dailyResult, landingResult, referrerResult] = await db.batch<Record<string, unknown>>([
    db.prepare(SOURCE_QUALITY_SQL),
    db.prepare(DAILY_SOURCE_SQL),
    db.prepare(LANDING_SQL),
    db.prepare(REFERRER_SQL),
  ]);
  if (!qualityResult || !dailyResult || !landingResult || !referrerResult) {
    throw new Error("ACQUISITION_DASHBOARD_QUERY_MISMATCH");
  }
  const quality = qualityRows(qualityResult);
  const daily = dailyResult.results.map((row) => ({
    day: typeof row.day === "string" ? row.day : "",
    channel: typeof row.channel === "string" ? row.channel : "other",
    events: n(row.events),
  }));
  const landings: LandingRow[] = landingResult.results.map((row) => ({
    landing: typeof row.landing === "string" ? row.landing : "",
    channel: typeof row.channel === "string" ? row.channel : "other",
    events: n(row.events),
    cityDetailViews: n(row.city_detail_views),
    shortlistActions: n(row.shortlist_actions),
  }));
  const qualityTable = quality.length
    ? quality
        .map(
          (row) => `<tr><td><strong>${esc(row.channel)}</strong></td><td>${row.homepageViews}</td><td>${pct(row.countryClicks, row.homepageViews)}</td><td>${pct(row.cityInteractions, row.countryViews)}</td><td>${pct(row.cityDetailViews, row.cityInteractions)}</td><td>${pct(row.shortlistActions, row.countryViews)}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="6">来源字段从本次发布后开始采集，暂无历史来源数据。</td></tr>';
  const landingTable = landings.length
    ? landings
        .map(
          (row) => `<tr><td>${esc(row.landing)}</td><td>${esc(row.channel)}</td><td>${row.events}</td><td>${row.cityDetailViews}</td><td>${row.shortlistActions}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="5">暂无落地页来源数据。</td></tr>';
  const referrers = referrerResult.results
    .map((row) => ({ host: typeof row.host === "string" ? row.host : "", events: n(row.events) }))
    .filter((row) => row.host.length > 0);
  const maxRef = Math.max(1, ...referrers.map((row) => row.events));
  const referrerBars = referrers.length
    ? referrers
        .map((row) => `<div class="bar-row"><span>${esc(row.host)}</span><div><i style="width:${Math.max(2, (row.events / maxRef) * 100)}%"></i></div><strong>${row.events}</strong></div>`)
        .join("")
    : '<div class="empty">暂无外部 Referrer 数据。</div>';
  const totalHome = quality.reduce((sum, row) => sum + row.homepageViews, 0);
  const topChannel = quality[0];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Weather V2 用户来源分析</title><style>body{margin:0;background:#f6f7f9;color:#17202a;font-family:ui-sans-serif,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}main{max-width:1180px;margin:auto;padding:32px 20px 64px}a{color:#2563eb;text-decoration:none}.hero{display:flex;justify-content:space-between;gap:20px;align-items:end}.badge{display:inline-block;background:#dcfce7;color:#166534;border-radius:999px;padding:5px 10px;font-size:12px}.summary,.panel{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px}.summary{margin:20px 0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.kpi strong{display:block;font-size:28px;margin-top:6px}.section-head{display:flex;justify-content:space-between;align-items:end;margin:30px 0 12px}.section-head h2{margin:0}.chart-wrap svg{width:100%;height:auto}.legends{display:flex;gap:14px;flex-wrap:wrap;font-size:12px}.legends i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;border-top:1px solid #eef2f7;padding:9px}.bar-row{display:grid;grid-template-columns:minmax(140px,220px) 1fr 50px;gap:10px;align-items:center;margin:10px 0}.bar-row div{height:10px;background:#eef2f7;border-radius:999px;overflow:hidden}.bar-row i{display:block;height:100%;background:#2563eb}.empty{padding:28px;text-align:center;color:#64748b}.note{margin-top:28px;padding:16px;background:#eef2ff;border-radius:14px;color:#475569;line-height:1.65;font-size:13px}@media(max-width:720px){.hero{display:block}.grid{grid-template-columns:1fr}.panel{overflow:auto}}</style></head><body><main><header class="hero"><div><p><a href="/growth">← 返回增长分析总览</a></p><h1>用户来源分析</h1><p>Acquisition → Activation → Decision → Retention</p></div><span class="badge">真实生产数据 · 匿名来源上下文</span></header><section class="summary"><div class="grid"><article class="kpi"><span>28 天可归因首页浏览</span><strong>${totalHome}</strong><small>来源字段从本次发布后开始积累</small></article><article class="kpi"><span>当前最大来源</span><strong>${esc(topChannel?.channel ?? "—")}</strong><small>${topChannel ? `${topChannel.homepageViews} 次首页浏览` : "暂无数据"}</small></article><article class="kpi"><span>分析重点</span><strong>质量 > 数量</strong><small>重点比较来源后的城市详情与收藏意图</small></article></div></section><div class="section-head"><div><h2>28 天来源趋势</h2><small>观察 SEO / Direct / Referral / Social 是否持续增长，而不是只看单日峰值</small></div></div><section class="panel">${lineChart(daily)}</section><div class="section-head"><div><h2>来源质量</h2><small>同一来源从首页进入后，后续决策动作是否更强</small></div></div><section class="panel"><table><thead><tr><th>渠道</th><th>首页浏览</th><th>国家选择率</th><th>地图互动率</th><th>城市详情率</th><th>留存意图</th></tr></thead><tbody>${qualityTable}</tbody></table></section><div class="section-head"><div><h2>Landing Page × Source</h2><small>找出哪些落地页不仅带来流量，还能推动深入决策</small></div></div><section class="panel"><table><thead><tr><th>落地页</th><th>来源</th><th>事件数</th><th>城市详情</th><th>收藏/对比</th></tr></thead><tbody>${landingTable}</tbody></table></section><div class="section-head"><div><h2>外部 Referrer</h2><small>仅保存 hostname，不保存完整来源 URL、路径或查询参数</small></div></div><section class="panel">${referrerBars}</section><p class="note"><strong>口径：</strong>来源上下文在首次落地时生成并仅保存在浏览器 sessionStorage，之后随事件重复上报，但不包含任何 session/user/device ID。Referrer 只保留 hostname；UTM 只保留经过小写、字符白名单和长度限制后的 source / medium / campaign token；Landing Page 只保存已有的路由模板，不保存原始 URL 或 query string。因此可以比较“不同来源的事件质量”，但不能做用户级 cohort 或跨 Session 归因。</p></main></body></html>`;
}
