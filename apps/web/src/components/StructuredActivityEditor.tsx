"use client";

import { useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import {
  activityItemsToLegacy,
  legacyActivityToStructured,
  normalizeActivityItems,
  withActivityPatch,
  type LegacyActivityContext,
  type TripActivity,
  type TripActivityEnvironment,
  type TripActivityFlexibility,
  type TripActivityPriority,
  type TripActivityReservation,
} from "../trips/activity-intelligence";
import { resolveConcretePlanB } from "../trips/activity-plan-b";
import { listCuratedPois, poiName, type PoiLocale } from "../trips/poi-catalog";
import type { TripForecastDay, TripWorkspaceDay } from "../trips/workspace";

export type StructuredActivityLocale = "en" | "zh-cn" | "zh-hant";

interface StructuredActivityEditorProps {
  readonly locale: StructuredActivityLocale;
  readonly day: TripWorkspaceDay;
  readonly forecast: TripForecastDay | null;
  readonly onChange: (patch: Partial<TripWorkspaceDay>) => void;
}

const COPY = {
  en: {
    title: "Structured activities",
    intro: "Weather-aware metadata powers concrete Plan B suggestions now and safe replanning later.",
    migrated: "Legacy itinerary text is preserved and upgraded deterministically when you edit.",
    addPoi: "Add curated place",
    choosePoi: "Choose a curated place",
    quick: "Quick add activity",
    quickPlaceholder: "09:00 Asakusa walk",
    add: "Add",
    empty: "No structured activities yet.",
    start: "Start",
    name: "Activity",
    environment: "Environment",
    flexibility: "Flexibility",
    priority: "Priority",
    reservation: "Reservation",
    indoor: "Indoor",
    outdoor: "Outdoor",
    mixed: "Mixed",
    fixed: "Fixed",
    movable: "Movable",
    flexible: "Flexible",
    must: "Must do",
    preferred: "Preferred",
    optional: "Optional",
    none: "None",
    recommended: "Recommended",
    required: "Required",
    remove: "Remove",
    planB: "Concrete Plan B",
    affected: "Weather-sensitive activity",
    rain: "Heavy rain risk",
    wind: "Strong wind risk",
    heat: "Heat risk",
    cold: "Cold risk",
    uv: "High UV risk",
    fixedWarning: "This activity is fixed or requires a reservation. Keep it unless the booking can be changed; use the alternatives as contingency options only.",
    alternatives: "Lower-weather-risk alternatives",
    addFallback: "Add as fallback",
    noPoi: "No curated POI catalogue is available for this city yet. Generic Plan B remains available.",
  },
  "zh-cn": {
    title: "结构化活动",
    intro: "室内外、天气敏感度和固定约束会用于当前 Plan B，并作为后续安全重排的基础。",
    migrated: "旧版每行行程会被确定性转换，原文本不会丢失。",
    addPoi: "添加精选 POI",
    choosePoi: "选择一个精选地点",
    quick: "快速添加活动",
    quickPlaceholder: "09:00 浅草寺",
    add: "添加",
    empty: "当天还没有结构化活动。",
    start: "开始",
    name: "活动",
    environment: "环境",
    flexibility: "可调整性",
    priority: "优先级",
    reservation: "预约",
    indoor: "室内",
    outdoor: "室外",
    mixed: "混合",
    fixed: "固定",
    movable: "可移动",
    flexible: "灵活",
    must: "必去",
    preferred: "优先",
    optional: "可选",
    none: "无需",
    recommended: "建议预约",
    required: "必须预约",
    remove: "删除",
    planB: "具体 Plan B",
    affected: "受天气影响的活动",
    rain: "强降雨风险",
    wind: "大风风险",
    heat: "高温风险",
    cold: "低温风险",
    uv: "高紫外线风险",
    fixedWarning: "该活动是固定约束或必须预约。除非确认可以改期，否则不要移动；以下地点只作为备用方案。",
    alternatives: "低天气风险备选",
    addFallback: "加入备选",
    noPoi: "这个城市还没有精选 POI 数据，继续使用通用 Plan B。",
  },
  "zh-hant": {
    title: "結構化活動",
    intro: "室內外、天氣敏感度和固定約束會用於目前 Plan B，並作為後續安全重排的基礎。",
    migrated: "舊版每行行程會被確定性轉換，原文字不會遺失。",
    addPoi: "新增精選 POI",
    choosePoi: "選擇一個精選地點",
    quick: "快速新增活動",
    quickPlaceholder: "09:00 淺草寺",
    add: "新增",
    empty: "當天還沒有結構化活動。",
    start: "開始",
    name: "活動",
    environment: "環境",
    flexibility: "可調整性",
    priority: "優先級",
    reservation: "預約",
    indoor: "室內",
    outdoor: "室外",
    mixed: "混合",
    fixed: "固定",
    movable: "可移動",
    flexible: "靈活",
    must: "必去",
    preferred: "優先",
    optional: "可選",
    none: "無需",
    recommended: "建議預約",
    required: "必須預約",
    remove: "刪除",
    planB: "具體 Plan B",
    affected: "受天氣影響的活動",
    rain: "強降雨風險",
    wind: "大風風險",
    heat: "高溫風險",
    cold: "低溫風險",
    uv: "高紫外線風險",
    fixedWarning: "該活動是固定約束或必須預約。除非確認可以改期，否則不要移動；以下地點只作為備用方案。",
    alternatives: "低天氣風險備選",
    addFallback: "加入備選",
    noPoi: "這個城市還沒有精選 POI 資料，繼續使用通用 Plan B。",
  },
} as const;

function context(day: TripWorkspaceDay): LegacyActivityContext {
  return {
    dayId: day.id,
    cityId: day.cityId,
    dayTheme: day.theme,
    dayFlexible: day.flexible,
    dayNotes: day.notes,
  };
}

function poiLocale(locale: StructuredActivityLocale): PoiLocale {
  return locale;
}

function environmentLabel(value: TripActivityEnvironment, copy: (typeof COPY)[StructuredActivityLocale]): string {
  return value === "indoor" ? copy.indoor : value === "outdoor" ? copy.outdoor : copy.mixed;
}

function flexibilityLabel(value: TripActivityFlexibility, copy: (typeof COPY)[StructuredActivityLocale]): string {
  return value === "fixed" ? copy.fixed : value === "movable" ? copy.movable : copy.flexible;
}

function priorityLabel(value: TripActivityPriority, copy: (typeof COPY)[StructuredActivityLocale]): string {
  return value === "must" ? copy.must : value === "preferred" ? copy.preferred : copy.optional;
}

function reservationLabel(value: TripActivityReservation, copy: (typeof COPY)[StructuredActivityLocale]): string {
  return value === "required" ? copy.required : value === "recommended" ? copy.recommended : copy.none;
}

export function StructuredActivityEditor({
  locale,
  day,
  forecast,
  onChange,
}: StructuredActivityEditorProps): ReactElement {
  const copy = COPY[locale];
  const [quickText, setQuickText] = useState("");
  const [selectedPoi, setSelectedPoi] = useState("");
  const activityContext = useMemo(() => context(day), [day]);
  const items = useMemo(
    () => normalizeActivityItems(day.activityItems, day.activities, activityContext),
    [activityContext, day.activities, day.activityItems],
  );
  const pois = useMemo(() => listCuratedPois(day.cityId), [day.cityId]);
  const planB = useMemo(
    () => resolveConcretePlanB(day, forecast, poiLocale(locale)),
    [day, forecast, locale],
  );

  const commit = (next: ReadonlyArray<TripActivity>): void => {
    onChange({ activityItems: next, activities: activityItemsToLegacy(next) });
  };

  const update = (index: number, patch: Partial<TripActivity>): void => {
    commit(
      items.map((item, itemIndex) =>
        itemIndex === index ? withActivityPatch(item, patch, activityContext) : item,
      ),
    );
  };

  const addQuick = (): void => {
    if (quickText.trim().length === 0 || items.length >= 12) return;
    commit([...items, legacyActivityToStructured(quickText, items.length, activityContext)]);
    setQuickText("");
  };

  const addPoi = (poiId = selectedPoi, fallback = false): void => {
    const poi = pois.find((item) => item.id === poiId);
    if (poi === undefined || items.length >= 12) return;
    const next: TripActivity = {
      id: `activity-${day.id}-${items.length + 1}-${poi.id}`,
      title: poiName(poi, poiLocale(locale)),
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
      priority: fallback ? "optional" : "preferred",
      poiId: poi.id,
      alternatives: [],
      notes: fallback ? "Plan B fallback" : "",
    };
    commit([...items, next]);
    setSelectedPoi("");
  };

  return (
    <section className="mt-5 rounded-2xl border border-border/80 bg-surface-elevated p-4" data-structured-activities="v2">
      <div>
        <p className="eyebrow">{copy.title}</p>
        <p className="mt-2 text-xs leading-5 text-muted">{copy.intro}</p>
        {day.version === undefined ? null : null}
        <p className="mt-1 text-[11px] text-muted">{copy.migrated}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={quickText}
            placeholder={copy.quickPlaceholder}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-sm"
            onChange={(event) => setQuickText(event.target.value.slice(0, 300))}
          />
          <button type="button" className="trip-secondary-button" onClick={addQuick}>{copy.add}</button>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedPoi}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-sm"
            onChange={(event) => setSelectedPoi(event.target.value)}
          >
            <option value="">{pois.length === 0 ? copy.noPoi : copy.choosePoi}</option>
            {pois.map((poi) => <option key={poi.id} value={poi.id}>{poiName(poi, poiLocale(locale))} · {environmentLabel(poi.environment, copy)}</option>)}
          </select>
          <button type="button" className="trip-secondary-button" disabled={selectedPoi.length === 0} onClick={() => addPoi()}>{copy.addPoi}</button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {items.length === 0 ? <p className="text-sm text-muted">{copy.empty}</p> : items.map((item, index) => (
          <article key={item.id} className="rounded-xl border border-border bg-white p-3" data-activity-environment={item.environment} data-activity-flexibility={item.flexibility}>
            <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
              <label className="grid gap-1 text-xs font-semibold text-muted">{copy.start}<input type="time" value={item.startTime ?? ""} className="min-h-10 rounded-lg border border-border px-2 text-sm text-foreground" onChange={(event) => update(index, { startTime: event.target.value || null })} /></label>
              <label className="grid gap-1 text-xs font-semibold text-muted">{copy.name}<input type="text" value={item.title} className="min-h-10 rounded-lg border border-border px-2 text-sm text-foreground" onChange={(event) => update(index, { title: event.target.value.slice(0, 180) })} /></label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-xs text-muted">{copy.environment}<select value={item.environment} className="min-h-10 rounded-lg border border-border bg-white px-2 text-sm" onChange={(event: ChangeEvent<HTMLSelectElement>) => update(index, { environment: event.target.value as TripActivityEnvironment })}>{(["indoor", "outdoor", "mixed"] as const).map((value) => <option key={value} value={value}>{environmentLabel(value, copy)}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-muted">{copy.flexibility}<select value={item.flexibility} className="min-h-10 rounded-lg border border-border bg-white px-2 text-sm" onChange={(event) => update(index, { flexibility: event.target.value as TripActivityFlexibility })}>{(["fixed", "movable", "flexible"] as const).map((value) => <option key={value} value={value}>{flexibilityLabel(value, copy)}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-muted">{copy.priority}<select value={item.priority} className="min-h-10 rounded-lg border border-border bg-white px-2 text-sm" onChange={(event) => update(index, { priority: event.target.value as TripActivityPriority })}>{(["must", "preferred", "optional"] as const).map((value) => <option key={value} value={value}>{priorityLabel(value, copy)}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-muted">{copy.reservation}<select value={item.reservation} className="min-h-10 rounded-lg border border-border bg-white px-2 text-sm" onChange={(event) => update(index, { reservation: event.target.value as TripActivityReservation })}>{(["none", "recommended", "required"] as const).map((value) => <option key={value} value={value}>{reservationLabel(value, copy)}</option>)}</select></label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted"><span>{item.poiId ?? "manual"} · {item.weatherSensitivity.length === 0 ? copy.indoor : item.weatherSensitivity.join(" / ")}</span><button type="button" className="font-bold text-danger" onClick={() => commit(items.filter((_, itemIndex) => itemIndex !== index))}>{copy.remove}</button></div>
          </article>
        ))}
      </div>

      {planB !== null ? (
        <section className="mt-5 rounded-xl border border-border bg-white p-4" data-concrete-plan-b="true">
          <p className="eyebrow">{copy.planB}</p>
          <p className="mt-2 text-sm font-bold text-foreground">{copy.affected}: {planB.affectedActivity.title}</p>
          <p className="mt-1 text-xs text-muted">{copy[planB.reason]}</p>
          {planB.fixed ? <p className="mt-3 rounded-lg bg-surface-elevated p-3 text-xs leading-5 text-foreground">{copy.fixedWarning}</p> : null}
          {planB.candidates.length > 0 ? <><p className="mt-4 text-xs font-bold text-muted">{copy.alternatives}</p><div className="mt-2 flex flex-wrap gap-2">{planB.candidates.map((candidate) => <button key={candidate.poi.id} type="button" className="trip-secondary-button" onClick={() => addPoi(candidate.poi.id, true)}>{copy.addFallback}: {candidate.label}</button>)}</div></> : <p className="mt-3 text-xs text-muted">{copy.noPoi}</p>}
        </section>
      ) : null}
    </section>
  );
}
