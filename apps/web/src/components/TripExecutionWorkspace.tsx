"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  activityItemsToLegacy,
  normalizeActivityItems,
  type TripActivity,
} from "../trips/activity-intelligence";
import {
  loadMostRecentOfflineTrip,
  loadOfflineRoute,
  saveOfflineRoute,
} from "../trips/offline-store";
import { routeContextFingerprint } from "../trips/route-cache";
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
import { TripExecutionReplanPanel, type TripExecutionLocale } from "./TripExecutionReplanPanel";

interface TripExecutionWorkspaceProps {
  readonly locale?: TripExecutionLocale;
}

interface InitialWorkspace {
  readonly workspace: TripWorkspace | null;
  readonly fromOffline: boolean;
}

const COPY = {
  en: {
    emptyTitle: "No local trip is ready to execute",
    emptyBody: "Create or import a trip in the workspace first, then return to Execution Mode.",
    openWorkspace: "Open trip workspace",
    eyebrow: "Trip Execution Mode",
    title: "See exactly how today should run",
    intro:
      "See today’s activities, fixed bookings, accommodation and route in one place. If live routing is unavailable, an estimated route is still shown.",
    back: "Back to editor",
    optimize: "Optimize route & save",
    route: "Refresh real road route",
    routing: "Routing…",
    day: "Execution day",
    cityMissing: "City not set",
    routeSource: "Route source",
    routed: "Real roads",
    estimated: "Local estimate",
    distance: "Estimated distance",
    transit: "Estimated transfer",
    noCoords: "This day does not have enough geocoded activities for routing.",
    routedOk: "Real road routing refreshed; the timeline now shows the same route preview order.",
    routedFallback: "Routing is temporarily unavailable. Local route estimates remain usable.",
    saved: "Route order saved. Fixed tickets, transport and required reservations stayed in place.",
    offlineLoaded: "Loaded the most recent trip saved on this device.",
    timeline: "Execution timeline",
    preview: "This is the route preview order. Use “Optimize route & save” to persist it.",
    maps: "Open in Maps",
    noActivities: "No structured activities for this day yet.",
    timeMissing: "Time not set",
    fixed: "Fixed constraint",
    indoor: "Indoor",
    previous: "Previous leg",
    hotelStart: "Start from hotel/accommodation",
    reservations: "Fixed reservations & transport",
    mapNote:
      "Route changes only move activities that are safe to move. Fixed tickets, transport and required reservations stay in place.",
    min: "min",
    hour: "h",
  },
  "zh-cn": {
    emptyTitle: "还没有可执行的本地行程",
    emptyBody: "先到天气旅行工作台创建或导入行程，再进入执行模式。",
    openWorkspace: "打开旅行工作台",
    eyebrow: "旅行执行模式",
    title: "今天怎么走，一屏看清",
    intro:
      "把今天的活动、固定预约、住宿和路线放在同一页查看。实时道路路线暂时不可用时，仍会显示估算路线。",
    back: "返回编辑",
    optimize: "优化路线并保存",
    route: "刷新真实道路路线",
    routing: "路线计算中…",
    day: "执行日期",
    cityMissing: "未设置城市",
    routeSource: "路线来源",
    routed: "真实道路",
    estimated: "本地估算",
    distance: "预计里程",
    transit: "预计转场",
    noCoords: "当天还没有足够的带坐标活动用于路线计算。",
    routedOk: "已使用真实道路数据刷新当天路线；左侧时间轴同步显示路线预览顺序。",
    routedFallback: "路线服务暂时不可用，已使用本地估算路线，不影响行程执行。",
    saved: "已优化可移动景点顺序并保存；固定门票、交通和必须预约活动保持原位。",
    offlineLoaded: "已载入这台设备最近保存的行程。",
    timeline: "执行时间轴",
    preview: "当前显示路线预览顺序；点击“优化路线并保存”后写回行程。",
    maps: "在地图中打开",
    noActivities: "当天还没有结构化活动。",
    timeMissing: "未定时间",
    fixed: "固定约束",
    indoor: "室内",
    previous: "上一段",
    hotelStart: "从酒店/住宿出发",
    reservations: "固定预约与交通",
    mapNote: "路线调整只移动适合调整的活动；固定门票、交通和必须预约活动会保持原位。",
    min: "分钟",
    hour: "小时",
  },
  "zh-hant": {
    emptyTitle: "還沒有可執行的本機行程",
    emptyBody: "先到天氣旅行工作台建立或匯入行程，再進入執行模式。",
    openWorkspace: "開啟旅行工作台",
    eyebrow: "旅行執行模式",
    title: "今天怎麼走，一屏看清",
    intro:
      "把今天的活動、固定預約、住宿和路線放在同一頁查看。即時道路路線暫時無法使用時，仍會顯示估算路線。",
    back: "返回編輯",
    optimize: "最佳化路線並儲存",
    route: "更新真實道路路線",
    routing: "路線計算中…",
    day: "執行日期",
    cityMissing: "未設定城市",
    routeSource: "路線來源",
    routed: "真實道路",
    estimated: "本機估算",
    distance: "預估里程",
    transit: "預估轉場",
    noCoords: "當天還沒有足夠的座標活動可進行路線計算。",
    routedOk: "已使用真實道路資料更新當天路線；左側時間軸同步顯示路線預覽順序。",
    routedFallback: "路線服務暫時不可用，已使用本機估算路線，不影響行程執行。",
    saved: "已最佳化可移動景點順序並儲存；固定門票、交通和必須預約活動保持原位。",
    offlineLoaded: "已載入這台裝置最近儲存的行程。",
    timeline: "執行時間軸",
    preview: "目前顯示路線預覽順序；點擊「最佳化路線並儲存」後寫回行程。",
    maps: "在地圖中開啟",
    noActivities: "當天還沒有結構化活動。",
    timeMissing: "未定時間",
    fixed: "固定限制",
    indoor: "室內",
    previous: "上一段",
    hotelStart: "從飯店／住宿出發",
    reservations: "固定預約與交通",
    mapNote: "路線調整只移動適合調整的活動；固定門票、交通和必須預約活動會保持原位。",
    min: "分鐘",
    hour: "小時",
  },
} as const;

function localePrefix(locale: TripExecutionLocale): string {
  if (locale === "en") return "";
  return `/${locale}`;
}

function loadLocalWorkspace(): TripWorkspace | null {
  const raw = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (raw === null) return null;
  try {
    return normalizeWorkspace(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function loadInitialWorkspace(): Promise<InitialWorkspace> {
  const local = loadLocalWorkspace();
  if (local !== null) return { workspace: local, fromOffline: false };
  const offline = await loadMostRecentOfflineTrip();
  return {
    workspace: offline?.workspace ?? null,
    fromOffline: offline !== null,
  };
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

function formatMinutes(seconds: number, locale: TripExecutionLocale): string {
  const copy = COPY[locale];
  const total = Math.round(seconds / 60);
  if (total < 60) return `${total} ${copy.min}`;
  return `${Math.floor(total / 60)} ${copy.hour} ${total % 60} ${copy.min}`;
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

export function TripExecutionWorkspace({
  locale = "zh-cn",
}: TripExecutionWorkspaceProps): ReactElement {
  const copy = COPY[locale];
  const prefix = localePrefix(locale);
  const [workspace, setWorkspace] = useState<TripWorkspace | null>(null);
  const [dayId, setDayId] = useState("");
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [routing, setRouting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void loadInitialWorkspace().then((initial) => {
      if (!active) return;
      setWorkspace(initial.workspace);
      setDayId(initial.workspace?.days[0]?.id ?? "");
      if (initial.fromOffline) setMessage(copy.offlineLoaded);
    });
    return () => {
      active = false;
    };
  }, [copy.offlineLoaded]);

  const selectedDay = workspace?.days.find((day) => day.id === dayId) ?? workspace?.days[0] ?? null;
  const activities = useMemo(
    () => (selectedDay === null ? [] : dayActivities(selectedDay)),
    [selectedDay],
  );
  const projection = useMemo(() => projectExecution(activities), [activities]);
  const routeFingerprint = useMemo(
    () =>
      routeContextFingerprint(projection.routeWaypoints, {
        start: projection.startAnchor,
        end: projection.endAnchor,
      }),
    [projection],
  );
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
  const visibleProjection = useMemo(() => projectExecution(visibleActivities), [visibleActivities]);
  const workspaceId = workspace?.id ?? "";
  const selectedDayId = selectedDay?.id ?? "";

  useEffect(() => {
    let active = true;
    setRoutePlan(null);
    if (workspaceId.length === 0 || selectedDayId.length === 0) return;
    void loadOfflineRoute(workspaceId, selectedDayId, routeFingerprint).then((plan) => {
      if (active && plan !== null) setRoutePlan(plan);
    });
    return () => {
      active = false;
    };
  }, [routeFingerprint, selectedDayId, workspaceId]);

  const refreshRoute = async (): Promise<void> => {
    if (projection.routeWaypoints.length < 1) {
      setMessage(copy.noCoords);
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
      if (workspace !== null && selectedDay !== null) {
        await saveOfflineRoute(workspace.id, selectedDay.id, routed, routeFingerprint);
      }
      setMessage(copy.routedOk);
    } catch {
      setRoutePlan(estimated);
      if (workspace !== null && selectedDay !== null) {
        await saveOfflineRoute(workspace.id, selectedDay.id, estimated, routeFingerprint);
      }
      setMessage(copy.routedFallback);
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
    const reorderedProjection = projectExecution(reordered);
    const reorderedRoute = estimateRoutePlan(reorderedProjection.routeWaypoints, "driving", {
      start: reorderedProjection.startAnchor,
      end: reorderedProjection.endAnchor,
    });
    const reorderedFingerprint = routeContextFingerprint(reorderedProjection.routeWaypoints, {
      start: reorderedProjection.startAnchor,
      end: reorderedProjection.endAnchor,
    });
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
    setWorkspace(next);
    setRoutePlan(reorderedRoute);
    void saveOfflineRoute(next.id, selectedDay.id, reorderedRoute, reorderedFingerprint);
    setMessage(copy.saved);
  };

  if (workspace === null) {
    return (
      <section className="info-panel">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="mt-3 text-xl font-bold">{copy.emptyTitle}</h1>
        <p className="mt-2 text-sm text-muted">{copy.emptyBody}</p>
        <a className="trip-primary-button mt-4 inline-flex" href={`${prefix}/trips/workspace`}>
          {copy.openWorkspace}
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
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{copy.intro}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="trip-secondary-button" href={`${prefix}/trips/workspace`}>
              {copy.back}
            </a>
            <button className="trip-secondary-button" type="button" onClick={optimizeAndSave}>
              {copy.optimize}
            </button>
            <button
              className="trip-primary-button"
              type="button"
              disabled={routing}
              onClick={() => void refreshRoute()}
            >
              {routing ? copy.routing : copy.route}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 rounded-2xl border border-border bg-white p-4 sm:grid-cols-[220px_1fr] sm:p-5">
        <label className="grid gap-2 text-xs font-semibold text-muted">
          {copy.day}
          <select
            className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
            value={selectedDay?.id ?? ""}
            onChange={(event) => setDayId(event.target.value)}
          >
            {workspace.days.map((day) => (
              <option key={day.id} value={day.id}>
                D{day.dayNumber} · {day.date} · {day.cityName || copy.cityMissing}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-surface-elevated p-3">
            <span className="text-xs text-muted">{copy.routeSource}</span>
            <strong className="mt-1 block text-sm">
              {visiblePlan.source === "routed" ? copy.routed : copy.estimated}
            </strong>
          </div>
          <div className="rounded-xl bg-surface-elevated p-3">
            <span className="text-xs text-muted">{copy.distance}</span>
            <strong className="mt-1 block text-sm">{distance(visiblePlan.distanceMeters)}</strong>
          </div>
          <div className="rounded-xl bg-surface-elevated p-3">
            <span className="text-xs text-muted">{copy.transit}</span>
            <strong className="mt-1 block text-sm">
              {formatMinutes(visiblePlan.durationSeconds, locale)}
            </strong>
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
              <h2 className="mt-2 text-xl font-bold">
                D{selectedDay?.dayNumber} {copy.timeline}
              </h2>
              <p className="mt-1 text-[11px] text-muted">{copy.preview}</p>
            </div>
            {externalMaps ? (
              <a
                className="trip-secondary-button"
                href={externalMaps}
                target="_blank"
                rel="noreferrer"
              >
                {copy.maps}
              </a>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            {visibleActivities.length === 0 ? (
              <p className="text-sm text-muted">{copy.noActivities}</p>
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
                          {activity.startTime ?? copy.timeMissing}
                        </p>
                        <h3 className="mt-1 text-sm font-bold text-foreground">{activity.title}</h3>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {reservation?.hard ? (
                          <span className="trip-risk-badge trip-risk-high">{copy.fixed}</span>
                        ) : null}
                        {activity.environment === "indoor" ? (
                          <span className="trip-risk-badge trip-risk-low">{copy.indoor}</span>
                        ) : null}
                      </div>
                    </div>
                    {leg ? (
                      <p className="mt-2 text-xs text-muted">
                        {copy.previous}: {distance(leg.distanceMeters)} ·{" "}
                        {formatMinutes(leg.durationSeconds, locale)}
                      </p>
                    ) : index === 0 && visibleProjection.startAnchor ? (
                      <p className="mt-2 text-xs text-muted">{copy.hotelStart}</p>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>

          {visibleProjection.reservations.length > 0 ? (
            <div className="mt-5 rounded-xl border border-border p-3">
              <p className="text-xs font-bold text-foreground">{copy.reservations}</p>
              <ul className="mt-2 grid gap-2 text-xs text-muted">
                {visibleProjection.reservations.map((item) => (
                  <li key={item.id}>
                    🔒 {item.startTime ?? copy.timeMissing} · {item.title}
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
          <p className="mt-3 text-[11px] leading-5 text-muted">{copy.mapNote}</p>
        </div>
      </section>

      {selectedDay !== null ? (
        <TripExecutionReplanPanel
          locale={locale}
          day={selectedDay}
          activities={activities}
          partyProfile={workspace.partyProfile}
        />
      ) : null}
    </div>
  );
}
