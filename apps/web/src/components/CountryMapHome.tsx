"use client";

import Link from "next/link";
import { useEffect, type ReactElement } from "react";
import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";
import type { WorldWeatherStatus } from "../world/world-overview";
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
}

export interface CountryMapHomeProps {
  readonly countries: ReadonlyArray<CountryMapHomeItem>;
  readonly locale?: BrowserAnalyticsLocale;
}

const COPY = {
  en: {
    eyebrow: "Where Not Rain",
    title: "Dates fixed. Where is it least likely to rain?",
    description:
      "Choose your starting city and travel dates to get a Top 3 shortlist of reachable destinations ranked by rain risk. Prefer browsing first? The world weather map is just below.",
    primaryAction: "Find least-rain destinations",
    mapAction: "Explore the world weather map",
    weeklyTitle: "Want a quick ranking?",
    weeklyDescription:
      "See the strongest low-rain city options for this week or this weekend without setting up a custom search.",
    weeklyAction: "This week's least-rain cities",
    weekendAction: "This weekend",
    supported: "Explore country weather maps",
    visualHint: "Weather fit by color",
    mapSectionLabel: "World travel weather overview",
    cityCount: (count: number) => `${count} ${count === 1 ? "city" : "cities"}`,
    footer: "Where Not Rain · Weather-driven destination decisions",
  },
  "zh-cn": {
    eyebrow: "哪里不下雨",
    title: "日期定了，去哪儿最不容易下雨？",
    description:
      "选择出发地和旅行日期，从可达目的地中获得按降雨风险排序的 Top 3。想先随便看看，也可以继续浏览下面的世界天气地图。",
    primaryAction: "找少雨目的地",
    mapAction: "浏览世界天气地图",
    weeklyTitle: "想快速看近期排行？",
    weeklyDescription: "无需填写条件，直接查看本周或本周末更少雨的城市。",
    weeklyAction: "查看本周少雨排行",
    weekendAction: "查看本周末",
    supported: "按国家浏览天气地图",
    visualHint: "用颜色快速看天气适合度",
    mapSectionLabel: "全球旅行天气概览",
    cityCount: (count: number) => `${count} 个城市`,
    footer: "Where Not Rain · 用天气决定去哪",
  },
  "zh-hant": {
    eyebrow: "哪裡不下雨",
    title: "日期定了，去哪裡最不容易下雨？",
    description:
      "選擇出發地和旅行日期，從可達目的地中取得按降雨風險排序的 Top 3。想先隨便看看，也可以繼續瀏覽下面的世界天氣地圖。",
    primaryAction: "找少雨目的地",
    mapAction: "瀏覽世界天氣地圖",
    weeklyTitle: "想快速看近期排行？",
    weeklyDescription: "不用填寫條件，直接查看本週或本週末更少雨的城市。",
    weeklyAction: "查看本週少雨排行",
    weekendAction: "查看本週末",
    supported: "按國家瀏覽天氣地圖",
    visualHint: "用顏色快速看天氣適合度",
    mapSectionLabel: "全球旅行天氣概覽",
    cityCount: (count: number) => `${count} 個城市`,
    footer: "Where Not Rain · 用天氣決定去哪",
  },
} as const;

export function CountryMapHome({ countries, locale = "en" }: CountryMapHomeProps): ReactElement {
  const copy = COPY[locale];
  const discoverPath = locale === "en" ? "/discover" : `/${locale}/discover`;
  const weeklyPath =
    locale === "en" ? "/best-weather-this-week" : `/${locale}/best-weather-this-week`;
  const weekendPath = locale === "en" ? "/best-weekend" : `/${locale}/best-weekend`;

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

  return (
    <>
      <section className="world-discovery-hero">
        <div className="world-discovery-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          <div className="world-discovery-actions">
            <Link href={discoverPath} className="world-discovery-primary-action focus-ring">
              {copy.primaryAction} <span aria-hidden="true">→</span>
            </Link>
            <a href="#world-weather-map" className="world-discovery-secondary-action focus-ring">
              {copy.mapAction}
            </a>
          </div>
        </div>
        <div className="world-discovery-legend" aria-label={copy.visualHint}>
          <span className="status-excellent">●</span>
          <small>{locale === "en" ? "Great" : locale === "zh-cn" ? "很适合" : "很適合"}</small>
          <span className="status-good">●</span>
          <small>{locale === "en" ? "Good" : locale === "zh-cn" ? "较适合" : "較適合"}</small>
          <span className="status-mixed">●</span>
          <small>{locale === "en" ? "Mixed" : "一般"}</small>
          <span className="status-poor">●</span>
          <small>{locale === "en" ? "Risk" : locale === "zh-cn" ? "风险较高" : "風險較高"}</small>
        </div>
      </section>

      <section id="world-weather-map" className="world-map-section" aria-label={copy.mapSectionLabel}>
        <WorldWeatherMap countries={countries} locale={locale} />
      </section>

      <section className="info-panel mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">{copy.weeklyTitle}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{copy.weeklyDescription}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={weeklyPath} className="country-detail-link focus-ring">
            {copy.weeklyAction} <span aria-hidden="true">→</span>
          </Link>
          <Link href={weekendPath} className="country-detail-link focus-ring">
            {copy.weekendAction} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="world-country-strip" aria-labelledby="world-country-strip-heading">
        <div className="world-country-strip-heading">
          <p className="eyebrow">{copy.visualHint}</p>
          <h2 id="world-country-strip-heading" className="section-title mt-2">
            {copy.supported}
          </h2>
        </div>
        <ul>
          {countries.map((country, index) => (
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
                  <small>{copy.cityCount(country.cityCount)}</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="page-footer">
        <span>{copy.footer}</span>
        <span>
          {locale === "en" ? "Forecast data by " : locale === "zh-cn" ? "天气数据：" : "天氣資料："}
          <a href="https://open-meteo.com/">Open-Meteo</a>
        </span>
      </footer>
    </>
  );
}
