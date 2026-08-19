"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { emitProductAnalytics } from "../analytics/browser-events";
import type { TripCityOption, TripForecastDay } from "../trips/workspace";
import { toTraditionalCity, toTraditionalForecast } from "../trips/traditional";
import { discoveryDateRange } from "../discovery/discovery-trip";
import {
  parseDiscoveryPreferences,
  rankDiscoveryCities,
  serializeDiscoveryPreferences,
  type DiscoveryCityResult,
  type DiscoveryPreferences,
  type DiscoveryReasonCode,
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

interface StoredDestinationSelection {
  readonly cityId: string;
  readonly from: string;
  readonly to: string;
}

const API_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");
const MAX_CITIES_PER_REQUEST = 12;
const MAX_RESULTS = 3;
const MAX_SHORTLIST = 3;
const SELECTED_DESTINATION_STORAGE_KEY = "wnr:selected-destination:v1";

const COPY = {
  en: {
    eyebrow: "Least-rain destination finder",
    title: "Where is it least likely to rain on your dates?",
    intro:
      "Choose a travel window. We rank destinations by overall rain risk and return only the three strongest matches.",
    when: "Travel dates",
    from: "From",
    to: "To",
    intent: "Ranking goal",
    intentValue: "Least rain",
    constraints: "Optional weather limits",
    advanced: "Optional weather limits",
    advancedHelp:
      "Leave every field blank for a pure least-rain ranking. A destination is excluded when it exceeds any limit you set.",
    rain: "Max rain chance on any day",
    tempMin: "Min night temperature",
    tempMax: "Max daytime temperature",
    wind: "Max wind",
    noLimit: "No limit",
    apply: "Find 3 dry-weather destinations",
    loading: "Checking destinations…",
    unavailable: "Destination weather is temporarily unavailable.",
    invalidRange: "Choose a valid range of 1–16 days.",
    noMatches: "No destinations match every selected limit. Relax one limit and try again.",
    results: "Top 3 least-rain destinations",
    checked: "eligible destinations checked",
    shortlist: "Add to comparison",
    shortlisted: "Added to comparison",
    shortlistFull: "You can compare up to 3 destinations.",
    compare: "Compare the shortlist",
    compareIntro: "The same forecast snapshot and dates, side by side.",
    emptyShortlist: "Add 2–3 destinations to compare their daily weather here.",
    score: "Dry score",
    rainMetric: "Peak rain",
    tempMetric: "Avg temperature",
    windMetric: "Peak wind",
    uvMetric: "Peak UV",
    forecast: "Daily outlook",
    filtersShare: "Dates, limits and comparison choices stay in the URL for sharing.",
    remove: "Remove",
    choose: "Choose this destination",
    chosen: "Chosen destination",
    choiceTitle: "Destination selected",
    choiceIntro:
      "Your choice is saved on this device. Commercial links appear only after you choose and never influence the ranking.",
    selectionSaved: "Destination selected.",
    details: "View city weather",
  },
  "zh-cn": {
    eyebrow: "少雨目的地工具",
    title: "这几天去哪里更不容易下雨？",
    intro: "选择出行日期，系统只按整体降雨风险排序，并只给出最值得比较的 3 个目的地。",
    when: "出行日期",
    from: "开始",
    to: "结束",
    intent: "排序目标",
    intentValue: "哪里不下雨",
    constraints: "可选限制条件",
    advanced: "可选限制条件",
    advancedHelp: "全部留空时只按少雨程度排序。设置任一条件后，超出限制的目的地会被直接排除。",
    rain: "任一天最高降雨概率",
    tempMin: "最低夜间温度",
    tempMax: "最高白天气温",
    wind: "最大风速",
    noLimit: "不限",
    apply: "找 3 个少雨目的地",
    loading: "正在比较目的地…",
    unavailable: "目的地天气暂时不可用。",
    invalidRange: "请选择 1–16 天的有效日期范围。",
    noMatches: "没有目的地同时满足全部限制条件，可以放宽一个条件后再试。",
    results: "最少雨的 3 个目的地",
    checked: "个符合条件的目的地已参与排序",
    shortlist: "加入对比",
    shortlisted: "已加入对比",
    shortlistFull: "最多同时对比 3 个目的地。",
    compare: "候选对比",
    compareIntro: "同一份天气快照、同一组日期，直接比较。",
    emptyShortlist: "先加入 2–3 个目的地，即可在这里比较逐日天气。",
    score: "少雨指数",
    rainMetric: "最高降雨",
    tempMetric: "平均气温",
    windMetric: "最大风速",
    uvMetric: "最高 UV",
    forecast: "逐日天气",
    filtersShare: "日期、限制条件和对比选择会写入 URL，可直接分享。",
    remove: "移除",
    choose: "选择这个目的地",
    chosen: "已选择",
    choiceTitle: "已选择目的地",
    choiceIntro: "选择会保存在当前设备。商业链接只在选择后出现，并且不会影响推荐排序。",
    selectionSaved: "已选择目的地。",
    details: "查看城市天气",
  },
  "zh-hant": {
    eyebrow: "少雨目的地工具",
    title: "這幾天去哪裡更不容易下雨？",
    intro: "選擇出行日期，系統只按整體降雨風險排序，並只給出最值得比較的 3 個目的地。",
    when: "出行日期",
    from: "開始",
    to: "結束",
    intent: "排序目標",
    intentValue: "哪裡不下雨",
    constraints: "可選限制條件",
    advanced: "可選限制條件",
    advancedHelp: "全部留空時只按少雨程度排序。設定任一條件後，超出限制的目的地會被直接排除。",
    rain: "任一天最高降雨機率",
    tempMin: "最低夜間溫度",
    tempMax: "最高白天氣溫",
    wind: "最大風速",
    noLimit: "不限",
    apply: "找 3 個少雨目的地",
    loading: "正在比較目的地…",
    unavailable: "目的地天氣暫時無法使用。",
    invalidRange: "請選擇 1–16 天的有效日期範圍。",
    noMatches: "沒有目的地同時符合全部限制條件，可以放寬一個條件後再試。",
    results: "最少雨的 3 個目的地",
    checked: "個符合條件的目的地已參與排序",
    shortlist: "加入比較",
    shortlisted: "已加入比較",
    shortlistFull: "最多同時比較 3 個目的地。",
    compare: "候選比較",
    compareIntro: "同一份天氣快照、同一組日期，直接比較。",
    emptyShortlist: "先加入 2–3 個目的地，即可在這裡比較逐日天氣。",
    score: "少雨指數",
    rainMetric: "最高降雨",
    tempMetric: "平均氣溫",
    windMetric: "最大風速",
    uvMetric: "最高 UV",
    forecast: "逐日天氣",
    filtersShare: "日期、限制條件和比較選擇會寫入 URL，可直接分享。",
    remove: "移除",
    choose: "選擇這個目的地",
    chosen: "已選擇",
    choiceTitle: "已選擇目的地",
    choiceIntro: "選擇會保存在目前裝置。商業連結只在選擇後出現，並且不會影響推薦排序。",
    selectionSaved: "已選擇目的地。",
    details: "查看城市天氣",
  },
} as const;

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
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function numeric(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cityPath(locale: WeatherDiscoveryLocale, city: TripCityOption): string {
  const suffix = `/${city.countrySlug}/${city.citySlug}`;
  return locale === "en" ? suffix : `/${locale}${suffix}`;
}

function format(value: number | null, suffix: string): string {
  return value === null ? "—" : `${value}${suffix}`;
}

function temperature(result: DiscoveryCityResult): string {
  const { averageMinC: low, averageMaxC: high } = result.metrics;
  return low === null || high === null ? "—" : `${low}°–${high}°`;
}

function readStoredSelection(): StoredDestinationSelection | null {
  try {
    const raw = window.localStorage.getItem(SELECTED_DESTINATION_STORAGE_KEY);
    if (raw === null) return null;
    const value = JSON.parse(raw) as Partial<StoredDestinationSelection>;
    return typeof value.cityId === "string" &&
      typeof value.from === "string" &&
      typeof value.to === "string"
      ? { cityId: value.cityId, from: value.from, to: value.to }
      : null;
  } catch {
    return null;
  }
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
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [stale, setStale] = useState(false);
  const discoveryViewTracked = useRef(false);

  useEffect(() => {
    if (discoveryViewTracked.current) return;
    discoveryViewTracked.current = true;
    emitProductAnalytics({
      locale,
      routeTemplate: "/discover",
      fields: { event: "weather_discovery_view" },
    });
  }, [locale]);

  useEffect(() => {
    const fallback = initialPreferences();
    const search = new URLSearchParams(window.location.search);
    const parsed = parseDiscoveryPreferences(search, { from: fallback.from, to: fallback.to });
    const stored = readStoredSelection();
    setDraft(parsed);
    setApplied(parsed);
    setShortlist((search.get("cities") ?? "").split(",").filter(Boolean).slice(0, MAX_SHORTLIST));
    if (stored?.from === parsed.from && stored.to === parsed.to) {
      setSelectedDestinationId(stored.cityId);
    }
  }, []);

  useEffect(() => {
    if (API_BASE.length === 0) {
      setState("error");
      setMessage(copy.unavailable);
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
  }, [apiLocale, copy.unavailable, locale]);

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
        if (snapshot !== null && snapshot !== nextSnapshot) {
          throw new Error("FORECAST_SNAPSHOT_CHANGED");
        }
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

  const rankedResults = useMemo(
    () => rankDiscoveryCities(cities, forecast, applied),
    [applied, cities, forecast],
  );
  const results = useMemo(() => rankedResults.slice(0, MAX_RESULTS), [rankedResults]);
  const resultIds = useMemo(() => new Set(results.map((result) => result.city.cityId)), [results]);
  const selectedResults = useMemo(
    () =>
      shortlist
        .map((id) => results.find((result) => result.city.cityId === id))
        .filter((result): result is DiscoveryCityResult => result !== undefined),
    [results, shortlist],
  );
  const selectedDestination = useMemo(
    () => results.find((result) => result.city.cityId === selectedDestinationId) ?? null,
    [results, selectedDestinationId],
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
        theme: "dry",
      })),
    [locale, results],
  );

  useEffect(() => {
    if (state !== "ready") return;
    setShortlist((current) => current.filter((id) => resultIds.has(id)).slice(0, MAX_SHORTLIST));
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
    setSelectedDestinationId(null);
    window.localStorage.removeItem(SELECTED_DESTINATION_STORAGE_KEY);
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
        if (!current.includes(cityId) && next !== current) {
          emitProductAnalytics({
            locale,
            routeTemplate: "/discover",
            fields: { event: "destination_shortlisted", destination_id: cityId },
          });
        }
        updateUrl(applied, next);
        return next;
      });
    },
    [applied, copy.shortlistFull, locale, updateUrl],
  );

  const chooseDestination = useCallback(
    (result: DiscoveryCityResult, position: number): void => {
      setSelectedDestinationId(result.city.cityId);
      window.localStorage.setItem(
        SELECTED_DESTINATION_STORAGE_KEY,
        JSON.stringify({
          cityId: result.city.cityId,
          from: applied.from,
          to: applied.to,
        } satisfies StoredDestinationSelection),
      );
      emitProductAnalytics({
        locale,
        routeTemplate: "/discover",
        fields: {
          event: "destination_selected",
          destination_id: result.city.cityId,
          position,
        },
      });
      setMessage(copy.selectionSaved);
    },
    [applied.from, applied.to, copy.selectionSaved, locale],
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <p className="eyebrow">{copy.when}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
          </div>

          <div data-discovery-intent="dry">
            <p className="eyebrow">{copy.intent}</p>
            <div className="mt-3 inline-flex min-h-11 items-center rounded-full border border-foreground bg-foreground px-4 text-sm font-semibold text-white">
              {copy.intentValue}
            </div>
          </div>
        </div>

        <details className="mt-5 rounded-2xl border border-border bg-surface-elevated p-4">
          <summary className="cursor-pointer text-sm font-bold text-foreground focus-ring">
            {copy.advanced}
          </summary>
          <p className="mt-2 text-xs leading-5 text-muted">{copy.advancedHelp}</p>
          <div className="mt-4">
            <p className="eyebrow">{copy.constraints}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          </div>
        </details>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" className="trip-primary-button" onClick={apply}>
            {copy.apply}
          </button>
          <p className="text-xs leading-5 text-muted">{copy.filtersShare}</p>
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
                <p className="eyebrow">{copy.intentValue}</p>
                <h2 id="discovery-results" className="section-title mt-2">
                  {copy.results}
                </h2>
              </div>
              <p className="text-xs text-muted">
                {rankedResults.length} {copy.checked}
                {updatedAt ? ` · ${new Date(updatedAt).toLocaleString()}` : ""}
                {stale ? ` · stale` : ""}
              </p>
            </div>
            {results.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
                {copy.noMatches}
              </p>
            ) : (
              <ul className="mt-5 grid gap-4 lg:grid-cols-3">
                {results.map((result, index) => {
                  const shortlisted = shortlist.includes(result.city.cityId);
                  const chosen = selectedDestinationId === result.city.cityId;
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
                                onClick={() => {
                                  void emitProductAnalytics({
                                    locale,
                                    routeTemplate: "/discover",
                                    fields: {
                                      event: "search_result_clicked",
                                      destination_id: result.city.cityId,
                                      result_type: "city",
                                      position: index + 1,
                                    },
                                  });
                                }}
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
                        <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            className={`min-h-11 rounded-xl px-4 text-sm font-bold focus-ring ${
                              chosen
                                ? "border border-foreground bg-foreground text-white"
                                : "bg-primary text-white"
                            }`}
                            aria-pressed={chosen}
                            onClick={() => chooseDestination(result, index + 1)}
                          >
                            {chosen ? copy.chosen : copy.choose}
                          </button>
                          <button
                            type="button"
                            className={`min-h-11 rounded-xl border px-4 text-sm font-bold focus-ring ${
                              shortlisted
                                ? "border-foreground bg-foreground text-white"
                                : "border-border bg-white text-foreground"
                            }`}
                            aria-pressed={shortlisted}
                            onClick={() => toggle(result.city.cityId)}
                          >
                            {shortlisted ? copy.shortlisted : copy.shortlist}
                          </button>
                        </div>
                        <a
                          className="relative mt-3 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
                          href={cityPath(locale, result.city)}
                        >
                          {copy.details} →
                        </a>
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
              theme="dry"
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
              <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                        <dd className="font-bold">{format(result.metrics.maxWindKph, " km/h")}</dd>
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
            )}
          </section>

          {selectedDestination !== null ? (
            <section
              className="info-panel mt-6"
              aria-labelledby="destination-selected"
              data-commerce-after-decision="destination-selected"
            >
              <p className="eyebrow">{copy.choiceTitle}</p>
              <h2 id="destination-selected" className="section-title mt-2">
                {selectedDestination.city.cityName}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{copy.choiceIntro}</p>
              <div className="mt-4">
                <ContextualAffiliateSurface
                  locale={locale}
                  context={{
                    stage: "discovery_decided",
                    destinationId: selectedDestination.city.cityId,
                    hasDestinationDecision: true,
                    hasTrip: false,
                    hasStructuredActivities: false,
                    carDependent: false,
                    weatherAction: "none",
                    indoorFallbackAvailable: false,
                    tripStartsWithinDays: null,
                  }}
                />
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
