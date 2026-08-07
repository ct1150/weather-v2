import type { ReactElement } from "react";
import type {
  CityPageViewModel,
  DestinationLinkViewModel,
  ScoreViewModel,
  WeatherSummaryViewModel,
} from "../app/view-models";
import { JsonLd } from "./JsonLd";
import { CityTripBridge } from "./CityTripBridge";
import { toTraditionalText } from "../trips/traditional";

export type ChineseWeatherLocale = "zh-cn" | "zh-hant";

interface ChineseCityWeatherPageProps {
  readonly viewModel: CityPageViewModel;
  readonly locale: ChineseWeatherLocale;
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

const COPY = {
  "zh-cn": {
    radar: "亚洲旅行天气",
    breadcrumb: "面包屑",
    eyebrow: "目的地天气",
    intro: (country: string) =>
      `查看降雨风险、气温和 7 天旅行评分，再和${country}其他目的地比较后决定行程。`,
    current: "当前天气",
    loadingWeather: "正在加载天气…",
    weatherError: "暂时无法加载当前天气。",
    weatherEmpty: "暂无当前天气。",
    currentCondition: "当前天气",
    temperature: "气温",
    peakRain: "最高降雨概率",
    updated: "更新于",
    score: "旅行评分",
    reason: "评分原因",
    plan: "安排未来几天",
    outlook: "7 天旅行天气",
    timezone: (timezone: string) => `日期与天气使用 ${timezone} 当地时间`,
    loadingForecast: "正在加载预报…",
    forecastError: "暂时无法加载天气预报。",
    forecastEmpty: "暂无天气预报。",
    today: "今天",
    tomorrow: "明天",
    day: (index: number) => `第 ${index + 1} 天`,
    scoreShort: "评分",
    peakRainShort: "最高降雨",
    covering: "覆盖日期：",
    relatedEyebrow: "继续探索",
    related: "相关目的地",
    footer: "Where Not Rain · 用天气决定去哪里",
    source: "天气数据：",
    derived: " · 衍生旅行评分",
  },
  "zh-hant": {
    radar: "亞洲旅行天氣",
    breadcrumb: "麵包屑",
    eyebrow: "目的地天氣",
    intro: (country: string) =>
      `查看降雨風險、氣溫和 7 天旅行評分，再和${country}其他目的地比較後決定行程。`,
    current: "目前天氣",
    loadingWeather: "正在載入天氣…",
    weatherError: "暫時無法載入目前天氣。",
    weatherEmpty: "暫無目前天氣。",
    currentCondition: "目前天氣",
    temperature: "氣溫",
    peakRain: "最高降雨機率",
    updated: "更新於",
    score: "旅行評分",
    reason: "評分原因",
    plan: "安排未來幾天",
    outlook: "7 天旅行天氣",
    timezone: (timezone: string) => `日期與天氣使用 ${timezone} 當地時間`,
    loadingForecast: "正在載入預報…",
    forecastError: "暫時無法載入天氣預報。",
    forecastEmpty: "暫無天氣預報。",
    today: "今天",
    tomorrow: "明天",
    day: (index: number) => `第 ${index + 1} 天`,
    scoreShort: "評分",
    peakRainShort: "最高降雨",
    covering: "涵蓋日期：",
    relatedEyebrow: "繼續探索",
    related: "相關目的地",
    footer: "Where Not Rain · 用天氣決定去哪裡",
    source: "天氣資料：",
    derived: " · 衍生旅行評分",
  },
} as const;

function renderScoreValue(score: ScoreViewModel, locale: ChineseWeatherLocale): string {
  if (score.value === null) {
    if (score.state === "unavailable") return locale === "zh-hant" ? "無資料" : "无数据";
    if (score.state === "limited_data") return locale === "zh-hant" ? "資料有限" : "数据有限";
    return "—";
  }
  return String(score.value);
}

function formatObservation(value: string, locale: ChineseWeatherLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat(locale === "zh-hant" ? "zh-TW" : "zh-CN", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function reasonLabel(reason: string, locale: ChineseWeatherLocale): string {
  const labels: Readonly<Record<string, string>> = {
    LOW_RAIN_CHANCE: "低降雨機率",
    COMFORTABLE_TEMPERATURE: "氣溫舒適",
    LOW_HUMIDITY: "濕度較低",
    CALM_WIND: "風勢平穩",
    HIGH_UV_CAUTION: "紫外線偏強",
    HEAVY_RAIN_RISK: "大雨風險",
    STORM_RISK: "雷暴風險",
    CLEAR_NIGHT_SKY: "夜空晴朗",
    GOOD_GOLDEN_HOUR: "黃金時段條件佳",
    LIMITED_DATA: "資料有限",
    STALE_DATA: "資料可能過期",
  };
  const traditional = labels[reason] ?? reason;
  return locale === "zh-hant"
    ? traditional
    : traditional
        .replaceAll("機率", "概率")
        .replaceAll("氣", "气")
        .replaceAll("濕", "湿")
        .replaceAll("風", "风")
        .replaceAll("線", "线")
        .replaceAll("險", "险")
        .replaceAll("黃", "黄")
        .replaceAll("時", "时")
        .replaceAll("條", "条")
        .replaceAll("資", "资")
        .replaceAll("料", "料")
        .replaceAll("過", "过")
        .replaceAll("期", "期");
}

function isCautionReason(reason: string): boolean {
  return /RISK|CAUTION|LIMITED|UNAVAILABLE|STALE/u.test(reason);
}

function conditionLabel(value: string, locale: ChineseWeatherLocale): string {
  const simplified: Readonly<Record<string, string>> = {
    Clear: "晴",
    "Mainly clear": "大致晴朗",
    "Partly cloudy": "多云间晴",
    Overcast: "阴",
    Fog: "雾",
    "Light drizzle": "小毛毛雨",
    Drizzle: "毛毛雨",
    "Dense drizzle": "密集毛毛雨",
    "Light rain": "小雨",
    Rain: "雨",
    "Heavy rain": "大雨",
    "Light snow": "小雪",
    Snow: "雪",
    "Heavy snow": "大雪",
    "Rain showers": "阵雨",
    "Moderate rain showers": "中等阵雨",
    "Violent rain showers": "强阵雨",
    Thunderstorm: "雷暴",
    "Thunderstorm with hail": "雷暴伴冰雹",
  };
  const result = simplified[value] ?? value;
  return locale === "zh-hant" ? toTraditionalText(result) : result;
}

function WeatherSummary({
  weather,
  locale,
}: {
  weather: WeatherSummaryViewModel;
  locale: ChineseWeatherLocale;
}): ReactElement {
  const copy = COPY[locale];
  return (
    <div className="info-panel h-full">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
        {copy.currentCondition}
      </p>
      <p className="mt-2 text-2xl font-bold text-foreground">
        {conditionLabel(weather.conditionLabel, locale)}
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="metric-block">
          <dt className="text-xs text-muted">{copy.temperature}</dt>
          <dd className="mt-1 font-bold text-foreground">
            {weather.temperatureMin !== null ? `${weather.temperatureMin}°C` : "–"} /{" "}
            {weather.temperatureMax !== null ? `${weather.temperatureMax}°C` : "–"}
          </dd>
        </div>
        <div className="metric-block">
          <dt className="text-xs text-muted">{copy.peakRain}</dt>
          <dd className="mt-1 font-bold text-foreground">
            {weather.rainProbability !== null ? `${weather.rainProbability}%` : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted">
        {copy.updated}{" "}
        <time dateTime={weather.observedAt}>{formatObservation(weather.observedAt, locale)}</time>
      </p>
    </div>
  );
}

export function ChineseCityWeatherPage({
  viewModel,
  locale,
  jsonLd,
}: ChineseCityWeatherPageProps): ReactElement {
  const copy = COPY[locale];
  const {
    city,
    weather,
    weatherState,
    score,
    forecastState,
    localDates,
    forecastDays,
    relatedLinks,
  } = viewModel;
  const localePrefix = locale === "zh-hant" ? "/zh-hant" : "/zh-cn";

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}
      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10">
          <nav aria-label={copy.breadcrumb} className="country-breadcrumb">
            <ol>
              <li>
                <a href={localePrefix} className="focus-ring">
                  {copy.radar}
                </a>
              </li>
              <li>
                <a href={`${localePrefix}/${city.countrySlug}`} className="focus-ring">
                  {city.countryName}
                </a>
              </li>
              <li aria-current="page">{city.cityName}</li>
            </ol>
          </nav>
          <p className="eyebrow mt-7">{copy.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-6xl">
            {city.cityName} · {city.countryName}
          </h1>
          <p className="mt-4 text-sm text-muted">
            {city.timezone} · {city.latitude.toFixed(2)}, {city.longitude.toFixed(2)}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            {copy.intro(city.countryName)}
          </p>
        </div>
      </section>

      <CityTripBridge
        locale={locale}
        cityId={city.cityId}
        cityName={city.cityName}
        countryName={city.countryName}
        defaultDate={localDates[0] ?? ""}
        workspacePath={`${localePrefix}/trips/workspace`}
      />

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <section aria-label={copy.current}>
          {weatherState === "loading" ? (
            <p role="status" className="text-body text-muted">
              {copy.loadingWeather}
            </p>
          ) : null}
          {weatherState === "error" ? (
            <p role="alert" className="text-body text-danger">
              {copy.weatherError}
            </p>
          ) : null}
          {weatherState === "empty" ? (
            <p className="text-body text-muted">{copy.weatherEmpty}</p>
          ) : null}
          {weatherState === "ready" && weather !== null ? (
            <WeatherSummary weather={weather} locale={locale} />
          ) : null}
        </section>

        <section aria-label={copy.score} className="info-panel h-full">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{copy.score}</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-bold tracking-[-0.05em] text-foreground">
              {renderScoreValue(score, locale)}
            </span>
            {score.value !== null ? (
              <span className="mb-1 text-sm font-semibold text-muted">/ 100</span>
            ) : null}
          </div>
          {score.reasonCodes.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label={copy.reason}>
              {score.reasonCodes.map((reason) => (
                <li
                  key={reason}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${isCautionReason(reason) ? "signal-caution" : "signal-good"}`}
                >
                  {reasonLabel(reason, locale)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section aria-label={copy.outlook} className="info-panel mt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{copy.plan}</p>
            <h2 className="section-title mt-3">{copy.outlook}</h2>
          </div>
          <p className="text-xs text-muted">{copy.timezone(city.timezone)}</p>
        </div>
        {forecastState === "loading" ? (
          <p role="status" className="mt-2 text-body text-muted">
            {copy.loadingForecast}
          </p>
        ) : null}
        {forecastState === "error" ? (
          <p role="alert" className="mt-2 text-body text-danger">
            {copy.forecastError}
          </p>
        ) : null}
        {forecastState === "empty" ? (
          <p className="mt-2 text-body text-muted">{copy.forecastEmpty}</p>
        ) : null}
        {forecastState === "ready" && (forecastDays?.length ?? 0) > 0 ? (
          <ol className="forecast-timeline mt-6">
            {forecastDays?.map((day, index) => (
              <li key={day.localDate} className="forecast-day">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                    {index === 0 ? copy.today : index === 1 ? copy.tomorrow : copy.day(index)}
                  </p>
                  <time
                    dateTime={day.localDate}
                    className="mt-1 block text-sm font-bold text-foreground"
                  >
                    {day.localDate}
                  </time>
                </div>
                <div className="sm:text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {conditionLabel(day.weather.conditionLabel, locale)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {day.weather.temperatureMin ?? "–"}° / {day.weather.temperatureMax ?? "–"}°
                  </p>
                </div>
                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <span
                    className={
                      day.weather.rainProbability !== null && day.weather.rainProbability <= 45
                        ? "text-sm font-bold text-success"
                        : "text-sm font-bold text-accent"
                    }
                  >
                    {day.weather.rainProbability ?? "—"}% {copy.peakRainShort}
                  </span>
                  <span className="min-w-12 text-right text-sm font-bold text-foreground">
                    {renderScoreValue(day.score, locale)}
                    <span className="block text-[9px] uppercase tracking-[0.1em] text-muted">
                      {copy.scoreShort}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : forecastState === "ready" && localDates.length > 0 ? (
          <p className="mt-4 text-body text-muted">
            {copy.covering}
            {localDates.join("、")}
          </p>
        ) : null}
      </section>

      {relatedLinks.length > 0 ? (
        <section aria-label={copy.related} className="mt-12">
          <p className="eyebrow">{copy.relatedEyebrow}</p>
          <h2 className="section-title mt-3">{copy.related}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedLinks.map((dest: DestinationLinkViewModel) => (
              <li key={dest.cityId}>
                <a href={dest.path} className="destination-link focus-ring">
                  <span>
                    <span className="font-bold text-foreground">{dest.cityName}</span>
                    <span className="ml-2 text-xs text-muted">{dest.countryName}</span>
                  </span>
                  <span aria-hidden="true" className="text-lg text-primary">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="page-footer">
        <span>{copy.footer}</span>
        <span>
          {copy.source}
          <a href="https://open-meteo.com/">Open-Meteo</a>
          {copy.derived}
        </span>
      </footer>
    </main>
  );
}
