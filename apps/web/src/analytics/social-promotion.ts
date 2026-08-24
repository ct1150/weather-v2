import type { PublishedLocale } from "../app/seo";

export type PromotionChannel = "reddit" | "x" | "xiaohongshu" | "tiktok" | "pinterest";
export type PromotionMode = "week" | "weekend";

export interface PromotionWeatherItem {
  readonly cityName: string;
  readonly countryName: string;
  readonly rainFreeDays: number;
  readonly totalDays: number;
  readonly totalRainMm: number | null;
}

const CAMPAIGN_BY_MODE: Record<PromotionMode, string> = {
  week: "weekly_weather",
  weekend: "weekend_weather",
};

const SOURCE_BY_CHANNEL: Record<PromotionChannel, string> = {
  reddit: "reddit",
  x: "x",
  xiaohongshu: "xiaohongshu",
  tiktok: "tiktok",
  pinterest: "pinterest",
};

export function buildPromotionUrl(
  pageUrl: string,
  channel: PromotionChannel,
  mode: PromotionMode,
): string {
  const url = new URL(pageUrl);
  url.searchParams.set("utm_source", SOURCE_BY_CHANNEL[channel]);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", CAMPAIGN_BY_MODE[mode]);
  return url.toString();
}

function compactItem(item: PromotionWeatherItem, locale: PublishedLocale): string {
  const rain = item.totalRainMm === null ? "—" : `${item.totalRainMm}mm`;
  if (locale === "en") {
    return `${item.cityName}, ${item.countryName}: ${item.rainFreeDays}/${item.totalDays} mostly rain-free · ${rain}`;
  }
  if (locale === "zh-hant") {
    return `${item.cityName} · ${item.countryName}：${item.totalDays}天裡${item.rainFreeDays}天基本不下雨 · ${rain}`;
  }
  return `${item.cityName} · ${item.countryName}：${item.totalDays}天里${item.rainFreeDays}天基本不下雨 · ${rain}`;
}

export function buildPromotionCopy(input: {
  readonly locale: PublishedLocale;
  readonly mode: PromotionMode;
  readonly channel: PromotionChannel;
  readonly pageUrl: string;
  readonly items: ReadonlyArray<PromotionWeatherItem>;
}): string {
  const top = input.items.slice(0, 3);
  const url = buildPromotionUrl(input.pageUrl, input.channel, input.mode);
  if (input.locale === "en") {
    const title =
      input.mode === "weekend"
        ? "Best mostly rain-free destinations this weekend"
        : "Best mostly rain-free destinations this week";
    return [
      title,
      ...top.map((item, index) => `${index + 1}. ${compactItem(item, input.locale)}`),
      `Live ranking: ${url}`,
    ].join("\n");
  }
  const traditional = input.locale === "zh-hant";
  const title =
    input.mode === "weekend"
      ? traditional
        ? "本週末基本不下雨旅行地 Top 3"
        : "本周末基本不下雨旅行地 Top 3"
      : traditional
        ? "這週基本不下雨旅行地 Top 3"
        : "这周基本不下雨旅行地 Top 3";
  const footer = traditional ? `即時排行：${url}` : `实时排行：${url}`;
  return [
    title,
    ...top.map((item, index) => `${index + 1}. ${compactItem(item, input.locale)}`),
    footer,
  ].join("\n");
}
