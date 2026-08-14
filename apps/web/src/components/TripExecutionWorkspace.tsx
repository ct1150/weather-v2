"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  activityItemsToLegacy,
  normalizeActivityItems,
  type TripActivity,
} from "../trips/activity-intelligence";
import {
  estimateRoutePlan,
  fetchRoutedPlan,
  optimizeRouteOrder,
  type RoutePlan,
} from "../trips/route-intelligence";
import { projectExecution, reorderActivitiesByRoute } from "../trips/trip-execution";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  normalizeWorkspace,
  type TripWorkspace,
  type TripWorkspaceDay,
} from "../trips/workspace";
import { TripExecutionMap } from "./TripExecutionMap";
import { TripExecutionReplanPanel } from "./TripExecutionReplanPanel";

function loadWorkspace(): TripWorkspace | null {
  const raw = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (raw === null) return null;
  try {
    return normalizeWorkspace(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function dayActivities(day: TripWorkspaceDay): ReadonlyArray<TripActivity> {
  return normalizeActivityItems(day.activityItems, day.activities, {
    dayId: day.id,
    cityId: day.cityId,
    dayTheme: day.theme,
    dayFlexible: day.flexible,
    dayNotes: day.notes,
  });
}

function minutes(seconds: number): string {
  const total = Math.round(seconds / 60);
  if (total < 60) return `${total} 分钟`;
  return `${Math.floor(total / 60)} 小时 ${total % 60} 分钟`;
}

function distance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

function mapsUrl(activities: ReadonlyArray<TripActivity>): string | null {
  const located = activities.filter((item) => item.latitude !== null && item.longitude !== null);
  if (located.length === 0) return null;
  const points = located.map((item) => `${item.latitude},${item.longitude}`).join("/");
  return `https://www.google.com/maps/dir/${points}`;
}

export function TripExecutionWorkspace(): ReactElement {
  const [workspace, setWorkspace] = useState<TripWorkspace | null>(null);
  const [dayId, setDayId] = useState("");
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [routing, setRouting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const next = loadWorkspace();
    setWorkspace(next);
    setDayId(next?.days[0]?.id ?? "");
  }, []);

  const selectedDay =
    workspace?.days.find((day) => day.id === dayId) ?? workspace?.days[0] ?? null;
  const activities = useMemo(
    () => (selectedDay === null ? [] : dayActivities(selectedDay)),
    [selectedDay],
  );
  const projection = useMemo(() => projectExecution(activities), [activities]);
  const estimated = useMemo(
    () =>
      estimateRoutePlan(projection.routeWaypoints, "driving", {
        start: projection.startAnchor,
        end: projection.endAnchor,
      }),
    [projection],
  );
  const visiblePlan = routePlan ?? estimated;
  const visibleActivities = useMemo(
    () => reorderActivitiesByRoute(activities, visiblePlan.waypointIds),
    [activities, visiblePlan.waypointIds],
  );
  const visibleProjection = useMemo(
    () => projectExecution(visibleActivities),
    [visibleActivities],
  );

  useEffect(() => {
    setRoutePlan(null);
    setMessage("");
  }, [dayId]);

  const refreshRoute = async (): Promise<void> => {
    if (projection.routeWaypoints.length < 1) {
      setMessage("当天还没有足够的带坐标活动用于路线计算。");
      return;
    }
    setRouting(true);
    setMessage("");
    try {
      const routed = await fetchRoutedPlan(
        projection.routeWaypoints,
        { start: projection.startAnchor, end: projection.endAnchor },
        { profile: "driving" },
      );
      setRoutePlan(routed);
      setMessage("已使用真实道路数据刷新当天路线；左侧时间轴同步显示路线预览顺序。");
    } catch {
      setRoutePlan(estimated);
      setMessage("路线服务暂时不可用，已使用本地估算路线，不影响行程执行。");
    } finally {
      setRouting(false);
    }
  };

  const optimizeAndSave = (): void => {
    if (workspace === null || selectedDay === null) return;
    const optimized = optimizeRouteOrder(projection.routeWaypoints, {
      start: projection.startAnchor,
      end: projection.endAnchor,
    });
    const reordered = reorderActivitiesByRoute(
      activities,
      optimized.map((item) => item.id),
    );
    const next = normalizeWorkspace({
      ...workspace,
      updatedAt: new Date().toISOString(),
      days: workspace.days.map((day) =>
        day.id === selectedDay.id
          ? {
              ...day,
              activityItems: reordered,
              activities: activityItemsToLegacy(reordered),
            }
          : day,
      ),
    });
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
    setWorkspace(next);
    setRoutePlan(null);
    setMessage("已优化可移动景点顺序并保存；固定门票、交通和必须预约活动保持原位。");
  };

  if (workspace === null) {
    return (
      <section className="info-panel">
        <h1 className="text-xl font-bold">还没有可执行的本地行程</h1>
        <p className="mt-2 text-sm text-muted">
          先到天气旅行工作台创建或导入行程，再进入执行模式。
        </p>
        <a className="trip-primary-button mt-4 inline-flex" href="/zh-cn/trips/workspace">
          打开旅行工作台
        </a>
      </section>
    );
  }

  const externalMaps = mapsUrl(visibleActivities);

  return (
    <div className="trip-execution-workspace">
      <section className="rounded-3xl border border-border bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Trip Execution Mode</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">
              今天怎么走，一屏看清
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
              复用现有行程数据，把活动、固定约束、酒店锚点和路线放到同一个执行视图。真实道路路线失败时会自动降级为本地估算。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="trip-secondary-button" href="/zh-cn/trips/workspace">
              返回编辑
            </a>
            <button className="trip-secondary-button" type="button" onClick={optimizeAndSave}>
              优化路线并保存
            </button>
            <button
              className="trip-primary-button"
              type="button"
              disabled={routing}
              onClick={() => void refreshRoute()}
            >
              {routing ? "路线计算中…" : "刷新真实道路路线"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 rounded-2xl border border-border bg-white p-4 sm:grid-cols-[220px_1fr] sm:p-5">
        <label className="grid gap-2 text-xs font-semibold text-muted">
          执行日期
          <select
            className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
            value={selectedDay?.id ?? ""}
            onChange={(event) => setDayId(event.target.value)}
          >
            {workspace.days.map((day) => (
              <option key={day.id} value={day.id}>
                D{day.dayNumber} · {day.date} · {day.cityName || "未设置城市"}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-surface-elevated p-3">
            <span className="text-xs text-muted">路线来源</span>
            <strong className="mt-1 block text-sm">
              {visiblePlan.source === "routed" ? "真实道路" : "本地估算"}
            </strong>
          </div>
          <div className="rounded-xl bg-surface-elevated p-3">
            <span className="text-xs text-muted">预计里程</span>
            <strong className="mt-1 block text-sm">{distance(visiblePlan.distanceMeters)}</strong>
          </div>
          <div className="rounded-xl bg-surface-elevated p-3">
            <span className="text-xs text-muted">预计转场</span>
            <strong className="mt-1 block text-sm">{minutes(visiblePlan.durationSeconds)}</strong>
          </div>
        </div>
      </section>

      {message ? (
        <p className="trip-workspace-message mt-4" role="status">
          {message}
        </p>
      ) : null}

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-border bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2 className="mt-2 text-xl font-bold">D{selectedDay?.dayNumber} 执行时间轴</h2>
              <p className="mt-1 text-[11px] text-muted">当前显示路线预览顺序；点击“优化路线并保存”后写回行程。</p>
            </div>
            {externalMaps ? (
              <a
                className="trip-secondary-button"
                href={externalMaps}
                target="_blank"
                rel="noreferrer"
              >
                在地图中打开
              </a>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            {visibleActivities.length === 0 ? (
              <p className="text-sm text-muted">当天还没有结构化活动。</p>
            ) : (
              visibleActivities.map((activity, index) => {
                const reservation = visibleProjection.reservations.find(
                  (item) => item.activityId === activity.id,
                );
                const leg = visiblePlan.legs.find((item) => item.toId === activity.id);
                return (
                  <article
                    key={activity.id}
                    className="rounded-xl border border-border bg-surface-elevated p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-muted">
                          {activity.startTime ?? "未定时间"}
                        </p>
                        <h3 className="mt-1 text-sm font-bold text-foreground">{activity.title}</h3>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {reservation?.hard ? (
                          <span className="trip-risk-badge trip-risk-high">固定约束</span>
                        ) : null}
                        {activity.environment === "indoor" ? (
                          <span className="trip-risk-badge trip-risk-low">室内</span>
                        ) : null}
                      </div>
                    </div>
                    {leg ? (
                      <p className="mt-2 text-xs text-muted">
                        上一段：{distance(leg.distanceMeters)} · {minutes(leg.durationSeconds)}
                      </p>
                    ) : index === 0 && visibleProjection.startAnchor ? (
                      <p className="mt-2 text-xs text-muted">从酒店/住宿出发</p>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>

          {visibleProjection.reservations.length > 0 ? (
            <div className="mt-5 rounded-xl border border-border p-3">
              <p className="text-xs font-bold text-foreground">固定预约与交通</p>
              <ul className="mt-2 grid gap-2 text-xs text-muted">
                {visibleProjection.reservations.map((item) => (
                  <li key={item.id}>
                    🔒 {item.startTime ?? "时间未定"} · {item.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-white p-3 sm:p-4">
          <TripExecutionMap
            plan={visiblePlan}
            waypoints={visibleProjection.routeWaypoints}
            startAnchor={visibleProjection.startAnchor}
            endAnchor={visibleProjection.endAnchor}
          />
          <p className="mt-3 text-[11px] leading-5 text-muted">
            路线优化只调整可移动活动；固定门票、交通和必须预约活动不会被移动。地图继续使用 Weather V2 现有 MapLibre + OpenFreeMap 技术栈。
          </p>
        </div>
      </section>

      {selectedDay !== null ? (
        <TripExecutionReplanPanel
          day={selectedDay}
          activities={activities}
          partyProfile={workspace.partyProfile}
        />
      ) : null}
    </div>
  );
}
