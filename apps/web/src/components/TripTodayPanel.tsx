"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";

import { assessActivityHourlyRisk, type ActivityHourlyWeather } from "../trips/activity-risk";
import {
  listCloudTripActivity,
  type CloudTripActivity,
} from "../trips/cloud-sync";
import { findWeatherFallbacks, poiName } from "../trips/poi-catalog";
import {
  fixedExecutionActivities,
  nextExecutableActivity,
  resolveActiveTripDay,
} from "../trips/today-mode";
import {
  listCloudWeatherInsights,
  type CloudWeatherInsight,
} from "../trips/weather-intelligence-client";
import type { TripCityOption, TripWorkspace } from "../trips/workspace";

const WEATHER_READ_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");

export type TripTodayLocale = "en" | "zh-cn" | "zh-hant";

interface TripCitiesResponse {
  readonly data?: { readonly items?: ReadonlyArray<TripCityOption> };
}

interface HourlyResponse {
  readonly data?: {
    readonly snapshotId?: string;
    readonly coverage?: { readonly availableCityIds?: ReadonlyArray<string> };
    readonly items?: ReadonlyArray<ActivityHourlyWeather>;
  };
}

interface TripTodayPanelProps {
  readonly locale: TripTodayLocale;
  readonly workspace: TripWorkspace;
  readonly cloudTripId: string | null;
}

const COPY = {
  en: {
    title: "Today / execution mode",
    intro: "Uses the destination timezone, not your device timezone, to decide what is happening now.",
    refresh: "Refresh today",
    noActive: "No itinerary day is active at the destination right now.",
    localTime: "Destination local time",
    nowWeather: "Current hourly weather",
    next: "Current / next activity",
    noNext: "No remaining timed activity today.",
    risk: "Hourly risk",
    fixed: "Fixed deadlines / protected items",
    insights: "Open weather changes today",
    replan: "Latest accepted weather replan",
    noReplan: "No accepted weather replan is recorded for today yet.",
    changed: "activities changed",
    guidance: "Weather-supported guidance",
    indoors: "Use the indoor fallback",
    unavailable: "Hourly coverage is unavailable, so no execution guidance is inferred.",
    rain: "Rain",
    wind: "Wind",
  },
  "zh-cn": {
    title: "今天 / 执行模式",
    intro: "按目的地时区判断今天和当前时间，不使用设备所在时区。",
    refresh: "刷新今天",
    noActive: "目的地当前没有正在执行的行程日。",
    localTime: "目的地当地时间",
    nowWeather: "当前小时天气",
    next: "当前 / 下一活动",
    noNext: "今天没有剩余的定时活动。",
    risk: "小时风险",
    fixed: "固定截止时间 / 不可移动项目",
    insights: "今天未处理的天气变化",
    replan: "最近一次已接受天气重排",
    noReplan: "今天还没有记录已接受的天气重排。",
    changed: "个活动已调整",
    guidance: "有天气数据支撑的执行建议",
    indoors: "切换到室内备选",
    unavailable: "缺少小时级天气覆盖，因此不推断执行建议。",
    rain: "降雨",
    wind: "风速",
  },
  "zh-hant": {
    title: "今天 / 執行模式",
    intro: "按目的地時區判斷今天和目前時間，不使用裝置所在時區。",
    refresh: "更新今天",
    noActive: "目的地目前沒有正在執行的行程日。",
    localTime: "目的地當地時間",
    nowWeather: "目前小時天氣",
    next: "目前 / 下一活動",
    noNext: "今天沒有剩餘的定時活動。",
    risk: "小時風險",
    fixed: "固定截止時間 / 不可移動項目",
    insights: "今天未處理的天氣變化",
    replan: "最近一次已接受天氣重排",
    noReplan: "今天還沒有記錄已接受的天氣重排。",
    changed: "個活動已調整",
    guidance: "有天氣資料支撐的執行建議",
    indoors: "切換到室內備選",
    unavailable: "缺少小時級天氣涵蓋，因此不推斷執行建議。",
    rain: "降雨",
    wind: "風速",
  },
} as const;

function apiLocale(locale: TripTodayLocale): "en" | "zh-cn" {
  return locale === "en" ? "en" : "zh-cn";
}

function selectedChangeIds(item: CloudTripActivity | null): ReadonlyArray<string> {
  const value = item?.payload.selectedChangeIds;
  return Array.isArray(value) && value.every((id): id is string => typeof id === "string") ? value : [];
}

export function TripTodayPanel({ locale, workspace, cloudTripId }: TripTodayPanelProps): ReactElement {
  const copy = COPY[locale];
  const [cities, setCities] = useState<ReadonlyArray<TripCityOption>>([]);
  const [now, setNow] = useState(() => new Date());
  const [hourly, setHourly] = useState<ReadonlyArray<ActivityHourlyWeather>>([]);
  const [hourlyAvailable, setHourlyAvailable] = useState(false);
  const [insights, setInsights] = useState<ReadonlyArray<CloudWeatherInsight>>([]);
  const [activityFeed, setActivityFeed] = useState<ReadonlyArray<CloudTripActivity>>([]);
  const [loading, setLoading] = useState(false);

  const active = useMemo(() => resolveActiveTripDay(workspace, cities, now), [cities, now, workspace]);
  const nextActivity = useMemo(
    () =>
      active === null
        ? null
        : nextExecutableActivity(active.day.activityItems ?? [], active.localClock.minutes),
    [active],
  );
  const nextRisk = useMemo(
    () =>
      active === null || nextActivity === null || !hourlyAvailable
        ? null
        : assessActivityHourlyRisk({
            activity: nextActivity,
            date: active.day.date,
            hourly,
            partyProfile: workspace.partyProfile,
          }),
    [active, hourly, hourlyAvailable, nextActivity, workspace.partyProfile],
  );
  const currentHour = active?.localClock.time.slice(0, 2) ?? "";
  const currentWeather =
    active === null
      ? null
      : (hourly.find((row) => row.localTime.startsWith(`${active.day.date}T${currentHour}:`)) ?? null);
  const fixed = active === null ? [] : fixedExecutionActivities(active.day);
  const openInsights =
    active === null
      ? []
      : insights.filter((item) => item.date === active.day.date && item.status === "open");
  const latestReplan =
    activityFeed.find(
      (item) => item.kind === "revision" && item.payload.operation === "replan",
    ) ?? null;
  const replanIds = selectedChangeIds(latestReplan);
  const indoorFallback =
    active !== null &&
    nextActivity !== null &&
    nextActivity.environment !== "indoor" &&
    nextRisk !== null &&
    nextRisk.score !== null &&
    nextRisk.score < 75
      ? findWeatherFallbacks(active.day.cityId, "indoor", 1)[0]
      : undefined;

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    const nextNow = new Date();
    setNow(nextNow);
    try {
      if (WEATHER_READ_BASE.length > 0) {
        const cityResponse = await fetch(
          `${WEATHER_READ_BASE}/api/v1/trip-cities?locale=${apiLocale(locale)}`,
        );
        if (cityResponse.ok) {
          const payload = (await cityResponse.json()) as TripCitiesResponse;
          setCities(payload.data?.items ?? []);
        }
      }
      if (cloudTripId !== null) {
        const [nextInsights, nextActivityFeed] = await Promise.all([
          listCloudWeatherInsights(cloudTripId),
          listCloudTripActivity(cloudTripId),
        ]);
        setInsights(nextInsights);
        setActivityFeed(nextActivityFeed);
      } else {
        setInsights([]);
        setActivityFeed([]);
      }
    } catch {
      // Today Mode remains useful with whichever read-only data loaded successfully.
    } finally {
      setLoading(false);
    }
  }, [cloudTripId, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (active === null || WEATHER_READ_BASE.length === 0) {
      setHourly([]);
      setHourlyAvailable(false);
      return;
    }
    let live = true;
    const params = new URLSearchParams({
      cityIds: active.day.cityId,
      date: active.day.date,
      locale: apiLocale(locale),
    });
    void fetch(`${WEATHER_READ_BASE}/api/v1/trip-hourly?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HOURLY_${response.status}`);
        return (await response.json()) as HourlyResponse;
      })
      .then((payload) => {
        if (!live) return;
        const available =
          payload.data?.coverage?.availableCityIds?.includes(active.day.cityId) === true;
        setHourly(payload.data?.items ?? []);
        setHourlyAvailable(available);
      })
      .catch(() => {
        if (!live) return;
        setHourly([]);
        setHourlyAvailable(false);
      });
    return () => {
      live = false;
    };
  }, [active, locale]);

  return (
    <section className="mt-4 rounded-2xl border border-border/80 bg-white p-4 sm:p-5" data-trip-today="phase8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Phase 8</p>
          <h3 className="mt-2 text-base font-bold text-foreground">{copy.title}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{copy.intro}</p>
        </div>
        <button type="button" className="trip-secondary-button" disabled={loading} onClick={() => void refresh()}>
          {copy.refresh}
        </button>
      </div>

      {active === null ? (
        <p className="mt-4 text-sm text-muted">{copy.noActive}</p>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="rounded-xl bg-surface-elevated p-3">
            <p className="text-xs font-semibold text-muted">{copy.localTime}</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {active.localClock.date} {active.localClock.time} · {active.day.cityName}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/80 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{copy.nowWeather}</h4>
              {currentWeather !== null ? (
                <p className="mt-2 text-sm text-foreground">
                  {currentWeather.condition} · {currentWeather.temperatureC ?? "—"}°C · {copy.rain} {currentWeather.rainProbability ?? "—"}% · {copy.wind} {currentWeather.windSpeedKph ?? "—"} km/h
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">{copy.unavailable}</p>
              )}
            </div>
            <div className="rounded-xl border border-border/80 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{copy.next}</h4>
              {nextActivity !== null ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {nextActivity.startTime ?? "—"} · {nextActivity.title}
                  </p>
                  {nextRisk !== null ? (
                    <p className="mt-1 text-xs text-muted">
                      {copy.risk}: {nextRisk.score ?? "—"} · {nextRisk.level}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">{copy.noNext}</p>
              )}
            </div>
          </div>

          {indoorFallback !== undefined ? (
            <div className="rounded-xl border border-border/80 bg-surface-elevated p-3" data-today-guidance="weather-supported">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{copy.guidance}</h4>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {copy.indoors}: {poiName(indoorFallback, locale)}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-border/80 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{copy.fixed}</h4>
              {fixed.length === 0 ? (
                <p className="mt-2 text-xs text-muted">—</p>
              ) : (
                <ul className="mt-2 grid gap-1 text-sm text-foreground">
                  {fixed.map((activity) => (
                    <li key={activity.id}>{activity.startTime ?? "—"} · {activity.title}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border/80 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{copy.insights}</h4>
              <p className="mt-2 text-2xl font-bold text-foreground">{openInsights.length}</p>
            </div>
            <div className="rounded-xl border border-border/80 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{copy.replan}</h4>
              {latestReplan === null ? (
                <p className="mt-2 text-xs text-muted">{copy.noReplan}</p>
              ) : (
                <p className="mt-2 text-sm text-foreground">
                  v{String(latestReplan.payload.version ?? "—")} · {replanIds.length} {copy.changed}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
