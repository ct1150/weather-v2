"use client";

import { useMemo, useState, type ReactElement } from "react";
import type { TripActivity } from "../trips/activity-intelligence";
import type { ActivityHourlyWeather } from "../trips/activity-risk";
import { findWeatherFallbacks, poiName } from "../trips/poi-catalog";
import { buildDeterministicReplan, type ReplanProposalDraft } from "../trips/replan-solver";
import { fetchRouteCostMatrix, type RouteWaypoint } from "../trips/route-intelligence";
import type { TripPartyProfile, TripWorkspaceDay } from "../trips/workspace";

const WEATHER_READ_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");

interface HourlyResponse {
  readonly data?: {
    readonly snapshotId?: string;
    readonly coverage?: { readonly availableCityIds?: ReadonlyArray<string> };
    readonly items?: ReadonlyArray<ActivityHourlyWeather>;
  };
}

interface TripExecutionReplanPanelProps {
  readonly day: TripWorkspaceDay;
  readonly activities: ReadonlyArray<TripActivity>;
  readonly partyProfile: TripPartyProfile;
}

function fallbackActivities(day: TripWorkspaceDay): ReadonlyArray<TripActivity> {
  return findWeatherFallbacks(day.cityId, null, 5).map((poi) => ({
    id: `fallback-${poi.id}`,
    title: poiName(poi, "zh-cn"),
    cityId: day.cityId,
    startTime: null,
    endTime: null,
    durationMinutes: poi.typicalDurationMinutes,
    latitude: poi.latitude,
    longitude: poi.longitude,
    category: poi.category,
    environment: poi.environment,
    weatherSensitivity: poi.weatherSensitivity,
    flexibility: poi.reservation === "required" ? "fixed" : "movable",
    reservation: poi.reservation,
    priority: "optional",
    poiId: poi.id,
    alternatives: [],
    notes: "Weather fallback",
  }));
}

function toWaypoint(activity: TripActivity): RouteWaypoint | null {
  if (activity.latitude === null || activity.longitude === null) return null;
  return {
    id: activity.id,
    label: activity.title,
    latitude: activity.latitude,
    longitude: activity.longitude,
    locked: false,
    sourceActivityId: activity.id,
  };
}

export function TripExecutionReplanPanel({
  day,
  activities,
  partyProfile,
}: TripExecutionReplanPanelProps): ReactElement {
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [proposal, setProposal] = useState<ReplanProposalDraft | null>(null);
  const [message, setMessage] = useState("");
  const fallbacks = useMemo(() => fallbackActivities(day), [day]);

  const analyze = async (): Promise<void> => {
    if (WEATHER_READ_BASE.length === 0 || day.cityId.length === 0 || activities.length === 0) {
      setMessage("当前没有足够的数据生成小时级重排建议。");
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const params = new URLSearchParams({ cityIds: day.cityId, date: day.date, locale: "zh-cn" });
      const response = await fetch(`${WEATHER_READ_BASE}/api/v1/trip-hourly?${params.toString()}`);
      if (!response.ok) throw new Error(`HOURLY_${response.status}`);
      const payload = (await response.json()) as HourlyResponse;
      const hourly = payload.data?.items ?? [];
      const snapshotId = payload.data?.snapshotId;
      if (
        typeof snapshotId !== "string" ||
        hourly.length === 0 ||
        payload.data?.coverage?.availableCityIds?.includes(day.cityId) !== true
      ) {
        throw new Error("NO_HOURLY_COVERAGE");
      }

      const sourceWaypoints = activities.map(toWaypoint).filter((item): item is RouteWaypoint => item !== null);
      const fallbackWaypoints = fallbacks.map(toWaypoint).filter((item): item is RouteWaypoint => item !== null);
      let routeCostMatrix;
      try {
        routeCostMatrix =
          sourceWaypoints.length > 0 && fallbackWaypoints.length > 0
            ? await fetchRouteCostMatrix(sourceWaypoints, fallbackWaypoints, { profile: "driving" })
            : undefined;
      } catch {
        routeCostMatrix = undefined;
      }

      const next = buildDeterministicReplan({
        date: day.date,
        weatherSnapshotId: snapshotId,
        activities,
        hourly,
        fallbackActivities: fallbacks,
        routeCostMatrix,
        partyProfile,
      });
      setProposal(next);
      setMessage(
        next.changes.length === 0
          ? "没有发现满足固定约束且能明显降低天气风险的调整。"
          : routeCostMatrix === undefined
            ? "已生成建议；道路矩阵不可用，本次转场成本使用降级估算。"
            : "已结合小时天气和真实道路转场成本生成建议。",
      );
    } catch {
      setProposal(null);
      setMessage("小时天气暂不可用，执行模式不会生成乐观重排建议。");
    } finally {
      setState("idle");
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-border bg-white p-4 sm:p-5" data-route-aware-replan="v1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Route-aware Replan</p>
          <h2 className="mt-2 text-lg font-bold text-foreground">天气变化时，优先选“更安全且更顺路”的 Plan B</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
            固定门票、交通和必须预约活动保持不变；可移动活动先尝试换时段，再比较室内备选的天气风险和真实道路转场成本。
          </p>
        </div>
        <button className="trip-secondary-button" type="button" disabled={state !== "idle"} onClick={() => void analyze()}>
          {state === "loading" ? "分析中…" : "分析当天天气重排"}
        </button>
      </div>

      {message ? <p className="trip-workspace-message mt-4" role="status">{message}</p> : null}

      {proposal !== null && proposal.changes.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {proposal.changes.map((change) => (
            <article key={change.activityId} className="rounded-xl border border-border bg-surface-elevated p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm text-foreground">
                  {change.kind === "move_time" ? "调整时段" : "切换备选"} · {change.before.title}
                </strong>
                <span className="trip-risk-badge trip-risk-low">风险改善 +{change.riskReduction}</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {change.before.startTime ?? "—"} {change.before.title} → {change.after.startTime ?? "—"} {change.after.title}
              </p>
              {change.kind === "replace_activity" ? (
                <p className="mt-1 text-xs text-muted">
                  新增转场：{change.travelDeltaMinutes === null ? "未知" : `${change.travelDeltaMinutes} 分钟`}
                </p>
              ) : null}
            </article>
          ))}
          {proposal.unchangedFixedActivityIds.length > 0 ? (
            <p className="rounded-xl bg-surface-elevated p-3 text-xs text-muted">
              🔒 保持不变：{proposal.unchangedFixedActivityIds.join("、")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
