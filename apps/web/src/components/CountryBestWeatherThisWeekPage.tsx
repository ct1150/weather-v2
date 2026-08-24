import type { ReactElement } from "react";
import type { PublishedLocale } from "../app/seo";
import type { WeeklyWeatherRankItem } from "../seo/weekly-weather-ranking";
import { JsonLd } from "./JsonLd";

const COPY = {
  en: {
    eyebrow: "Country travel-weather ranking",
    title: (country: string) => `Best weather in ${country} this week`,
    intro: (country: string) =>
      `Compare supported destinations in ${country} by mostly rain-free days, expected precipitation and peak rain chance over the next 7 days.`,
    direct: (country: string, best: WeeklyWeatherRankItem | undefined) =>
      best === undefined
        ? `No ranked forecast is available for ${country} right now.`
        : `${best.cityName} currently ranks first in ${country} with ${best.rainFreeDays} of ${best.totalDays} forecast days mostly rain-free and ${best.totalRainMm ?? "—"} mm expected precipitation.`,
    ranking: (country: string) => `Best travel weather in ${country} for the next 7 days`,
    rainFree: (item: WeeklyWeatherRankItem) =>
      item.rainFreeDays === item.totalDays
        ? `All ${item.totalDays} days mostly rain-free`
        : `${item.rainFreeDays} of ${item.totalDays} days mostly rain-free`,
    rain: "Expected rain",
    peak: "Peak rain chance",
    temperature: "Temperature",
    dates: "Mostly rain-free dates",
    details: "Open city forecast",
    methodTitle: "How this country ranking works",
    method:
      "Cities rank first by mostly rain-free forecast days, then by lower expected precipitation and lower peak rain chance. Rain, drizzle, showers, thunder, hail, snow and sleet never count as rain-free.",
    source: "Forecast source",
    updated: "Data updated",
  },
  "zh-cn": {
    eyebrow: "国家旅行天气排行",
    title: (country: string) => `${country}这周哪里天气更好？`,
    intro: (country: string) =>
      `比较${country}已收录旅行地未来7天基本不下雨的天数、预计总降雨和最高降雨概率，快速判断这周更适合去哪里。`,
    direct: (country: string, best: WeeklyWeatherRankItem | undefined) =>
      best === undefined
        ? `暂时没有${country}可用的旅行天气排行。`
        : `目前${best.cityName}在${country}排名第一：未来${best.totalDays}天有${best.rainFreeDays}天基本不下雨，预计总降雨${best.totalRainMm ?? "—"} mm。`,
    ranking: (country: string) => `${country}未来7天天气更好的旅行地`,
    rainFree: (item: WeeklyWeatherRankItem) =>
      item.rainFreeDays === item.totalDays
        ? `${item.totalDays}天基本都不下雨`
        : `${item.totalDays}天里有${item.rainFreeDays}天基本不下雨`,
    rain: "预计总降雨",
    peak: "最高降雨概率",
    temperature: "气温",
    dates: "基本不下雨日期",
    details: "查看城市天气",
    methodTitle: "国家排行怎么计算",
    method:
      "先按基本不下雨的天数从多到少排序，再比较预计总降雨量和最高降雨概率。逐日天气如果明确是雨、毛毛雨、阵雨、雷暴、冰雹或雪，就不会计为基本不下雨。",
    source: "天气数据来源",
    updated: "数据更新于",
  },
  "zh-hant": {
    eyebrow: "國家旅行天氣排行",
    title: (country: string) => `${country}這週哪裡天氣更好？`,
    intro: (country: string) =>
      `比較${country}已收錄旅行地未來7天基本不下雨的天數、預計總降雨和最高降雨機率，快速判斷這週更適合去哪裡。`,
    direct: (country: string, best: WeeklyWeatherRankItem | undefined) =>
      best === undefined
        ? `暫時沒有${country}可用的旅行天氣排行。`
        : `目前${best.cityName}在${country}排名第一：未來${best.totalDays}天有${best.rainFreeDays}天基本不下雨，預計總降雨${best.totalRainMm ?? "—"} mm。`,
    ranking: (country: string) => `${country}未來7天天氣更好的旅行地`,
    rainFree: (item: WeeklyWeatherRankItem) =>
      item.rainFreeDays === item.totalDays
        ? `${item.totalDays}天基本都不下雨`
        : `${item.totalDays}天裡有${item.rainFreeDays}天基本不下雨`,
    rain: "預計總降雨",
    peak: "最高降雨機率",
    temperature: "氣溫",
    dates: "基本不下雨日期",
    details: "查看城市天氣",
    methodTitle: "國家排行怎麼計算",
    method:
      "先按基本不下雨的天數從多到少排序，再比較預計總降雨量和最高降雨機率。逐日天氣如果明確是雨、毛毛雨、陣雨、雷暴、冰雹或雪，就不會計為基本不下雨。",
    source: "天氣資料來源",
    updated: "資料更新於",
  },
} as const;

function shortDate(value: string, locale: PublishedLocale): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const language = locale === "en" ? "en" : locale === "zh-cn" ? "zh-CN" : "zh-TW";
  return new Intl.DateTimeFormat(language, {
    month: locale === "en" ? "short" : "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function temperature(item: WeeklyWeatherRankItem): string {
  if (item.temperatureMin === null && item.temperatureMax === null) return "—";
  return `${item.temperatureMin ?? "–"}–${item.temperatureMax ?? "–"}°C`;
}

function updatedAt(value: string, locale: PublishedLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const language = locale === "en" ? "en" : locale === "zh-cn" ? "zh-CN" : "zh-TW";
  return `${new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: locale === "en" ? "short" : "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)} UTC`;
}

export function CountryBestWeatherThisWeekPage({
  locale,
  countryName,
  items,
  dataUpdatedAt,
  jsonLd,
}: {
  readonly locale: PublishedLocale;
  readonly countryName: string;
  readonly items: ReadonlyArray<WeeklyWeatherRankItem>;
  readonly dataUpdatedAt: string;
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}): ReactElement {
  const copy = COPY[locale];
  const displayed = items.slice(0, 20);
  const best = displayed[0];

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}
      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-6xl">
            {copy.title(countryName)}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            {copy.intro(countryName)}
          </p>
          <p className="mt-5 max-w-3xl text-lg font-bold leading-7 text-foreground" data-ranking-answer>
            {copy.direct(countryName, best)}
          </p>
          <p className="mt-3 text-xs text-muted">
            {copy.updated} {updatedAt(dataUpdatedAt, locale)} · {copy.source}: {" "}
            <a href="https://open-meteo.com/">Open-Meteo</a>
          </p>
        </div>
      </section>

      <section aria-labelledby="country-weekly-weather-ranking" className="mt-10">
        <p className="eyebrow">Top {displayed.length}</p>
        <h2 id="country-weekly-weather-ranking" className="section-title mt-3">
          {copy.ranking(countryName)}
        </h2>
        <ol className="mt-5 grid gap-4 lg:grid-cols-2">
          {displayed.map((item, index) => (
            <li key={item.cityId} className="info-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-muted">#{index + 1}</p>
                  <h3 className="mt-1 text-xl font-bold text-foreground">{item.cityName}</h3>
                </div>
                <strong className="rounded-full bg-surface-elevated px-3 py-2 text-sm text-foreground">
                  {copy.rainFree(item)}
                </strong>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div className="metric-block">
                  <dt className="text-xs text-muted">{copy.rain}</dt>
                  <dd className="mt-1 font-bold text-foreground">
                    {item.totalRainMm === null ? "—" : `${item.totalRainMm} mm`}
                  </dd>
                </div>
                <div className="metric-block">
                  <dt className="text-xs text-muted">{copy.peak}</dt>
                  <dd className="mt-1 font-bold text-foreground">
                    {item.peakRainChance === null ? "—" : `${item.peakRainChance}%`}
                  </dd>
                </div>
                <div className="metric-block">
                  <dt className="text-xs text-muted">{copy.temperature}</dt>
                  <dd className="mt-1 font-bold text-foreground">{temperature(item)}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted">{copy.dates}</p>
                <p className="mt-1 text-sm text-foreground">
                  {item.rainFreeDates.length === 0
                    ? "—"
                    : item.rainFreeDates.map((date) => shortDate(date, locale)).join(" · ")}
                </p>
              </div>
              <a href={item.path} className="country-detail-link focus-ring mt-4 inline-flex">
                {copy.details} <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="info-panel mt-10" aria-labelledby="country-weekly-weather-method">
        <h2 id="country-weekly-weather-method" className="text-lg font-bold text-foreground">
          {copy.methodTitle}
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">{copy.method}</p>
      </section>
    </main>
  );
}
