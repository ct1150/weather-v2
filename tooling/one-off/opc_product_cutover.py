from __future__ import annotations

from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(dedent(content).lstrip(), encoding="utf-8")


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    occurrences = text.count(old)
    if occurrences < count:
        raise RuntimeError(f"{path}: expected at least {count} occurrence(s), found {occurrences}: {old[:120]!r}")
    target.write_text(text.replace(old, new, count), encoding="utf-8")


def remove_exact(path: str, old: str, count: int = 1) -> None:
    replace_exact(path, old, "", count)


# ---------------------------------------------------------------------------
# Destination discovery: one explicit least-rain job, Top 3, optional limits.
# ---------------------------------------------------------------------------

write(
    "apps/web/src/components/WeatherDiscoveryPlannerV2.tsx",
    r'''
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
        advancedHelp:
          "全部留空时只按少雨程度排序。设置任一条件后，超出限制的目的地会被直接排除。",
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
        advancedHelp:
          "全部留空時只按少雨程度排序。設定任一條件後，超出限制的目的地會被直接排除。",
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
        return typeof value.cityId === "string" && typeof value.from === "string" && typeof value.to === "string"
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
        setShortlist(
          (search.get("cities") ?? "").split(",").filter(Boolean).slice(0, MAX_SHORTLIST),
        );
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
                <ExplorerMap markers={markers} theme="dry" windowLabel={`${applied.from} – ${applied.to}`} />
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
                            <dd className="font-bold">
                              {format(result.metrics.maxWindKph, " km/h")}
                            </dd>
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
    ''',
)

# The least-rain score must express rain only. Wind remains visible and can be a hard limit.
remove_exact(
    "apps/web/src/discovery/weather-discovery.ts",
    "    penalty += abovePenalty(wind, 35, 0.4, 8);\n",
)

write(
    "apps/web/src/components/weather-discovery-phase6-contract.test.ts",
    r'''
    import { readFileSync } from "node:fs";
    import { describe, expect, it } from "vitest";

    const planner = readFileSync(new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url), "utf8");
    const engine = readFileSync(new URL("../discovery/weather-discovery.ts", import.meta.url), "utf8");
    const trip = readFileSync(new URL("../discovery/discovery-trip.ts", import.meta.url), "utf8");
    const englishRoute = readFileSync(new URL("../app/discover/page.tsx", import.meta.url), "utf8");
    const simplifiedRoute = readFileSync(
      new URL("../app/zh-cn/discover/page.tsx", import.meta.url),
      "utf8",
    );
    const traditionalRoute = readFileSync(
      new URL("../app/zh-hant/discover/page.tsx", import.meta.url),
      "utf8",
    );

    describe("least-rain destination discovery contract", () => {
      it("exposes one active least-rain intent and normalizes legacy links", () => {
        expect(engine).toContain('const INTENTS: ReadonlyArray<WeatherDiscoveryIntent> = ["dry"]');
        expect(engine).toContain('intent: "dry"');
        expect(engine).toContain("partyProfile: null");
        expect(engine).toContain("theme: null");
        expect(engine).not.toContain('search.set("party"');
        expect(engine).not.toContain('search.set("theme"');
        expect(planner).toContain('data-discovery-intent="dry"');
        expect(planner).not.toContain("contextualizeDiscoveryResults");
        expect(planner).not.toContain("<select");
      });

      it("returns only the Top 3 and preserves four explicit hard limits", () => {
        expect(planner).toContain("const MAX_RESULTS = 3");
        expect(planner).toContain("rankedResults.slice(0, MAX_RESULTS)");
        expect(planner).toContain("rainProbabilityMax");
        expect(planner).toContain("temperatureMinC");
        expect(planner).toContain("temperatureMaxC");
        expect(planner).toContain("windSpeedMaxKph");
        expect(planner).toContain("A destination is excluded when it exceeds any limit");
      });

      it("keeps forecast reads bounded and provider-isolated", () => {
        expect(planner).toContain("MAX_CITIES_PER_REQUEST = 12");
        expect(planner).toContain("/api/v1/trip-cities");
        expect(planner).toContain("/api/v1/trip-forecast");
        expect(planner).toContain("FORECAST_SNAPSHOT_CHANGED");
        expect(planner).not.toContain("open-meteo.com");
        expect(planner).not.toContain("api.open-meteo.com");
        expect(trip).toContain("dates.length < 16");
      });

      it("keeps dates, limits and shortlist shareable through URL state", () => {
        expect(engine).toContain("parseDiscoveryPreferences");
        expect(engine).toContain("serializeDiscoveryPreferences");
        expect(planner).toContain('search.set("cities"');
        expect(planner).toContain("window.history.replaceState");
      });

      it("records an explicit destination choice before commercial surfaces", () => {
        expect(planner).toContain('event: "destination_selected"');
        expect(planner).toContain('data-commerce-after-decision="destination-selected"');
        expect(planner).toContain('stage: "discovery_decided"');
        expect(planner).toContain("hasTrip: false");
        expect(planner).not.toContain("buildDiscoveryWorkspace");
      });

      it("ships localized crawlable routes with one product promise", () => {
        expect(englishRoute).toContain('locale="en"');
        expect(simplifiedRoute).toContain('locale="zh-cn"');
        expect(traditionalRoute).toContain('locale="zh-hant"');
        expect(planner).toContain("Least-rain destination finder");
        expect(planner).toContain("少雨目的地工具");
        expect(planner).not.toContain("Weather Discovery 2.0");
        expect(planner).not.toContain("Phase 7");
      });
    });
    ''',
)

# Add a regression proving wind does not silently alter the dry score.
replace_exact(
    "apps/web/src/discovery/weather-discovery.test.ts",
    "  it(\"applies optional limits as hard filters\", () => {\n",
    "  it(\"keeps the least-rain score independent from wind unless a wind limit is set\", () => {\n"
    "    const calm = assessDiscoveryWeather([day({ windSpeedKph: 5 })], DEFAULT_PREFERENCES);\n"
    "    const windy = assessDiscoveryWeather([day({ windSpeedKph: 80 })], DEFAULT_PREFERENCES);\n"
    "    expect(calm.score).toBe(windy.score);\n"
    "  });\n\n"
    "  it(\"applies optional limits as hard filters\", () => {\n",
)

# ---------------------------------------------------------------------------
# Analytics: destination selection is the Phase 0 north-star conversion.
# ---------------------------------------------------------------------------

replace_exact(
    "packages/analytics/src/events.ts",
    "export interface TripCreatedEvent {\n",
    "export interface DestinationSelectedEvent {\n"
    "  readonly event: \"destination_selected\";\n"
    "  readonly event_version: 1;\n"
    "  readonly occurred_at: string;\n"
    "  readonly route_template: string;\n"
    "  readonly locale: AnalyticsLocale;\n"
    "  readonly destination_id: string;\n"
    "  readonly position: number;\n"
    "}\n\n"
    "export interface TripCreatedEvent {\n",
)
replace_exact(
    "packages/analytics/src/events.ts",
    "  | DestinationShortlistedEvent\n  | TripCreatedEvent\n",
    "  | DestinationShortlistedEvent\n  | DestinationSelectedEvent\n  | TripCreatedEvent\n",
)
replace_exact(
    "packages/analytics/src/events.ts",
    '  "destination_shortlisted",\n  "trip_created",\n',
    '  "destination_shortlisted",\n  "destination_selected",\n  "trip_created",\n',
)
replace_exact(
    "packages/analytics/src/events.ts",
    "    case \"trip_created\": {\n",
    "    case \"destination_selected\": {\n"
    "      const id = obj.destination_id;\n"
    "      if (!asString(id) || !DESTINATION_KEY_RE.test(id)) {\n"
    "        return failV(\"invalid_destination_id\");\n"
    "      }\n"
    "      const position = obj.position;\n"
    "      if (!asBoundedPositiveInt(position, 3)) return failV(\"invalid_position\");\n"
    "      return okV<AnalyticsEvent>({\n"
    "        ...common,\n"
    "        event: \"destination_selected\",\n"
    "        destination_id: id,\n"
    "        position,\n"
    "      });\n"
    "    }\n\n"
    "    case \"trip_created\": {\n",
)
replace_exact(
    "packages/analytics/src/funnel-events.test.ts",
    "      {\n        ...common,\n        event: \"trip_created\",\n",
    "      {\n"
    "        ...common,\n"
    "        event: \"destination_selected\",\n"
    "        route_template: \"/discover\",\n"
    "        destination_id: \"jp-tokyo\",\n"
    "        position: 1,\n"
    "      },\n"
    "      {\n"
    "        ...common,\n"
    "        event: \"trip_created\",\n",
)
replace_exact(
    "packages/analytics/src/funnel-events.test.ts",
    "    expect(\n      validateAnalyticsEvent({\n        ...common,\n        event: \"trip_created\",\n",
    "    expect(\n"
    "      validateAnalyticsEvent({\n"
    "        ...common,\n"
    "        event: \"destination_selected\",\n"
    "        route_template: \"/discover\",\n"
    "        destination_id: \"jp-tokyo\",\n"
    "        position: 4,\n"
    "      }).ok,\n"
    "    ).toBe(false);\n"
    "    expect(\n"
    "      validateAnalyticsEvent({\n"
    "        ...common,\n"
    "        event: \"trip_created\",\n",
)

# ---------------------------------------------------------------------------
# Global information architecture: one primary tool, advanced Trips retained.
# ---------------------------------------------------------------------------

write(
    "apps/web/src/components/SiteHeader.tsx",
    r'''
    "use client";

    import type { ChangeEvent, ReactElement } from "react";
    import { usePathname } from "next/navigation";
    import {
      LOCALE_STORAGE_KEY,
      htmlLanguage,
      isAutoLocalizablePath,
      localeFromPath,
      localizedPath,
      type SiteLocale,
    } from "../i18n/locale-routing";

    function BrandMark(): ReactElement {
      return (
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 36 36" fill="none">
            <path
              d="M9 22.5h16.2a5.3 5.3 0 0 0 .2-10.6 8.1 8.1 0 0 0-15.2 2.7A4 4 0 0 0 9 22.5Z"
              fill="currentColor"
            />
            <path
              d="m11.5 27.2-1.7 2.5m7.8-2.5-1.7 2.5m7.8-2.5L22 29.7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    }

    export function SiteHeader(): ReactElement {
      const pathname = usePathname();
      const currentLocale = localeFromPath(pathname);
      const isTraditional = currentLocale === "zh-hant";
      const isSimplified = currentLocale === "zh-cn";
      const isChinese = currentLocale !== "en";
      const localePrefix = isTraditional ? "/zh-hant" : isSimplified ? "/zh-cn" : "";
      const homeHref = localePrefix || "/";
      const decisionHref = `${localePrefix}/discover`;

      function chooseLocale(event: ChangeEvent<HTMLSelectElement>): void {
        const locale = event.target.value as SiteLocale;
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        document.documentElement.lang = htmlLanguage(locale);
        const destination = isAutoLocalizablePath(pathname)
          ? localizedPath(pathname, locale)
          : locale === "en"
            ? "/discover"
            : `/${locale}/discover`;
        window.location.assign(`${destination}${window.location.search}${window.location.hash}`);
      }

      return (
        <header className="site-header">
          <a href="#main-content" className="skip-link">
            {isTraditional ? "跳至主要內容" : isSimplified ? "跳到主要内容" : "Skip to content"}
          </a>
          <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
            <a
              href={homeHref}
              className="group flex items-center gap-2.5 rounded-lg focus-ring"
              aria-label={
                isTraditional
                  ? "Where Not Rain 少雨目的地首頁"
                  : isSimplified
                    ? "Where Not Rain 少雨目的地首页"
                    : "Where Not Rain least-rain destination finder home"
              }
            >
              <BrandMark />
              <span className="text-[15px] font-bold tracking-[-0.02em] text-foreground sm:text-base">
                Where Not Rain
              </span>
              <span className="hidden rounded-full border border-border bg-surface-elevated px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted md:inline">
                {isChinese ? "少雨去哪" : "Dry trip"}
              </span>
            </a>
            <nav aria-label={isChinese ? "主導覽" : "Main navigation"} className="flex items-center gap-1">
              <a href={decisionHref} className="nav-link bg-foreground !text-white shadow-sm focus-ring">
                <span className="hidden sm:inline">
                  {isTraditional
                    ? "找少雨目的地"
                    : isSimplified
                      ? "找少雨目的地"
                      : "Find dry destinations"}
                </span>
                <span className="sm:hidden">{isChinese ? "少雨" : "Find"}</span>
              </a>
              <label className="nav-link focus-within:ring-2 focus-within:ring-primary/30">
                <span className="sr-only">
                  {isTraditional ? "選擇語言" : isSimplified ? "选择语言" : "Choose language"}
                </span>
                <select
                  value={currentLocale}
                  onChange={chooseLocale}
                  className="cursor-pointer bg-transparent text-xs font-bold sm:text-sm"
                  aria-label={
                    isTraditional ? "選擇語言" : isSimplified ? "选择语言" : "Choose language"
                  }
                >
                  <option value="en">English</option>
                  <option value="zh-cn">简体中文</option>
                  <option value="zh-hant">繁體中文</option>
                </select>
              </label>
            </nav>
          </div>
        </header>
      );
    }
    ''',
)

write(
    "apps/web/src/app/layout.tsx",
    r'''
    import type { Metadata, Viewport } from "next";
    import type { ReactNode } from "react";
    import { CloudflareAnalytics } from "../components/CloudflareAnalytics";
    import { LocaleBootstrap } from "../components/LocaleBootstrap";
    import { PwaBootstrap } from "../components/PwaBootstrap";
    import { SiteHeader } from "../components/SiteHeader";
    import "./globals.css";

    export const metadata: Metadata = {
      title: {
        default: "Where Not Rain — least-rain destination finder",
        template: "%s — Where Not Rain",
      },
      description:
        "Choose travel dates, apply optional weather limits and compare the three destinations with the lowest rain risk.",
      metadataBase: new URL("https://868656.xyz"),
      applicationName: "Where Not Rain",
      manifest: "/manifest.webmanifest",
      appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Where Not Rain",
      },
      icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
    };

    export const viewport: Viewport = {
      themeColor: "#2563eb",
    };

    export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
      return (
        <html lang="en">
          <body>
            <LocaleBootstrap />
            <PwaBootstrap />
            <SiteHeader />
            {children}
            <CloudflareAnalytics />
          </body>
        </html>
      );
    }
    ''',
)

focus_css = ROOT / "apps/web/src/app/discovery-focus.css"
if focus_css.exists():
    focus_css.unlink()

write(
    "apps/web/public/manifest.webmanifest",
    r'''
    {
      "name": "Where Not Rain",
      "short_name": "Where Not Rain",
      "description": "Choose dates and find the three destinations with the lowest rain risk.",
      "start_url": "/discover",
      "scope": "/",
      "display": "standalone",
      "background_color": "#f7f8f3",
      "theme_color": "#2563eb",
      "icons": [
        {
          "src": "/pwa-icon.svg",
          "sizes": "any",
          "type": "image/svg+xml",
          "purpose": "any maskable"
        }
      ],
      "shortcuts": [
        {
          "name": "Find dry destinations",
          "short_name": "Find dry",
          "url": "/discover"
        }
      ]
    }
    ''',
)

# English homepage keeps the crawlable weather overview but has one acquisition task.
replace_exact(
    "apps/web/src/app/page.tsx",
    "  const rankedCards = [...cards].sort(\n    (left, right) => (right.score.value ?? -1) - (left.score.value ?? -1),\n  );\n",
    "  const rankedCards = [...cards]\n"
    "    .sort((left, right) => (right.score.value ?? -1) - (left.score.value ?? -1))\n"
    "    .slice(0, 3);\n",
)
replace_exact("apps/web/src/app/page.tsx", "Weather-first group destination decisions", "Least-rain destination finder")
replace_exact(
    "apps/web/src/app/page.tsx",
    "              Dates fixed.\n              <br />\n              Destination open?\n",
    "              Dates fixed.\n              <br />\n              Where is it least likely to rain?\n",
)
replace_exact(
    "apps/web/src/app/page.tsx",
    "              Compare the next 14 days, keep the shortlist small, and share the same weather\n              evidence with the people travelling with you. Once everyone agrees, continue in one\n              shared trip.\n",
    "              Choose your dates, apply optional rain, temperature and wind limits, and compare\n              only the three destinations with the strongest dry-weather signal.\n",
)
replace_exact("apps/web/src/app/page.tsx", "                Compare destinations\n", "                Find 3 dry-weather destinations\n")
remove_exact(
    "apps/web/src/app/page.tsx",
    "              <a\n                href=\"/trips\"\n                className=\"rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary/30 hover:bg-surface-elevated focus-ring\"\n              >\n                Continue shared planning <span aria-hidden=\"true\">→</span>\n              </a>\n",
)
replace_exact("apps/web/src/app/page.tsx", "              See today&apos;s weather shortlist\n", "              See today&apos;s weather overview\n")
replace_exact("apps/web/src/app/page.tsx", "Best weather signal today", "Driest weather signal today")
replace_exact("apps/web/src/app/page.tsx", "Travel Score", "Weather signal", 2)
replace_exact(
    "apps/web/src/app/page.tsx",
    "        aria-label=\"Weather-first group decision flow\"\n",
    "        aria-label=\"Least-rain destination decision flow\"\n",
)
replace_exact(
    "apps/web/src/app/page.tsx",
    "          [\"01\", \"Set the window\", \"Choose dates and the weather conditions that matter most.\"],\n          [\n            \"02\",\n            \"Compare 3–5 places\",\n            \"Review the reasons, trade-offs and daily outlook together.\",\n          ],\n          [\n            \"03\",\n            \"Share and plan\",\n            \"Send one shortlist to the group, then continue in a shared trip after the choice.\",\n          ],\n",
    "          [\"01\", \"Choose dates\", \"Set the exact travel window within the forecast horizon.\"],\n"
    "          [\"02\", \"Add optional limits\", \"Exclude destinations that are too wet, hot, cold or windy.\"],\n"
    "          [\"03\", \"Compare the Top 3\", \"Choose one destination or share the same shortlist externally.\"],\n",
)
replace_exact("apps/web/src/app/page.tsx", "Weather shortlist", "Dry-weather overview")
replace_exact("apps/web/src/app/page.tsx", "Best available weather, ranked", "Three strongest dry-weather signals")
replace_exact("apps/web/src/app/page.tsx", "Where Not Rain · Decide together with the weather", "Where Not Rain · Find the least-rain destination")
replace_exact(
    "apps/web/src/app/page.tsx",
    '  const title = "Weather-first group destination decisions | Where Not Rain";\n  const description =\n    "Dates fixed but destination open? Compare the next 14 days, share a small shortlist and continue planning together after the group decides.";\n',
    '  const title = "Find the least-rain travel destination | Where Not Rain";\n'
    '  const description =\n'
    '    "Choose travel dates, apply optional weather limits and compare the three destinations with the lowest rain risk.";\n',
)
replace_exact("apps/web/src/app/page.tsx", 'alternateName: "Dates fixed. Destination open?",', 'alternateName: "Dates fixed. Where is it least likely to rain?",')
replace_exact(
    "apps/web/src/app/page.tsx",
    '          "Weather-first destination comparisons and lightweight group trip planning for travellers deciding where to go.",',
    '          "A focused tool for comparing the three destinations with the lowest rain risk on fixed travel dates.",',
)
replace_exact("apps/web/src/app/page.tsx", '        name: "Weather-first group destination decisions",', '        name: "Least-rain destination finder",')
replace_exact(
    "apps/web/src/app/page.tsx",
    '          "Compare rain, temperature and Travel Scores before sharing a shortlist and planning together.",',
    '          "Compare rain risk on fixed travel dates, apply explicit limits and choose from a Top 3 shortlist.",',
)

# Localized homepages are compact and are rewritten to one product task.
write(
    "apps/web/src/app/zh-cn/page.tsx",
    r'''
    import type { Metadata } from "next";
    import type { ReactElement } from "react";
    import { getBakedDataset } from "../../build/bake";
    import { JsonLd } from "../../components/JsonLd";
    import { buildAlternates, localeUrl, routeRobots } from "../seo";

    export async function generateMetadata(): Promise<Metadata> {
      const title = "未来14天少雨目的地 Top 3 | Where Not Rain";
      const description =
        "日期已经确定？选择出行日期和可选天气限制，比较日本、韩国和东南亚城市中降雨风险最低的 3 个目的地。";
      return {
        title: { absolute: title },
        description,
        alternates: buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"]),
        robots: routeRobots("homepage", true),
        openGraph: {
          type: "website",
          url: localeUrl("zh-cn", "/"),
          siteName: "Where Not Rain",
          title,
          description,
          locale: "zh_CN",
        },
      };
    }

    export default async function SimplifiedChineseHome(): Promise<ReactElement> {
      const dataset = await getBakedDataset();
      const countries = dataset.countries.map((country) => {
        const cities = dataset.citiesByCountry.get(country.id) ?? [];
        return {
          slug: country.slug,
          name: country.name["zh-cn"],
          summary: country.summary?.["zh-cn"] ?? country.summary?.en ?? "",
          cityCount: cities.length,
          cityNames: cities.slice(0, 3).map((item) => item.city.name["zh-cn"]),
        };
      });
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "未来14天少雨目的地 Top 3",
        description: "选择出行日期和可选天气限制，只比较降雨风险最低的 3 个目的地。",
        url: localeUrl("zh-cn", "/"),
        inLanguage: "zh-CN",
        hasPart: countries.map((country) => ({
          "@type": "WebPage",
          name: `${country.name}旅行天气地图`,
          url: localeUrl("zh-cn", `/${country.slug}`),
        })),
      };

      return (
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <JsonLd schema={jsonLd} />
          <section className="hero-panel !p-6 sm:!p-10">
            <div className="relative z-10 max-w-4xl">
              <p className="eyebrow">未来14天 · 少雨目的地决策</p>
              <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
                日期定了，去哪里更不容易下雨？
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
                选择出行日期，按整体降雨风险筛选目的地；也可以设置温度、风速和最高降雨概率限制，只看最值得比较的 3 个结果。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/zh-cn/discover"
                  className="rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-lg shadow-foreground/15 transition hover:-translate-y-0.5 hover:bg-primary focus-ring"
                >
                  找 3 个少雨目的地
                </a>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="少雨目的地决策流程">
            {[
              ["01", "选择准确日期", "在未来14天预报窗口内确定开始和结束日期。"],
              ["02", "设置可选限制", "需要时排除太热、太冷、风太大或某天降雨概率太高的城市。"],
              ["03", "比较并选择 Top 3", "查看统一天气依据，选择一个目的地或把候选分享给同行人。"],
            ].map(([number, title, description]) => (
              <article key={number} className="trip-process-card">
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </section>

          <section className="mt-12" aria-labelledby="country-weather-heading">
            <p className="eyebrow">按地区继续探索</p>
            <h2 id="country-weather-heading" className="section-title mt-3">
              查看各国城市天气地图
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              还没有具体候选时，可以先从一个国家开始，再用准确日期比较全部已收录城市。
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {countries.map((country) => (
                <li key={country.slug}>
                  <a href={`/zh-cn/${country.slug}`} className="destination-card block focus-ring">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                      {country.cityCount} 个旅游城市
                    </p>
                    <h3 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-foreground">
                      {country.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{country.summary}</p>
                    <p className="mt-5 text-xs font-semibold text-primary">
                      {country.cityNames.join(" · ")}
                    </p>
                    <span className="trip-action" aria-hidden="true">
                      比较城市天气 <span>→</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <footer className="page-footer">
            <span>Where Not Rain · 日期定了，去哪里更少雨</span>
            <span>
              天气数据：<a href="https://open-meteo.com/">Open-Meteo</a> · 衍生少雨指数
            </span>
          </footer>
        </main>
      );
    }
    ''',
)

write(
    "apps/web/src/app/zh-hant/page.tsx",
    r'''
    import type { Metadata } from "next";
    import type { ReactElement } from "react";
    import { getBakedDataset } from "../../build/bake";
    import { JsonLd } from "../../components/JsonLd";
    import { toTraditionalText } from "../../trips/traditional";
    import { buildAlternates, localeUrl, routeRobots } from "../seo";

    export async function generateMetadata(): Promise<Metadata> {
      const title = "未來14天少雨目的地 Top 3 | Where Not Rain";
      const description =
        "日期已經確定？選擇出行日期和可選天氣限制，比較日本、韓國和東南亞城市中降雨風險最低的 3 個目的地。";
      return {
        title: { absolute: title },
        description,
        alternates: buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"]),
        robots: routeRobots("homepage", true),
        openGraph: {
          type: "website",
          url: localeUrl("zh-hant", "/"),
          siteName: "Where Not Rain",
          title,
          description,
          locale: "zh_TW",
        },
      };
    }

    export default async function TraditionalChineseHome(): Promise<ReactElement> {
      const dataset = await getBakedDataset();
      const countries = dataset.countries.map((country) => {
        const cities = dataset.citiesByCountry.get(country.id) ?? [];
        return {
          slug: country.slug,
          name: toTraditionalText(country.name["zh-cn"]),
          summary: toTraditionalText(country.summary?.["zh-cn"] ?? country.summary?.en ?? ""),
          cityCount: cities.length,
          cityNames: cities.slice(0, 3).map((item) => toTraditionalText(item.city.name["zh-cn"])),
        };
      });
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "未來14天少雨目的地 Top 3",
        description: "選擇出行日期和可選天氣限制，只比較降雨風險最低的 3 個目的地。",
        url: localeUrl("zh-hant", "/"),
        inLanguage: "zh-Hant",
        hasPart: countries.map((country) => ({
          "@type": "WebPage",
          name: `${country.name}旅行天氣地圖`,
          url: localeUrl("zh-hant", `/${country.slug}`),
        })),
      };

      return (
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <JsonLd schema={jsonLd} />
          <section className="hero-panel !p-6 sm:!p-10">
            <div className="relative z-10 max-w-4xl">
              <p className="eyebrow">未來14天 · 少雨目的地決策</p>
              <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
                日期定了，去哪裡更不容易下雨？
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
                選擇出行日期，按整體降雨風險篩選目的地；也可以設定溫度、風速和最高降雨機率限制，只看最值得比較的 3 個結果。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/zh-hant/discover"
                  className="rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-lg shadow-foreground/15 transition hover:-translate-y-0.5 hover:bg-primary focus-ring"
                >
                  找 3 個少雨目的地
                </a>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="少雨目的地決策流程">
            {[
              ["01", "選擇準確日期", "在未來14天預報窗口內確定開始和結束日期。"],
              ["02", "設定可選限制", "需要時排除太熱、太冷、風太大或某天降雨機率太高的城市。"],
              ["03", "比較並選擇 Top 3", "查看統一天氣依據，選擇一個目的地或把候選分享給同行人。"],
            ].map(([number, title, description]) => (
              <article key={number} className="trip-process-card">
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </section>

          <section className="mt-12" aria-labelledby="country-weather-heading">
            <p className="eyebrow">按地區繼續探索</p>
            <h2 id="country-weather-heading" className="section-title mt-3">
              查看各國城市天氣地圖
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              還沒有具體候選時，可以先從一個國家開始，再用準確日期比較全部已收錄城市。
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {countries.map((country) => (
                <li key={country.slug}>
                  <a href={`/zh-hant/${country.slug}`} className="destination-card block focus-ring">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                      {country.cityCount} 個旅遊城市
                    </p>
                    <h3 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-foreground">
                      {country.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{country.summary}</p>
                    <p className="mt-5 text-xs font-semibold text-primary">
                      {country.cityNames.join(" · ")}
                    </p>
                    <span className="trip-action" aria-hidden="true">
                      比較城市天氣 <span>→</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <footer className="page-footer">
            <span>Where Not Rain · 日期定了，去哪裡更少雨</span>
            <span>
              天氣資料：<a href="https://open-meteo.com/">Open-Meteo</a> · 衍生少雨指數
            </span>
          </footer>
        </main>
      );
    }
    ''',
)

# Crawlable discovery metadata matches the one-job product promise.
write(
    "apps/web/src/app/discover/page.tsx",
    r'''
    import type { Metadata } from "next";
    import type { ReactElement } from "react";
    import { DiscoveryRetentionCompanion } from "../../components/DiscoveryRetentionCompanion";
    import { JsonLd } from "../../components/JsonLd";
    import { WeatherDiscoveryPlannerV2 } from "../../components/WeatherDiscoveryPlannerV2";
    import { buildAlternates, localeUrl } from "../seo";

    const description =
      "Choose travel dates, apply optional rain, temperature and wind limits, then compare the three destinations with the lowest rain risk.";

    export const metadata: Metadata = {
      title: "Find the least-rain travel destination",
      description,
      alternates: buildAlternates("/discover", "en", ["en", "zh-cn", "zh-hant"]),
      robots: { index: true, follow: true },
    };

    export default function WeatherDiscoveryPage(): ReactElement {
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Where Not Rain least-rain destination finder",
        description,
        url: localeUrl("en", "/discover"),
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        inLanguage: "en",
      };

      return (
        <>
          <JsonLd schema={jsonLd} />
          <DiscoveryRetentionCompanion locale="en" />
          <WeatherDiscoveryPlannerV2 locale="en" />
        </>
      );
    }
    ''',
)

write(
    "apps/web/src/app/zh-cn/discover/page.tsx",
    r'''
    import type { Metadata } from "next";
    import type { ReactElement } from "react";
    import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
    import { JsonLd } from "../../../components/JsonLd";
    import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
    import { buildAlternates, localeUrl } from "../../seo";

    const description = "选择出行日期和可选天气限制，只比较整体降雨风险最低的 3 个旅行目的地。";

    export const metadata: Metadata = {
      title: "哪里不下雨：少雨目的地 Top 3",
      description,
      alternates: buildAlternates("/discover", "zh-cn", ["en", "zh-cn", "zh-hant"]),
      robots: { index: true, follow: true },
    };

    export default function SimplifiedWeatherDiscoveryPage(): ReactElement {
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Where Not Rain 少雨目的地工具",
        description,
        url: localeUrl("zh-cn", "/discover"),
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        inLanguage: "zh-CN",
      };

      return (
        <>
          <JsonLd schema={jsonLd} />
          <DiscoveryRetentionCompanion locale="zh-cn" />
          <WeatherDiscoveryPlannerV2 locale="zh-cn" />
        </>
      );
    }
    ''',
)

write(
    "apps/web/src/app/zh-hant/discover/page.tsx",
    r'''
    import type { Metadata } from "next";
    import type { ReactElement } from "react";
    import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
    import { JsonLd } from "../../../components/JsonLd";
    import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
    import { buildAlternates, localeUrl } from "../../seo";

    const description = "選擇出行日期和可選天氣限制，只比較整體降雨風險最低的 3 個旅行目的地。";

    export const metadata: Metadata = {
      title: "哪裡不下雨：少雨目的地 Top 3",
      description,
      alternates: buildAlternates("/discover", "zh-hant", ["en", "zh-cn", "zh-hant"]),
      robots: { index: true, follow: true },
    };

    export default function TraditionalWeatherDiscoveryPage(): ReactElement {
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Where Not Rain 少雨目的地工具",
        description,
        url: localeUrl("zh-hant", "/discover"),
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        inLanguage: "zh-Hant",
      };

      return (
        <>
          <JsonLd schema={jsonLd} />
          <DiscoveryRetentionCompanion locale="zh-hant" />
          <WeatherDiscoveryPlannerV2 locale="zh-hant" />
        </>
      );
    }
    ''',
)

# Advanced trip tooling remains reachable for existing users but leaves acquisition and SEO.
write(
    "apps/web/src/app/trips/page.tsx",
    r'''
    import type { Metadata } from "next";
    import type { ReactElement } from "react";
    import { MyTripsDashboard } from "../../components/MyTripsDashboard";
    import { buildAlternates } from "../seo";

    export const metadata: Metadata = {
      title: "Advanced itinerary tools",
      description: "Existing local and cloud trip workspaces remain available as optional advanced tools.",
      alternates: buildAlternates("/trips", "en", ["en", "zh-hant", "zh-cn"]),
      robots: { index: false, follow: true },
    };

    export default function TripsLanding(): ReactElement {
      return (
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <section className="trip-hero">
            <div className="relative z-10 max-w-4xl">
              <p className="eyebrow">Advanced itinerary tools</p>
              <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
                Existing workspaces remain available.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
                Where Not Rain now focuses on choosing a least-rain destination. Existing itinerary,
                collaboration and execution tools remain available here for people who already use them.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="trip-primary-button" href="/discover">
                  Return to destination finder
                </a>
                <a className="trip-secondary-button" href="/trips/workspace">
                  Open existing workspace
                </a>
              </div>
              <a
                className="mt-4 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
                href="/trips/new"
              >
                Import an existing itinerary
              </a>
            </div>
          </section>

          <MyTripsDashboard locale="en" />

          <footer className="page-footer">
            <span>Where Not Rain · Advanced tools for existing trips</span>
            <span>Not part of the primary destination-decision journey</span>
          </footer>
        </main>
      );
    }
    ''',
)

write(
    "apps/web/src/app/zh-cn/trips/page.tsx",
    r'''
    import type { Metadata } from "next";
    import type { ReactElement } from "react";
    import { MyTripsDashboard } from "../../../components/MyTripsDashboard";
    import { buildAlternates } from "../../seo";

    export const metadata: Metadata = {
      title: "高级行程工具",
      description: "已有的本地和云端行程工作区继续作为可选高级工具保留。",
      alternates: buildAlternates("/trips", "zh-cn", ["en", "zh-hant", "zh-cn"]),
      robots: { index: false, follow: true },
    };

    export default function SimplifiedTripsLanding(): ReactElement {
      return (
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <section className="trip-hero">
            <div className="relative z-10 max-w-4xl">
              <p className="eyebrow">高级行程工具</p>
              <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
                已有行程仍可继续使用。
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
                Where Not Rain 现在专注于选择少雨目的地。已有的行程、协作和执行功能继续在这里保留，供原有用户按需使用。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="trip-primary-button" href="/zh-cn/discover">
                  返回少雨目的地工具
                </a>
                <a className="trip-secondary-button" href="/zh-cn/trips/workspace">
                  打开已有工作台
                </a>
              </div>
              <a
                className="mt-4 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
                href="/zh-cn/trips/new"
              >
                导入已有行程
              </a>
            </div>
          </section>

          <MyTripsDashboard locale="zh-cn" />

          <footer className="page-footer">
            <span>Where Not Rain · 已有行程的高级工具</span>
            <span>不再属于目的地决策主流程</span>
          </footer>
        </main>
      );
    }
    ''',
)

write(
    "apps/web/src/app/zh-hant/trips/page.tsx",
    r'''
    import type { Metadata } from "next";
    import type { ReactElement } from "react";
    import { MyTripsDashboard } from "../../../components/MyTripsDashboard";
    import { buildAlternates } from "../../seo";

    export const metadata: Metadata = {
      title: "進階行程工具",
      description: "既有的本機和雲端行程工作區繼續作為可選進階工具保留。",
      alternates: buildAlternates("/trips", "zh-hant", ["en", "zh-hant", "zh-cn"]),
      robots: { index: false, follow: true },
    };

    export default function TraditionalTripsLanding(): ReactElement {
      return (
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <section className="trip-hero">
            <div className="relative z-10 max-w-4xl">
              <p className="eyebrow">進階行程工具</p>
              <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
                既有行程仍可繼續使用。
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
                Where Not Rain 現在專注於選擇少雨目的地。既有的行程、協作和執行功能繼續在這裡保留，供原有使用者按需使用。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="trip-primary-button" href="/zh-hant/discover">
                  返回少雨目的地工具
                </a>
                <a className="trip-secondary-button" href="/zh-hant/trips/workspace">
                  開啟既有工作台
                </a>
              </div>
              <a
                className="mt-4 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
                href="/zh-hant/trips/new"
              >
                匯入既有行程
              </a>
            </div>
          </section>

          <MyTripsDashboard locale="zh-hant" />

          <footer className="page-footer">
            <span>Where Not Rain · 既有行程的進階工具</span>
            <span>不再屬於目的地決策主流程</span>
          </footer>
        </main>
      );
    }
    ''',
)

# Remove advanced trip pages from the public sitemap; URLs remain valid and noindexed.
remove_exact(
    "apps/web/src/app/sitemap.ts",
    '    ...localizedSitemapEntries("/trips", { lastModified, changeFrequency }, [\n      "en",\n      "zh-hant",\n      "zh-cn",\n    ]),\n    ...localizedSitemapEntries("/trips/qinggan-family-2026", { lastModified, changeFrequency }, [\n      "en",\n      "zh-cn",\n    ]),\n',
)

# ---------------------------------------------------------------------------
# Product and production contracts.
# ---------------------------------------------------------------------------

write(
    "apps/web/src/components/ux-funnel-contract.test.ts",
    r'''
    import { readFileSync } from "node:fs";
    import { describe, expect, it } from "vitest";

    const englishHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    const simplifiedHome = readFileSync(new URL("../app/zh-cn/page.tsx", import.meta.url), "utf8");
    const traditionalHome = readFileSync(new URL("../app/zh-hant/page.tsx", import.meta.url), "utf8");
    const header = readFileSync(new URL("./SiteHeader.tsx", import.meta.url), "utf8");
    const discovery = readFileSync(new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url), "utf8");
    const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
    const trips = readFileSync(new URL("../app/trips/page.tsx", import.meta.url), "utf8");

    describe("OPC least-rain decision UX contracts", () => {
      it("gives every homepage one primary least-rain task", () => {
        expect(englishHome).toContain("Where is it least likely to rain?");
        expect(englishHome).toContain("Find 3 dry-weather destinations");
        expect(englishHome).not.toContain('href="/trips"');

        expect(simplifiedHome).toContain("日期定了，去哪里更不容易下雨？");
        expect(simplifiedHome).toContain("找 3 个少雨目的地");
        expect(simplifiedHome).not.toContain('href="/zh-cn/trips"');

        expect(traditionalHome).toContain("日期定了，去哪裡更不容易下雨？");
        expect(traditionalHome).toContain("找 3 個少雨目的地");
        expect(traditionalHome).not.toContain('href="/zh-hant/trips"');
      });

      it("uses one global product navigation task", () => {
        expect(header).toContain("Find dry destinations");
        expect(header).toContain("找少雨目的地");
        expect(header).not.toContain("Plan together");
        expect(header).not.toContain("共同规划");
        expect(header).not.toContain("共同規劃");
        expect(header).not.toContain("tripHref");
      });

      it("returns Top 3 results with explicit limits and no context dropdowns", () => {
        expect(discovery).toContain("const MAX_RESULTS = 3");
        expect(discovery).toContain("rankedResults.slice(0, MAX_RESULTS)");
        expect(discovery).toContain("Optional weather limits");
        expect(discovery).toContain("可选限制条件");
        expect(discovery).not.toContain("<select");
        expect(discovery).not.toContain("Travellers");
        expect(discovery).not.toContain("Trip style");
      });

      it("keeps advanced Trips available but outside acquisition and indexing", () => {
        expect(trips).toContain("Advanced itinerary tools");
        expect(trips).toContain("robots: { index: false, follow: true }");
        expect(sitemap).not.toContain('localizedSitemapEntries("/trips"');
        expect(header).not.toContain('href={tripHref}');
      });

      it("keeps complete three-locale homepage alternates and crawlable discovery", () => {
        expect(englishHome).toContain('buildAlternates("/", "en", ["en", "zh-cn", "zh-hant"])');
        expect(simplifiedHome).toContain('buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"])');
        expect(traditionalHome).toContain(
          'buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"])',
        );
        expect(sitemap).toContain('localizedSitemapEntries("/discover"');
      });
    });
    ''',
)

write(
    "apps/web/src/components/group-decision-scope-contract.test.ts",
    r'''
    import { readFileSync } from "node:fs";
    import { describe, expect, it } from "vitest";

    const founderPrd = readFileSync(
      new URL(
        "../../../../docs/superpowers/product/2026-08-19-founder-prd-opc-dry-destination-engine.md",
        import.meta.url,
      ),
      "utf8",
    );
    const executionPlan = readFileSync(
      new URL(
        "../../../../docs/superpowers/plans/2026-08-19-opc-product-cutover-phase0.md",
        import.meta.url,
      ),
      "utf8",
    );

    describe("OPC least-rain product scope", () => {
      it("defines one north-star job and explicit non-goals", () => {
        expect(founderPrd).toContain("Where is it least likely to rain within reach?");
        expect(founderPrd).toContain("Top 3");
        expect(founderPrd).toContain("Explicit non-goals");
        expect(founderPrd).toContain("full collaborative itinerary platform");
      });

      it("uses rain as the only ranking target and limits as hard filters", () => {
        expect(founderPrd).toContain("Rain is the only ranking target");
        expect(founderPrd).toContain("maximum daily rain probability");
        expect(founderPrd).toContain("maximum wind speed");
        expect(founderPrd).toContain("minimum night temperature");
        expect(founderPrd).toContain("maximum daytime temperature");
      });

      it("phases reachability, conversion and voting after the product cutover", () => {
        expect(executionPlan).toContain("Phase 0 — OPC product cutover");
        expect(executionPlan).toContain("Phase 1 — origin and reachability");
        expect(executionPlan).toContain("Phase 2 — selection, monetization and retention");
        expect(executionPlan).toContain("Phase 3 — evidence-gated lightweight voting");
      });

      it("preserves provider and low-frequency CI boundaries", () => {
        expect(executionPlan).toContain("Weather provider boundaries remain unchanged");
        expect(executionPlan).toContain("four-workflow low-frequency CI/CD model");
      });
    });
    ''',
)

write(
    "apps/web/src/components/production-smoke-copy-contract.test.ts",
    r'''
    import { readFileSync } from "node:fs";
    import { describe, expect, it } from "vitest";

    const productionSmoke = readFileSync(
      new URL("../../../../.github/workflows/production-smoke.yml", import.meta.url),
      "utf8",
    );
    const discoverySmoke = readFileSync(
      new URL("../../../../tooling/deploy/weather-discovery-smoke.mjs", import.meta.url),
      "utf8",
    );
    const discoveryPlanner = readFileSync(
      new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url),
      "utf8",
    );
    const englishHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    const englishTrips = readFileSync(new URL("../app/trips/page.tsx", import.meta.url), "utf8");
    const simplifiedHome = readFileSync(new URL("../app/zh-cn/page.tsx", import.meta.url), "utf8");
    const simplifiedTrips = readFileSync(
      new URL("../app/zh-cn/trips/page.tsx", import.meta.url),
      "utf8",
    );
    const traditionalHome = readFileSync(new URL("../app/zh-hant/page.tsx", import.meta.url), "utf8");
    const traditionalTrips = readFileSync(
      new URL("../app/zh-hant/trips/page.tsx", import.meta.url),
      "utf8",
    );

    const currentCopy = [
      [englishHome, ["Dates fixed.", "Where is it least likely to rain?", "Find 3 dry-weather destinations"]],
      [englishTrips, ["Advanced itinerary tools", "Existing workspaces remain available.", "Return to destination finder"]],
      [simplifiedHome, ["未来14天 · 少雨目的地决策", "日期定了，去哪里更不容易下雨？", "找 3 个少雨目的地"]],
      [simplifiedTrips, ["高级行程工具", "已有行程仍可继续使用。", "返回少雨目的地工具"]],
      [traditionalHome, ["未來14天 · 少雨目的地決策", "日期定了，去哪裡更不容易下雨？", "找 3 個少雨目的地"]],
      [traditionalTrips, ["進階行程工具", "既有行程仍可繼續使用。", "返回少雨目的地工具"]],
    ] as const;

    const discoveryCopy = [
      ["Least-rain destination finder", "Where is it least likely to rain on your dates?"],
      ["少雨目的地工具", "这几天去哪里更不容易下雨？"],
      ["少雨目的地工具", "這幾天去哪裡更不容易下雨？"],
    ] as const;

    describe("production smoke copy contract", () => {
      it("checks the same OPC product copy rendered by every locale", () => {
        for (const [page, phrases] of currentCopy) {
          for (const phrase of phrases) {
            expect(page).toContain(phrase);
            expect(productionSmoke).toContain(phrase);
          }
        }
      });

      it("keeps the live discovery smoke aligned with the least-rain finder", () => {
        for (const phrases of discoveryCopy) {
          for (const phrase of phrases) {
            expect(discoveryPlanner).toContain(phrase);
            expect(discoverySmoke).toContain(phrase);
          }
        }
      });

      it("does not retain superseded group-planning acquisition copy", () => {
        for (const obsolete of [
          "Continue shared planning",
          "继续共同规划",
          "繼續共同規劃",
          "Plan it together.",
          "接下来一起规划。",
          "接下來一起規劃。",
        ]) {
          expect(productionSmoke).not.toContain(obsolete);
        }
      });
    });
    ''',
)

write(
    "apps/web/src/components/phase9-commercial-surface-contract.test.ts",
    r'''
    import { readFileSync } from "node:fs";
    import { describe, expect, it } from "vitest";

    function source(relative: string): string {
      return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
    }

    describe("Phase 9 commercial surface separation contract", () => {
      it("places Discovery commerce only after an explicit destination choice", () => {
        const discovery = source("components/WeatherDiscoveryPlannerV2.tsx");
        expect(discovery).toContain(
          'import { ContextualAffiliateSurface } from "./ContextualAffiliateSurface";',
        );
        expect(discovery).toContain("selectedDestination !== null");
        expect(discovery).toContain('event: "destination_selected"');
        expect(discovery).toContain('stage: "discovery_decided"');
        expect(discovery).toContain('data-commerce-after-decision="destination-selected"');
        expect(discovery).toContain("hasTrip: false");

        const choice = discovery.indexOf("chooseDestination");
        const commerce = discovery.indexOf('data-commerce-after-decision="destination-selected"');
        expect(choice).toBeGreaterThanOrEqual(0);
        expect(commerce).toBeGreaterThan(choice);
      });

      it("places weather-replan commerce only behind an actual replacement proposal", () => {
        const replan = source("components/TripReplanPanel.tsx");
        expect(replan).toContain('change.kind === "replace_activity"');
        expect(replan).toContain('stage: "weather_replan"');
        expect(replan).toContain('weatherAction: "indoor_fallback"');
        expect(replan).toContain('data-commerce-after-decision="weather-indoor-fallback"');
      });

      it("keeps commercial dependencies out of weather and replan algorithms", () => {
        for (const file of [
          "discovery/weather-discovery.ts",
          "trips/activity-risk.ts",
          "trips/replan-solver.ts",
        ]) {
          const text = source(file);
          expect(text).not.toContain("ContextualAffiliateSurface");
          expect(text).not.toContain("resolveContextualAffiliateSurface");
          expect(text).not.toContain("contextual-conversion");
          expect(text).not.toContain("affiliate-adapter");
        }
      });

      it("keeps the UI zero-fill by default when deployment commercial config is absent", () => {
        const surface = source("components/ContextualAffiliateSurface.tsx");
        expect(surface).toContain('process.env.NEXT_PUBLIC_AFFILIATE_OFFERS_JSON ?? ""');
        expect(surface).toContain('process.env.NEXT_PUBLIC_AFFILIATE_SLOTS ?? ""');
        expect(surface).toContain("if (items.length === 0) return null;");
      });
    });
    ''',
)

# Home and PWA tests track the cutover language and entry point.
replace_exact("apps/web/src/app/travel-radar.test.ts", "weather-first group\n// destination decision.", "least-rain destination\n// decision.")
replace_exact(
    "apps/web/src/app/travel-radar.test.ts",
    "    expect(html).toContain(\"Destination open?\");\n    expect(html).toContain(\"Compare destinations\");\n    expect(html).toContain('href=\"/discover\"');\n    expect(html).toContain(\"Continue shared planning\");\n    expect(html).toContain('href=\"/trips\"');\n",
    "    expect(html).toContain(\"Where is it least likely to rain?\");\n"
    "    expect(html).toContain(\"Find 3 dry-weather destinations\");\n"
    "    expect(html).toContain('href=\"/discover\"');\n"
    "    expect(html).not.toContain('href=\"/trips\"');\n",
)
replace_exact(
    "apps/web/src/app/travel-radar.test.ts",
    "  it(\"renders the three-step group decision flow\", () => {\n    expect(html).toContain(\"Set the window\");\n    expect(html).toContain(\"Compare 3–5 places\");\n    expect(html).toContain(\"Share and plan\");\n  });\n",
    "  it(\"renders the three-step least-rain decision flow\", () => {\n"
    "    expect(html).toContain(\"Choose dates\");\n"
    "    expect(html).toContain(\"Add optional limits\");\n"
    "    expect(html).toContain(\"Compare the Top 3\");\n"
    "  });\n",
)
replace_exact("apps/web/src/app/travel-radar.test.ts", "Travel Score", "Weather signal")
replace_exact(
    "apps/web/src/e2e/critical-paths.test.ts",
    "    expect(html).toContain(\"Destination open?\");\n    expect(html).toContain(\"Compare destinations\");\n",
    "    expect(html).toContain(\"Where is it least likely to rain?\");\n"
    "    expect(html).toContain(\"Find 3 dry-weather destinations\");\n",
)
replace_exact(
    "apps/web/src/components/trip-execution-pwa-contract.test.ts",
    "    expect(manifest).toContain('\"start_url\": \"/trips\"');\n    expect(manifest).toContain('\"url\": \"/discover\"');\n    expect(manifest).toContain('\"url\": \"/trips/execution\"');\n",
    "    expect(manifest).toContain('\"start_url\": \"/discover\"');\n"
    "    expect(manifest).toContain('\"url\": \"/discover\"');\n"
    "    expect(manifest).not.toContain('\"url\": \"/trips/execution\"');\n",
)

# Production smoke expectations.
replace_exact(
    ".github/workflows/production-smoke.yml",
    '          fetch_and_match "English homepage" "${SITE_URL}/" /tmp/home-en.html \\\n            "Dates fixed." "Destination open?" "Compare destinations" "Continue shared planning"\n          fetch_and_match "English landing" "${SITE_URL}/trips" /tmp/trips.html \\\n            "Destination chosen?" "Plan it together." "Choose a destination first" \\\n            "Advanced: import an existing itinerary"\n',
    '          fetch_and_match "English homepage" "${SITE_URL}/" /tmp/home-en.html \\\n            "Dates fixed." "Where is it least likely to rain?" "Find 3 dry-weather destinations"\n'
    '          fetch_and_match "English landing" "${SITE_URL}/trips" /tmp/trips.html \\\n            "Advanced itinerary tools" "Existing workspaces remain available." \\\n            "Return to destination finder"\n',
)
replace_exact(
    ".github/workflows/production-smoke.yml",
    '          fetch_and_match "Traditional homepage" "${SITE_URL}/zh-hant" /tmp/home-hant.html \\\n            "未來14天 · 多人目的地決策" "日期定了，去哪還沒定？" \\\n            "開始比較目的地" "繼續共同規劃"\n          fetch_and_match "Traditional landing" "${SITE_URL}/zh-hant/trips" /tmp/trips-hant.html \\\n            "去哪已經確定？" "接下來一起規劃。" "先一起決定去哪" \\\n            "進階功能：匯入既有行程"\n',
    '          fetch_and_match "Traditional homepage" "${SITE_URL}/zh-hant" /tmp/home-hant.html \\\n            "未來14天 · 少雨目的地決策" "日期定了，去哪裡更不容易下雨？" \\\n            "找 3 個少雨目的地"\n'
    '          fetch_and_match "Traditional landing" "${SITE_URL}/zh-hant/trips" /tmp/trips-hant.html \\\n            "進階行程工具" "既有行程仍可繼續使用。" "返回少雨目的地工具"\n',
)
replace_exact(
    ".github/workflows/production-smoke.yml",
    '          fetch_and_match "Simplified homepage" "${SITE_URL}/zh-cn" /tmp/home-cn.html \\\n            "未来14天 · 多人目的地决策" "日期定了，去哪还没定？" \\\n            "开始比较目的地" "继续共同规划"\n          fetch_and_match "Simplified landing" "${SITE_URL}/zh-cn/trips" /tmp/trips-cn.html \\\n            "去哪已经确定？" "接下来一起规划。" "先一起决定去哪" \\\n            "高级功能：导入已有行程"\n',
    '          fetch_and_match "Simplified homepage" "${SITE_URL}/zh-cn" /tmp/home-cn.html \\\n            "未来14天 · 少雨目的地决策" "日期定了，去哪里更不容易下雨？" \\\n            "找 3 个少雨目的地"\n'
    '          fetch_and_match "Simplified landing" "${SITE_URL}/zh-cn/trips" /tmp/trips-cn.html \\\n            "高级行程工具" "已有行程仍可继续使用。" "返回少雨目的地工具"\n',
)

replace_exact(
    "tooling/deploy/weather-discovery-smoke.mjs",
    '  requireText(english, "Find the right destination", "English discovery route");\n  requireText(\n    english,\n    "Start with the weather. Decide the destination second.",\n    "English discovery route",\n  );\n  const simplified = await fetchText(`${siteUrl}/zh-cn/discover`);\n  requireText(simplified, "按天气找目的地", "Simplified discovery route");\n  requireText(simplified, "先看天气，再决定去哪里。", "Simplified discovery route");\n  const traditional = await fetchText(`${siteUrl}/zh-hant/discover`);\n  requireText(traditional, "按天氣找目的地", "Traditional discovery route");\n  requireText(traditional, "先看天氣，再決定去哪裡。", "Traditional discovery route");\n',
    '  requireText(english, "Least-rain destination finder", "English discovery route");\n'
    '  requireText(english, "Where is it least likely to rain on your dates?", "English discovery route");\n'
    '  const simplified = await fetchText(`${siteUrl}/zh-cn/discover`);\n'
    '  requireText(simplified, "少雨目的地工具", "Simplified discovery route");\n'
    '  requireText(simplified, "这几天去哪里更不容易下雨？", "Simplified discovery route");\n'
    '  const traditional = await fetchText(`${siteUrl}/zh-hant/discover`);\n'
    '  requireText(traditional, "少雨目的地工具", "Traditional discovery route");\n'
    '  requireText(traditional, "這幾天去哪裡更不容易下雨？", "Traditional discovery route");\n',
)

# ---------------------------------------------------------------------------
# Product direction and execution plan.
# ---------------------------------------------------------------------------

readme = (ROOT / "README.md").read_text(encoding="utf-8")
marker = "## Documentation authority\n"
if marker not in readme:
    raise RuntimeError("README authority marker missing")
_, remainder = readme.split(marker, 1)
(ROOT / "README.md").write_text(
    dedent(
        '''
        # Where Not Rain

        Automated least-rain destination decision tool for a one-person company. Users choose travel dates, optionally set explicit weather limits, and receive only the three destinations with the lowest rain risk in the supported dataset.

        ## Current product direction

        ```text
        choose dates
        → optionally exclude places that are too wet, hot, cold or windy
        → compare the Top 3 least-rain destinations
        → choose one destination
        → continue to external booking or weather reminders
        ```

        Rain is the only ranking target. Temperature and wind remain visible and may be used as explicit hard filters, but they do not silently alter the dry score.

        Existing itinerary, collaboration, route and execution capabilities remain available for current users under `/trips`, but they are no longer part of primary navigation, acquisition, sitemap or product expansion.

        The OPC product contract is recorded in `docs/superpowers/product/2026-08-19-founder-prd-opc-dry-destination-engine.md` and its phased implementation plan in `docs/superpowers/plans/2026-08-19-opc-product-cutover-phase0.md`.

        ## Documentation authority
        '''
    ).lstrip()
    + remainder,
    encoding="utf-8",
)

write(
    "docs/superpowers/product/2026-08-19-founder-prd-opc-dry-destination-engine.md",
    r'''
    # Founder PRD — OPC least-rain destination engine

    Date: 2026-08-19  
    Status: Product-owner approved implementation direction  
    Product: Where Not Rain

    ## 1. Product thesis

    Where Not Rain is an automated decision tool for travellers whose dates are fixed but destination is still open.

    > **Dates fixed. Where is it least likely to rain within reach?**

    The product does one job: compare supported destinations for the selected dates and return a **Top 3** shortlist ordered by rain risk.

    ## 2. OPC operating model

    The product must remain suitable for a one-person company:

    - automated weather ingestion and static/read-only delivery;
    - bounded geography and forecast horizon;
    - no user-content moderation requirement;
    - no live booking, payment or customer-service operation;
    - no dependency on LLM itinerary quality;
    - no full collaborative itinerary platform;
    - monetization only after the user chooses a destination.

    ## 3. Core user

    A traveller planning within the next 14 days who already knows:

    - when they can travel;
    - roughly how long the trip is;
    - that the destination may change;
    - that rain materially affects the choice.

    ## 4. Core job

    ```text
    choose travel dates
    → optionally apply explicit weather limits
    → receive Top 3 least-rain destinations
    → compare daily weather
    → choose one destination
    → open booking links or enable reminders
    ```

    ## 5. Ranking contract

    **Rain is the only ranking target.**

    The dry score may use:

    - average daily rain probability;
    - average precipitation amount;
    - a bounded surcharge for one severe rain day;
    - forecast data completeness and confidence.

    The dry score must not silently include:

    - wind;
    - temperature;
    - UV;
    - family or senior profiles;
    - beach or outdoor preferences;
    - commercial value;
    - live prices.

    ## 6. Optional hard limits

    Users may explicitly exclude destinations using:

    - maximum daily rain probability;
    - maximum wind speed;
    - minimum night temperature;
    - maximum daytime temperature.

    A destination that violates any selected limit is excluded rather than receiving an opaque score penalty.

    ## 7. Output contract

    The primary result contains no more than three destinations. Each destination shows:

    - dry score;
    - peak rain probability;
    - daily weather;
    - temperature range;
    - wind and UV cautions;
    - forecast freshness;
    - selection and comparison actions.

    ## 8. Selection and commerce

    Ranking and affiliate value are strictly separated.

    Commercial actions may appear only after the user selects a destination. The first conversion event is `destination_selected`, not trip creation or account registration.

    ## 9. Advanced tools

    Existing Trips, collaboration, route optimization, execution mode and adaptive replanning remain reachable for existing users but are:

    - removed from primary navigation;
    - removed from the public sitemap;
    - marked `noindex` at the Trips landing page;
    - frozen from new product expansion until the core decision funnel is validated.

    ## 10. Explicit non-goals

    - general AI travel assistant;
    - full collaborative itinerary platform;
    - complete POI and opening-hours database;
    - live flight, rail, hotel or ticket inventory;
    - real-time price-aware budget engine;
    - OTA checkout or payment;
    - community, reviews or travel feed;
    - global coverage before supported regional demand is validated.

    ## 11. North-star metric

    **Weekly valid destination selections**:

    ```text
    valid dates submitted
    → Top 3 returned
    → one destination selected
    ```

    Supporting metrics:

    - query completion rate;
    - no-result rate;
    - Top 3 detail click-through;
    - destination selection rate;
    - shortlist share rate;
    - post-selection commercial click rate;
    - reminder opt-in and return rate.
    ''',
)

write(
    "docs/superpowers/plans/2026-08-19-opc-product-cutover-phase0.md",
    r'''
    # OPC product cutover plan

    Date: 2026-08-19  
    Status: Phase 0 implemented in PR #55

    ## Phase 0 — OPC product cutover

    - one homepage task and one top-level product navigation item;
    - one active `dry` discovery intent;
    - no traveller or trip-style dropdowns;
    - four explicit optional weather limits;
    - dry score independent from wind and temperature;
    - Top 3 result cap;
    - explicit `destination_selected` event;
    - commercial surfaces only after selection;
    - Trips retained as noindex advanced tools;
    - Trips removed from navigation and sitemap;
    - PWA starts at `/discover`;
    - three-locale SEO and production-smoke contracts updated.

    ## Phase 1 — origin and reachability

    Add a bounded, static reachability dataset:

    ```text
    origin
    + transport mode
    + maximum one-way travel time
    → eligible destination set
    → least-rain Top 3
    ```

    No live fare, inventory or schedule dependency is required for the first release.

    ## Phase 2 — selection, monetization and retention

    - persist selected destination;
    - destination-specific hotel, flight, activity, eSIM, insurance or car-rental links;
    - saved searches;
    - D-7, D-3 and D-1 weather-change reminders;
    - automated weekend least-rain email.

    ## Phase 3 — evidence-gated lightweight voting

    Build anonymous Top 3 voting only after analytics prove that users repeatedly share result URLs. Do not build a full collaborative itinerary platform.

    ## Phase 4 — API and widget

    Consider Dry Score API and widgets only after consumer demand and score stability are demonstrated.

    ## Architecture guardrails

    - Weather provider boundaries remain unchanged: provider calls stay inside `weather-sync`.
    - Immutable weather snapshots remain the decision evidence.
    - The four-workflow low-frequency CI/CD model remains unchanged.
    - No preview deployment fan-out is reintroduced.
    - No runtime AI, booking, payment or live transport dependency is added in Phase 0.
    ''',
)

print("OPC product cutover files updated")
