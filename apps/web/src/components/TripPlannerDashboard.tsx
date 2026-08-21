"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";
import type {
  ResolvedTripActivity,
  ResolvedTripDay,
  ResolvedTripPlan,
  TripRiskLevel,
} from "../trips/types";

function riskCopy(level: TripRiskLevel): string {
  if (level === "low") return "低风险";
  if (level === "medium") return "需留意";
  return "高风险";
}

function riskClass(level: TripRiskLevel): string {
  if (level === "low") return "trip-risk-low";
  if (level === "medium") return "trip-risk-medium";
  return "trip-risk-high";
}

function intensityCopy(level: ResolvedTripDay["intensity"]): string {
  if (level === "easy") return "轻松";
  if (level === "moderate") return "适中";
  return "高强度";
}

function formatTemperature(activity: ResolvedTripActivity): string {
  const min = activity.weather?.temperatureMinC;
  const max = activity.weather?.temperatureMaxC;
  if (min === null || min === undefined || max === null || max === undefined) return "温度待确认";
  return `${Math.round(min)}°–${Math.round(max)}°`;
}

function metric(value: number | null | undefined, suffix: string): string {
  return value === null || value === undefined ? "—" : `${Math.round(value)}${suffix}`;
}

function ScoreDial({ score }: { readonly score: number }): ReactElement {
  const style = {
    "--trip-score": `${score * 3.6}deg`,
  } as CSSProperties;
  const label = score >= 75 ? "天气影响较小" : score >= 50 ? "部分时段需留意" : "建议调整户外安排";
  const shortLabel = score >= 75 ? "较稳" : score >= 50 ? "留意" : "调整";
  return (
    <div className="trip-score-dial" style={style} aria-label={label}>
      <span>{shortLabel}</span>
      <small>天气参考</small>
    </div>
  );
}

function ActivityCard({ activity }: { readonly activity: ResolvedTripActivity }): ReactElement {
  const hasFallback = activity.fallback !== undefined;
  return (
    <article className="trip-activity-card">
      <div className="trip-activity-time">
        <span>{activity.startTime}</span>
        {activity.endTime !== undefined ? <small>— {activity.endTime}</small> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-bold text-foreground">{activity.name}</h4>
          <span className={`trip-risk-badge ${riskClass(activity.assessment.riskLevel)}`}>
            {riskCopy(activity.assessment.riskLevel)}
          </span>
          {activity.flexibility === "fixed" ? (
            <span className="trip-constraint-badge">已固定</span>
          ) : null}
          {activity.latestDeparture !== undefined ? (
            <span className="trip-deadline-badge">最晚 {activity.latestDeparture}</span>
          ) : null}
        </div>
        {activity.description !== undefined ? (
          <p className="mt-2 text-sm leading-6 text-muted">{activity.description}</p>
        ) : null}
        <div className="trip-weather-row mt-3">
          <span>{activity.weather?.condition ?? "天气待确认"}</span>
          <span>{formatTemperature(activity)}</span>
          <span>降雨 {metric(activity.weather?.rainProbability, "%")}</span>
          <span>风速 {metric(activity.weather?.windSpeedKph, " km/h")}</span>
          <span>{activity.weather?.source === "open-meteo" ? "最新预报" : "已有预报"}</span>
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground">{activity.assessment.summary}</p>
        <ul className="mt-2 grid gap-1 text-xs leading-5 text-muted sm:grid-cols-2">
          {activity.assessment.reasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        {hasFallback ? (
          <div className="trip-inline-fallback mt-3">
            <strong>活动 Plan B</strong>
            <span>{activity.fallback}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function TripPlannerDashboard({ trip }: { readonly trip: ResolvedTripPlan }): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [planBEnabled, setPlanBEnabled] = useState(false);
  const selectedDay = trip.days[selectedIndex] ?? trip.days[0];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selected = Number(params.get("day"));
    if (Number.isInteger(selected) && selected >= 1 && selected <= trip.days.length) {
      setSelectedIndex(selected - 1);
    }
  }, [trip.days.length]);

  useEffect(() => {
    setPlanBEnabled(false);
    const url = new URL(window.location.href);
    url.searchParams.set("day", String(selectedIndex + 1));
    window.history.replaceState({}, "", url);
  }, [selectedIndex]);

  const totalKm = useMemo(
    () => trip.days.reduce((sum, day) => sum + day.drivingKm, 0),
    [trip.days],
  );

  if (selectedDay === undefined) {
    return <p className="info-panel">行程数据暂不可用。</p>;
  }

  return (
    <div className="trip-dashboard">
      <section className="trip-summary-grid" aria-label="行程摘要">
        <div>
          <span>旅行天数</span>
          <strong>{trip.days.length}天8晚</strong>
        </div>
        <div>
          <span>家庭成员</span>
          <strong>2成人 · 2老人 · 1儿童</strong>
        </div>
        <div>
          <span>计划驾驶</span>
          <strong>约 {totalKm} km</strong>
        </div>
        <div>
          <span>天气数据</span>
          <strong>{trip.liveWeatherEnabled ? "最新天气" : "已有天气"}</strong>
        </div>
      </section>

      <div className="trip-day-strip" role="tablist" aria-label="选择行程日期">
        {trip.days.map((day, index) => (
          <button
            key={day.dayNumber}
            type="button"
            role="tab"
            aria-selected={selectedIndex === index}
            className={selectedIndex === index ? "is-active" : ""}
            onClick={() => setSelectedIndex(index)}
          >
            <span>D{day.dayNumber}</span>
            <small>{day.date.slice(5).replace("-", "/")}</small>
            <i className={riskClass(day.riskLevel)}>{day.weatherScore}</i>
          </button>
        ))}
      </div>

      <section className="trip-selected-day" aria-labelledby="selected-trip-day">
        <header className="trip-day-header">
          <div>
            <p className="eyebrow">
              D{selectedDay.dayNumber} · {selectedDay.date} · {selectedDay.weekday}
            </p>
            <h2
              id="selected-trip-day"
              className="mt-3 text-3xl font-bold tracking-[-0.04em] text-foreground"
            >
              {selectedDay.title}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-muted">
              <span className="trip-meta-pill">{selectedDay.transport}</span>
              <span className="trip-meta-pill">驾驶 {selectedDay.drivingKm} km</span>
              <span className="trip-meta-pill">强度：{intensityCopy(selectedDay.intensity)}</span>
            </div>
          </div>
          <ScoreDial score={selectedDay.weatherScore} />
        </header>

        <div className="trip-route-strip" aria-label="当日路线">
          {selectedDay.route.map((stop, index) => (
            <div key={`${stop}-${index}`}>
              <span>{index + 1}</span>
              <strong>{stop}</strong>
              {index < selectedDay.route.length - 1 ? <i aria-hidden="true">→</i> : null}
            </div>
          ))}
        </div>

        <div className={`trip-decision-panel ${riskClass(selectedDay.riskLevel)}`}>
          <div>
            <span>今天的天气提醒</span>
            <strong>{selectedDay.primaryWeatherSummary}</strong>
          </div>
          <button type="button" onClick={() => setPlanBEnabled((value) => !value)}>
            {planBEnabled ? "返回 Plan A" : "查看 Plan B"}
          </button>
        </div>

        {planBEnabled ? (
          <section className="trip-plan-b" aria-live="polite">
            <p className="text-xs font-bold uppercase tracking-[0.14em]">天气变化后的备选安排</p>
            <h3 className="mt-2 text-xl font-bold">{selectedDay.planB}</h3>
            <p className="mt-3 text-sm leading-6 opacity-80">
              系统仅提出调整建议，不会自动修改已购机票、高铁、门票或酒店订单。固定约束始终优先。
            </p>
          </section>
        ) : null}

        <div className="trip-day-layout">
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">逐项天气提醒</p>
                <h3 className="section-title mt-2">今日时间轴</h3>
              </div>
              <button type="button" className="trip-print-button" onClick={() => window.print()}>
                打印行程
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              {selectedDay.activities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <section className="trip-side-card">
              <p className="eyebrow">餐厅推荐</p>
              <div className="mt-4 grid gap-4">
                {selectedDay.restaurants.map((restaurant) => (
                  <article key={`${restaurant.name}-${restaurant.meal}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-foreground">{restaurant.name}</h4>
                      <span className="trip-priority-badge">
                        {restaurant.priority === "primary" ? "首选" : "备选"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted">{restaurant.note}</p>
                    <p className="mt-2 text-xs font-semibold text-primary">
                      {restaurant.recommendedDishes.join(" · ")}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            {selectedDay.hotel !== undefined ? (
              <section className="trip-side-card">
                <p className="eyebrow">今晚住宿</p>
                <h3 className="mt-3 text-lg font-bold text-foreground">{selectedDay.hotel.name}</h3>
                <p className="mt-2 text-sm text-muted">{selectedDay.hotel.location}</p>
                <p className="mt-4 text-2xl font-bold text-foreground">
                  ¥{selectedDay.hotel.priceCny}
                </p>
                {selectedDay.hotel.note !== undefined ? (
                  <p className="mt-2 text-xs leading-5 text-muted">{selectedDay.hotel.note}</p>
                ) : null}
              </section>
            ) : null}

            <section className="trip-side-card">
              <p className="eyebrow">执行提醒</p>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-body">
                {selectedDay.executionNotes.map((note) => (
                  <li key={note} className="flex gap-3">
                    <span className="trip-check-dot" aria-hidden="true">
                      ✓
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}
