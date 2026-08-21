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
    eyebrow: "Where Not Rain",
    title: "Pick a country and see where rain looks less likely.",
    description:
      "Each city is a dot on the map. Color shows the rain outlook for the next seven days; hover or tap a city for details.",
    choose: "Choose a country",
    placeholder: "Select a country",
    mapAction: "View country weather",
    howItWorks: "How to use the map",
    steps: [
      ["01", "Choose a country", "Start with a country you may visit."],
      [
        "02",
        "Check the dots",
        "Green means less rain; yellow and red mean rain needs more attention.",
      ],
      ["03", "Open a city", "Hover or tap a city when you want the daily forecast."],
    ],
    cityCount: (count: number) => `${count} ${count === 1 ? "destination" : "destinations"}`,
    footer: "Where Not Rain · Compare rain outlooks by city",
  },
  "zh-cn": {
    eyebrow: "哪里不下雨",
    title: "选一个国家，看看哪些城市更少雨。",
    description:
      "地图上的每个圆点代表一个城市，颜色表示未来 7 天的降雨情况；鼠标移入或点击即可查看详情。",
    choose: "选择国家",
    placeholder: "请选择一个国家",
    mapAction: "查看国家天气",
    howItWorks: "怎么看这张图",
    steps: [
      ["01", "选择国家", "先选一个你准备去的国家。"],
      ["02", "看圆点颜色", "绿色表示雨较少；黄色和红色表示更需要留意降雨。"],
      ["03", "查看城市", "想看具体天气时，再移到或点击城市圆点。"],
    ],
    cityCount: (count: number) => `${count} 个旅游地`,
    footer: "Where Not Rain · 按城市比较未来降雨情况",
  },
  "zh-hant": {
    eyebrow: "哪裡不下雨",
    title: "選一個國家，看看哪些城市更少雨。",
    description:
      "地圖上的每個圓點代表一個城市，顏色表示未來 7 天的降雨情況；滑鼠移入或點擊即可查看詳情。",
    choose: "選擇國家",
    placeholder: "請選擇一個國家",
    mapAction: "查看國家天氣",
    howItWorks: "怎麼看這張圖",
    steps: [
      ["01", "選擇國家", "先選一個你準備去的國家。"],
      ["02", "看圓點顏色", "綠色表示雨較少；黃色和紅色表示更需要留意降雨。"],
      ["03", "查看城市", "想看具體天氣時，再移到或點擊城市圓點。"],
    ],
    cityCount: (count: number) => `${count} 個旅遊地`,
    footer: "Where Not Rain · 按城市比較未來降雨情況",
  },
} as const;

export function CountryMapHome({ countries, locale = "en" }: CountryMapHomeProps): ReactElement {
  const copy = COPY[locale];
  const countryLinkRefs = useRef(new Map<string, HTMLAnchorElement>());

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

      <section className="country-map-home-list" aria-labelledby="country-map-list-heading">
        <div>
          <p className="eyebrow">{copy.choose}</p>
          <h2 id="country-map-list-heading" className="section-title mt-3">
            {locale === "en" ? "Countries" : copy.title}
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
