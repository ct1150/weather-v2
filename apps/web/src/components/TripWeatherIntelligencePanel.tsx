"use client";

import { useCallback, useMemo, useState, type ReactElement } from "react";
import type { TripAccessRole } from "../trips/cloud-sync";
import {
  convertCloudWeatherInsightToDecision,
  listCloudWeatherInsights,
  refreshCloudTripWeather,
  type CloudWeatherInsight,
  type TripWeatherObservation,
  type WeatherInsightReasonCode,
} from "../trips/weather-intelligence-client";
import type { CloudTripLocale } from "./CloudTripControls";

const COPY = {
  en: {
    open: "Weather changes",
    close: "Hide weather changes",
    intro: "Only meaningful forecast deterioration is surfaced. Small forecast noise stays quiet.",
    refresh: "Check latest forecast",
    checking: "Checking latest forecast…",
    empty: "No meaningful weather deterioration detected.",
    unavailable: "Weather monitoring is temporarily unavailable.",
    viewer: "Read only",
    watch: "Watch",
    action: "Action needed",
    impact: "Impact",
    recommendation: "Recommended action",
    adjust: "Move or shorten the outdoor window",
    planB: "Activate the prepared Plan B",
    createDecision: "Create decision",
    converted: "Decision created",
    whatChanged: "What changed",
    reasons: "Why it matters",
    baseline: "A fresh baseline was recorded. Future forecast changes will be compared against it.",
    noNew: "Forecast checked. No new meaningful deterioration was found.",
    newInsight: "New weather change detected.",
    rain: "Rain chance",
    precipitation: "Rainfall",
    wind: "Wind",
    gust: "Gust",
    high: "High",
    low: "Low",
    uv: "UV",
  },
  "zh-cn": {
    open: "天气变化",
    close: "收起天气变化",
    intro: "只提示真正会影响行程的天气恶化，小幅预报波动不会打扰你。",
    refresh: "检查最新天气",
    checking: "正在检查最新天气…",
    empty: "目前没有检测到明显的天气恶化。",
    unavailable: "天气监测暂时不可用。",
    viewer: "仅查看",
    watch: "需要关注",
    action: "建议调整",
    impact: "影响分",
    recommendation: "建议动作",
    adjust: "调整或缩短户外游玩时段",
    planB: "启用已经准备好的 Plan B",
    createDecision: "形成协作决定",
    converted: "已形成决定",
    whatChanged: "天气怎么变了",
    reasons: "为什么会影响行程",
    baseline: "已记录最新天气基线，后续预报会与它自动比较。",
    noNew: "已检查最新天气，没有新的明显恶化。",
    newInsight: "发现新的天气变化。",
    rain: "降雨概率",
    precipitation: "降水量",
    wind: "持续风",
    gust: "阵风",
    high: "最高温",
    low: "最低温",
    uv: "紫外线",
  },
  "zh-hant": {
    open: "天氣變化",
    close: "收起天氣變化",
    intro: "只提示真正會影響行程的天氣惡化，小幅預報波動不會打擾你。",
    refresh: "檢查最新天氣",
    checking: "正在檢查最新天氣…",
    empty: "目前沒有偵測到明顯的天氣惡化。",
    unavailable: "天氣監測暫時無法使用。",
    viewer: "僅查看",
    watch: "需要關注",
    action: "建議調整",
    impact: "影響分",
    recommendation: "建議動作",
    adjust: "調整或縮短戶外遊玩時段",
    planB: "啟用已經準備好的 Plan B",
    createDecision: "形成協作決定",
    converted: "已形成決定",
    whatChanged: "天氣怎麼變了",
    reasons: "為什麼會影響行程",
    baseline: "已記錄最新天氣基線，後續預報會與它自動比較。",
    noNew: "已檢查最新天氣，沒有新的明顯惡化。",
    newInsight: "發現新的天氣變化。",
    rain: "降雨機率",
    precipitation: "降水量",
    wind: "持續風",
    gust: "陣風",
    high: "最高溫",
    low: "最低溫",
    uv: "紫外線",
  },
} as const;

const REASONS: Record<CloudTripLocale, Record<WeatherInsightReasonCode, string>> = {
  en: {
    RAIN_PROBABILITY_JUMP: "Rain probability increased sharply",
    HEAVY_RAIN_THRESHOLD: "Rain probability crossed the high-risk threshold",
    PRECIPITATION_VOLUME_JUMP: "Expected rainfall increased materially",
    WIND_THRESHOLD: "Sustained wind reached an activity-sensitive level",
    GUST_THRESHOLD: "Wind gusts reached an activity-sensitive level",
    HEAT_THRESHOLD: "Temperature crossed the heat threshold for this travel party",
    COLD_THRESHOLD: "Temperature crossed the cold threshold for this travel party",
    UV_THRESHOLD: "UV crossed the outdoor exposure threshold",
  },
  "zh-cn": {
    RAIN_PROBABILITY_JUMP: "降雨概率明显上升",
    HEAVY_RAIN_THRESHOLD: "降雨概率进入高风险区间",
    PRECIPITATION_VOLUME_JUMP: "预计降水量明显增加",
    WIND_THRESHOLD: "持续风达到影响游玩的阈值",
    GUST_THRESHOLD: "阵风达到影响游玩的阈值",
    HEAT_THRESHOLD: "温度超过当前出行成员的高温阈值",
    COLD_THRESHOLD: "温度跌破当前出行成员的低温阈值",
    UV_THRESHOLD: "紫外线超过户外暴露阈值",
  },
  "zh-hant": {
    RAIN_PROBABILITY_JUMP: "降雨機率明顯上升",
    HEAVY_RAIN_THRESHOLD: "降雨機率進入高風險區間",
    PRECIPITATION_VOLUME_JUMP: "預計降水量明顯增加",
    WIND_THRESHOLD: "持續風達到影響遊玩的門檻",
    GUST_THRESHOLD: "陣風達到影響遊玩的門檻",
    HEAT_THRESHOLD: "溫度超過目前出行成員的高溫門檻",
    COLD_THRESHOLD: "溫度跌破目前出行成員的低溫門檻",
    UV_THRESHOLD: "紫外線超過戶外暴露門檻",
  },
};

function metric(
  label: string,
  before: number | null,
  after: number | null,
  suffix: string,
): string | null {
  if (before === null || after === null || before === after) return null;
  return `${label} ${before}${suffix} → ${after}${suffix}`;
}

function changes(
  previous: TripWeatherObservation,
  current: TripWeatherObservation,
  copy: (typeof COPY)[CloudTripLocale],
): ReadonlyArray<string> {
  return [
    metric(copy.rain, previous.rainProbability, current.rainProbability, "%"),
    metric(copy.precipitation, previous.precipitationMm, current.precipitationMm, " mm"),
    metric(copy.wind, previous.windSpeedKph, current.windSpeedKph, " km/h"),
    metric(copy.gust, previous.windGustKph, current.windGustKph, " km/h"),
    metric(copy.high, previous.temperatureMaxC, current.temperatureMaxC, "°C"),
    metric(copy.low, previous.temperatureMinC, current.temperatureMinC, "°C"),
    metric(copy.uv, previous.uvIndex, current.uvIndex, ""),
  ].filter((item): item is string => item !== null);
}

export function TripWeatherIntelligencePanel({
  locale,
  tripId,
  accessRole,
}: {
  readonly locale: CloudTripLocale;
  readonly tripId: string;
  readonly accessRole: TripAccessRole;
}): ReactElement {
  const copy = COPY[locale];
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReadonlyArray<CloudWeatherInsight>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const writable = accessRole !== "viewer";

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setItems(await listCloudWeatherInsights(tripId));
      setMessage("");
    } catch {
      setMessage(copy.unavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.unavailable, tripId]);

  const toggle = useCallback((): void => {
    setOpen((current) => {
      const next = !current;
      if (next) void load();
      return next;
    });
  }, [load]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!writable) return;
    setLoading(true);
    try {
      const report = await refreshCloudTripWeather(tripId);
      setItems(await listCloudWeatherInsights(tripId));
      setMessage(
        report.insightsCreated > 0
          ? copy.newInsight
          : report.baselinesCreated > 0
            ? copy.baseline
            : copy.noNew,
      );
    } catch {
      setMessage(copy.unavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.baseline, copy.newInsight, copy.noNew, copy.unavailable, tripId, writable]);

  const createDecision = useCallback(
    async (insight: CloudWeatherInsight): Promise<void> => {
      if (!writable || insight.status === "converted") return;
      setLoading(true);
      try {
        await convertCloudWeatherInsightToDecision(tripId, insight.id);
        setItems(await listCloudWeatherInsights(tripId));
      } catch {
        setMessage(copy.unavailable);
      } finally {
        setLoading(false);
      }
    },
    [copy.unavailable, tripId, writable],
  );

  const openCount = useMemo(() => items.filter((item) => item.status === "open").length, [items]);

  return (
    <section className="mt-4 rounded-xl border border-border/80 bg-surface-elevated p-4" data-weather-intelligence="phase-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className="text-left text-sm font-bold text-foreground" onClick={toggle}>
            {open ? copy.close : copy.open}{openCount > 0 ? ` · ${openCount}` : ""}
          </button>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{copy.intro}</p>
        </div>
        <div className="flex items-center gap-2">
          {!writable ? <span className="text-xs font-semibold text-muted">{copy.viewer}</span> : null}
          {open && writable ? (
            <button type="button" className="trip-secondary-button" disabled={loading} onClick={() => void refresh()}>
              {loading ? copy.checking : copy.refresh}
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3">
          {message.length > 0 ? <p className="text-xs leading-5 text-muted">{message}</p> : null}
          {loading && items.length === 0 ? <p className="text-xs text-muted">{copy.checking}</p> : null}
          {!loading && items.length === 0 ? <p className="text-sm text-muted">{copy.empty}</p> : null}
          {items.map((insight) => {
            const changed = changes(insight.previous, insight.current, copy);
            return (
              <article
                key={insight.id}
                className="rounded-xl border border-border/80 bg-white p-4"
                data-weather-severity={insight.severity}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] font-bold text-foreground">
                        {insight.severity === "action" ? copy.action : copy.watch}
                      </span>
                      <strong className="text-sm text-foreground">D{insight.dayNumber} · {insight.cityName}</strong>
                      <span className="text-xs text-muted">{insight.date}</span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted">{copy.impact}: {insight.impactScore}/100</p>
                  </div>
                  <div className="text-right text-xs text-muted">{new Date(insight.createdAt).toLocaleString()}</div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{copy.whatChanged}</h4>
                    <ul className="mt-2 grid gap-1 text-sm text-foreground">
                      {changed.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{copy.reasons}</h4>
                    <ul className="mt-2 grid gap-1 text-sm text-foreground">
                      {insight.reasonCodes.map((reason) => <li key={reason}>• {REASONS[locale][reason]}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-elevated p-3">
                  <p className="text-sm font-semibold text-foreground">
                    {copy.recommendation}: {insight.recommendation === "activate_plan_b" ? copy.planB : copy.adjust}
                  </p>
                  {insight.status === "converted" ? (
                    <span className="text-xs font-bold text-muted">✓ {copy.converted}</span>
                  ) : writable ? (
                    <button type="button" className="trip-primary-button" disabled={loading} onClick={() => void createDecision(insight)}>
                      {copy.createDecision}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
