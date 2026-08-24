import type { CityForecastDayViewModel } from "../app/view-models";
import { isMostlyDryTravelDay } from "./rain-day-classification";

export type CityDirectAnswerLocale = "en" | "zh-cn" | "zh-hant";

export interface CityDirectAnswerData {
  readonly totalDays: number;
  readonly rainFreeDays: number;
  readonly rainFreeDates: ReadonlyArray<string>;
  readonly totalRainMm: number | null;
  readonly rangeStart: string;
  readonly rangeEnd: string;
  readonly updatedAt: string | null;
}

function numeric(values: ReadonlyArray<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

export function buildCityDirectAnswerData(
  days: ReadonlyArray<CityForecastDayViewModel>,
): CityDirectAnswerData | null {
  if (days.length === 0) return null;

  const rainFreeDates = days
    .filter(isMostlyDryTravelDay)
    .map((day) => day.localDate);
  const rainAmounts = numeric(days.map((day) => day.weather.precipitationMm));
  const observed = days
    .map((day) => day.weather.observedAt)
    .filter((value) => value.length > 0)
    .sort();

  return {
    totalDays: days.length,
    rainFreeDays: rainFreeDates.length,
    rainFreeDates,
    totalRainMm:
      rainAmounts.length === 0
        ? null
        : Math.round(rainAmounts.reduce((sum, value) => sum + value, 0) * 10) / 10,
    rangeStart: days[0]?.localDate ?? "",
    rangeEnd: days.at(-1)?.localDate ?? days[0]?.localDate ?? "",
    updatedAt: observed.at(-1) ?? null,
  };
}

function dateLabel(value: string, locale: CityDirectAnswerLocale): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const language = locale === "en" ? "en" : locale === "zh-cn" ? "zh-CN" : "zh-TW";
  return new Intl.DateTimeFormat(language, {
    month: locale === "en" ? "short" : "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function updatedLabel(value: string, locale: CityDirectAnswerLocale): string {
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

export interface CityDirectAnswerCopy {
  readonly eyebrow: string;
  readonly heading: string;
  readonly summary: string;
  readonly dateGuidance: string;
  readonly periodLabel: string;
  readonly periodValue: string;
  readonly rainLabel: string;
  readonly rainValue: string;
  readonly method: string;
  readonly updated: string | null;
  readonly source: string;
}

export function buildCityDirectAnswerCopy(
  cityName: string,
  data: CityDirectAnswerData,
  locale: CityDirectAnswerLocale,
): CityDirectAnswerCopy {
  const { totalDays, rainFreeDays, rainFreeDates } = data;
  const dateList = rainFreeDates.map((date) => dateLabel(date, locale));
  const period = `${dateLabel(data.rangeStart, locale)}–${dateLabel(data.rangeEnd, locale)}`;
  const rainValue = data.totalRainMm === null ? "—" : `${data.totalRainMm} mm`;

  if (locale === "en") {
    const summary =
      rainFreeDays === 0
        ? `Rain is possible on all ${totalDays} forecast days in ${cityName}.`
        : rainFreeDays === totalDays
          ? `All ${totalDays} forecast days in ${cityName} are currently expected to be mostly rain-free.`
          : `${rainFreeDays} of the next ${totalDays} forecast days in ${cityName} are currently expected to be mostly rain-free.`;
    const dateGuidance =
      rainFreeDays === 0
        ? "There is no clear rain-free window right now, so keep a backup plan for outdoor activities."
        : rainFreeDays === totalDays
          ? "Every forecast day currently qualifies as mostly rain-free."
          : `Better outdoor-weather dates: ${dateList.join(", ")}.`;
    return {
      eyebrow: "Direct weather answer",
      heading: `${cityName} rain outlook for the next ${totalDays} days`,
      summary,
      dateGuidance,
      periodLabel: "Forecast period",
      periodValue: period,
      rainLabel: "Expected precipitation",
      rainValue,
      method:
        "A day counts as mostly rain-free only when the daily condition is not rain, drizzle or showers and expected precipitation stays within the site threshold.",
      updated: data.updatedAt === null ? null : `Forecast updated ${updatedLabel(data.updatedAt, locale)}`,
      source: "Forecast source",
    };
  }

  const traditional = locale === "zh-hant";
  const summary = traditional
    ? rainFreeDays === 0
      ? `未來${totalDays}天，${cityName}每天都有降雨可能。`
      : rainFreeDays === totalDays
        ? `未來${totalDays}天，${cityName}基本都不下雨。`
        : `未來${totalDays}天，${cityName}有${rainFreeDays}天基本不下雨。`
    : rainFreeDays === 0
      ? `未来${totalDays}天，${cityName}每天都有降雨可能。`
      : rainFreeDays === totalDays
        ? `未来${totalDays}天，${cityName}基本都不下雨。`
        : `未来${totalDays}天，${cityName}有${rainFreeDays}天基本不下雨。`;
  const dateGuidance = traditional
    ? rainFreeDays === 0
      ? "目前沒有明確的基本不下雨日期，戶外安排建議保留備選方案。"
      : rainFreeDays === totalDays
        ? "目前預報中的全部日期都符合基本不下雨條件。"
        : `更適合戶外的日期：${dateList.join("、")}。`
    : rainFreeDays === 0
      ? "目前没有明确的基本不下雨日期，户外安排建议保留备选方案。"
      : rainFreeDays === totalDays
        ? "目前预报中的全部日期都符合基本不下雨条件。"
        : `更适合户外的日期：${dateList.join("、")}。`;

  return {
    eyebrow: traditional ? "天氣直接答案" : "天气直接答案",
    heading: traditional
      ? `${cityName}未來${totalDays}天降雨概覽`
      : `${cityName}未来${totalDays}天降雨概览`,
    summary,
    dateGuidance,
    periodLabel: traditional ? "預報日期" : "预报日期",
    periodValue: period,
    rainLabel: traditional ? "預計總降雨" : "预计总降雨",
    rainValue,
    method: traditional
      ? "只有當逐日天氣不是雨、毛毛雨或陣雨，且預計降水量符合本站門檻時，才計為「基本不下雨」。"
      : "只有当逐日天气不是雨、毛毛雨或阵雨，且预计降水量符合本站门槛时，才计为“基本不下雨”。",
    updated:
      data.updatedAt === null
        ? null
        : traditional
          ? `天氣資料更新於 ${updatedLabel(data.updatedAt, locale)}`
          : `天气数据更新于 ${updatedLabel(data.updatedAt, locale)}`,
    source: traditional ? "天氣資料來源" : "天气数据来源",
  };
}
