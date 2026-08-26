"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";
import {
  availableHomeWeatherDates,
  resolveHomeWeatherDates,
  summarizeHomeCountryRain,
  type HomeCityWeatherSeries,
  type HomeWeatherPreset,
} from "../weather/home-rain-window";
import { worldWeatherStatus, type WorldWeatherStatus } from "../world/world-overview";
import { WorldWeatherMap } from "./WorldWeatherMap";

export interface CountryMapHomeItem {
  readonly countryId?: string;
  readonly slug: string;
  readonly name: string;
  readonly path: string;
  readonly summary: string;
  readonly cityCount: number;
  readonly cityNames: ReadonlyArray<string>;
  readonly weatherScore: number | null;
  readonly weatherStatus: WorldWeatherStatus;
  readonly bestDryDays?: number;
  readonly weatherDays?: number;
  readonly cityWeather?: ReadonlyArray<HomeCityWeatherSeries>;
}

export interface CountryMapHomeProps {
  readonly countries: ReadonlyArray<CountryMapHomeItem>;
  readonly locale?: BrowserAnalyticsLocale;
}

const COPY = {
  en: {
    eyebrow: "Where Not Rain",
    title: "Pick the dates. See where it stays drier.",
    description:
      "Switch between this weekend, the next 7 days or your own dates. The world map and country ranking update together from the same forecast window.",
    period: "Weather period",
    sevenDays: "Next 7 days",
    weekend: "This weekend",
    custom: "Custom dates",
    from: "From",
    to: "To",
    selected: (days: number) => `${days} forecast ${days === 1 ? "day" : "days"} selected`,
    supported: "Explore country weather maps",
    visualHint: "More green means more mostly rain-free days",
    mapSectionLabel: "World travel weather overview",
    cityCount: (count: number) => `${count} ${count === 1 ? "city" : "cities"}`,
    dryDays: (dry: number, total: number) => `${dry}/${total} mostly rain-free`,
    legendExcellent: "Mostly dry",
    legendGood: "Good",
    legendMixed: "Mixed",
    legendPoor: "Wetter",
    footer: "Where Not Rain · Pick dates, then pick a place",
    source: "Forecast data by ",
  },
  "zh-cn": {
    eyebrow: "哪里不下雨",
    title: "先选时间，再看哪里不下雨。",
    description:
      "切换本周末、未来 7 天或自定义日期，世界地图和国家排行会按同一段天气预报一起变化。先看天气，再决定去哪。",
    period: "天气时间",
    sevenDays: "未来 7 天",
    weekend: "本周末",
    custom: "自定义日期",
    from: "开始日期",
    to: "结束日期",
    selected: (days: number) => `已选择 ${days} 天预报`,
    supported: "按国家查看天气地图",
    visualHint: "越绿代表所选时间内基本不下雨的天数越多",
    mapSectionLabel: "全球旅行天气概览",
    cityCount: (count: number) => `${count} 个城市`,
    dryDays: (dry: number, total: number) => `${dry}/${total} 天基本不下雨`,
    legendExcellent: "少雨",
    legendGood: "较少雨",
    legendMixed: "晴雨交替",
    legendPoor: "降雨偏多",
    footer: "Where Not Rain · 先选时间，再决定去哪",
    source: "天气数据：",
  },
  "zh-hant": {
    eyebrow: "哪裡不下雨",
    title: "先選時間，再看哪裡不下雨。",
    description:
      "切換本週末、未來 7 天或自訂日期，世界地圖和國家排行會按同一段天氣預報一起變化。先看天氣，再決定去哪。",
    period: "天氣時間",
    sevenDays: "未來 7 天",
    weekend: "本週末",
    custom: "自訂日期",
    from: "開始日期",
    to: "結束日期",
    selected: (days: number) => `已選擇 ${days} 天預報`,
    supported: "按國家查看天氣地圖",
    visualHint: "越綠代表所選時間內基本不下雨的天數越多",
    mapSectionLabel: "全球旅行天氣概覽",
    cityCount: (count: number) => `${count} 個城市`,
    dryDays: (dry: number, total: number) => `${dry}/${total} 天基本不下雨`,
    legendExcellent: "少雨",
    legendGood: "較少雨",
    legendMixed: "晴雨交替",
    legendPoor: "降雨偏多",
    footer: "Where Not Rain · 先選時間，再決定去哪",
    source: "天氣資料：",
  },
} as const;

export function CountryMapHome({ countries, locale = "en" }: CountryMapHomeProps): ReactElement {
  const copy = COPY[locale];
  const allCityWeather = useMemo(
    () => countries.flatMap((country) => country.cityWeather ?? []),
    [countries],
  );
  const availableDates = useMemo(
    () => availableHomeWeatherDates(allCityWeather),
    [allCityWeather],
  );
  const [preset, setPreset] = useState<HomeWeatherPreset>("7d");
  const [customFrom, setCustomFrom] = useState(availableDates[0] ?? "");
  const [customTo, setCustomTo] = useState(availableDates.at(-1) ?? "");
  const selectedDates = useMemo(
    () => resolveHomeWeatherDates(availableDates, preset, customFrom, customTo),
    [availableDates, customFrom, customTo, preset],
  );

  const displayedCountries = useMemo<ReadonlyArray<CountryMapHomeItem>>(
    () =>
      countries.map((country) => {
        const cityWeather = country.cityWeather ?? [];
        if (cityWeather.length === 0 || selectedDates.length === 0) return country;

        const weather = summarizeHomeCountryRain(cityWeather, selectedDates);
        const topIds = new Set(weather.topCityIds);
        const topCities = [
          ...cityWeather.filter((item) => topIds.has(item.cityId)),
          ...cityWeather.filter((item) => !topIds.has(item.cityId)),
        ].slice(0, 4);

        return {
          ...country,
          cityNames: topCities.map((item) => item.cityName),
          weatherScore: weather.score,
          weatherStatus: worldWeatherStatus(weather.score),
          bestDryDays: weather.bestDryDays,
          weatherDays: weather.totalDays,
        };
      }),
    [countries, selectedDates],
  );

  useEffect(() => {
    emitProductAnalytics({
      locale,
      routeTemplate: "/",
      fields: { event: "weather_discovery_view" },
    });
  }, [locale]);

  function recordCountryOpen(country: CountryMapHomeItem, position: number): void {
    emitProductAnalytics({
      locale,
      routeTemplate: "/",
      fields: {
        event: "search_result_clicked",
        destination_id: country.slug,
        result_type: "country",
        position,
      },
    });
  }

  const firstAvailable = availableDates[0] ?? "";
  const lastAvailable = availableDates.at(-1) ?? "";

  return (
    <>
      <section className="world-discovery-hero">
        <div className="world-discovery-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>

          <div
            className="mt-6 rounded-2xl border border-border bg-surface p-3 sm:p-4"
            data-home-weather-window
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
                {copy.period}
              </p>
              <span className="text-xs font-semibold text-muted">
                {copy.selected(selectedDates.length)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ["7d", copy.sevenDays],
                ["weekend", copy.weekend],
                ["custom", copy.custom],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={preset === value}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold transition focus-ring ${
                    preset === value
                      ? "border-foreground bg-foreground text-white shadow-sm"
                      : "border-border bg-surface-elevated text-foreground hover:border-primary/40"
                  }`}
                  onClick={() => setPreset(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {preset === "custom" && firstAvailable.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold text-muted">
                  {copy.from}
                  <input
                    type="date"
                    min={firstAvailable}
                    max={lastAvailable}
                    value={customFrom}
                    className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground focus-ring"
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomFrom(value);
                      if (customTo.length === 0 || value > customTo) setCustomTo(value);
                    }}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-muted">
                  {copy.to}
                  <input
                    type="date"
                    min={firstAvailable}
                    max={lastAvailable}
                    value={customTo}
                    className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground focus-ring"
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomTo(value);
                      if (customFrom.length === 0 || value < customFrom) setCustomFrom(value);
                    }}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
        <div className="world-discovery-legend" aria-label={copy.visualHint}>
          <span className="status-excellent">●</span>
          <small>{copy.legendExcellent}</small>
          <span className="status-good">●</span>
          <small>{copy.legendGood}</small>
          <span className="status-mixed">●</span>
          <small>{copy.legendMixed}</small>
          <span className="status-poor">●</span>
          <small>{copy.legendPoor}</small>
        </div>
      </section>

      <section
        id="world-weather-map"
        className="world-map-section"
        aria-label={copy.mapSectionLabel}
      >
        <WorldWeatherMap countries={displayedCountries} locale={locale} />
      </section>

      <section className="world-country-strip" aria-labelledby="world-country-strip-heading">
        <div className="world-country-strip-heading">
          <p className="eyebrow">{copy.visualHint}</p>
          <h2 id="world-country-strip-heading" className="section-title mt-2">
            {copy.supported}
          </h2>
        </div>
        <ul>
          {displayedCountries.map((country, index) => {
            const hasDryWindow =
              country.bestDryDays !== undefined &&
              country.weatherDays !== undefined &&
              country.weatherDays > 0;
            const detail = hasDryWindow
              ? copy.dryDays(country.bestDryDays ?? 0, country.weatherDays ?? 0)
              : copy.cityCount(country.cityCount);

            return (
              <li key={country.slug}>
                <Link
                  href={country.path}
                  prefetch
                  className={`world-country-chip status-${country.weatherStatus} focus-ring`}
                  onClick={() => recordCountryOpen(country, index + 1)}
                >
                  <span className="world-country-chip-score">{country.weatherScore ?? "—"}</span>
                  <span>
                    <strong>{country.name}</strong>
                    <small>{detail}</small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="page-footer">
        <span>{copy.footer}</span>
        <span>
          {copy.source}
          <a href="https://open-meteo.com/">Open-Meteo</a>
        </span>
      </footer>
    </>
  );
}
