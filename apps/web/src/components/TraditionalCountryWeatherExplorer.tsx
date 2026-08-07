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
import { toTraditionalText } from "../trips/traditional";
import { MAPLIBRE_STYLE_URL } from "./ExplorerMap";

import "maplibre-gl/dist/maplibre-gl.css";

const WINDOW_INDICES: Readonly<Record<Window, ReadonlyArray<number>>> = {
  today: [0],
  tomorrow: [1],
  weekend: [5, 6],
  next_week: [2, 3, 4],
};

const WINDOW_LABELS: Readonly<Record<Window, string>> = {
  today: "今天",
  tomorrow: "明天",
  weekend: "本週末",
  next_week: "下週",
};

const WINDOWS: ReadonlyArray<Window> = ["today", "tomorrow", "weekend", "next_week"];

const CONDITION_ZH: Readonly<Record<string, string>> = {
  Clear: "晴",
  "Mainly clear": "大致晴朗",
  "Partly cloudy": "多雲間晴",
  Overcast: "陰",
  Fog: "霧",
  "Rime fog": "霧凇",
  "Light drizzle": "小毛毛雨",
  Drizzle: "毛毛雨",
  "Dense drizzle": "密集毛毛雨",
  "Light freezing drizzle": "輕微凍毛毛雨",
  "Dense freezing drizzle": "密集凍毛毛雨",
  "Light rain": "小雨",
  Rain: "雨",
  "Heavy rain": "大雨",
  "Light freezing rain": "輕微凍雨",
  "Heavy freezing rain": "強凍雨",
  "Light snow": "小雪",
  Snow: "雪",
  "Heavy snow": "大雪",
  "Snow grains": "米雪",
  "Rain showers": "陣雨",
  "Moderate rain showers": "中等陣雨",
  "Violent rain showers": "強陣雨",
  "Light snow showers": "小陣雪",
  "Heavy snow showers": "強陣雪",
  Thunderstorm: "雷暴",
  "Thunderstorm with hail": "雷暴伴冰雹",
};

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

export interface TraditionalCountryWeatherExplorerProps {
  readonly country: CountryHeaderViewModel;
  readonly countries: ReadonlyArray<CountryOptionViewModel>;
  readonly cities: ReadonlyArray<CountryWeatherCityViewModel>;
  readonly updatedLabel: string;
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

function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function rangeLabel(days: ReadonlyArray<CountryWeatherDayViewModel>): string {
  if (days.length === 0) return "暫無可用日期";
  if (days.length === 1) return shortDate(days[0]?.localDate ?? "");
  return `${shortDate(days[0]?.localDate ?? "")}–${shortDate(days[days.length - 1]?.localDate ?? "")}`;
}

function rainLabel(summary: CitySummary): string {
  if (summary.totalRainMm === null && summary.maxRain === null) return "暫無降雨資料";
  if (summary.totalRainMm === null) {
    return summary.days.length === 1
      ? `最高降雨機率 ${summary.maxRain}%`
      : `${summary.dryDays}/${summary.days.length}天少雨 · 最高${summary.maxRain}%`;
  }
  return summary.days.length === 1
    ? `預計 ${summary.totalRainMm} mm · 最高${summary.maxRain ?? "—"}%`
    : `${summary.dryDays}/${summary.days.length}天少雨 · 共${summary.totalRainMm} mm`;
}

function markerLabel(summary: CitySummary): string {
  if (summary.days.length === 1) {
    return summary.totalRainMm === null
      ? `${summary.maxRain ?? "—"}%最高`
      : `${summary.totalRainMm} mm · ${summary.maxRain ?? "—"}%最高`;
  }
  return `${summary.dryDays}/${summary.days.length}少雨 · ${summary.totalRainMm ?? "—"} mm`;
}

function conditionLabel(value: string): string {
  return CONDITION_ZH[value] ?? toTraditionalText(value);
}

export function TraditionalCountryWeatherExplorer({
  country,
  countries,
  cities,
  updatedLabel,
}: TraditionalCountryWeatherExplorerProps): ReactElement {
  const [activeWindow, setActiveWindow] = useState<Window>("today");
  const [customRange, setCustomRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedCityId, setSelectedCityId] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapModuleRef = useRef<typeof MapLibreModule | null>(null);
  const markerRefs = useRef<MapLibreMarker[]>([]);

  const selectedIndices = useMemo(() => {
    if (customRange === null) return WINDOW_INDICES[activeWindow];
    return Array.from(
      { length: customRange.end - customRange.start + 1 },
      (_, index) => customRange.start + index,
    );
  }, [activeWindow, customRange]);

  const summaries = useMemo(
    () =>
      cities
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
  const exactDates = rangeLabel(referenceDays(cities, selectedIndices));
  const rangeName = customRange === null ? WINDOW_LABELS[activeWindow] : "自選行程";
  const answer =
    best === null
      ? "暫無可用日期"
      : `${rangeName}（${exactDates}），${best.city.cityName}在${summaries.length}個城市中排名第一：${rainLabel(best)}，平均旅行評分${best.score ?? "—"}。`;

  useEffect(() => {
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
    if (requested !== null && WINDOWS.includes(requested)) setActiveWindow(requested);
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
        `${summary.city.cityName}：${rainLabel(summary)}。選擇城市。`,
      );
      if (summary.city.cityId === selected?.city.cityId) button.dataset.selected = "true";
      const name = document.createElement("strong");
      name.textContent = summary.city.cityName;
      const detail = document.createElement("span");
      detail.textContent = markerLabel(summary);
      button.append(name, detail);
      button.addEventListener("click", () => setSelectedCityId(summary.city.cityId));
      shell.append(button);
      const offset = MARKER_OFFSETS[summary.city.cityId] ?? [0, 0];
      return new module.Marker({ element: shell, anchor: "bottom", offset })
        .setLngLat([summary.city.longitude, summary.city.latitude])
        .addTo(map);
    });
  }, [mapReady, selected?.city.cityId, summaries]);

  function selectWindow(windowKind: Window): void {
    setActiveWindow(windowKind);
    setCustomRange(null);
    setSelectedCityId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("from");
    url.searchParams.delete("to");
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

  return (
    <section className="country-weather-console" aria-label={`${country.name}旅行天氣地圖`}>
      <div className="country-console-toolbar">
        <label className="country-select-label">
          <span>國家</span>
          <select
            value={`/${country.slug}`}
            onChange={(event) => window.location.assign(event.target.value)}
            className="country-select focus-ring"
            aria-label="選擇國家"
          >
            {countries.map((option) => (
              <option key={option.slug} value={option.path}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 flex-1">
          <p className="country-control-label">旅行日期</p>
          <div className="country-window-tabs" role="group" aria-label="旅行日期">
            {WINDOWS.map((windowKind) => (
              <button
                key={windowKind}
                type="button"
                onClick={() => selectWindow(windowKind)}
                aria-pressed={customRange === null && activeWindow === windowKind}
                className={`country-window-button focus-ring ${customRange === null && activeWindow === windowKind ? "is-active" : ""}`}
              >
                <span>{WINDOW_LABELS[windowKind]}</span>
                <small>{rangeLabel(referenceDays(cities, WINDOW_INDICES[windowKind]))}</small>
              </button>
            ))}
          </div>
          <div className="country-custom-range" aria-label="或選擇準確日期">
            <span>或選擇準確日期</span>
            <label>
              <span className="sr-only">旅行開始日期</span>
              <select
                aria-label="旅行開始日期"
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
                    {shortDate(day.localDate)}
                  </option>
                ))}
              </select>
            </label>
            <span aria-hidden="true">→</span>
            <label>
              <span className="sr-only">旅行結束日期</span>
              <select
                aria-label="旅行結束日期"
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
                    {shortDate(day.localDate)}
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
          <p className="country-answer-eyebrow">天氣結論</p>
          <h2>這段日期的優先目的地</h2>
        </div>
        <p>{answer}</p>
      </section>

      <div className="country-map-layout">
        <div className="country-map-stage">
          <div className="country-map-heading">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                {country.name} 天氣概覽
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-foreground sm:text-2xl">
                地圖上比較全部旅遊城市
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
            aria-label={`${country.name}${rangeName}城市天氣地圖`}
            data-testid="country-weather-map"
          />
          <div className="country-map-legend" aria-label="地圖天氣風險圖例">
            <span>
              <i className="legend-good" /> 少雨
            </span>
            <span>
              <i className="legend-mixed" /> 天氣不定
            </span>
            <span>
              <i className="legend-wet" /> 降雨偏多
            </span>
          </div>
        </div>

        {selected !== null ? (
          <aside
            className="country-city-inspector"
            aria-label={`${selected.city.cityName}天氣摘要`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">
                  {summaries[0]?.city.cityId === selected.city.cityId ? "目前最佳" : "已選城市"}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-white">
                  {selected.city.cityName}
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  {rangeName} · {rangeLabel(selected.days)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{selected.score ?? "—"}</p>
                <p className="text-[9px] uppercase tracking-[0.12em] text-white/45">平均評分</p>
              </div>
            </div>
            <div className="country-inspector-summary">
              <div>
                <span>少雨天數</span>
                <strong>
                  {selected.dryDays}/{selected.days.length}
                </strong>
              </div>
              <div>
                <span>預計降雨量 · 最高機率</span>
                <strong>
                  {selected.totalRainMm ?? "—"} mm · {selected.maxRain ?? "—"}%
                </strong>
              </div>
              <div>
                <span>氣溫</span>
                <strong>
                  {selected.temperatureMin ?? "–"}–{selected.temperatureMax ?? "–"}°C
                </strong>
              </div>
            </div>
            <ol className="country-daily-strip" aria-label="所選日期的逐日天氣">
              {selected.days.map((day) => (
                <li key={day.localDate}>
                  <div>
                    <time dateTime={day.localDate} className="text-xs font-bold text-white">
                      {shortDate(day.localDate)}
                    </time>
                    <p className="mt-0.5 text-[11px] text-white/55">
                      {conditionLabel(day.weather.conditionLabel)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">
                      {day.weather.rainProbability ?? "—"}% 最高降雨機率
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/50">
                      {day.weather.temperatureMin ?? "–"}–{day.weather.temperatureMax ?? "–"}°
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <a href={selected.city.path} className="country-detail-link focus-ring">
              查看 7 天天氣 <span aria-hidden="true">→</span>
            </a>
          </aside>
        ) : null}
      </div>

      <div className="country-city-list-section">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">不用打開詳情頁，直接比較</p>
            <h2 className="section-title mt-3">{country.name}全部旅遊城市</h2>
          </div>
          <p className="text-xs text-muted">按少雨天數、預計降雨量和評分排序</p>
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
                  <span className="mt-1 block text-xs text-muted">{rainLabel(summary)}</span>
                </span>
                <span className="text-right">
                  <strong className="block text-lg text-foreground">{summary.score ?? "—"}</strong>
                  <span className="text-[9px] uppercase tracking-[0.1em] text-muted">評分</span>
                </span>
              </button>
              <a href={summary.city.path} className="country-city-forecast-link focus-ring">
                7 天天氣 <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <section
        className="country-evidence-panel"
        aria-labelledby="traditional-comparison-methodology"
      >
        <div className="country-evidence-heading">
          <p className="eyebrow">如何理解這份比較</p>
          <p>{updatedLabel}</p>
        </div>
        <div className="country-evidence-grid">
          <article>
            <h2 id="traditional-comparison-methodology">城市是如何排序的？</h2>
            <p>
              先比較少雨天數，再比較預計降雨量、最高降雨機率和旅行評分。評分用於橫向決策，不是天氣保證。
            </p>
          </article>
          <article>
            <h2>高降雨機率等於會下一整天嗎？</h2>
            <p>
              不等於。降雨機率表示出現可測降雨的可能性，不代表持續時間；決策時應同時查看預計毫米數和逐日天氣。
            </p>
          </article>
          <article>
            <h2>天氣資料來自哪裡？</h2>
            <p>
              預報資料統一換算成便於比較各城市的旅行天氣指標，來源：{" "}
              <a href="https://open-meteo.com/">Open-Meteo</a>
            </p>
          </article>
        </div>
      </section>
    </section>
  );
}
