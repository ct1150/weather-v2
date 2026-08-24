"use client";

import Link from "next/link";
import { useEffect, type ReactElement } from "react";
import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";
import type { WorldWeatherStatus } from "../world/world-overview";
import { WorldWeatherMap } from "./WorldWeatherMap";

export interface CountryMapHomeItem {
  readonly countryId: string;
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
    title: "See the world first. Then decide where to go.",
    description:
      "Highlighted countries are already supported. Their color summarizes the best weather options across supported cities for the current forecast.",
    weeklyTitle: "Want the ranking instead?",
    weeklyDescription: "Compare the strongest city options across countries for this week or this weekend.",
    weeklyAction: "This week's best weather",
    weekendAction: "This weekend",
    supported: "Supported countries",
    visualHint: "Color first, words second",
    cityCount: (count: number) => `${count} ${count === 1 ? "city" : "cities"}`,
    footer: "Where Not Rain · Weather-first destination discovery",
  },
  "zh-cn": {
    eyebrow: "哪里不下雨",
    title: "先看世界，再决定去哪。",
    description: "高亮国家均已支持；颜色直接概括该国已收录城市当前整体天气表现，点击国家即可进入城市天气地图。",
    weeklyTitle: "想直接看排行？",
    weeklyDescription: "跨国家比较本周或本周末天气更值得去的城市。",
    weeklyAction: "查看这周天气排行",
    weekendAction: "查看本周末",
    supported: "已支持国家",
    visualHint: "先看颜色，再看文字",
    cityCount: (count: number) => `${count} 个城市`,
    footer: "Where Not Rain · 用天气发现目的地",
  },
  "zh-hant": {
    eyebrow: "哪裡不下雨",
    title: "先看世界，再決定去哪。",
    description: "高亮國家均已支援；顏色直接概括該國已收錄城市目前整體天氣表現，點擊國家即可進入城市天氣地圖。",
    weeklyTitle: "想直接看排行？",
    weeklyDescription: "跨國家比較本週或本週末天氣更值得去的城市。",
    weeklyAction: "查看這週天氣排行",
    weekendAction: "查看本週末",
    supported: "已支援國家",
    visualHint: "先看顏色，再看文字",
    cityCount: (count: number) => `${count} 個城市`,
    footer: "Where Not Rain · 用天氣發現目的地",
  },
} as const;

export function CountryMapHome({ countries, locale = "en" }: CountryMapHomeProps): ReactElement {
  const copy = COPY[locale];
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
        </div>
        <div className="world-discovery-legend" aria-label={copy.visualHint}>
          <span className="status-excellent">●</span><small>{locale === "en" ? "Great" : locale === "zh-cn" ? "很适合" : "很適合"}</small>
          <span className="status-good">●</span><small>{locale === "en" ? "Good" : locale === "zh-cn" ? "较适合" : "較適合"}</small>
          <span className="status-mixed">●</span><small>{locale === "en" ? "Mixed" : "一般"}</small>
          <span className="status-poor">●</span><small>{locale === "en" ? "Risk" : locale === "zh-cn" ? "风险较高" : "風險較高"}</small>
        </div>
      </section>

      <WorldWeatherMap countries={countries} locale={locale} />

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
          <h2 id="world-country-strip-heading" className="section-title mt-2">{copy.supported}</h2>
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
