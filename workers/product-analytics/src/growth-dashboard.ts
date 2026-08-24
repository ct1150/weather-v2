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
  const [funnel, countries, cities] = await db.batch<Record<string, unknown>>([
    db.prepare(FUNNEL_SQL).bind(days),
    db.prepare(TOP_COUNTRIES_SQL).bind(days),
    db.prepare(TOP_CITIES_SQL).bind(days),
  ]);
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
      label: "28-day sample size",
      passed: metrics.homepageViews >= 300,
      value: `${metrics.homepageViews} homepage views`,
      target: "≥ 300",
    },
    {
      label: "Country selection",
      passed: (metrics.countrySelectionRate ?? 0) >= 20,
      value: formatRate(metrics.countrySelectionRate),
      target: "≥ 20%",
    },
    {
      label: "Country-map city interaction",
      passed: (metrics.mapInteractionRate ?? 0) >= 30,
      value: formatRate(metrics.mapInteractionRate),
      target: "≥ 30%",
    },
    {
      label: "City detail open",
      passed: (metrics.cityDetailOpenRate ?? 0) >= 15,
      value: formatRate(metrics.cityDetailOpenRate),
      target: "≥ 15%",
    },
    {
      label: "Retention intent (shortlist)",
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

function metricCard(label: string, value: string, detail: string): string {
  return `<article class="card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
}

function ranking(title: string, items: ReadonlyArray<RankedGrowthItem>): string {
  const rows = items.length
    ? items
        .map(
          (item, index) =>
            `<tr><td>${index + 1}</td><td>${escapeHtml(item.id)}</td><td>${item.events}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="3">No data yet</td></tr>';
  return `<section class="panel"><h2>${escapeHtml(title)}</h2><table><thead><tr><th>#</th><th>Destination</th><th>Events</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function periodSection(periodSnapshot: GrowthPeriodSnapshot): string {
  const m = periodSnapshot.metrics;
  return `<section><div class="section-head"><h2>Last ${periodSnapshot.days} days</h2><span>Anonymous event counts</span></div><div class="grid">${metricCard("Homepage views", String(m.homepageViews), "Country-map homepage")}${metricCard("Country selection", formatRate(m.countrySelectionRate), `${m.countryClicks} country clicks`)}${metricCard("Map interaction", formatRate(m.mapInteractionRate), `${m.cityInteractions} city interactions`)}${metricCard("City detail open", formatRate(m.cityDetailOpenRate), `${m.cityDetailViews} detail opens`)}${metricCard("Retention intent", formatRate(m.retentionIntentRate), `${m.shortlistActions} shortlist actions`)}</div><div class="rankings">${ranking("Top country entries", periodSnapshot.topCountries)}${ranking("Top city interactions", periodSnapshot.topCities)}</div></section>`;
}

export function renderGrowthDashboardHtml(snapshot: GrowthDashboardSnapshot): string {
  const gateClass =
    snapshot.gate.state === "ready_for_monetization_test"
      ? "ready"
      : snapshot.gate.state === "promising"
        ? "promising"
        : "collecting";
  const gateLabel = snapshot.gate.state.replaceAll("_", " ");
  const checks = snapshot.gate.checks
    .map(
      (check) =>
        `<li><span>${check.passed ? "✓" : "○"} ${escapeHtml(check.label)}</span><strong>${escapeHtml(check.value)}</strong><small>target ${escapeHtml(check.target)}</small></li>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Weather V2 Growth Dashboard</title><style>body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;background:#f6f7f9;color:#17202a}main{max-width:1180px;margin:auto;padding:32px 20px 64px}.hero{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:28px}.hero h1{margin:0;font-size:32px}.hero p,.section-head span,small{color:#64748b}.gate{border-radius:20px;padding:20px;margin:20px 0 34px;background:white;border:1px solid #e2e8f0}.gate.ready{border-color:#86efac}.gate.promising{border-color:#fde68a}.gate h2{text-transform:capitalize;margin:0 0 12px}.gate ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}.gate li{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:16px;align-items:center;padding:10px 0;border-top:1px solid #eef2f7}.section-head{display:flex;justify-content:space-between;align-items:end;margin:30px 0 14px}.section-head h2{margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.card,.panel{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.card{display:grid;gap:8px}.card strong{font-size:28px}.rankings{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-top:14px}.panel h2{font-size:16px;margin:0 0 12px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:8px;border-top:1px solid #eef2f7}th{color:#64748b;font-weight:600}.note{margin-top:28px;padding:16px;border-radius:14px;background:#eef2ff;color:#475569;font-size:13px;line-height:1.6}@media(max-width:640px){.hero{display:block}.gate li{grid-template-columns:1fr auto}.gate li small{grid-column:1/-1}.rankings{grid-template-columns:1fr}}</style></head><body><main><header class="hero"><div><p>Internal · privacy-safe aggregate analytics</p><h1>Weather V2 Growth Dashboard</h1></div><small>Generated ${escapeHtml(snapshot.generatedAt)}</small></header><section class="gate ${gateClass}"><h2>${escapeHtml(gateLabel)}</h2><p>${snapshot.gate.passed}/${snapshot.gate.total} working validation gates passed.</p><ul>${checks}</ul></section>${periodSection(snapshot.sevenDays)}${periodSection(snapshot.twentyEightDays)}<p class="note">Rates are event-count ratios, not user/session cohorts: the analytics design intentionally stores no user, session or device identifier. “Retention intent” currently means destination shortlist actions relative to country-map views. Gate thresholds are working product-validation thresholds, not industry benchmarks. Affiliate data is intentionally excluded from the readiness decision.</p></main></body></html>`;
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
