"use client";

import { useMemo, useState, type ReactElement } from "react";

import { emitProductAnalytics } from "../analytics/browser-events";
import { activityItemsToLegacy, type TripActivity } from "../trips/activity-intelligence";
import type { ActivityHourlyWeather } from "../trips/activity-risk";
import { findWeatherFallbacks, poiName } from "../trips/poi-catalog";
import {
  buildDeterministicReplan,
  type ReplanChange,
  type ReplanProposalDraft,
} from "../trips/replan-solver";
import { normalizeWorkspace, type TripWorkspace } from "../trips/workspace";
import { ContextualAffiliateSurface } from "./ContextualAffiliateSurface";

const WEATHER_READ_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");

export type TripReplanLocale = "en" | "zh-cn" | "zh-hant";

interface HourlyResponse {
  readonly data?: {
    readonly snapshotId?: string;
    readonly coverage?: {
      readonly availableCityIds?: ReadonlyArray<string>;
      readonly unavailableCityIds?: ReadonlyArray<string>;
    };
    readonly items?: ReadonlyArray<ActivityHourlyWeather>;
  };
}

interface TripReplanPanelProps {
  readonly locale: TripReplanLocale;
  readonly workspace: TripWorkspace;
  readonly canApply: boolean;
  readonly cloudReady: boolean;
  readonly onApply: (
    workspace: TripWorkspace,
    weatherSnapshotId: string,
    selectedChangeIds: ReadonlyArray<string>,
  ) => Promise<void>;
}

const COPY = {
  en: {
    title: "Weather replan",
    intro:
      "Compare structured activities with the hourly forecast. Nothing changes until you review and apply selected changes.",
    day: "Day to review",
    analyze: "Analyze hourly weather",
    analyzing: "Analyzing…",
    noStructured: "This day has no structured activities to analyze.",
    unavailable:
      "Hourly coverage is unavailable for this city/date. No optimistic proposal was created.",
    noChanges: "No safe weather-driven change improves this day enough to recommend.",
    proposal: "Proposed changes",
    before: "Before",
    after: "After",
    risk: "Risk score",
    reduction: "Improvement",
    move: "Move time",
    replace: "Use fallback",
    travel: "Approx. relocation",
    minutes: "min",
    fixed: "Protected / unchanged",
    apply: "Apply selected changes",
    applying: "Applying…",
    cloudRequired:
      "Save/sign in to an editable Cloud Trip to apply. Preview remains available locally.",
    viewer: "This shared trip is read-only. You can inspect proposals but cannot apply them.",
    applied: "Selected changes were applied as a new Cloud Trip revision.",
    failed: "The proposal could not be applied. Reload the latest Cloud version and try again.",
    select: "Select change",
  },
  "zh-cn": {
    title: "天气重排建议",
    intro: "用小时级天气检查结构化活动。只有你勾选并点击应用后，行程才会真正变更。",
    day: "选择要检查的日期",
    analyze: "分析小时天气",
    analyzing: "分析中…",
    noStructured: "这一天没有可分析的结构化活动。",
    unavailable: "该城市/日期没有小时级天气覆盖，系统不会生成乐观建议。",
    noChanges: "没有发现风险改善足够大且满足约束的安全调整。",
    proposal: "建议变更",
    before: "原计划",
    after: "建议后",
    risk: "风险分",
    reduction: "改善",
    move: "调整时段",
    replace: "切换备选",
    travel: "预计新增转场",
    minutes: "分钟",
    fixed: "固定 / 保持不变",
    apply: "应用已选变更",
    applying: "应用中…",
    cloudRequired: "保存并登录可编辑的云端行程后才能应用；本地仍可预览建议。",
    viewer: "当前是只读协作行程，可查看建议但不能应用。",
    applied: "已将所选变更作为新的云端行程版本应用。",
    failed: "应用失败，请先载入云端最新版本后再试。",
    select: "选择此变更",
  },
  "zh-hant": {
    title: "天氣重排建議",
    intro: "用小時級天氣檢查結構化活動。只有你勾選並點擊套用後，行程才會真正變更。",
    day: "選擇要檢查的日期",
    analyze: "分析小時天氣",
    analyzing: "分析中…",
    noStructured: "這一天沒有可分析的結構化活動。",
    unavailable: "該城市／日期沒有小時級天氣涵蓋，系統不會產生樂觀建議。",
    noChanges: "沒有發現風險改善足夠大且符合限制的安全調整。",
    proposal: "建議變更",
    before: "原計畫",
    after: "建議後",
    risk: "風險分",
    reduction: "改善",
    move: "調整時段",
    replace: "切換備選",
    travel: "預計新增轉場",
    minutes: "分鐘",
    fixed: "固定／保持不變",
    apply: "套用已選變更",
    applying: "套用中…",
    cloudRequired: "儲存並登入可編輯的雲端行程後才能套用；本機仍可預覽建議。",
    viewer: "目前是唯讀協作行程，可查看建議但不能套用。",
    applied: "已將所選變更作為新的雲端行程版本套用。",
    failed: "套用失敗，請先載入雲端最新版本後再試。",
    select: "選擇此變更",
  },
} as const;

function apiLocale(locale: TripReplanLocale): "en" | "zh-cn" {
  return locale === "en" ? "en" : "zh-cn";
}

function fallbackActivities(
  day: TripWorkspace["days"][number],
  locale: TripReplanLocale,
): ReadonlyArray<TripActivity> {
  return findWeatherFallbacks(day.cityId, null, 5).map((poi) => ({
    id: `fallback-${poi.id}`,
    title: poiName(poi, locale),
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

function changeLabel(change: ReplanChange, copy: (typeof COPY)[TripReplanLocale]): string {
  return change.kind === "move_time" ? copy.move : copy.replace;
}

function activitySummary(activity: TripActivity): string {
  const time = activity.startTime ?? "—";
  return `${time} · ${activity.title}`;
}

function applySelectedProposal(
  workspace: TripWorkspace,
  dayId: string,
  proposal: ReplanProposalDraft,
  selectedIds: ReadonlySet<string>,
): TripWorkspace {
  const byId = new Map(
    proposal.changes
      .filter((change) => selectedIds.has(change.activityId))
      .map((change) => [change.activityId, change.after] as const),
  );
  return normalizeWorkspace({
    ...workspace,
    updatedAt: new Date().toISOString(),
    days: workspace.days.map((day) => {
      if (day.id !== dayId || day.activityItems === undefined) return day;
      const nextItems = day.activityItems.map((activity) => byId.get(activity.id) ?? activity);
      return {
        ...day,
        activityItems: nextItems,
        activities: activityItemsToLegacy(nextItems),
      };
    }),
  });
}

export function TripReplanPanel({
  locale,
  workspace,
  canApply,
  cloudReady,
  onApply,
}: TripReplanPanelProps): ReactElement {
  const copy = COPY[locale];
  const eligibleDays = useMemo(
    () =>
      workspace.days.filter((day) => (day.activityItems?.length ?? 0) > 0 && day.cityId.length > 0),
    [workspace.days],
  );
  const [dayId, setDayId] = useState(eligibleDays[0]?.id ?? "");
  const [proposal, setProposal] = useState<ReplanProposalDraft | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [state, setState] = useState<"idle" | "loading" | "applying">("idle");
  const [message, setMessage] = useState("");

  const selectedDay = eligibleDays.find((day) => day.id === dayId) ?? eligibleDays[0] ?? null;
  const hasIndoorFallbackProposal =
    proposal?.changes.some((change) => change.kind === "replace_activity") ?? false;

  const analyze = async (): Promise<void> => {
    if (selectedDay === null || selectedDay.activityItems === undefined) {
      setMessage(copy.noStructured);
      return;
    }
    if (WEATHER_READ_BASE.length === 0) {
      setMessage(copy.unavailable);
      return;
    }
    setState("loading");
    setMessage("");
    setProposal(null);
    try {
      const params = new URLSearchParams({
        cityIds: selectedDay.cityId,
        date: selectedDay.date,
        locale: apiLocale(locale),
      });
      const response = await fetch(`${WEATHER_READ_BASE}/api/v1/trip-hourly?${params.toString()}`);
      if (!response.ok) throw new Error(`HOURLY_${response.status}`);
      const payload = (await response.json()) as HourlyResponse;
      const hourly = payload.data?.items ?? [];
      const snapshotId = payload.data?.snapshotId;
      const available =
        payload.data?.coverage?.availableCityIds?.includes(selectedDay.cityId) === true;
      if (!available || hourly.length === 0 || typeof snapshotId !== "string") {
        setMessage(copy.unavailable);
        return;
      }
      const next = buildDeterministicReplan({
        date: selectedDay.date,
        weatherSnapshotId: snapshotId,
        activities: selectedDay.activityItems,
        hourly,
        fallbackActivities: fallbackActivities(selectedDay, locale),
        partyProfile: workspace.partyProfile,
      });
      setProposal(next);
      setSelectedIds(new Set(next.changes.map((change) => change.activityId)));
      if (next.changes.length > 0) {
        emitProductAnalytics({
          locale,
          routeTemplate: "/trips/workspace",
          fields: {
            event: "replan_proposed",
            change_count: next.changes.length,
            fallback_included: next.changes.some((change) => change.kind === "replace_activity"),
          },
        });
      }
      setMessage(next.changes.length === 0 ? copy.noChanges : "");
    } catch {
      setMessage(copy.unavailable);
    } finally {
      setState("idle");
    }
  };

  const toggleChange = (activityId: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  };

  const apply = async (): Promise<void> => {
    if (proposal === null || selectedDay === null || selectedIds.size === 0 || !canApply) return;
    const selectedChangeIds = proposal.changes
      .map((change) => change.activityId)
      .filter((activityId) => selectedIds.has(activityId));
    const proposedWorkspace = applySelectedProposal(
      workspace,
      selectedDay.id,
      proposal,
      selectedIds,
    );
    setState("applying");
    setMessage("");
    try {
      await onApply(proposedWorkspace, proposal.weatherSnapshotId, selectedChangeIds);
      emitProductAnalytics({
        locale,
        routeTemplate: "/trips/workspace",
        fields: { event: "replan_accepted", change_count: selectedChangeIds.length },
      });
      setProposal(null);
      setSelectedIds(new Set());
      setMessage(copy.applied);
    } catch {
      setMessage(copy.failed);
    } finally {
      setState("idle");
    }
  };

  return (
    <section
      className="mt-4 rounded-2xl border border-border/80 bg-white p-4 sm:p-5"
      data-trip-replan-review="phase8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Phase 8</p>
          <h3 className="mt-2 text-base font-bold text-foreground">{copy.title}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{copy.intro}</p>
        </div>
        <button
          type="button"
          className="trip-secondary-button"
          disabled={selectedDay === null || state !== "idle"}
          onClick={() => void analyze()}
        >
          {state === "loading" ? copy.analyzing : copy.analyze}
        </button>
      </div>

      <label className="mt-4 block text-xs font-semibold text-muted">
        <span className="mb-1 block">{copy.day}</span>
        <select
          value={selectedDay?.id ?? ""}
          className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground sm:max-w-md"
          onChange={(event) => {
            setDayId(event.target.value);
            setProposal(null);
            setSelectedIds(new Set());
            setMessage("");
          }}
        >
          {eligibleDays.length === 0 ? <option value="">{copy.noStructured}</option> : null}
          {eligibleDays.map((day) => (
            <option key={day.id} value={day.id}>
              D{day.dayNumber} · {day.date} · {day.cityName}
            </option>
          ))}
        </select>
      </label>

      {proposal !== null && proposal.unchangedFixedActivityIds.length > 0 ? (
        <p
          className="mt-4 rounded-xl bg-surface-elevated p-3 text-xs text-muted"
          data-replan-fixed="unchanged"
        >
          <strong>{copy.fixed}:</strong> {proposal.unchangedFixedActivityIds.join(", ")}
        </p>
      ) : null}

      {proposal !== null && proposal.changes.length > 0 ? (
        <div className="mt-4 grid gap-3" data-replan-proposal="visible">
          <h4 className="text-sm font-bold text-foreground">{copy.proposal}</h4>
          {proposal.changes.map((change) => (
            <article key={change.activityId} className="rounded-xl border border-border/80 p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedIds.has(change.activityId)}
                  onChange={() => toggleChange(change.activityId)}
                  aria-label={`${copy.select}: ${change.before.title}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted">
                    {changeLabel(change, copy)}
                  </span>
                  <span className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <span className="rounded-lg bg-surface-elevated p-2">
                      <strong>{copy.before}:</strong> {activitySummary(change.before)}
                      <br />
                      <span className="text-xs text-muted">
                        {copy.risk}: {change.riskBefore.score ?? "—"}
                      </span>
                    </span>
                    <span className="rounded-lg bg-surface-elevated p-2">
                      <strong>{copy.after}:</strong> {activitySummary(change.after)}
                      <br />
                      <span className="text-xs text-muted">
                        {copy.risk}: {change.riskAfter.score ?? "—"} · {copy.reduction} +
                        {change.riskReduction}
                      </span>
                    </span>
                  </span>
                  {change.travelDeltaMinutes !== null && change.travelDeltaMinutes > 0 ? (
                    <span className="mt-2 block text-xs text-muted">
                      {copy.travel}: {change.travelDeltaMinutes} {copy.minutes}
                    </span>
                  ) : null}
                </span>
              </label>
            </article>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="trip-primary-button"
              disabled={!canApply || selectedIds.size === 0 || state !== "idle"}
              onClick={() => void apply()}
            >
              {state === "applying" ? copy.applying : copy.apply}
            </button>
            {!cloudReady ? <span className="text-xs text-muted">{copy.cloudRequired}</span> : null}
            {cloudReady && !canApply ? (
              <span className="text-xs text-muted">{copy.viewer}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {proposal !== null && selectedDay !== null && hasIndoorFallbackProposal ? (
        <div className="mt-4" data-commerce-after-decision="weather-indoor-fallback">
          <ContextualAffiliateSurface
            locale={locale}
            context={{
              stage: "weather_replan",
              destinationId: selectedDay.cityId,
              hasDestinationDecision: true,
              hasTrip: true,
              hasStructuredActivities: true,
              carDependent: false,
              weatherAction: "indoor_fallback",
              indoorFallbackAvailable: true,
              tripStartsWithinDays: null,
            }}
          />
        </div>
      ) : null}

      {message.length > 0 ? <p className="mt-3 text-xs text-muted">{message}</p> : null}
    </section>
  );
}
