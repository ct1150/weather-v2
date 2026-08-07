"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type * as MapLibreModule from "maplibre-gl";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import type {
  CountryHeaderViewModel,
  CountryOptionViewModel,
  CountryWeatherCityViewModel,
  CountryWeatherDayViewModel,
} from "../app/view-models";
import type { Window } from "../api/v1/schemas";
import { windowIndicesForDates } from "../weather/window-selection";
import { DiscoveryTripAction } from "./DiscoveryTripAction";
import { MAPLIBRE_STYLE_URL } from "./ExplorerMap";

import "maplibre-gl/dist/maplibre-gl.css";

type ExplorerLocale = "en" | "zh-cn";

const WINDOW_LABELS: Readonly<Record<ExplorerLocale, Readonly<Record<Window, string>>>> = {
  en: { today: "Today", tomorrow: "Tomorrow", weekend: "This weekend", next_week: "Next week" },
  "zh-cn": { today: "今天", tomorrow: "明天", weekend: "本周末", next_week: "下周" },
};

const COPY = {
  en: {
    country: "Country",
    chooseCountry: "Choose country",
    travelDates: "Travel dates",
    exactDates: "Or choose exact dates",
    firstDate: "First travel date",
    lastDate: "Last travel date",
    unavailable: "Dates unavailable",
    customTrip: "Custom trip",
    atGlance: "at a glance",
    mapHeading: "Weather across every listed travel city",
    lowerRain: "Lower rain",
    mixed: "Mixed",
    rainLikely: "Rain likely",
    best: "Best available",
    selected: "Selected city",
    averageScore: "Avg score",
    lowerRainDays: "Lower-rain days",
    expectedRain: "Expected rain · peak chance",
    temperature: "Temperature",
    dailyWeather: "Daily weather in selected range",
    peakRain: "peak rain",
    detail: "Open 7-day city outlook",
    compare: "Compare without leaving the map",
    allCities: (country: string) => `All ${country} travel cities`,
    sorted: "Sorted by lighter-rain days, expected amount, then score",
    score: "Score",
    mapRiskLegend: "Map risk legend",
    answerEyebrow: "Weather answer",
    answerHeading: "Best weather option for these dates",
    methodology: "How to use this comparison",
    rankingQuestion: "How are cities ranked?",
    rankingAnswer:
      "We prioritize lower-rain days, then expected rainfall, peak rain probability and Travel Score. The score is a comparison aid, not a weather guarantee.",
    probabilityQuestion: "Does a high rain chance mean rain all day?",
    probabilityAnswer:
      "No. Probability describes the chance of measurable rain, not how long it lasts. Compare expected millimetres and the daily breakdown before deciding.",
    sourceQuestion: "Where does the forecast come from?",
    sourceAnswer:
      "Forecasts are converted into the same city-by-city decision measures using data from",
    cityForecast: "7-day forecast",
  },
  "zh-cn": {
    country: "国家",
    chooseCountry: "选择国家",
    travelDates: "旅行日期",
    exactDates: "或选择准确日期",
    firstDate: "旅行开始日期",
    lastDate: "旅行结束日期",
    unavailable: "暂无可用日期",
    customTrip: "自选行程",
    atGlance: "天气概览",
    mapHeading: "地图上比较全部旅游城市",
    lowerRain: "少雨",
    mixed: "天气不定",
    rainLikely: "降雨偏多",
    best: "当前最佳",
    selected: "已选城市",
    averageScore: "平均评分",
    lowerRainDays: "少雨天数",
    expectedRain: "预计降雨量 · 最高概率",
    temperature: "气温",
    dailyWeather: "所选日期的逐日天气",
    peakRain: "最高降雨概率",
    detail: "查看7天天气",
    compare: "不用打开详情页，直接比较",
    allCities: (country: string) => `${country}全部旅游城市`,
    sorted: "按少雨天数、预计降雨量和评分排序",
    score: "评分",
    mapRiskLegend: "地图天气风险图例",
    answerEyebrow: "天气结论",
    answerHeading: "这段日期的优先目的地",
    methodology: "如何理解这份比较",
    rankingQuestion: "城市是如何排序的？",
    rankingAnswer:
      "先比较少雨天数，再比较预计降雨量、最高降雨概率和旅行评分。评分用于横向决策，不是天气保证。",
    probabilityQuestion: "高降雨概率等于会下一整天吗？",
    probabilityAnswer:
      "不等于。降雨概率表示出现可测降雨的可能性，不代表持续时间；决策时应同时查看预计毫米数和逐日天气。",
    sourceQuestion: "天气数据来自哪里？",
    sourceAnswer: "预报数据统一换算成便于比较各城市的旅行天气指标，来源：",
    cityForecast: "7天天气",
  },
} as const;

const CONDITION_ZH: Readonly<Record<string, string>> = {
  Clear: "晴",
  "Mainly clear": "大致晴朗",
  "Partly cloudy": "多云间晴",
  Overcast: "阴",
  Fog: "雾",
  "Rime fog": "雾凇",
  "Light drizzle": "小毛毛雨",
  Drizzle: "毛毛雨",
  "Dense drizzle": "密集毛毛雨",
  "Light freezing drizzle": "轻微冻毛毛雨",
  "Dense freezing drizzle": "密集冻毛毛雨",
  "Light rain": "小雨",
  Rain: "雨",
  "Heavy rain": "大雨",
  "Light freezing rain": "轻微冻雨",
  "Heavy freezing rain": "强冻雨",
  "Light snow": "小雪",
  Snow: "雪",
  "Heavy snow": "大雪",
  "Snow grains": "米雪",
  "Rain showers": "阵雨",
  "Moderate rain showers": "中等阵雨",
  "Violent rain showers": "强阵雨",
  "Light snow showers": "小阵雪",
  "Heavy snow showers": "强阵雪",
  Thunderstorm: "雷暴",
  "Thunderstorm with hail": "雷暴伴冰雹",
};

const WINDOWS: ReadonlyArray<Window> = ["today", "tomorrow", "weekend", "next_week"];

type Risk = "good" | "mixed" | "wet" | "unknown";

interface CitySummary {
  readonly city: CountryWeatherCityViewModel;
  readonly days: ReadonlyArray<CountryWeatherDayViewModel>;
  readonly dryDays: number;
  readonly maxRain: number | null;
  readonly totalRainMm: number | null;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
  readonly score: number | null;
  readonly risk: Risk;
}

/** Pixel nudges keep dense tourism corridors legible without hiding a destination. */
const MARKER_OFFSETS: Readonly<Record<string, [number, number]>> = {
  osaka: [42, 62],
  kyoto: [-30, -82],
  kanazawa: [58, -62],
  hiroshima: [-84, -34],
  fukuoka: [-72, 38],
  tokyo: [82, 16],
  gyeongju: [34, -20],
  busan: [-34, 18],
  krabi: [-32, 18],
  phuket: [34, -18],
  "da-nang": [34, -18],
  "da-lat": [50, -34],
  "ho-chi-minh": [58, 42],
  "phu-quoc": [-52, 16],
  bali: [-38, 16],
  lombok: [38, -16],
};

export interface CountryWeatherExplorerProps {
  readonly country: CountryHeaderViewModel;
  readonly countries: ReadonlyArray<CountryOptionViewModel>;
  readonly cities: ReadonlyArray<CountryWeatherCityViewModel>;
  readonly updatedLabel: string;
  readonly locale?: ExplorerLocale;
}

function daysForWindow(
  city: CountryWeatherCityViewModel,
  indices: ReadonlyArray<number>,
): ReadonlyArray<CountryWeatherDayViewModel> {
  return indices
    .map((index) => city.days[index])
    .filter((day): day is CountryWeatherDayViewModel => day !== undefined);
}

function referenceDays(
  cities: ReadonlyArray<CountryWeatherCityViewModel>,
  indices: ReadonlyArray<number>,
): ReadonlyArray<CountryWeatherDayViewModel> {
  const city = cities[0];
  return city === undefined ? [] : daysForWindow(city, indices);
}

function numericValues(values: ReadonlyArray<number | null>): number[] {
  return values.filter((value): value is number => value !== null);
}

function summarize(city: CountryWeatherCityViewModel, indices: ReadonlyArray<number>): CitySummary {
  const days = daysForWindow(city, indices);
  const rainValues = numericValues(days.map((day) => day.weather.rainProbability));
  const rainAmounts = numericValues(days.map((day) => day.weather.precipitationMm ?? null));
  const minimums = numericValues(days.map((day) => day.weather.temperatureMin));
  const maximums = numericValues(days.map((day) => day.weather.temperatureMax));
  const scores = numericValues(days.map((day) => day.score.value));
  const dryDays = days.filter((day) => {
    const chance = day.weather.rainProbability;
    const amount = day.weather.precipitationMm;
    return amount !== undefined && amount !== null
      ? amount <= 2.5 || ((chance ?? 100) <= 45 && amount < 5)
      : chance !== null && chance <= 45;
  }).length;
  const maxRain = rainValues.length > 0 ? Math.max(...rainValues) : null;
  const totalRainMm =
    rainAmounts.length > 0
      ? Math.round(rainAmounts.reduce((total, value) => total + value, 0) * 10) / 10
      : null;
  const temperatureMin = minimums.length > 0 ? Math.min(...minimums) : null;
  const temperatureMax = maximums.length > 0 ? Math.max(...maximums) : null;
  const score =
    scores.length > 0
      ? Math.round(scores.reduce((total, value) => total + value, 0) / scores.length)
      : null;
  const risk: Risk =
    totalRainMm === null && maxRain === null
      ? "unknown"
      : dryDays === days.length && (totalRainMm ?? 0) <= days.length * 2.5
        ? "good"
        : dryDays >= Math.ceil(days.length / 2) || (totalRainMm ?? Infinity) <= days.length * 8
          ? "mixed"
          : "wet";
  return {
    city,
    days,
    dryDays,
    maxRain,
    totalRainMm,
    temperatureMin,
    temperatureMax,
    score,
    risk,
  };
}

function shortDate(value: string, locale: ExplorerLocale): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh-cn" ? "zh-CN" : "en", {
    month: locale === "zh-cn" ? "numeric" : "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function rangeLabel(
  days: ReadonlyArray<CountryWeatherDayViewModel>,
  locale: ExplorerLocale,
): string {
  if (days.length === 0) return COPY[locale].unavailable;
  if (days.length === 1) return shortDate(days[0]?.localDate ?? "", locale);
  return `${shortDate(days[0]?.localDate ?? "", locale)}–${shortDate(days[days.length - 1]?.localDate ?? "", locale)}`;
}

function rainLabel(summary: CitySummary, locale: ExplorerLocale): string {
  if (summary.totalRainMm === null && summary.maxRain === null)
    return locale === "zh-cn" ? "暂无降雨数据" : "Rain data unavailable";
  if (summary.totalRainMm === null) {
    if (locale === "zh-cn") {
      return summary.days.length === 1
        ? `最高降雨概率 ${summary.maxRain}%`
        : `${summary.dryDays}/${summary.days.length}天少雨 · 最高${summary.maxRain}%`;
    }
    return summary.days.length === 1
      ? `${summary.maxRain}% peak rain chance`
      : `${summary.dryDays}/${summary.days.length} lower-rain days · max ${summary.maxRain}%`;
  }
  if (locale === "zh-cn") {
    return summary.days.length === 1
      ? `预计 ${summary.totalRainMm} mm · 最高${summary.maxRain ?? "—"}%`
      : `${summary.dryDays}/${summary.days.length}天少雨 · 共${summary.totalRainMm ?? "—"} mm`;
  }
  if (summary.days.length === 1) {
    return `${summary.totalRainMm} mm expected · ${summary.maxRain ?? "—"}% peak chance`;
  }
  return `${summary.dryDays}/${summary.days.length} lighter-rain days · ${summary.totalRainMm ?? "—"} mm total`;
}

function mapMarkerLabel(summary: CitySummary, locale: ExplorerLocale): string {
  if (summary.days.length === 1) {
    return summary.totalRainMm === null
      ? `${summary.maxRain ?? "—"}%${locale === "zh-cn" ? "最高" : " peak"}`
      : `${summary.totalRainMm} mm · ${summary.maxRain ?? "—"}%${locale === "zh-cn" ? "最高" : " peak"}`;
  }
  return `${summary.dryDays}/${summary.days.length}${locale === "zh-cn" ? "少雨" : " light"} · ${summary.totalRainMm ?? "—"} mm`;
}

function conditionLabel(value: string, locale: ExplorerLocale): string {
  return locale === "zh-cn" ? (CONDITION_ZH[value] ?? value) : value;
}

function WeatherIcon({ condition }: { condition: string }): ReactElement {
  const rainy = /rain|storm|shower/i.test(condition);
  const cloudy = /cloud|overcast|fog/i.test(condition);
  return (
    <span className="country-day-icon" aria-hidden="true">
      <svg viewBox="0 0 28 28" fill="none">
        {rainy || cloudy ? (
          <>
            <path
              d="M6.5 18.5h14a4.2 4.2 0 0 0 .1-8.4A6.6 6.6 0 0 0 8.2 12.3a3.2 3.2 0 0 0-1.7 6.2Z"
              fill="currentColor"
              opacity=".85"
            />
            {rainy ? (
              <path
                d="m9 21.5-1 1.8m6-1.8-1 1.8m6-1.8-1 1.8"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            ) : null}
          </>
        ) : (
          <>
            <circle cx="14" cy="14" r="4.5" fill="currentColor" />
            <path
              d="M14 3v3m0 16v3M3 14h3m16 0h3M6.2 6.2l2.1 2.1m11.4 11.4 2.1 2.1m0-15.6-2.1 2.1M8.3 19.7l-2.1 2.1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </span>
  );
}

export function CountryWeatherExplorer({
  country,
  countries,
  cities,
  updatedLabel,
  locale = "en",
}: CountryWeatherExplorerProps): ReactElement {
  const copy = COPY[locale];
  const [activeWindow, setActiveWindow] = useState<Window>("today");
  const [customRange, setCustomRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedCityId, setSelectedCityId] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapModuleRef = useRef<typeof MapLibreModule | null>(null);
  const markerRefs = useRef<MapLibreMarker[]>([]);

  const selectedIndices = useMemo(() => {
    if (customRange === null) {
      return windowIndicesForDates(
        (cities[0]?.days ?? []).map((day) => day.localDate),
        activeWindow,
      );
    }
    return Array.from(
      { length: customRange.end - customRange.start + 1 },
      (_, index) => customRange.start + index,
    );
  }, [activeWindow, cities, customRange]);
  const summaries = useMemo(
    () =>
      selectedIndices.length === 0
        ? []
        : cities
            .map((city) => summarize(city, selectedIndices))
            .sort((left, right) => {
              if (right.dryDays !== left.dryDays) return right.dryDays - left.dryDays;
              if ((left.totalRainMm ?? Infinity) !== (right.totalRainMm ?? Infinity))
                return (left.totalRainMm ?? Infinity) - (right.totalRainMm ?? Infinity);
              if ((left.maxRain ?? 101) !== (right.maxRain ?? 101))
                return (left.maxRain ?? 101) - (right.maxRain ?? 101);
              return (right.score ?? -1) - (left.score ?? -1);
            }),
    [cities, selectedIndices],
  );
  const selected =
    summaries.find((summary) => summary.city.cityId === selectedCityId) ?? summaries[0] ?? null;
  const best = summaries[0] ?? null;
  const exactDates = rangeLabel(referenceDays(cities, selectedIndices), locale);
  const rangeName = customRange === null ? WINDOW_LABELS[locale][activeWindow] : copy.customTrip;
  const answer =
    best === null
      ? copy.unavailable
      : locale === "zh-cn"
        ? `${rangeName}（${exactDates}），${best.city.cityName}在${summaries.length}个城市中排名第一：${rainLabel(best, locale)}，平均旅行评分${best.score ?? "—"}。`
        : `For ${rangeName.toLowerCase()} (${exactDates}), ${best.city.cityName} ranks first among ${summaries.length} cities with ${rainLabel(best, locale)} and an average Travel Score of ${best.score ?? "—"}.`;

  useEffect(() => {
    const restoreUrlState = (): void => {
      const params = new URLSearchParams(window.location.search);
      const from = Number(params.get("from"));
      const to = Number(params.get("to"));
      const finalIndex = Math.max(0, (cities[0]?.days.length ?? 1) - 1);
      if (
        params.has("from") &&
        params.has("to") &&
        Number.isInteger(from) &&
        Number.isInteger(to) &&
        from >= 0 &&
        to >= from &&
        to <= finalIndex
      ) {
        setCustomRange({ start: from, end: to });
        return;
      }
      const requested = params.get("window") as Window | null;
      if (requested !== null && WINDOWS.includes(requested)) {
        setActiveWindow(requested);
        setCustomRange(null);
      }
    };
    restoreUrlState();
    const onPopState = (): void => restoreUrlState();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [cities]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (container === null || cities.length === 0) return;
    let cancelled = false;
    void import("maplibre-gl").then((module) => {
      if (cancelled || mapContainerRef.current === null) return;
      mapModuleRef.current = module;
      const longitude = cities.reduce((sum, city) => sum + city.longitude, 0) / cities.length;
      const latitude = cities.reduce((sum, city) => sum + city.latitude, 0) / cities.length;
      const map = new module.Map({
        container: mapContainerRef.current,
        style: MAPLIBRE_STYLE_URL,
        center: [longitude, latitude],
        zoom: 4,
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
      mapRef.current = map;
      map.addControl(new module.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        const bounds = new module.LngLatBounds();
        cities.forEach((city) => bounds.extend([city.longitude, city.latitude]));
        map.fitBounds(bounds, { padding: 90, maxZoom: 6, duration: 0 });
        setMapReady(true);
      });
    });
    return () => {
      cancelled = true;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      mapModuleRef.current = null;
    };
  }, [cities]);

  useEffect(() => {
    const map = mapRef.current;
    const module = mapModuleRef.current;
    if (!mapReady || map === null || module === null) return;
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = summaries.map((summary) => {
      const shell = document.createElement("div");
      shell.className = `country-weather-marker risk-${summary.risk}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "country-weather-marker-button";
      button.setAttribute(
        "aria-label",
        locale === "zh-cn"
          ? `${summary.city.cityName}：${rainLabel(summary, locale)}。选择城市。`
          : `${summary.city.cityName}: ${rainLabel(summary, locale)}. Select city.`,
      );
      if (summary.city.cityId === selected?.city.cityId) button.dataset.selected = "true";
      const name = document.createElement("strong");
      name.textContent = summary.city.cityName;
      const detail = document.createElement("span");
      detail.textContent = mapMarkerLabel(summary, locale);
      button.append(name, detail);
      button.addEventListener("click", () => setSelectedCityId(summary.city.cityId));
      shell.append(button);
      const offset = MARKER_OFFSETS[summary.city.cityId] ?? [0, 0];
      const leaderLength = Math.hypot(offset[0], offset[1]);
      shell.style.setProperty("--marker-leader-length", `${leaderLength}px`);
      shell.style.setProperty("--marker-leader-angle", `${Math.atan2(-offset[1], -offset[0])}rad`);
      return new module.Marker({
        element: shell,
        anchor: "bottom",
        offset,
      })
        .setLngLat([summary.city.longitude, summary.city.latitude])
        .addTo(map);
    });
  }, [locale, mapReady, selected?.city.cityId, summaries]);

  function selectWindow(windowKind: Window): void {
    setActiveWindow(windowKind);
    setCustomRange(null);
    setSelectedCityId("");
    const url = new URL(window.location.href);
    url.searchParams.set("window", windowKind);
    window.history.pushState({}, "", url);
  }

  function selectCustomRange(start: number, end: number): void {
    const next = { start: Math.min(start, end), end: Math.max(start, end) };
    setCustomRange(next);
    setSelectedCityId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("window");
    url.searchParams.set("from", String(next.start));
    url.searchParams.set("to", String(next.end));
    window.history.pushState({}, "", url);
  }

  function cityDetailHref(path: string): string {
    const selectedDays = referenceDays(cities, selectedIndices);
    const start = selectedDays[0]?.localDate;
    if (start === undefined) return path;
    const end = selectedDays.at(-1)?.localDate ?? start;
    const params = new URLSearchParams({ start, end });
    if (customRange === null) params.set("window", activeWindow);
    return `${path}?${params.toString()}`;
  }

  return (
    <section
      className="country-weather-console"
      aria-label={
        locale === "zh-cn" ? `${country.name}旅行天气地图` : `${country.name} travel weather map`
      }
    >
      <div className="country-console-toolbar">
        <label className="country-select-label">
          <span>{copy.country}</span>
          <select
            value={`/${country.slug}`}
            onChange={(event) => window.location.assign(event.target.value)}
            className="country-select focus-ring"
            aria-label={copy.chooseCountry}
          >
            {countries.map((option) => (
              <option key={option.slug} value={option.path}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 flex-1">
          <p className="country-control-label">{copy.travelDates}</p>
          <div className="country-window-tabs" role="group" aria-label={copy.travelDates}>
            {WINDOWS.map((windowKind) => {
              const dates = rangeLabel(
                referenceDays(
                  cities,
                  windowIndicesForDates(
                    (cities[0]?.days ?? []).map((day) => day.localDate),
                    windowKind,
                  ),
                ),
                locale,
              );
              return (
                <button
                  key={windowKind}
                  type="button"
                  onClick={() => selectWindow(windowKind)}
                  aria-pressed={customRange === null && activeWindow === windowKind}
                  className={`country-window-button focus-ring ${customRange === null && activeWindow === windowKind ? "is-active" : ""}`}
                >
                  <span>{WINDOW_LABELS[locale][windowKind]}</span>
                  <small>{dates}</small>
                </button>
              );
            })}
          </div>
          <div className="country-custom-range" aria-label={copy.exactDates}>
            <span>{copy.exactDates}</span>
            <label>
              <span className="sr-only">{copy.firstDate}</span>
              <select
                aria-label={copy.firstDate}
                value={customRange?.start ?? selectedIndices[0] ?? 0}
                onChange={(event) =>
                  selectCustomRange(
                    Number(event.target.value),
                    customRange?.end ?? Number(event.target.value),
                  )
                }
              >
                {(cities[0]?.days ?? []).map((day, index) => (
                  <option key={day.localDate} value={index}>
                    {shortDate(day.localDate, locale)}
                  </option>
                ))}
              </select>
            </label>
            <span aria-hidden="true">→</span>
            <label>
              <span className="sr-only">{copy.lastDate}</span>
              <select
                aria-label={copy.lastDate}
                value={customRange?.end ?? selectedIndices[selectedIndices.length - 1] ?? 0}
                onChange={(event) =>
                  selectCustomRange(
                    customRange?.start ?? Number(event.target.value),
                    Number(event.target.value),
                  )
                }
              >
                {(cities[0]?.days ?? []).map((day, index) => (
                  <option key={day.localDate} value={index}>
                    {shortDate(day.localDate, locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <p className="country-data-age">{updatedLabel}</p>
      </div>

      <section className="country-answer-brief" aria-live="polite">
        <div>
          <p className="country-answer-eyebrow">{copy.answerEyebrow}</p>
          <h2>{copy.answerHeading}</h2>
        </div>
        <p>{answer}</p>
      </section>

      <div className="country-map-layout">
        <div className="country-map-stage">
          <div className="country-map-heading">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                {country.name} {copy.atGlance}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-foreground sm:text-2xl">
                {copy.mapHeading}
              </h2>
            </div>
            <p className="text-xs font-semibold text-muted">
              {rangeName} · {exactDates}
            </p>
          </div>
          <div
            ref={mapContainerRef}
            className="country-weather-map"
            role="region"
            aria-label={
              locale === "zh-cn"
                ? `${country.name}${rangeName}城市天气地图`
                : `${country.name} city weather map for ${rangeName}`
            }
            data-testid="country-weather-map"
          />
          <div className="country-map-legend" aria-label={copy.mapRiskLegend}>
            <span>
              <i className="legend-good" /> {copy.lowerRain}
            </span>
            <span>
              <i className="legend-mixed" /> {copy.mixed}
            </span>
            <span>
              <i className="legend-wet" /> {copy.rainLikely}
            </span>
          </div>
        </div>

        {selected !== null ? (
          <aside
            className="country-city-inspector"
            aria-label={
              locale === "zh-cn"
                ? `${selected.city.cityName}天气摘要`
                : `${selected.city.cityName} weather summary`
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">
                  {summaries[0]?.city.cityId === selected.city.cityId ? copy.best : copy.selected}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-white">
                  {selected.city.cityName}
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  {rangeName} · {rangeLabel(selected.days, locale)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{selected.score ?? "—"}</p>
                <p className="text-[9px] uppercase tracking-[0.12em] text-white/45">
                  {copy.averageScore}
                </p>
              </div>
            </div>
            <div className="country-inspector-summary">
              <div>
                <span>{copy.lowerRainDays}</span>
                <strong>
                  {selected.dryDays}/{selected.days.length}
                </strong>
              </div>
              <div>
                <span>{copy.expectedRain}</span>
                <strong>
                  {selected.totalRainMm ?? "—"} mm · {selected.maxRain ?? "—"}%
                </strong>
              </div>
              <div>
                <span>{copy.temperature}</span>
                <strong>
                  {selected.temperatureMin ?? "–"}–{selected.temperatureMax ?? "–"}°C
                </strong>
              </div>
            </div>
            <ol className="country-daily-strip" aria-label={copy.dailyWeather}>
              {selected.days.map((day) => (
                <li key={day.localDate}>
                  <div className="flex items-center gap-3">
                    <WeatherIcon condition={day.weather.conditionLabel} />
                    <div>
                      <time dateTime={day.localDate} className="text-xs font-bold text-white">
                        {shortDate(day.localDate, locale)}
                      </time>
                      <p className="mt-0.5 text-[11px] text-white/55">
                        {conditionLabel(day.weather.conditionLabel, locale)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">
                      {day.weather.rainProbability ?? "—"}% {copy.peakRain}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/50">
                      {day.weather.temperatureMin ?? "–"}–{day.weather.temperatureMax ?? "–"}°
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <DiscoveryTripAction
              locale={locale}
              cityId={selected.city.cityId}
              cityName={selected.city.cityName}
              countryName={selected.city.countryName}
              dates={selected.days.map((day) => day.localDate)}
              workspacePath={locale === "zh-cn" ? "/zh-cn/trips/workspace" : "/trips/workspace"}
              variant="inspector"
            />
            <a href={cityDetailHref(selected.city.path)} className="country-detail-link focus-ring">
              {copy.detail} <span aria-hidden="true">→</span>
            </a>
          </aside>
        ) : null}
      </div>

      <div className="country-city-list-section">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{copy.compare}</p>
            <h2 className="section-title mt-3">{copy.allCities(country.name)}</h2>
          </div>
          <p className="text-xs text-muted">{copy.sorted}</p>
        </div>
        <ul className="country-city-grid">
          {summaries.map((summary, index) => (
            <li
              key={summary.city.cityId}
              className={`country-city-choice risk-${summary.risk}`}
              data-selected={selected?.city.cityId === summary.city.cityId}
            >
              <button
                type="button"
                onClick={() => setSelectedCityId(summary.city.cityId)}
                aria-pressed={selected?.city.cityId === summary.city.cityId}
                className="country-city-select focus-ring"
              >
                <span className="country-city-rank">#{index + 1}</span>
                <span className="min-w-0 flex-1 text-left">
                  <strong className="block truncate text-base text-foreground">
                    {summary.city.cityName}
                  </strong>
                  <span className="mt-1 block text-xs text-muted">
                    {rainLabel(summary, locale)}
                  </span>
                </span>
                <span className="text-right">
                  <strong className="block text-lg text-foreground">{summary.score ?? "—"}</strong>
                  <span className="text-[9px] uppercase tracking-[0.1em] text-muted">
                    {copy.score}
                  </span>
                </span>
              </button>
              <DiscoveryTripAction
                locale={locale}
                cityId={summary.city.cityId}
                cityName={summary.city.cityName}
                countryName={summary.city.countryName}
                dates={summary.days.map((day) => day.localDate)}
                workspacePath={locale === "zh-cn" ? "/zh-cn/trips/workspace" : "/trips/workspace"}
              />
              <a
                href={cityDetailHref(summary.city.path)}
                className="country-city-forecast-link focus-ring"
                aria-label={`${summary.city.cityName} ${copy.cityForecast}`}
              >
                {copy.cityForecast} <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <section className="country-evidence-panel" aria-labelledby="comparison-methodology">
        <div className="country-evidence-heading">
          <p className="eyebrow">{copy.methodology}</p>
          <p>{updatedLabel}</p>
        </div>
        <div className="country-evidence-grid">
          <article>
            <h2 id="comparison-methodology">{copy.rankingQuestion}</h2>
            <p>{copy.rankingAnswer}</p>
          </article>
          <article>
            <h2>{copy.probabilityQuestion}</h2>
            <p>{copy.probabilityAnswer}</p>
          </article>
          <article>
            <h2>{copy.sourceQuestion}</h2>
            <p>
              {copy.sourceAnswer} <a href="https://open-meteo.com/">Open-Meteo</a>
            </p>
          </article>
        </div>
      </section>
    </section>
  );
}
