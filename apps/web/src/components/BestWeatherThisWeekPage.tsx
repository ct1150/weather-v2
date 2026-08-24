import type { ReactElement } from "react";
import type { PublishedLocale } from "../app/seo";
import type { WeeklyWeatherRankItem } from "../seo/weekly-weather-ranking";
import { JsonLd } from "./JsonLd";

const COPY = {
  en: {
    eyebrow: "Updated travel-weather ranking",
    title: "Where is the best weather this week?",
    intro:
      "Compare supported destinations by how many of the next seven forecast days are mostly rain-free. Rankings use the same rain-free rule as every country map and city page.",
    direct: (best: WeeklyWeatherRankItem | undefined) =>
      best === undefined
        ? "No ranked forecast is available right now."
        : `${best.cityName} currently ranks first with ${best.rainFreeDays} of ${best.totalDays} forecast days mostly rain-free and ${best.totalRainMm ?? "—"} mm expected precipitation.`,
    ranking: "Best travel weather for the next 7 days",
    rainFree: (item: WeeklyWeatherRankItem) =>
      item.rainFreeDays === item.totalDays
        ? `All ${item.totalDays} days mostly rain-free`
        : `${item.rainFreeDays} of ${item.totalDays} days mostly rain-free`,
    rain: "Expected rain",
    peak: "Peak rain chance",
    temperature: "Temperature",
    dates: "Mostly rain-free dates",
    details: "Open city forecast",
    methodTitle: "How this ranking works",
    method:
      "Destinations rank first by the number of mostly rain-free forecast days, then by lower expected precipitation and lower peak rain chance. A day does not count as rain-free when the daily condition is rain, drizzle, showers, thunder, hail, snow or sleet.",
    source: "Forecast source",
    updated: "Data updated",
  },
  "zh-cn": {
    eyebrow: "实时旅行天气排行",
    title: "这周哪里天气更好？",
    intro:
      "按未来 7 天“基本不下雨”的天数比较已收录旅行地。排行与国家地图、城市页使用完全相同的降雨判断规则。",
    direct: (best: WeeklyWeatherRankItem | undefined) =>
      best === undefined
        ? "暂时没有可用的旅行天气排行。"
        : `目前${best.cityName}排名第一：未来${best.totalDays}天有${best.rainFreeDays}天基本不下雨，预计总降雨${best.totalRainMm ?? "—"} mm。`,
    ranking: "未来 7 天天气更好的旅行地",
    rainFree: (item: WeeklyWeatherRankItem) =>
      item.rainFreeDays === item.totalDays
        ? `${item.totalDays}天基本都不下雨`
        : `${item.totalDays}天里有${item.rainFreeDays}天基本不下雨`,
    rain: "预计总降雨",
    peak: "最高降雨概率",
    temperature: "气温",
    dates: "基本不下雨日期",
    details: "查看城市天气",
    methodTitle: "排行怎么计算",
    method:
      "先按“基本不下雨”的天数从多到少排序，再比较预计总降雨量和最高降雨概率。逐日天气如果明确是雨、毛毛雨、阵雨、雷暴、冰雹或雪，就不会计为“基本不下雨”。",
    source: "天气数据来源",
    updated: "数据更新于",
  },
  "zh-hant": {
    eyebrow: "即時旅行天氣排行",
    title: "這週哪裡天氣更好？",
    intro:
      "按未來 7 天「基本不下雨」的天數比較已收錄旅行地。排行與國家地圖、城市頁使用完全相同的降雨判斷規則。",
    direct: (best: WeeklyWeatherRankItem | undefined) =>
      best === undefined
        ? "暫時沒有可用的旅行天氣排行。"
        : `目前${best.cityName}排名第一：未來${best.totalDays}天有${best.rainFreeDays}天基本不下雨，預計總降雨${best.totalRainMm ?? "—"} mm。`,
    ranking: "未來 7 天天氣更好的旅行地",
    rainFree: (item: WeeklyWeatherRankItem) =>
      item.rainFreeDays === item.totalDays
        ? `${item.totalDays}天基本都不下雨`
        : `${item.totalDays}天裡有${item.rainFreeDays}天基本不下雨`,
    rain: "預計總降雨",
    peak: "最高降雨機率",
    temperature: "氣溫",
    dates: "基本不下雨日期",
    details: "查看城市天氣",
    methodTitle: "排行怎麼計算",
    method:
      "先按「基本不下雨」的天數從多到少排序，再比較預計總降雨量和最高降雨機率。逐日天氣如果明確是雨、毛毛雨、陣雨、雷暴、冰雹或雪，就不會計為「基本不下雨」。",
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

export function BestWeatherThisWeekPage({
  locale,
  items,
  dataUpdatedAt,
  jsonLd,
}: {
  readonly locale: PublishedLocale;
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
            {copy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted sm:text-base">{copy.intro}</p>
          <p
            className="mt-5 max-w-3xl text-lg font-bold leading-7 text-foreground"
            data-ranking-answer
          >
            {copy.direct(best)}
          </p>
          <p className="mt-3 text-xs text-muted">
            {copy.updated} {updatedAt(dataUpdatedAt, locale)} · {copy.source}:{" "}
            <a href="https://open-meteo.com/">Open-Meteo</a>
          </p>
        </div>
      </section>

      <section aria-labelledby="weekly-weather-ranking" className="mt-10">
        <p className="eyebrow">Top {displayed.length}</p>
        <h2 id="weekly-weather-ranking" className="section-title mt-3">
          {copy.ranking}
        </h2>
        <ol className="mt-5 grid gap-4 lg:grid-cols-2">
          {displayed.map((item, index) => (
            <li key={item.cityId} className="info-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-muted">#{index + 1}</p>
                  <h3 className="mt-1 text-xl font-bold text-foreground">{item.cityName}</h3>
                  <p className="mt-1 text-xs text-muted">{item.countryName}</p>
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

      <section className="info-panel mt-10" aria-labelledby="weekly-weather-method">
        <h2 id="weekly-weather-method" className="text-lg font-bold text-foreground">
          {copy.methodTitle}
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">{copy.method}</p>
      </section>
    </main>
  );
}
