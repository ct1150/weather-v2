"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactElement } from "react";
import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";

export interface CountryMapHomeItem {
  readonly slug: string;
  readonly name: string;
  readonly path: string;
  readonly summary: string;
  readonly cityCount: number;
  readonly cityNames: ReadonlyArray<string>;
}

export interface CountryMapHomeProps {
  readonly countries: ReadonlyArray<CountryMapHomeItem>;
  readonly locale?: BrowserAnalyticsLocale;
}

const COPY = {
  en: {
    eyebrow: "Country travel weather map",
    title: "Pick a country. See where the weather looks better.",
    description:
      "Open one map and compare the next seven days across popular travel destinations. No origin, route or score to configure.",
    choose: "Choose a country",
    placeholder: "Select a country",
    mapAction: "Open weather map",
    weeklyTitle: "Not sure which country yet?",
    weeklyDescription:
      "Compare supported cities across countries by how many of the next seven days are mostly rain-free.",
    weeklyAction: "See this week's best weather",
    howItWorks: "One glance, three steps",
    steps: [
      ["01", "Choose a country", "Start with the country you are already considering."],
      [
        "02",
        "Read the map",
        "Weather icons, mostly rain-free days and temperatures appear on every destination.",
      ],
      ["03", "Tap a place", "Open the daily forecast only when a destination catches your eye."],
    ],
    cityCount: (count: number) =>
      `${count} popular ${count === 1 ? "destination" : "destinations"}`,
    footer: "Where Not Rain · One country map, less weather guesswork",
  },
  "zh-cn": {
    eyebrow: "哪里不下雨",
    title: "选择一个国家，一张图看懂哪里天气更好。",
    description:
      "直接查看热门旅游地未来 7 天的天气图标、基本不下雨的天数和气温，不需要填写出发地、交通方式或复杂评分。",
    choose: "选择国家",
    placeholder: "请选择一个国家",
    mapAction: "打开天气地图",
    weeklyTitle: "还没决定去哪个国家？",
    weeklyDescription: "跨国家比较热门城市未来 7 天基本不下雨的天数，直接找这周天气更好的旅行地。",
    weeklyAction: "查看这周天气排行",
    howItWorks: "一眼看懂，只需三步",
    steps: [
      ["01", "选择国家", "从你已经感兴趣的国家开始。"],
      ["02", "查看地图", "每个热门目的地直接显示天气图标、基本不下雨的天数和气温。"],
      ["03", "点击地点", "只有对某个地方感兴趣时，再查看逐日天气。"],
    ],
    cityCount: (count: number) => `${count} 个热门旅游地`,
    footer: "Where Not Rain · 一张国家地图，少一点天气猜测",
  },
  "zh-hant": {
    eyebrow: "哪裡不下雨",
    title: "選擇一個國家，一張圖看懂哪裡天氣更好。",
    description:
      "直接查看熱門旅遊地未來 7 天的天氣圖示、基本不下雨的天數和氣溫，不需要填寫出發地、交通方式或複雜評分。",
    choose: "選擇國家",
    placeholder: "請選擇一個國家",
    mapAction: "打開天氣地圖",
    weeklyTitle: "還沒決定去哪個國家？",
    weeklyDescription: "跨國家比較熱門城市未來 7 天基本不下雨的天數，直接找這週天氣更好的旅行地。",
    weeklyAction: "查看這週天氣排行",
    howItWorks: "一眼看懂，只需三步",
    steps: [
      ["01", "選擇國家", "從你已經感興趣的國家開始。"],
      ["02", "查看地圖", "每個熱門目的地直接顯示天氣圖示、基本不下雨的天數和氣溫。"],
      ["03", "點擊地點", "只有對某個地方感興趣時，再查看逐日天氣。"],
    ],
    cityCount: (count: number) => `${count} 個熱門旅遊地`,
    footer: "Where Not Rain · 一張國家地圖，少一點天氣猜測",
  },
} as const;

export function CountryMapHome({ countries, locale = "en" }: CountryMapHomeProps): ReactElement {
  const copy = COPY[locale];
  const countryLinkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const weeklyPath =
    locale === "en" ? "/best-weather-this-week" : `/${locale}/best-weather-this-week`;

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

  function openSelectedCountry(path: string): void {
    countryLinkRefs.current.get(path)?.click();
  }

  return (
    <>
      <section className="country-map-home-hero">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <label className="country-map-home-picker">
          <span>{copy.choose}</span>
          <select
            defaultValue=""
            aria-label={copy.choose}
            onChange={(event) => {
              const selected = countries.find((country) => country.path === event.target.value);
              if (selected === undefined) return;
              openSelectedCountry(selected.path);
            }}
          >
            <option value="" disabled>
              {copy.placeholder}
            </option>
            {countries.map((country) => (
              <option key={country.slug} value={country.path}>
                {country.name} · {copy.cityCount(country.cityCount)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="info-panel mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">{copy.weeklyTitle}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{copy.weeklyDescription}</p>
        </div>
        <Link href={weeklyPath} className="country-detail-link focus-ring shrink-0">
          {copy.weeklyAction} <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="country-map-home-list" aria-labelledby="country-map-list-heading">
        <div>
          <p className="eyebrow">{copy.choose}</p>
          <h2 id="country-map-list-heading" className="section-title mt-3">
            {locale === "en" ? "Popular country maps" : copy.title}
          </h2>
        </div>
        <ul>
          {countries.map((country, index) => (
            <li key={country.slug}>
              <Link
                href={country.path}
                prefetch
                ref={(node) => {
                  if (node === null) countryLinkRefs.current.delete(country.path);
                  else countryLinkRefs.current.set(country.path, node);
                }}
                className="country-map-country-card focus-ring"
                onClick={() => recordCountryOpen(country, index + 1)}
              >
                <span className="country-map-country-count">
                  {copy.cityCount(country.cityCount)}
                </span>
                <h3>{country.name}</h3>
                <p>{country.summary}</p>
                <small>{country.cityNames.join(" · ")}</small>
                <strong>
                  {copy.mapAction} <span aria-hidden="true">→</span>
                </strong>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="country-map-home-steps" aria-labelledby="country-map-steps-heading">
        <p className="eyebrow">{copy.howItWorks}</p>
        <h2 id="country-map-steps-heading" className="sr-only">
          {copy.howItWorks}
        </h2>
        <div>
          {copy.steps.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
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
