import { describe, expect, it } from "vitest";
import { buildPromotionCopy, buildPromotionUrl } from "./social-promotion";

const items = [
  { cityName: "Tokyo", countryName: "Japan", rainFreeDays: 6, totalDays: 7, totalRainMm: 1.2 },
  { cityName: "Seoul", countryName: "Korea", rainFreeDays: 5, totalDays: 7, totalRainMm: 2.4 },
  { cityName: "Bangkok", countryName: "Thailand", rainFreeDays: 4, totalDays: 7, totalRainMm: 3.1 },
  { cityName: "Bali", countryName: "Indonesia", rainFreeDays: 3, totalDays: 7, totalRainMm: 4.8 },
] as const;

describe("social promotion attribution", () => {
  it("builds bounded channel-specific UTM links", () => {
    const url = new URL(buildPromotionUrl("https://868656.xyz/best-weather-this-week", "reddit", "week"));
    expect(url.searchParams.get("utm_source")).toBe("reddit");
    expect(url.searchParams.get("utm_medium")).toBe("social");
    expect(url.searchParams.get("utm_campaign")).toBe("weekly_weather");
  });

  it("builds a Top 3 post and excludes lower-ranked destinations", () => {
    const post = buildPromotionCopy({
      locale: "en",
      mode: "week",
      channel: "reddit",
      pageUrl: "https://868656.xyz/best-weather-this-week",
      items,
    });
    expect(post).toContain("Tokyo, Japan: 6/7 mostly rain-free");
    expect(post).toContain("Bangkok, Thailand");
    expect(post).not.toContain("Bali");
    expect(post).toContain("utm_source=reddit");
  });

  it("generates Chinese short-form copy with Xiaohongshu attribution", () => {
    const post = buildPromotionCopy({
      locale: "zh-cn",
      mode: "weekend",
      channel: "xiaohongshu",
      pageUrl: "https://868656.xyz/zh-cn/best-weekend",
      items,
    });
    expect(post).toContain("本周末基本不下雨旅行地 Top 3");
    expect(post).toContain("utm_source=xiaohongshu");
    expect(post).toContain("utm_campaign=weekend_weather");
  });
});
