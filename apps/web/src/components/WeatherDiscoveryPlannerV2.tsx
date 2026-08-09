"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { clearCloudMetadata } from "../trips/cloud-sync";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  normalizeWorkspace,
  type TripCityOption,
  type TripForecastDay,
  type TripPartyProfile,
  type TripWorkspace,
} from "../trips/workspace";
import { toTraditionalCity, toTraditionalForecast } from "../trips/traditional";
import {
  allocateDiscoveryDates,
  buildDiscoveryWorkspace,
  discoveryDateRange,
} from "../discovery/discovery-trip";
import { contextualizeDiscoveryResults } from "../discovery/discovery-context";
import {
  listDiscoveryIntents,
  parseDiscoveryPreferences,
  rankDiscoveryCities,
  serializeDiscoveryPreferences,
  type DiscoveryCityResult,
  type DiscoveryPreferences,
  type DiscoveryReasonCode,
  type DiscoveryTheme,
  type WeatherDiscoveryIntent,
} from "../discovery/weather-discovery";
import { ContextualAffiliateSurface } from "./ContextualAffiliateSurface";
import { ExplorerMap } from "./ExplorerMap";

export type WeatherDiscoveryLocale = "en" | "zh-cn" | "zh-hant";
type LoadState = "loading" | "ready" | "error";

interface TripCitiesResponse {
  readonly data?: { readonly items?: ReadonlyArray<TripCityOption> };
}
interface TripForecastResponse {
  readonly data?: {
    readonly snapshotId?: string;
    readonly freshness?: { readonly dataUpdatedAt?: string; readonly stale?: boolean };
    readonly items?: ReadonlyArray<TripForecastDay>;
  };
}

const API_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");
const MAX_CITIES_PER_REQUEST = 12;
const MAX_SHORTLIST = 4;

const COPY = {
  en: {
    eyebrow: "Weather Discovery 2.0",
    title: "Start with the weather. Decide the destination second.",
    intro:
      "Choose exact dates and the conditions you care about. Rankings, map markers and comparisons use the same persisted forecast snapshot.",
    when: "Travel dates",
    from: "From",
    to: "To",
    intent: "What matters most?",
    context: "Trip context",
    party: "Travellers",
    theme: "Trip style",
    any: "Any",
    adults: "Adults",
    family: "Family",
    senior: "Senior-friendly",
    city: "City",
    beach: "Beach",
    outdoor: "Outdoor",
    indoor: "Indoor",
    constraints: "Optional limits",
    rain: "Max rain chance",
    tempMin: "Min night temperature",
    tempMax: "Max daytime temperature",
    wind: "Max wind",
    noLimit: "No limit",
    apply: "Update results",
    loading: "Checking destinations…",
    unavailable: "Weather discovery is temporarily unavailable.",
    invalidRange: "Choose a valid range of 1–16 days.",
    noMatches: "No destinations match every selected limit. Relax one constraint and try again.",
    results: "Best matches",
    checked: "destinations matched",
    shortlist: "Shortlist",
    shortlisted: "Shortlisted",
    shortlistFull: "You can compare up to 4 cities.",
    compare: "Compare shortlist",
    compareIntro: "One weather snapshot, the same dates, side by side.",
    emptyShortlist: "Shortlist 2–4 destinations to compare them here.",
    score: "Intent score",
    rainMetric: "Peak rain",
    tempMetric: "Avg temperature",
    windMetric: "Peak wind",
    uvMetric: "Peak UV",
    forecast: "Daily outlook",
    trip: "Turn shortlist into a trip",
    tripIntro:
      "The selected dates are split into contiguous city blocks. This creates city/day scaffolding only—POIs come in Phase 7.",
    create: "Create new trip",
    append: "Append to current trip",
    openTrip: "Open trip",
    created: "Trip workspace created.",
    appended: "Cities appended to your current workspace.",
    needCity: "Shortlist at least one destination first.",
    needDates: "The date range needs at least one day per shortlisted city.",
    refreshed: "Forecast updated",
    stale: "stale snapshot",
    apiMissing: "Weather read API is not configured.",
    titleTrip: "Weather shortlist trip",
    filtersShare: "Filters and shortlist are stored in the URL so this comparison can be shared.",
    remove: "Remove",
  },
  "zh-cn": {
    eyebrow: "天气探索 2.0",
    title: "先看天气，再决定去哪里。",
    intro: "选择准确日期和真正关心的天气条件。排行榜、地图和城市对比始终使用同一份持久化天气快照。",
    when: "出行日期",
    from: "开始",
    to: "结束",
    intent: "你最在意什么？",
    context: "出行情景",
    party: "同行成员",
    theme: "游玩类型",
    any: "不限",
    adults: "成人",
    family: "亲子家庭",
    senior: "含长辈",
    city: "城市游",
    beach: "海岛/沙滩",
    outdoor: "户外",
    indoor: "室内",
    constraints: "可选限制条件",
    rain: "最高降雨概率",
    tempMin: "最低夜间温度",
    tempMax: "最高白天气温",
    wind: "最大风速",
    noLimit: "不限",
    apply: "更新推荐",
    loading: "正在比较目的地…",
    unavailable: "天气探索暂时不可用。",
    invalidRange: "请选择 1–16 天的有效日期范围。",
    noMatches: "没有城市同时满足全部限制条件，可以放宽一个条件后再试。",
    results: "最匹配的目的地",
    checked: "个目的地符合条件",
    shortlist: "加入对比",
    shortlisted: "已加入对比",
    shortlistFull: "最多同时对比 4 个城市。",
    compare: "城市对比",
    compareIntro: "同一份天气快照、同一组日期，直接横向比较。",
    emptyShortlist: "先加入 2–4 个目的地，即可在这里横向比较。",
    score: "意图评分",
    rainMetric: "最高降雨",
    tempMetric: "平均气温",
    windMetric: "最大风速",
    uvMetric: "最高 UV",
    forecast: "逐日天气",
    trip: "把对比城市变成行程",
    tripIntro: "所选日期会按城市顺序连续均分，只创建“城市 + 日期”骨架；具体 POI 留到 Phase 7。",
    create: "创建新行程",
    append: "追加到当前行程",
    openTrip: "打开行程",
    created: "已创建行程工作区。",
    appended: "已追加到当前行程。",
    needCity: "请先至少加入一个目的地。",
    needDates: "日期天数必须不少于已选城市数，才能保证每城至少一天。",
    refreshed: "天气已更新",
    stale: "数据可能已过期",
    apiMissing: "天气只读 API 尚未配置。",
    titleTrip: "天气优选行程",
    filtersShare: "筛选条件和对比城市会写入 URL，可直接分享当前结果。",
    remove: "移除",
  },
  "zh-hant": {
    eyebrow: "天氣探索 2.0",
    title: "先看天氣，再決定去哪裡。",
    intro: "選擇準確日期和真正關心的天氣條件。排行榜、地圖和城市比較始終使用同一份持久化天氣快照。",
    when: "出行日期",
    from: "開始",
    to: "結束",
    intent: "你最在意什麼？",
    context: "出行情境",
    party: "同行成員",
    theme: "遊玩類型",
    any: "不限",
    adults: "成人",
    family: "親子家庭",
    senior: "含長輩",
    city: "城市遊",
    beach: "海島/沙灘",
    outdoor: "戶外",
    indoor: "室內",
    constraints: "可選限制條件",
    rain: "最高降雨機率",
    tempMin: "最低夜間溫度",
    tempMax: "最高白天氣溫",
    wind: "最大風速",
    noLimit: "不限",
    apply: "更新推薦",
    loading: "正在比較目的地…",
    unavailable: "天氣探索暫時無法使用。",
    invalidRange: "請選擇 1–16 天的有效日期範圍。",
    noMatches: "沒有城市同時符合全部限制條件，可以放寬一個條件後再試。",
    results: "最匹配的目的地",
    checked: "個目的地符合條件",
    shortlist: "加入比較",
    shortlisted: "已加入比較",
    shortlistFull: "最多同時比較 4 個城市。",
    compare: "城市比較",
    compareIntro: "同一份天氣快照、同一組日期，直接橫向比較。",
    emptyShortlist: "先加入 2–4 個目的地，即可在這裡橫向比較。",
    score: "意圖評分",
    rainMetric: "最高降雨",
    tempMetric: "平均氣溫",
    windMetric: "最大風速",
    uvMetric: "最高 UV",
    forecast: "逐日天氣",
    trip: "把比較城市變成行程",
    tripIntro: "所選日期會按城市順序連續均分，只建立「城市 + 日期」骨架；具體 POI 留到 Phase 7。",
    create: "建立新行程",
    append: "追加到目前行程",
    openTrip: "開啟行程",
    created: "已建立行程工作區。",
    appended: "已追加到目前行程。",
    needCity: "請先至少加入一個目的地。",
    needDates: "日期天數必須不少於已選城市數，才能保證每城至少一天。",
    refreshed: "天氣已更新",
    stale: "資料可能已過期",
    apiMissing: "天氣唯讀 API 尚未設定。",
    titleTrip: "天氣優選行程",
    filtersShare: "篩選條件和比較城市會寫入 URL，可直接分享目前結果。",
    remove: "移除",
  },
} as const;

const INTENT_COPY: Record<WeatherDiscoveryLocale, Record<WeatherDiscoveryIntent, string>> = {
  en: {
    dry: "Least rain",
    outdoor: "Best outdoors",
    beach: "Beach weather",
    cool_escape: "Cool escape",
    warm_escape: "Warm escape",
    family_comfort: "Family comfort",
    senior_comfort: "Senior comfort",
  },
  "zh-cn": {
    dry: "哪里不下雨",
    outdoor: "适合户外",
    beach: "适合海岛",
    cool_escape: "避暑",
    warm_escape: "暖和一点",
    family_comfort: "亲子舒适",
    senior_comfort: "长辈友好",
  },
  "zh-hant": {
    dry: "哪裡不下雨",
    outdoor: "適合戶外",
    beach: "適合海島",
    cool_escape: "避暑",
    warm_escape: "暖和一點",
    family_comfort: "親子舒適",
    senior_comfort: "長輩友好",
  },
};

const REASON_COPY: Record<WeatherDiscoveryLocale, Record<DiscoveryReasonCode, string>> = {
  en: {
    DRY_WINDOW: "Low rain risk",
    RAIN_RISK: "High rain risk",
    COMFORTABLE_TEMPERATURE: "Comfortable temperature",
    HEAT_RISK: "Heat risk",
    COLD_RISK: "Cold risk",
    LOW_WIND: "Low wind",
    WIND_RISK: "Wind risk",
    UV_CAUTION: "High UV",
    BEACH_READY: "Good beach profile",
    FAMILY_COMFORT: "Family-friendly comfort",
    SENIOR_COMFORT: "Senior-friendly comfort",
    LIMITED_DATA: "Limited data",
    CUSTOM_CONSTRAINT_MISS: "Outside your limits",
  },
  "zh-cn": {
    DRY_WINDOW: "降雨风险低",
    RAIN_RISK: "降雨风险高",
    COMFORTABLE_TEMPERATURE: "温度舒适",
    HEAT_RISK: "高温风险",
    COLD_RISK: "低温风险",
    LOW_WIND: "风力较小",
    WIND_RISK: "风力偏大",
    UV_CAUTION: "紫外线较强",
    BEACH_READY: "海岛条件较好",
    FAMILY_COMFORT: "亲子舒适度较好",
    SENIOR_COMFORT: "长辈舒适度较好",
    LIMITED_DATA: "数据有限",
    CUSTOM_CONSTRAINT_MISS: "超出你的限制条件",
  },
  "zh-hant": {
    DRY_WINDOW: "降雨風險低",
    RAIN_RISK: "降雨風險高",
    COMFORTABLE_TEMPERATURE: "溫度舒適",
    HEAT_RISK: "高溫風險",
    COLD_RISK: "低溫風險",
    LOW_WIND: "風力較小",
    WIND_RISK: "風力偏大",
    UV_CAUTION: "紫外線較強",
    BEACH_READY: "海島條件較好",
    FAMILY_COMFORT: "親子舒適度較好",
    SENIOR_COMFORT: "長輩舒適度較好",
    LIMITED_DATA: "資料有限",
    CUSTOM_CONSTRAINT_MISS: "超出你的限制條件",
  },
};

function initialPreferences(): DiscoveryPreferences {
  const from = new Date().toISOString().slice(0, 10);
  const toDate = new Date(`${from}T00:00:00Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 2);
  return {
    intent: "dry",
    from,
    to: toDate.toISOString().slice(0, 10),
    rainProbabilityMax: null,
    temperatureMinC: null,
    temperatureMaxC: null,
    windSpeedMaxKph: null,
    partyProfile: null,
    theme: null,
  };
}

function chunks<T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    output.push(items.slice(index, index + size));
  return output;
}
function numeric(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function readStoredWorkspace(): TripWorkspace | null {
  const value = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (value === null) return null;
  try {
    return normalizeWorkspace(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}
function cityPath(locale: WeatherDiscoveryLocale, city: TripCityOption): string {
  const suffix = `/${city.countrySlug}/${city.citySlug}`;
  return locale === "en" ? suffix : `/${locale}${suffix}`;
}
function workspacePath(locale: WeatherDiscoveryLocale): string {
  return locale === "en" ? "/trips/workspace" : `/${locale}/trips/workspace`;
}
function format(value: number | null, suffix: string): string {
  return value === null ? "—" : `${value}${suffix}`;
}
function temperature(result: DiscoveryCityResult): string {
  const { averageMinC: low, averageMaxC: high } = result.metrics;
  return low === null || high === null ? "—" : `${low}°–${high}°`;
}

export function WeatherDiscoveryPlannerV2({
  locale,
}: {
  readonly locale: WeatherDiscoveryLocale;
}): ReactElement {
  const copy = COPY[locale];
  const apiLocale = locale === "en" ? "en" : "zh-cn";
  const [draft, setDraft] = useState<DiscoveryPreferences>(initialPreferences);
  const [applied, setApplied] = useState<DiscoveryPreferences>(initialPreferences);
  const [cities, setCities] = useState<ReadonlyArray<TripCityOption>>([]);
  const [forecast, setForecast] = useState<ReadonlyArray<TripForecastDay>>([]);
  const [shortlist, setShortlist] = useState<ReadonlyArray<string>>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [stale, setStale] = useState(false);
  const [tripReady, setTripReady] = useState(false);

  useEffect(() => {
    const fallback = initialPreferences();
    const search = new URLSearchParams(window.location.search);
    const parsed = parseDiscoveryPreferences(search, { from: fallback.from, to: fallback.to });
    setDraft(parsed);
    setApplied(parsed);
    setShortlist((search.get("cities") ?? "").split(",").filter(Boolean).slice(0, MAX_SHORTLIST));
  }, []);

  useEffect(() => {
    if (API_BASE.length === 0) {
      setState("error");
      setMessage(copy.apiMissing);
      return;
    }
    let active = true;
    void fetch(`${API_BASE}/api/v1/trip-cities?locale=${apiLocale}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`CITY_API_${response.status}`);
        return (await response.json()) as TripCitiesResponse;
      })
      .then((payload) => {
        if (!active) return;
        const raw = payload.data?.items ?? [];
        setCities(locale === "zh-hant" ? raw.map(toTraditionalCity) : raw);
      })
      .catch(() => {
        if (active) {
          setState("error");
          setMessage(copy.unavailable);
        }
      });
    return () => {
      active = false;
    };
  }, [apiLocale, copy.apiMissing, copy.unavailable, locale]);

  const loadForecast = useCallback(async (): Promise<void> => {
    if (cities.length === 0 || API_BASE.length === 0) return;
    if (discoveryDateRange(applied.from, applied.to).length === 0) {
      setState("error");
      setMessage(copy.invalidRange);
      return;
    }
    setState("loading");
    setMessage("");
    try {
      let snapshot: string | null = null;
      let freshness = "";
      let anyStale = false;
      const items: TripForecastDay[] = [];
      for (const batch of chunks(cities, MAX_CITIES_PER_REQUEST)) {
        const search = new URLSearchParams({
          cityIds: batch.map((city) => city.cityId).join(","),
          from: applied.from,
          to: applied.to,
          locale: apiLocale,
        });
        const response = await fetch(`${API_BASE}/api/v1/trip-forecast?${search.toString()}`);
        if (!response.ok) throw new Error(`FORECAST_API_${response.status}`);
        const payload = (await response.json()) as TripForecastResponse;
        const nextSnapshot = payload.data?.snapshotId;
        if (typeof nextSnapshot !== "string") throw new Error("FORECAST_SNAPSHOT_MISSING");
        if (snapshot !== null && snapshot !== nextSnapshot)
          throw new Error("FORECAST_SNAPSHOT_CHANGED");
        snapshot = nextSnapshot;
        freshness = payload.data?.freshness?.dataUpdatedAt ?? freshness;
        anyStale ||= payload.data?.freshness?.stale === true;
        const raw = payload.data?.items ?? [];
        items.push(...(locale === "zh-hant" ? raw.map(toTraditionalForecast) : raw));
      }
      setForecast(items);
      setUpdatedAt(freshness);
      setStale(anyStale);
      setState("ready");
    } catch {
      setState("error");
      setMessage(copy.unavailable);
    }
  }, [apiLocale, applied, cities, copy.invalidRange, copy.unavailable, locale]);

  useEffect(() => {
    void loadForecast();
  }, [loadForecast]);

  const results = useMemo(
    () => contextualizeDiscoveryResults(rankDiscoveryCities(cities, forecast, applied), applied),
    [applied, cities, forecast],
  );
  const resultIds = useMemo(() => new Set(results.map((result) => result.city.cityId)), [results]);
  const selectedResults = useMemo(
    () =>
      shortlist
        .map((id) => results.find((result) => result.city.cityId === id))
        .filter((result): result is DiscoveryCityResult => result !== undefined),
    [results, shortlist],
  );
  const markers = useMemo(
    () =>
      results.map((result) => ({
        id: result.city.cityId,
        latitude: result.city.latitude,
        longitude: result.city.longitude,
        label: result.city.cityName,
        path: cityPath(locale, result.city),
        score: result.score,
        theme: applied.theme ?? applied.intent,
      })),
    [applied.intent, applied.theme, locale, results],
  );

  useEffect(() => {
    if (state === "ready") setShortlist((current) => current.filter((id) => resultIds.has(id)));
  }, [resultIds, state]);

  const updateUrl = useCallback(
    (preferences: DiscoveryPreferences, selected: ReadonlyArray<string>): void => {
      const search = serializeDiscoveryPreferences(preferences);
      if (selected.length > 0) search.set("cities", selected.join(","));
      window.history.replaceState({}, "", `${window.location.pathname}?${search.toString()}`);
    },
    [],
  );

  const apply = useCallback((): void => {
    if (discoveryDateRange(draft.from, draft.to).length === 0) {
      setMessage(copy.invalidRange);
      return;
    }
    setTripReady(false);
    setApplied(draft);
    updateUrl(draft, shortlist);
  }, [copy.invalidRange, draft, shortlist, updateUrl]);

  const toggle = useCallback(
    (cityId: string): void => {
      setShortlist((current) => {
        const next = current.includes(cityId)
          ? current.filter((id) => id !== cityId)
          : current.length < MAX_SHORTLIST
            ? [...current, cityId]
            : current;
        if (next === current) setMessage(copy.shortlistFull);
        else setMessage("");
        updateUrl(applied, next);
        return next;
      });
    },
    [applied, copy.shortlistFull, updateUrl],
  );

  const createTrip = useCallback(
    (append: boolean): void => {
      if (selectedResults.length === 0) {
        setMessage(copy.needCity);
        return;
      }
      const allocations = allocateDiscoveryDates(
        selectedResults.map((result) => result.city),
        discoveryDateRange(applied.from, applied.to),
      );
      if (allocations.length === 0) {
        setMessage(copy.needDates);
        return;
      }
      const next = buildDiscoveryWorkspace(readStoredWorkspace(), allocations, {
        append,
        title: copy.titleTrip,
      });
      if (next === null) return;
      if (!append) clearCloudMetadata();
      window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
      setTripReady(true);
      setMessage(append ? copy.appended : copy.created);
    },
    [applied.from, applied.to, copy, selectedResults],
  );

  const updateNumber = (
    key: "rainProbabilityMax" | "temperatureMinC" | "temperatureMaxC" | "windSpeedMaxKph",
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    setDraft((current) => ({ ...current, [key]: numeric(event.target.value) }));
  };

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="hero-panel">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
          {copy.title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-muted sm:text-lg">{copy.intro}</p>
      </section>

      <section className="info-panel mt-6" aria-label={copy.when}>
        <div className="grid gap-6 xl:grid-cols-3">
          <div>
            <p className="eyebrow">{copy.when}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                {copy.from}
                <input
                  type="date"
                  value={draft.from}
                  className="min-h-11 rounded-xl border border-border bg-white px-3"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, from: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                {copy.to}
                <input
                  type="date"
                  value={draft.to}
                  className="min-h-11 rounded-xl border border-border bg-white px-3"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, to: event.target.value }))
                  }
                />
              </label>
            </div>
            <p className="eyebrow mt-6">{copy.intent}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {listDiscoveryIntents().map((intent) => (
                <button
                  key={intent}
                  type="button"
                  aria-pressed={draft.intent === intent}
                  className={`min-h-11 rounded-full border px-3 text-sm font-semibold focus-ring ${draft.intent === intent ? "border-foreground bg-foreground text-white" : "border-border bg-white text-foreground"}`}
                  onClick={() => setDraft((current) => ({ ...current, intent }))}
                >
                  {INTENT_COPY[locale][intent]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow">{copy.context}</p>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-xs font-semibold text-muted">
                {copy.party}
                <select
                  className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
                  value={draft.partyProfile ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      partyProfile: (event.target.value || null) as TripPartyProfile | null,
                    }))
                  }
                >
                  <option value="">{copy.any}</option>
                  <option value="adults">{copy.adults}</option>
                  <option value="family">{copy.family}</option>
                  <option value="senior">{copy.senior}</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                {copy.theme}
                <select
                  className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
                  value={draft.theme ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      theme: (event.target.value || null) as DiscoveryTheme | null,
                    }))
                  }
                >
                  <option value="">{copy.any}</option>
                  <option value="city">{copy.city}</option>
                  <option value="beach">{copy.beach}</option>
                  <option value="outdoor">{copy.outdoor}</option>
                  <option value="indoor">{copy.indoor}</option>
                </select>
              </label>
            </div>
          </div>

          <div>
            <p className="eyebrow">{copy.constraints}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-muted">
                {copy.rain} (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.rainProbabilityMax ?? ""}
                  placeholder={copy.noLimit}
                  className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
                  onChange={(event) => updateNumber("rainProbabilityMax", event)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                {copy.wind} (km/h)
                <input
                  type="number"
                  min="0"
                  max="250"
                  value={draft.windSpeedMaxKph ?? ""}
                  placeholder={copy.noLimit}
                  className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
                  onChange={(event) => updateNumber("windSpeedMaxKph", event)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                {copy.tempMin} (°C)
                <input
                  type="number"
                  min="-50"
                  max="60"
                  value={draft.temperatureMinC ?? ""}
                  placeholder={copy.noLimit}
                  className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
                  onChange={(event) => updateNumber("temperatureMinC", event)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                {copy.tempMax} (°C)
                <input
                  type="number"
                  min="-50"
                  max="60"
                  value={draft.temperatureMaxC ?? ""}
                  placeholder={copy.noLimit}
                  className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
                  onChange={(event) => updateNumber("temperatureMaxC", event)}
                />
              </label>
            </div>
            <button type="button" className="trip-primary-button mt-4 w-full" onClick={apply}>
              {copy.apply}
            </button>
            <p className="mt-2 text-xs leading-5 text-muted">{copy.filtersShare}</p>
          </div>
        </div>
      </section>

      {message.length > 0 ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
      {state === "loading" ? <p className="mt-6 text-sm text-muted">{copy.loading}</p> : null}
      {state === "error" ? <p className="mt-6 text-sm text-danger">{copy.unavailable}</p> : null}

      {state === "ready" ? (
        <>
          <section className="mt-10" aria-labelledby="discovery-results">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">{INTENT_COPY[locale][applied.intent]}</p>
                <h2 id="discovery-results" className="section-title mt-2">
                  {copy.results}
                </h2>
              </div>
              <p className="text-xs text-muted">
                {results.length} {copy.checked}
                {updatedAt ? ` · ${copy.refreshed} ${new Date(updatedAt).toLocaleString()}` : ""}
                {stale ? ` · ${copy.stale}` : ""}
              </p>
            </div>
            {results.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
                {copy.noMatches}
              </p>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((result, index) => {
                  const selected = shortlist.includes(result.city.cityId);
                  return (
                    <li key={result.city.cityId}>
                      <article className="destination-card h-full">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                              #{index + 1} · {result.city.countryName}
                            </p>
                            <h3 className="mt-1 text-xl font-bold text-foreground">
                              <a
                                href={cityPath(locale, result.city)}
                                className="focus-ring hover:text-primary"
                              >
                                {result.city.cityName}
                              </a>
                            </h3>
                          </div>
                          <div className="score-orbit">
                            <div>
                              <p className="text-lg font-bold leading-none text-foreground">
                                {result.score}
                              </p>
                              <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">
                                {copy.score}
                              </span>
                            </div>
                          </div>
                        </div>
                        <dl className="relative mt-4 grid grid-cols-2 gap-2 text-sm">
                          <div className="metric-block">
                            <dt className="text-xs text-muted">{copy.rainMetric}</dt>
                            <dd className="mt-1 font-bold">
                              {format(result.metrics.maxRainProbability, "%")}
                            </dd>
                          </div>
                          <div className="metric-block">
                            <dt className="text-xs text-muted">{copy.tempMetric}</dt>
                            <dd className="mt-1 font-bold">{temperature(result)}</dd>
                          </div>
                          <div className="metric-block">
                            <dt className="text-xs text-muted">{copy.windMetric}</dt>
                            <dd className="mt-1 font-bold">
                              {format(result.metrics.maxWindKph, " km/h")}
                            </dd>
                          </div>
                          <div className="metric-block">
                            <dt className="text-xs text-muted">{copy.uvMetric}</dt>
                            <dd className="mt-1 font-bold">{format(result.metrics.maxUv, "")}</dd>
                          </div>
                        </dl>
                        <ul className="relative mt-4 flex flex-wrap gap-1.5">
                          {result.reasonCodes.slice(0, 4).map((reason) => (
                            <li
                              key={reason}
                              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted"
                            >
                              {REASON_COPY[locale][reason]}
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className={`relative mt-5 min-h-11 w-full rounded-xl border px-4 text-sm font-bold focus-ring ${selected ? "border-foreground bg-foreground text-white" : "border-border bg-white text-foreground"}`}
                          aria-pressed={selected}
                          onClick={() => toggle(result.city.cityId)}
                        >
                          {selected ? copy.shortlisted : copy.shortlist}
                        </button>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {markers.length > 0 ? (
            <ExplorerMap
              markers={markers}
              theme={applied.theme ?? applied.intent}
              windowLabel={`${applied.from} – ${applied.to}`}
            />
          ) : null}

          <section className="info-panel mt-10" aria-labelledby="discovery-compare">
            <p className="eyebrow">{copy.compare}</p>
            <h2 id="discovery-compare" className="section-title mt-2">
              {copy.compare}
            </h2>
            <p className="mt-2 text-sm text-muted">{copy.compareIntro}</p>
            {selectedResults.length < 2 ? (
              <p className="mt-5 text-sm text-muted">{copy.emptyShortlist}</p>
            ) : (
              <div className="mt-5 overflow-x-auto pb-2">
                <div
                  className="grid min-w-[760px] gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${selectedResults.length}, minmax(180px, 1fr))`,
                  }}
                >
                  {selectedResults.map((result) => (
                    <article
                      key={result.city.cityId}
                      className="rounded-2xl border border-border bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted">{result.city.countryName}</p>
                          <h3 className="text-lg font-bold">{result.city.cityName}</h3>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-bold text-primary"
                          onClick={() => toggle(result.city.cityId)}
                        >
                          {copy.remove}
                        </button>
                      </div>
                      <p className="mt-3 text-3xl font-bold">{result.score}</p>
                      <p className="text-xs text-muted">{copy.score}</p>
                      <dl className="mt-4 grid gap-2 text-xs">
                        <div className="flex justify-between">
                          <dt>{copy.rainMetric}</dt>
                          <dd className="font-bold">
                            {format(result.metrics.maxRainProbability, "%")}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>{copy.tempMetric}</dt>
                          <dd className="font-bold">{temperature(result)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>{copy.windMetric}</dt>
                          <dd className="font-bold">
                            {format(result.metrics.maxWindKph, " km/h")}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>{copy.uvMetric}</dt>
                          <dd className="font-bold">{format(result.metrics.maxUv, "")}</dd>
                        </div>
                      </dl>
                      <p className="mt-4 text-xs font-bold uppercase tracking-[0.08em] text-muted">
                        {copy.forecast}
                      </p>
                      <ul className="mt-2 grid gap-2">
                        {result.forecastDays.map((day) => (
                          <li
                            key={`${day.cityId}-${day.date}`}
                            className="rounded-xl bg-surface-elevated p-2 text-xs"
                          >
                            <div className="flex justify-between gap-2">
                              <strong>{day.date.slice(5)}</strong>
                              <span>{day.condition}</span>
                            </div>
                            <div className="mt-1 flex justify-between gap-2 text-muted">
                              <span>
                                {day.temperatureMinC ?? "—"}°–{day.temperatureMaxC ?? "—"}°
                              </span>
                              <span>{day.rainProbability ?? "—"}%</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="info-panel mt-6" aria-labelledby="discovery-trip">
            <p className="eyebrow">{copy.trip}</p>
            <h2 id="discovery-trip" className="section-title mt-2">
              {copy.trip}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{copy.tripIntro}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="trip-primary-button"
                disabled={selectedResults.length === 0}
                onClick={() => createTrip(false)}
              >
                {copy.create}
              </button>
              <button
                type="button"
                className="trip-secondary-button"
                disabled={selectedResults.length === 0}
                onClick={() => createTrip(true)}
              >
                {copy.append}
              </button>
              {tripReady ? (
                <a className="trip-secondary-button" href={workspacePath(locale)}>
                  {copy.openTrip} →
                </a>
              ) : null}
            </div>
          </section>

          {tripReady && selectedResults.length === 1 && selectedResults[0] !== undefined ? (
            <div className="mt-4" data-commerce-after-decision="discovery-trip-created">
              <ContextualAffiliateSurface
                locale={locale}
                context={{
                  stage: "discovery_decided",
                  destinationId: selectedResults[0].city.cityId,
                  hasDestinationDecision: true,
                  hasTrip: true,
                  hasStructuredActivities: false,
                  carDependent: false,
                  weatherAction: "none",
                  indoorFallbackAvailable: false,
                  tripStartsWithinDays: null,
                }}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
