"use client";

import { useCallback, useMemo, useState, type ReactElement } from "react";
import { emitProductAnalytics } from "../analytics/browser-events";
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
    intro: "We only flag forecast changes that could affect your plans.",
    refresh: "Check latest forecast",
    checking: "Checking latest forecast…",
    empty: "No meaningful weather deterioration detected.",
    unavailable: "Weather monitoring is temporarily unavailable.",
    viewer: "Read only",
    watch: "Watch",
    action: "Action needed",
    impact: "Attention",
    recommendation: "What you can do",
    adjust: "Move or shorten the outdoor window",
    planB: "Activate the prepared Plan B",
    createDecision: "Save this adjustment",
    converted: "Saved",
    whatChanged: "What changed",
    reasons: "Why it matters",
    baseline: "Current forecast saved. We will compare later changes with it.",
    noNew: "Forecast checked. No new meaningful deterioration was found.",
    newInsight: "Weather has changed.",
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
    impact: "需要留意",
    recommendation: "可以怎么调整",
    adjust: "调整或缩短户外游玩时段",
    planB: "启用已经准备好的 Plan B",
    createDecision: "保存这个调整",
    converted: "已保存",
    whatChanged: "天气怎么变了",
    reasons: "为什么会影响行程",
    baseline: "已保存当前预报，之后会用它对比天气变化。",
    noNew: "已检查最新天气，没有新的明显恶化。",
    newInsight: "天气有了新的变化。",
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
    impact: "需要留意",
    recommendation: "可以怎麼調整",
    adjust: "調整或縮短戶外遊玩時段",
    planB: "啟用已經準備好的 Plan B",
    createDecision: "儲存這個調整",
    converted: "已儲存",
    whatChanged: "天氣怎麼變了",
    reasons: "為什麼會影響行程",
    baseline: "已儲存目前預報，之後會用它比較天氣變化。",
    noNew: "已檢查最新天氣，沒有新的明顯惡化。",
    newInsight: "天氣有了新的變化。",
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
    HEAVY_RAIN_THRESHOLD: "Rain chance is now high enough to affect outdoor plans",
    PRECIPITATION_VOLUME_JUMP: "Expected rainfall increased noticeably",
    WIND_THRESHOLD: "Wind is strong enough to affect some outdoor activities",
    GUST_THRESHOLD: "Gusts are strong enough to affect some outdoor activities",
    HEAT_THRESHOLD: "The forecast is hot enough to affect this group",
    COLD_THRESHOLD: "The forecast is cold enough to affect this group",
    UV_THRESHOLD: "UV is high enough to need extra sun protection",
  },
  "zh-cn": {
    RAIN_PROBABILITY_JUMP: "降雨概率明显上升",
    HEAVY_RAIN_THRESHOLD: "降雨概率已经高到可能影响户外安排",
    PRECIPITATION_VOLUME_JUMP: "预计降雨量明显增加",
    WIND_THRESHOLD: "风力已经可能影响部分户外活动",
    GUST_THRESHOLD: "阵风已经可能影响部分户外活动",
    HEAT_THRESHOLD: "高温可能影响当前同行成员",
    COLD_THRESHOLD: "低温可能影响当前同行成员",
    UV_THRESHOLD: "紫外线较强，户外需要加强防晒",
  },
  "zh-hant": {
    RAIN_PROBABILITY_JUMP: "降雨機率明顯上升",
    HEAVY_RAIN_THRESHOLD: "降雨機率已經高到可能影響戶外安排",
    PRECIPITATION_VOLUME_JUMP: "預計降雨量明顯增加",
    WIND_THRESHOLD: "風力已經可能影響部分戶外活動",
    GUST_THRESHOLD: "陣風已經可能影響部分戶外活動",
    HEAT_THRESHOLD: "高溫可能影響目前同行成員",
    COLD_THRESHOLD: "低溫可能影響目前同行成員",
    UV_THRESHOLD: "紫外線較強，戶外需要加強防曬",
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
      if (next) {
        emitProductAnalytics({
          locale,
          routeTemplate: "/trips/workspace",
          fields: { event: "weather_insight_opened" },
        });
        void load();
      }
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
    <section
      className="mt-4 rounded-xl border border-border/80 bg-surface-elevated p-4"
      data-weather-intelligence="phase-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="text-left text-sm font-bold text-foreground"
            onClick={toggle}
          >
            {open ? copy.close : copy.open}
            {openCount > 0 ? ` · ${openCount}` : ""}
          </button>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{copy.intro}</p>
        </div>
        <div className="flex items-center gap-2">
          {!writable ? (
            <span className="text-xs font-semibold text-muted">{copy.viewer}</span>
          ) : null}
          {open && writable ? (
            <button
              type="button"
              className="trip-secondary-button"
              disabled={loading}
              onClick={() => void refresh()}
            >
              {loading ? copy.checking : copy.refresh}
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3">
          {message.length > 0 ? <p className="text-xs leading-5 text-muted">{message}</p> : null}
          {loading && items.length === 0 ? (
            <p className="text-xs text-muted">{copy.checking}</p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="text-sm text-muted">{copy.empty}</p>
          ) : null}
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
                      <strong className="text-sm text-foreground">
                        D{insight.dayNumber} · {insight.cityName}
                      </strong>
                      <span className="text-xs text-muted">{insight.date}</span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {copy.impact}: {insight.severity === "action" ? copy.action : copy.watch}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    {new Date(insight.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                      {copy.whatChanged}
                    </h4>
                    <ul className="mt-2 grid gap-1 text-sm text-foreground">
                      {changed.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                      {copy.reasons}
                    </h4>
                    <ul className="mt-2 grid gap-1 text-sm text-foreground">
                      {insight.reasonCodes.map((reason) => (
                        <li key={reason}>• {REASONS[locale][reason]}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-elevated p-3">
                  <p className="text-sm font-semibold text-foreground">
                    {copy.recommendation}:{" "}
                    {insight.recommendation === "activate_plan_b" ? copy.planB : copy.adjust}
                  </p>
                  {insight.status === "converted" ? (
                    <span className="text-xs font-bold text-muted">✓ {copy.converted}</span>
                  ) : writable ? (
                    <button
                      type="button"
                      className="trip-primary-button"
                      disabled={loading}
                      onClick={() => void createDecision(insight)}
                    >
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
