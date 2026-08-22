"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import type {
  CountryHeaderViewModel,
  CountryOptionViewModel,
  CountryWeatherCityViewModel,
  CountryWeatherDayViewModel,
} from "../app/view-models";
import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";
import { toTraditionalText } from "../trips/traditional";
import { windowIndicesForDates } from "../weather/window-selection";
import { isMostlyDryTravelDay } from "./rain-day-classification";
import {
  CountryOutlineMap,
  type CountryOutlineMarker,
  type CountryOutlineRisk,
} from "./CountryOutlineMap";

type ExplorerLocale = BrowserAnalyticsLocale;
type RangePreset = "3d" | "7d" | "weekend" | "custom";
type Risk = CountryOutlineRisk;

interface WeatherFilters {
  readonly rainMax: number | null;
  readonly windMax: number | null;
  readonly tempMin: number | null;
  readonly tempMax: number | null;
}

interface CitySummary {
  readonly city: CountryWeatherCityViewModel;
  readonly days: ReadonlyArray<CountryWeatherDayViewModel>;
  readonly dryDays: number;
  readonly maxRain: number | null;
  readonly totalRainMm: number | null;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
  readonly maxWind: number | null;
  readonly risk: Risk;
  readonly symbol: string;
  readonly filtered: boolean;
  readonly filterReasons: ReadonlyArray<string>;
}

const EMPTY_FILTERS: WeatherFilters = {
  rainMax: null,
  windMax: null,
  tempMin: null,
  tempMax: null,
};

const COPY = {
  en: {
    country: "Country",
    chooseCountry: "Choose country",
    period: "Weather period",
    threeDays: "Next 3 days",
    sevenDays: "Next 7 days",
    weekend: "This weekend",
    custom: "Custom dates",
    firstDate: "First travel date",
    lastDate: "Last travel date",
    filters: "Optional weather limits",
    filtersHint: "Destinations stay on the map and turn grey when they exceed a limit.",
    activeFilters: (count: number) => `${count} active`,
    noLimit: "No limit",
    maxRain: "Highest daily rain chance",
    maxWind: "Maximum wind speed",
    minTemp: "Lowest overnight temperature",
    maxTemp: "Highest daytime temperature",
    clearFilters: "Clear filters",
    share: "Copy map link",
    copied: "Link copied",
    copyFailed: "Copy unavailable",
    mapHeading: "All supported travel destinations at a glance",
    mapHint: (count: number) =>
      `${count} destinations appear as weather-colored dots. Hover on desktop; on mobile, tap a dot to keep a quick summary beside it and tap another dot to compare. Scroll down only when you want the daily forecast.`,
    mapCount: (count: number) => `${count}/${count} shown`,
    mapLegend: "Weather map legend",
    lowerRain: "Mostly rain-free",
    mixed: "Mixed conditions",
    rainLikely: "Rain more likely",
    selected: "Selected destination",
    dryDays: "Rain outlook",
    rain: "Expected rain · peak chance",
    temperature: "Temperature",
    wind: "Maximum wind",
    daily: "Daily weather",
    peakRain: "rain",
    detail: "Open full city forecast",
    destinations: (country: string) => `All supported destinations in ${country}`,
    listHint: (count: number) =>
      `All ${count} catalogue destinations appear both on the map and in this weather list.`,
    outsideLimits: "Outside your limits",
    matchesLimits: "Matches your limits",
    unavailable: "Weather unavailable",
    rainReason: (value: number, limit: number) => `Peak rain ${value}% exceeds ${limit}%`,
    windReason: (value: number, limit: number) => `Wind ${value} km/h exceeds ${limit} km/h`,
    coldReason: (value: number, limit: number) => `Night low ${value}°C is below ${limit}°C`,
    hotReason: (value: number, limit: number) => `Day high ${value}°C exceeds ${limit}°C`,
    sourceHeading: "How to read this map",
    sourceText:
      "The country outline and every weather dot are embedded in the page, so no external map tiles delay the first result. Dot color summarizes rain conditions for the selected period; hover for a quick read or open the daily forecast for detail.",
    source: "Forecast source",
  },
  "zh-cn": {
    country: "国家",
    chooseCountry: "选择国家",
    period: "天气时间范围",
    threeDays: "未来 3 天",
    sevenDays: "未来 7 天",
    weekend: "本周末",
    custom: "自定义日期",
    firstDate: "开始日期",
    lastDate: "结束日期",
    filters: "可选天气限制",
    filtersHint: "超出限制的目的地不会消失，只会在地图上变灰并说明原因。",
    activeFilters: (count: number) => `${count} 项已启用`,
    noLimit: "不限",
    maxRain: "任一天最高降雨概率",
    maxWind: "最大风速",
    minTemp: "最低夜间温度",
    maxTemp: "最高白天气温",
    clearFilters: "清除限制",
    share: "复制地图链接",
    copied: "链接已复制",
    copyFailed: "暂时无法复制",
    mapHeading: "全部已收录旅行地天气一目了然",
    mapHint: (count: number) =>
      `地图显示 ${count} 个按天气着色的地点圆点。手机轻触圆点会在原地显示摘要，可继续点击其他圆点比较；需要逐日天气时再向下查看。`,
    mapCount: (count: number) => `已显示 ${count}/${count}`,
    mapLegend: "地图天气图例",
    lowerRain: "基本不下雨",
    mixed: "晴雨交替",
    rainLikely: "降雨偏多",
    selected: "已选目的地",
    dryDays: "降雨情况",
    rain: "预计降雨量 · 最高概率",
    temperature: "气温",
    wind: "最大风速",
    daily: "逐日天气",
    peakRain: "降雨",
    detail: "查看完整城市天气",
    destinations: (country: string) => `${country}全部已收录旅行地`,
    listHint: (count: number) => `当前目录中的 ${count} 个旅行地已全部同时显示在地图和天气列表中。`,
    outsideLimits: "超出你的限制",
    matchesLimits: "符合你的限制",
    unavailable: "暂无天气数据",
    rainReason: (value: number, limit: number) => `最高降雨概率 ${value}% 超过 ${limit}%`,
    windReason: (value: number, limit: number) => `风速 ${value} km/h 超过 ${limit} km/h`,
    coldReason: (value: number, limit: number) => `夜间最低 ${value}°C 低于 ${limit}°C`,
    hotReason: (value: number, limit: number) => `白天最高 ${value}°C 超过 ${limit}°C`,
    sourceHeading: "如何理解这张地图",
    sourceText:
      "国家轮廓和全部天气圆点都直接内置在页面中，不再等待境外地图瓦片。圆点颜色概括所选日期的降雨情况，鼠标悬停可快速查看，逐日预报提供具体依据。",
    source: "天气数据来源",
  },
  "zh-hant": {
    country: "國家",
    chooseCountry: "選擇國家",
    period: "天氣時間範圍",
    threeDays: "未來 3 天",
    sevenDays: "未來 7 天",
    weekend: "本週末",
    custom: "自訂日期",
    firstDate: "開始日期",
    lastDate: "結束日期",
    filters: "可選天氣限制",
    filtersHint: "超出限制的目的地不會消失，只會在地圖上變灰並說明原因。",
    activeFilters: (count: number) => `${count} 項已啟用`,
    noLimit: "不限",
    maxRain: "任一天最高降雨機率",
    maxWind: "最大風速",
    minTemp: "最低夜間溫度",
    maxTemp: "最高白天氣溫",
    clearFilters: "清除限制",
    share: "複製地圖連結",
    copied: "連結已複製",
    copyFailed: "暫時無法複製",
    mapHeading: "全部已收錄旅行地天氣一目了然",
    mapHint: (count: number) =>
      `地圖顯示 ${count} 個按天氣著色的地點圓點。手機輕觸圓點會在原地顯示摘要，可繼續點擊其他圓點比較；需要逐日天氣時再向下查看。`,
    mapCount: (count: number) => `已顯示 ${count}/${count}`,
    mapLegend: "地圖天氣圖例",
    lowerRain: "基本不下雨",
    mixed: "晴雨交替",
    rainLikely: "降雨偏多",
    selected: "已選目的地",
    dryDays: "降雨情況",
    rain: "預計降雨量 · 最高機率",
    temperature: "氣溫",
    wind: "最大風速",
    daily: "逐日天氣",
    peakRain: "降雨",
    detail: "查看完整城市天氣",
    destinations: (country: string) => `${country}全部已收錄旅行地`,
    listHint: (count: number) => `目前目錄中的 ${count} 個旅行地已全部同時顯示在地圖和天氣列表中。`,
    outsideLimits: "超出你的限制",
    matchesLimits: "符合你的限制",
    unavailable: "暫無天氣資料",
    rainReason: (value: number, limit: number) => `最高降雨機率 ${value}% 超過 ${limit}%`,
    windReason: (value: number, limit: number) => `風速 ${value} km/h 超過 ${limit} km/h`,
    coldReason: (value: number, limit: number) => `夜間最低 ${value}°C 低於 ${limit}°C`,
    hotReason: (value: number, limit: number) => `白天最高 ${value}°C 超過 ${limit}°C`,
    sourceHeading: "如何理解這張地圖",
    sourceText:
      "國家輪廓和全部天氣圓點都直接內置在頁面中，不再等待境外地圖圖磚。圓點顏色概括所選日期的降雨情況，滑鼠懸停可快速查看，逐日預報提供具體依據。",
    source: "天氣資料來源",
  },
} as const;

const CONDITION_ZH: Readonly<Record<string, string>> = {
  Clear: "晴",
  "Mainly clear": "大致晴朗",
  "Partly cloudy": "多云间晴",
  Overcast: "阴",
  Fog: "雾",
  "Rime fog": "雾凇",
  "Light drizzle": "小毛毛雨",
  Drizzle: "毛毛雨",
  "Dense drizzle": "密集毛毛雨",
  "Light freezing drizzle": "轻微冻毛毛雨",
  "Dense freezing drizzle": "密集冻毛毛雨",
  "Light rain": "小雨",
  Rain: "雨",
  "Heavy rain": "大雨",
  "Light freezing rain": "轻微冻雨",
  "Heavy freezing rain": "强冻雨",
  "Light snow": "小雪",
  Snow: "雪",
  "Heavy snow": "大雪",
  "Snow grains": "米雪",
  "Rain showers": "阵雨",
  "Moderate rain showers": "中等阵雨",
  "Violent rain showers": "强阵雨",
  "Light snow showers": "小阵雪",
  "Heavy snow showers": "强阵雪",
  Thunderstorm: "雷暴",
  "Thunderstorm with hail": "雷暴伴冰雹",
};

export interface CountryWeatherExplorerProps {
  readonly country: CountryHeaderViewModel;
  readonly countries: ReadonlyArray<CountryOptionViewModel>;
  readonly cities: ReadonlyArray<CountryWeatherCityViewModel>;
  readonly updatedLabel: string;
  readonly locale?: ExplorerLocale;
}

function numericValues(values: ReadonlyArray<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number");
}

function daysForIndices(
  city: CountryWeatherCityViewModel,
  indices: ReadonlyArray<number>,
): ReadonlyArray<CountryWeatherDayViewModel> {
  return indices
    .map((index) => city.days[index])
    .filter((day): day is CountryWeatherDayViewModel => day !== undefined);
}

function dailySymbol(condition: string): string {
  if (/thunder|hail/i.test(condition)) return "⛈️";
  if (/snow|sleet/i.test(condition)) return "🌨️";
  if (/rain|drizzle|shower/i.test(condition)) return "🌧️";
  if (/fog|mist/i.test(condition)) return "🌫️";
  if (/partly|mainly clear/i.test(condition)) return "🌤️";
  if (/cloud|overcast/i.test(condition)) return "☁️";
  return "☀️";
}

function summarySymbol(days: ReadonlyArray<CountryWeatherDayViewModel>, risk: Risk): string {
  const conditions = days.map((day) => day.weather.conditionLabel).join(" ");
  if (/thunder|hail/i.test(conditions)) return "⛈️";
  if (/snow|sleet/i.test(conditions)) return "🌨️";
  if (risk === "wet") return "🌧️";
  if (/rain|drizzle|shower/i.test(conditions)) return "🌦️";
  const clearDays = days.filter((day) => /clear|sun/i.test(day.weather.conditionLabel)).length;
  return clearDays >= Math.ceil(days.length / 2) ? "☀️" : "🌤️";
}

function filterReasons(
  metrics: Pick<CitySummary, "maxRain" | "maxWind" | "temperatureMin" | "temperatureMax">,
  filters: WeatherFilters,
  locale: ExplorerLocale,
): ReadonlyArray<string> {
  const copy = COPY[locale];
  const reasons: string[] = [];
  if (filters.rainMax !== null && metrics.maxRain !== null && metrics.maxRain > filters.rainMax) {
    reasons.push(copy.rainReason(metrics.maxRain, filters.rainMax));
  }
  if (filters.windMax !== null && metrics.maxWind !== null && metrics.maxWind > filters.windMax) {
    reasons.push(copy.windReason(metrics.maxWind, filters.windMax));
  }
  if (
    filters.tempMin !== null &&
    metrics.temperatureMin !== null &&
    metrics.temperatureMin < filters.tempMin
  ) {
    reasons.push(copy.coldReason(metrics.temperatureMin, filters.tempMin));
  }
  if (
    filters.tempMax !== null &&
    metrics.temperatureMax !== null &&
    metrics.temperatureMax > filters.tempMax
  ) {
    reasons.push(copy.hotReason(metrics.temperatureMax, filters.tempMax));
  }
  return reasons;
}

function summarize(
  city: CountryWeatherCityViewModel,
  indices: ReadonlyArray<number>,
  filters: WeatherFilters,
  locale: ExplorerLocale,
): CitySummary {
  const days = daysForIndices(city, indices);
  const rainValues = numericValues(days.map((day) => day.weather.rainProbability));
  const rainAmounts = numericValues(days.map((day) => day.weather.precipitationMm));
  const minimums = numericValues(days.map((day) => day.weather.temperatureMin));
  const maximums = numericValues(days.map((day) => day.weather.temperatureMax));
  const winds = numericValues(days.map((day) => day.weather.windSpeedMax));
  const dryDays = days.filter(isMostlyDryTravelDay).length;
  const maxRain = rainValues.length > 0 ? Math.max(...rainValues) : null;
  const totalRainMm =
    rainAmounts.length > 0
      ? Math.round(rainAmounts.reduce((total, value) => total + value, 0) * 10) / 10
      : null;
  const temperatureMin = minimums.length > 0 ? Math.min(...minimums) : null;
  const temperatureMax = maximums.length > 0 ? Math.max(...maximums) : null;
  const maxWind = winds.length > 0 ? Math.round(Math.max(...winds)) : null;
  const risk: Risk =
    days.length === 0 || (totalRainMm === null && maxRain === null)
      ? "unknown"
      : dryDays === days.length
        ? "good"
        : dryDays > 0 &&
            (dryDays >= Math.ceil(days.length / 2) ||
              (totalRainMm ?? Infinity) <= days.length * 2.5)
          ? "mixed"
          : "wet";
  const metrics = { maxRain, maxWind, temperatureMin, temperatureMax };
  const reasons = filterReasons(metrics, filters, locale);
  return {
    city,
    days,
    dryDays,
    maxRain,
    totalRainMm,
    temperatureMin,
    temperatureMax,
    maxWind,
    risk,
    symbol: summarySymbol(days, risk),
    filtered: reasons.length > 0,
    filterReasons: reasons,
  };
}

function shortDate(value: string, locale: ExplorerLocale): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const language = locale === "en" ? "en" : locale === "zh-cn" ? "zh-CN" : "zh-TW";
  return new Intl.DateTimeFormat(language, {
    month: locale === "en" ? "short" : "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function rangeLabel(
  days: ReadonlyArray<CountryWeatherDayViewModel>,
  locale: ExplorerLocale,
): string {
  if (days.length === 0) return COPY[locale].unavailable;
  if (days.length === 1) return shortDate(days[0]?.localDate ?? "", locale);
  return `${shortDate(days[0]?.localDate ?? "", locale)}–${shortDate(days.at(-1)?.localDate ?? "", locale)}`;
}

function lowerRainHeadline(summary: CitySummary, locale: ExplorerLocale): string {
  const total = summary.days.length;
  const lowerRainDays = summary.dryDays;
  if (total === 0) return COPY[locale].unavailable;

  if (locale === "en") {
    if (total === 1)
      return lowerRainDays === 1
        ? "That day should be mostly rain-free"
        : "Rain is possible that day";
    if (lowerRainDays === 0) return `Rain is possible on all ${total} days`;
    if (lowerRainDays === total) return `All ${total} days should be mostly rain-free`;
    return `${lowerRainDays} of ${total} days should be mostly rain-free`;
  }

  if (locale === "zh-cn") {
    if (total === 1) return lowerRainDays === 1 ? "当天基本不下雨" : "当天可能下雨";
    if (lowerRainDays === 0) return `这${total}天都有降雨可能`;
    if (lowerRainDays === total) return `这${total}天基本都不下雨`;
    return `${total}天里有${lowerRainDays}天基本不下雨`;
  }

  if (total === 1) return lowerRainDays === 1 ? "當天基本不下雨" : "當天可能下雨";
  if (lowerRainDays === 0) return `這${total}天都有降雨可能`;
  if (lowerRainDays === total) return `這${total}天基本都不下雨`;
  return `${total}天裡有${lowerRainDays}天基本不下雨`;
}

function lowerRainCompact(summary: CitySummary, locale: ExplorerLocale): string {
  const total = summary.days.length;
  const lowerRainDays = summary.dryDays;
  if (total === 0) return COPY[locale].unavailable;

  if (locale === "en") {
    if (lowerRainDays === 0) return "Rain possible every day";
    return `${lowerRainDays} mostly rain-free ${lowerRainDays === 1 ? "day" : "days"}`;
  }
  if (locale === "zh-cn") {
    if (lowerRainDays === 0) return `${total}天都有降雨可能`;
    if (lowerRainDays === total) return `${total}天基本不下雨`;
    return `${lowerRainDays}天基本不下雨`;
  }
  if (lowerRainDays === 0) return `${total}天都有降雨可能`;
  if (lowerRainDays === total) return `${total}天基本不下雨`;
  return `${lowerRainDays}天基本不下雨`;
}

function rainLabel(summary: CitySummary, locale: ExplorerLocale): string {
  if (summary.days.length === 0) return COPY[locale].unavailable;
  const rain = summary.totalRainMm ?? "—";
  if (locale === "en") return `${lowerRainHeadline(summary, locale)} · ${rain} mm expected`;
  if (locale === "zh-cn") return `${lowerRainHeadline(summary, locale)} · 预计共${rain} mm`;
  return `${lowerRainHeadline(summary, locale)} · 預計共${rain} mm`;
}

function markerDetail(summary: CitySummary, locale: ExplorerLocale): string {
  const range = `${summary.temperatureMin ?? "–"}–${summary.temperatureMax ?? "–"}°`;
  return `${lowerRainCompact(summary, locale)} · ${range}`;
}

function conditionLabel(value: string, locale: ExplorerLocale): string {
  if (locale === "en") return value;
  const simplified = CONDITION_ZH[value] ?? value;
  return locale === "zh-hant" ? toTraditionalText(simplified) : simplified;
}

function parseNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function presetIndices(
  dates: ReadonlyArray<string>,
  preset: Exclude<RangePreset, "custom">,
): ReadonlyArray<number> {
  if (preset === "3d") return dates.slice(0, 3).map((_, index) => index);
  if (preset === "7d") return dates.slice(0, 7).map((_, index) => index);
  const weekend = windowIndicesForDates(dates, "weekend");
  return weekend.length > 0 ? weekend : dates.slice(0, 7).map((_, index) => index);
}

function activeFilterCount(filters: WeatherFilters): number {
  return Object.values(filters).filter((value) => value !== null).length;
}

export function InstantCountryWeatherExplorer({
  country,
  countries,
  cities,
  updatedLabel,
  locale = "en",
}: CountryWeatherExplorerProps): ReactElement {
  const copy = COPY[locale];
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [customRange, setCustomRange] = useState<{ start: number; end: number } | null>(null);
  const [filters, setFilters] = useState<WeatherFilters>(EMPTY_FILTERS);
  const [selectedCityId, setSelectedCityId] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  const dates = useMemo(() => (cities[0]?.days ?? []).map((day) => day.localDate), [cities]);
  const selectedIndices = useMemo(() => {
    if (preset !== "custom") return presetIndices(dates, preset);
    if (customRange === null) return dates.slice(0, 7).map((_, index) => index);
    return Array.from(
      { length: customRange.end - customRange.start + 1 },
      (_, index) => customRange.start + index,
    );
  }, [customRange, dates, preset]);
  const summaries = useMemo(
    () => cities.map((city) => summarize(city, selectedIndices, filters, locale)),
    [cities, filters, locale, selectedIndices],
  );
  const selected =
    summaries.find((summary) => summary.city.cityId === selectedCityId) ??
    summaries.find((summary) => !summary.filtered) ??
    summaries[0] ??
    null;
  const selectedReferenceDays =
    cities[0] === undefined ? [] : daysForIndices(cities[0], selectedIndices);
  const exactDates = rangeLabel(selectedReferenceDays, locale);
  const filterCount = activeFilterCount(filters);

  function writeUrl(
    nextPreset: RangePreset,
    nextCustomRange: { start: number; end: number } | null,
    nextFilters: WeatherFilters,
    nextCityId: string,
  ): void {
    const url = new URL(window.location.href);
    for (const key of [
      "window",
      "origin",
      "mode",
      "maxTravel",
      "intent",
      "party",
      "theme",
      "cities",
    ]) {
      url.searchParams.delete(key);
    }
    if (nextPreset === "custom" && nextCustomRange !== null) {
      url.searchParams.delete("range");
      url.searchParams.set("from", String(nextCustomRange.start));
      url.searchParams.set("to", String(nextCustomRange.end));
    } else {
      url.searchParams.delete("from");
      url.searchParams.delete("to");
      url.searchParams.set("range", nextPreset === "custom" ? "7d" : nextPreset);
    }
    const dimensions: ReadonlyArray<[keyof WeatherFilters, string]> = [
      ["rainMax", "rainMax"],
      ["windMax", "windMax"],
      ["tempMin", "tempMin"],
      ["tempMax", "tempMax"],
    ];
    for (const [field, query] of dimensions) {
      const value = nextFilters[field];
      if (value === null) url.searchParams.delete(query);
      else url.searchParams.set(query, String(value));
    }
    if (nextCityId.length > 0) url.searchParams.set("city", nextCityId);
    else url.searchParams.delete("city");
    window.history.replaceState({}, "", url);
  }

  useEffect(() => {
    const restoreUrlState = (): void => {
      const params = new URLSearchParams(window.location.search);
      const from = Number(params.get("from"));
      const to = Number(params.get("to"));
      const finalIndex = Math.max(0, dates.length - 1);
      if (
        params.has("from") &&
        params.has("to") &&
        Number.isInteger(from) &&
        Number.isInteger(to) &&
        from >= 0 &&
        to >= from &&
        to <= finalIndex
      ) {
        setPreset("custom");
        setCustomRange({ start: from, end: to });
      } else {
        const requestedRange = params.get("range");
        const legacyWindow = params.get("window");
        if (requestedRange === "3d" || requestedRange === "7d" || requestedRange === "weekend") {
          setPreset(requestedRange);
          setCustomRange(null);
        } else if (legacyWindow === "today" || legacyWindow === "tomorrow") {
          const index = legacyWindow === "today" ? 0 : Math.min(1, finalIndex);
          setPreset("custom");
          setCustomRange({ start: index, end: index });
        } else if (legacyWindow === "weekend") {
          setPreset("weekend");
          setCustomRange(null);
        } else {
          setPreset("7d");
          setCustomRange(null);
        }
      }
      setFilters({
        rainMax: parseNumber(params.get("rainMax")),
        windMax: parseNumber(params.get("windMax")),
        tempMin: parseNumber(params.get("tempMin")),
        tempMax: parseNumber(params.get("tempMax")),
      });
      const city = params.get("city") ?? "";
      setSelectedCityId(cities.some((item) => item.cityId === city) ? city : "");
    };
    restoreUrlState();
    window.addEventListener("popstate", restoreUrlState);
    return () => window.removeEventListener("popstate", restoreUrlState);
  }, [cities, dates.length]);

  useEffect(() => {
    emitProductAnalytics({
      locale,
      routeTemplate: "/[country]",
      fields: { event: "country_viewed", country_code: country.countryId },
    });
  }, [country.countryId, locale]);

  function selectCity(summary: CitySummary): void {
    setSelectedCityId(summary.city.cityId);
    writeUrl(preset, customRange, filters, summary.city.cityId);
    emitProductAnalytics({
      locale,
      routeTemplate: "/[country]",
      fields: {
        event: "city_viewed",
        city_id: summary.city.cityId,
        country_code: country.countryId,
      },
    });
  }

  function selectMarker(markerId: string): void {
    const summary = summaries.find((item) => item.city.cityId === markerId);
    if (summary !== undefined) selectCity(summary);
  }

  function selectPreset(nextPreset: Exclude<RangePreset, "custom">): void {
    setPreset(nextPreset);
    setCustomRange(null);
    setSelectedCityId("");
    writeUrl(nextPreset, null, filters, "");
  }

  function chooseCustomRange(start: number, end: number): void {
    const finalIndex = Math.max(0, dates.length - 1);
    const next = {
      start: Math.max(0, Math.min(start, end, finalIndex)),
      end: Math.max(0, Math.min(Math.max(start, end), finalIndex)),
    };
    setPreset("custom");
    setCustomRange(next);
    setSelectedCityId("");
    writeUrl("custom", next, filters, "");
  }

  function updateFilter(field: keyof WeatherFilters, raw: string): void {
    const next = { ...filters, [field]: parseNumber(raw) };
    setFilters(next);
    setSelectedCityId("");
    writeUrl(preset, customRange, next, "");
  }

  function clearFilters(): void {
    setFilters(EMPTY_FILTERS);
    setSelectedCityId("");
    writeUrl(preset, customRange, EMPTY_FILTERS, "");
  }

  async function copyShareLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus(copy.copied);
    } catch {
      setShareStatus(copy.copyFailed);
    }
    window.setTimeout(() => setShareStatus(""), 2500);
  }

  function cityDetailHref(path: string): string {
    const start = selectedReferenceDays[0]?.localDate;
    if (start === undefined) return path;
    const end = selectedReferenceDays.at(-1)?.localDate ?? start;
    return `${path}?${new URLSearchParams({ start, end }).toString()}`;
  }

  const currentCountryPath = countries.find(
    (option) => option.slug === country.slug.split("/").at(-1),
  )?.path;
  const mapMarkers: ReadonlyArray<CountryOutlineMarker> = summaries.map((summary) => ({
    id: summary.city.cityId,
    name: summary.city.cityName,
    longitude: summary.city.longitude,
    latitude: summary.city.latitude,
    symbol: summary.symbol,
    detail: markerDetail(summary, locale),
    risk: summary.risk,
    filtered: summary.filtered,
    selected: selected?.city.cityId === summary.city.cityId,
    ariaLabel: `${summary.city.cityName}: ${rainLabel(summary, locale)}${summary.filtered ? `. ${copy.outsideLimits}: ${summary.filterReasons.join("; ")}` : ""}`,
  }));

  return (
    <section className="country-weather-console" aria-label={`${country.name} ${copy.mapHeading}`}>
      <div className="country-console-toolbar country-map-toolbar">
        <label className="country-select-label">
          <span>{copy.country}</span>
          <select
            value={currentCountryPath ?? `/${country.slug}`}
            onChange={(event) =>
              window.location.assign(`${event.target.value}${window.location.search}`)
            }
            className="country-select focus-ring"
            aria-label={copy.chooseCountry}
          >
            {countries.map((option) => (
              <option key={option.slug} value={option.path}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        <div className="min-w-0 flex-1">
          <p className="country-control-label">{copy.period}</p>
          <div className="country-window-tabs" role="group" aria-label={copy.period}>
            {(
              [
                ["3d", copy.threeDays],
                ["7d", copy.sevenDays],
                ["weekend", copy.weekend],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => selectPreset(value)}
                aria-pressed={preset === value}
                className={`country-window-button focus-ring ${preset === value ? "is-active" : ""}`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                chooseCustomRange(
                  customRange?.start ?? selectedIndices[0] ?? 0,
                  customRange?.end ?? selectedIndices.at(-1) ?? Math.min(6, dates.length - 1),
                )
              }
              aria-pressed={preset === "custom"}
              className={`country-window-button focus-ring ${preset === "custom" ? "is-active" : ""}`}
            >
              {copy.custom}
            </button>
          </div>
          {preset === "custom" ? (
            <div className="country-custom-range">
              <label>
                <span className="sr-only">{copy.firstDate}</span>
                <select
                  aria-label={copy.firstDate}
                  value={customRange?.start ?? 0}
                  onChange={(event) =>
                    chooseCustomRange(
                      Number(event.target.value),
                      customRange?.end ?? Number(event.target.value),
                    )
                  }
                >
                  {(cities[0]?.days ?? []).map((day, index) => (
                    <option key={day.localDate} value={index}>
                      {shortDate(day.localDate, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <span aria-hidden="true">→</span>
              <label>
                <span className="sr-only">{copy.lastDate}</span>
                <select
                  aria-label={copy.lastDate}
                  value={customRange?.end ?? Math.min(6, dates.length - 1)}
                  onChange={(event) =>
                    chooseCustomRange(
                      customRange?.start ?? Number(event.target.value),
                      Number(event.target.value),
                    )
                  }
                >
                  {(cities[0]?.days ?? []).map((day, index) => (
                    <option key={day.localDate} value={index}>
                      {shortDate(day.localDate, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <div className="country-map-actions">
          <button
            type="button"
            onClick={() => void copyShareLink()}
            className="country-share-button focus-ring"
          >
            {copy.share}
          </button>
          <p aria-live="polite">{shareStatus || updatedLabel}</p>
        </div>
      </div>

      <details className="country-filter-details">
        <summary>
          <span>{copy.filters}</span>
          {filterCount > 0 ? <strong>{copy.activeFilters(filterCount)}</strong> : null}
        </summary>
        <p>{copy.filtersHint}</p>
        <div className="country-filter-grid">
          <label>
            <span>{copy.maxRain}</span>
            <select
              value={filters.rainMax ?? ""}
              onChange={(event) => updateFilter("rainMax", event.target.value)}
            >
              <option value="">{copy.noLimit}</option>
              {[30, 40, 50, 60, 70].map((value) => (
                <option key={value} value={value}>{`≤ ${value}%`}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.maxWind}</span>
            <select
              value={filters.windMax ?? ""}
              onChange={(event) => updateFilter("windMax", event.target.value)}
            >
              <option value="">{copy.noLimit}</option>
              {[20, 30, 40, 50].map((value) => (
                <option key={value} value={value}>{`≤ ${value} km/h`}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.minTemp}</span>
            <select
              value={filters.tempMin ?? ""}
              onChange={(event) => updateFilter("tempMin", event.target.value)}
            >
              <option value="">{copy.noLimit}</option>
              {[0, 10, 15, 20].map((value) => (
                <option key={value} value={value}>{`≥ ${value}°C`}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.maxTemp}</span>
            <select
              value={filters.tempMax ?? ""}
              onChange={(event) => updateFilter("tempMax", event.target.value)}
            >
              <option value="">{copy.noLimit}</option>
              {[25, 30, 32, 35].map((value) => (
                <option key={value} value={value}>{`≤ ${value}°C`}</option>
              ))}
            </select>
          </label>
        </div>
        {filterCount > 0 ? (
          <button type="button" onClick={clearFilters} className="country-filter-clear focus-ring">
            {copy.clearFilters}
          </button>
        ) : null}
      </details>

      <div className="country-map-heading country-map-primary-heading">
        <div>
          <p className="eyebrow">{country.name}</p>
          <h2>{copy.mapHeading}</h2>
          <p>{copy.mapHint(summaries.length)}</p>
        </div>
        <div className="country-map-heading-status">
          <strong>{exactDates}</strong>
          <span>{copy.mapCount(summaries.length)}</span>
        </div>
      </div>

      <div className="country-map-layout">
        <div className="country-map-stage">
          <CountryOutlineMap
            countryId={country.countryId}
            countryName={country.name}
            ariaLabel={`${country.name} ${copy.mapHeading}`}
            markers={mapMarkers}
            onSelect={selectMarker}
          />
          <div className="country-map-legend" aria-label={copy.mapLegend}>
            <span>
              <i className="legend-good" /> {copy.lowerRain}
            </span>
            <span>
              <i className="legend-mixed" /> {copy.mixed}
            </span>
            <span>
              <i className="legend-wet" /> {copy.rainLikely}
            </span>
          </div>
        </div>

        {selected !== null ? (
          <aside
            className="country-city-inspector"
            aria-label={`${selected.city.cityName} weather summary`}
          >
            <div className="country-inspector-title">
              <span aria-hidden="true">{selected.symbol}</span>
              <div>
                <p>{copy.selected}</p>
                <h2>{selected.city.cityName}</h2>
                <small>{rangeLabel(selected.days, locale)}</small>
              </div>
            </div>
            <p className={`country-filter-result ${selected.filtered ? "is-filtered" : ""}`}>
              {selected.filtered ? copy.outsideLimits : copy.matchesLimits}
            </p>
            {selected.filterReasons.length > 0 ? (
              <ul className="country-filter-reasons">
                {selected.filterReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            <div className="country-inspector-summary country-map-inspector-summary">
              <div>
                <span>{copy.dryDays}</span>
                <strong>{lowerRainHeadline(selected, locale)}</strong>
              </div>
              <div>
                <span>{copy.rain}</span>
                <strong>
                  {selected.totalRainMm ?? "—"} mm · {selected.maxRain ?? "—"}%
                </strong>
              </div>
              <div>
                <span>{copy.temperature}</span>
                <strong>
                  {selected.temperatureMin ?? "–"}–{selected.temperatureMax ?? "–"}°C
                </strong>
              </div>
              <div>
                <span>{copy.wind}</span>
                <strong>{selected.maxWind ?? "—"} km/h</strong>
              </div>
            </div>
            <ol className="country-daily-strip" aria-label={copy.daily}>
              {selected.days.map((day) => (
                <li key={day.localDate}>
                  <div className="flex items-center gap-3">
                    <span className="country-daily-emoji" aria-hidden="true">
                      {dailySymbol(day.weather.conditionLabel)}
                    </span>
                    <div>
                      <time dateTime={day.localDate}>{shortDate(day.localDate, locale)}</time>
                      <p>{conditionLabel(day.weather.conditionLabel, locale)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <strong>
                      {day.weather.rainProbability ?? "—"}% {copy.peakRain}
                    </strong>
                    <p>
                      {day.weather.temperatureMin ?? "–"}–{day.weather.temperatureMax ?? "–"}°
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <a href={cityDetailHref(selected.city.path)} className="country-detail-link focus-ring">
              {copy.detail} <span aria-hidden="true">→</span>
            </a>
          </aside>
        ) : null}
      </div>

      <section className="country-city-list-section" aria-labelledby="country-destination-list">
        <div className="country-city-list-heading">
          <div>
            <p className="eyebrow">{copy.destinations(country.name)}</p>
            <h2 id="country-destination-list" className="section-title mt-3">
              {copy.destinations(country.name)}
            </h2>
          </div>
          <p>{copy.listHint(summaries.length)}</p>
        </div>
        <ul className="country-city-grid country-map-city-grid">
          {summaries.map((summary) => (
            <li
              key={summary.city.cityId}
              className={`country-city-choice risk-${summary.risk}${summary.filtered ? " is-filtered" : ""}`}
              data-selected={selected?.city.cityId === summary.city.cityId}
            >
              <button
                type="button"
                onClick={() => selectCity(summary)}
                className="country-city-select focus-ring"
              >
                <span className="country-list-weather-icon" aria-hidden="true">
                  {summary.symbol}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <strong>{summary.city.cityName}</strong>
                  <small>{rainLabel(summary, locale)}</small>
                  {summary.filtered ? <em>{summary.filterReasons[0]}</em> : null}
                </span>
                <span className="country-list-temperature">
                  {summary.temperatureMin ?? "–"}–{summary.temperatureMax ?? "–"}°
                </span>
              </button>
              <a
                href={cityDetailHref(summary.city.path)}
                className="country-city-forecast-link focus-ring"
              >
                {copy.detail} <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="country-evidence-panel">
        <div className="country-evidence-heading">
          <p className="eyebrow">{copy.sourceHeading}</p>
          <p>{updatedLabel}</p>
        </div>
        <div className="country-map-methodology">
          <p>{copy.sourceText}</p>
          <p>
            {copy.source}: <a href="https://open-meteo.com/">Open-Meteo</a>
          </p>
        </div>
      </section>
    </section>
  );
}
