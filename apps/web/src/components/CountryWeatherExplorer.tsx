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
import { MAPLIBRE_STYLE_URL } from "./ExplorerMap";

import "maplibre-gl/dist/maplibre-gl.css";

const WINDOW_INDICES: Readonly<Record<Window, ReadonlyArray<number>>> = {
  today: [0],
  tomorrow: [1],
  weekend: [5, 6],
  next_week: [2, 3, 4],
};

const WINDOW_LABELS: Readonly<Record<Window, string>> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  next_week: "Next week",
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
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    date,
  );
}

function rangeLabel(days: ReadonlyArray<CountryWeatherDayViewModel>): string {
  if (days.length === 0) return "Dates unavailable";
  if (days.length === 1) return shortDate(days[0]?.localDate ?? "");
  return `${shortDate(days[0]?.localDate ?? "")}–${shortDate(days[days.length - 1]?.localDate ?? "")}`;
}

function rainLabel(summary: CitySummary): string {
  if (summary.totalRainMm === null && summary.maxRain === null) return "Rain data unavailable";
  if (summary.totalRainMm === null) {
    return summary.days.length === 1
      ? `${summary.maxRain}% peak rain chance`
      : `${summary.dryDays}/${summary.days.length} lower-rain days · max ${summary.maxRain}%`;
  }
  if (summary.days.length === 1) {
    return `${summary.totalRainMm} mm expected · ${summary.maxRain ?? "—"}% peak chance`;
  }
  return `${summary.dryDays}/${summary.days.length} lighter-rain days · ${summary.totalRainMm ?? "—"} mm total`;
}

function mapMarkerLabel(summary: CitySummary): string {
  if (summary.days.length === 1) {
    return summary.totalRainMm === null
      ? `${summary.maxRain ?? "—"}% peak`
      : `${summary.totalRainMm} mm · ${summary.maxRain ?? "—"}% peak`;
  }
  return `${summary.dryDays}/${summary.days.length} light · ${summary.totalRainMm ?? "—"} mm`;
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
}: CountryWeatherExplorerProps): ReactElement {
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
  const exactDates = rangeLabel(referenceDays(cities, selectedIndices));
  const rangeName = customRange === null ? WINDOW_LABELS[activeWindow] : "Custom trip";

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
        `${summary.city.cityName}: ${rainLabel(summary)}. Select city.`,
      );
      if (summary.city.cityId === selected?.city.cityId) button.dataset.selected = "true";
      const name = document.createElement("strong");
      name.textContent = summary.city.cityName;
      const detail = document.createElement("span");
      detail.textContent = mapMarkerLabel(summary);
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
  }, [mapReady, selected?.city.cityId, summaries]);

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

  return (
    <section className="country-weather-console" aria-label={`${country.name} travel weather map`}>
      <div className="country-console-toolbar">
        <label className="country-select-label">
          <span>Country</span>
          <select
            value={`/${country.slug}`}
            onChange={(event) => window.location.assign(event.target.value)}
            className="country-select focus-ring"
            aria-label="Choose country"
          >
            {countries.map((option) => (
              <option key={option.slug} value={option.path}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 flex-1">
          <p className="country-control-label">Travel dates</p>
          <div className="country-window-tabs" role="group" aria-label="Travel dates">
            {WINDOWS.map((windowKind) => {
              const dates = rangeLabel(referenceDays(cities, WINDOW_INDICES[windowKind]));
              return (
                <button
                  key={windowKind}
                  type="button"
                  onClick={() => selectWindow(windowKind)}
                  aria-pressed={customRange === null && activeWindow === windowKind}
                  className={`country-window-button focus-ring ${customRange === null && activeWindow === windowKind ? "is-active" : ""}`}
                >
                  <span>{WINDOW_LABELS[windowKind]}</span>
                  <small>{dates}</small>
                </button>
              );
            })}
          </div>
          <div className="country-custom-range" aria-label="Choose an exact travel date range">
            <span>Or choose exact dates</span>
            <label>
              <span className="sr-only">First travel date</span>
              <select
                aria-label="First travel date"
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
              <span className="sr-only">Last travel date</span>
              <select
                aria-label="Last travel date"
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

      <div className="country-map-layout">
        <div className="country-map-stage">
          <div className="country-map-heading">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                {country.name} at a glance
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-foreground sm:text-2xl">
                Weather across every listed travel city
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
            aria-label={`${country.name} city weather map for ${rangeName}`}
            data-testid="country-weather-map"
          />
          <div className="country-map-legend" aria-label="Map risk legend">
            <span>
              <i className="legend-good" /> Lower rain
            </span>
            <span>
              <i className="legend-mixed" /> Mixed
            </span>
            <span>
              <i className="legend-wet" /> Rain likely
            </span>
          </div>
        </div>

        {selected !== null ? (
          <aside
            className="country-city-inspector"
            aria-label={`${selected.city.cityName} weather summary`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">
                  {summaries[0]?.city.cityId === selected.city.cityId
                    ? "Best available"
                    : "Selected city"}
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
                <p className="text-[9px] uppercase tracking-[0.12em] text-white/45">Avg score</p>
              </div>
            </div>
            <div className="country-inspector-summary">
              <div>
                <span>Lower-rain days</span>
                <strong>
                  {selected.dryDays}/{selected.days.length}
                </strong>
              </div>
              <div>
                <span>Expected rain · peak chance</span>
                <strong>
                  {selected.totalRainMm ?? "—"} mm · {selected.maxRain ?? "—"}%
                </strong>
              </div>
              <div>
                <span>Temperature</span>
                <strong>
                  {selected.temperatureMin ?? "–"}–{selected.temperatureMax ?? "–"}°C
                </strong>
              </div>
            </div>
            <ol className="country-daily-strip" aria-label="Daily weather in selected range">
              {selected.days.map((day) => (
                <li key={day.localDate}>
                  <div className="flex items-center gap-3">
                    <WeatherIcon condition={day.weather.conditionLabel} />
                    <div>
                      <time dateTime={day.localDate} className="text-xs font-bold text-white">
                        {shortDate(day.localDate)}
                      </time>
                      <p className="mt-0.5 text-[11px] text-white/55">
                        {day.weather.conditionLabel}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">
                      {day.weather.rainProbability ?? "—"}% peak rain
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/50">
                      {day.weather.temperatureMin ?? "–"}–{day.weather.temperatureMax ?? "–"}°
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <a href={selected.city.path} className="country-detail-link focus-ring">
              Open 7-day city outlook <span aria-hidden="true">→</span>
            </a>
          </aside>
        ) : null}
      </div>

      <div className="country-city-list-section">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Compare without leaving the map</p>
            <h2 className="section-title mt-3">All {country.name} travel cities</h2>
          </div>
          <p className="text-xs text-muted">
            Sorted by lighter-rain days, expected amount, then score
          </p>
        </div>
        <ul className="country-city-grid">
          {summaries.map((summary, index) => (
            <li key={summary.city.cityId}>
              <button
                type="button"
                onClick={() => setSelectedCityId(summary.city.cityId)}
                aria-pressed={selected?.city.cityId === summary.city.cityId}
                className={`country-city-choice focus-ring risk-${summary.risk}`}
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
                  <span className="text-[9px] uppercase tracking-[0.1em] text-muted">Score</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
