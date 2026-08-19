import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const englishHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const simplifiedHome = readFileSync(new URL("../app/zh-cn/page.tsx", import.meta.url), "utf8");
const traditionalHome = readFileSync(new URL("../app/zh-hant/page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("./SiteHeader.tsx", import.meta.url), "utf8");
const discovery = readFileSync(new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const trips = readFileSync(new URL("../app/trips/page.tsx", import.meta.url), "utf8");

describe("OPC least-rain decision UX contracts", () => {
  it("gives every homepage one primary least-rain task", () => {
    expect(englishHome).toContain("Where is it least likely to rain?");
    expect(englishHome).toContain("Find 3 dry-weather destinations");
    expect(englishHome).not.toContain('href="/trips"');

    expect(simplifiedHome).toContain("日期定了，去哪里更不容易下雨？");
    expect(simplifiedHome).toContain("找 3 个少雨目的地");
    expect(simplifiedHome).not.toContain('href="/zh-cn/trips"');

    expect(traditionalHome).toContain("日期定了，去哪裡更不容易下雨？");
    expect(traditionalHome).toContain("找 3 個少雨目的地");
    expect(traditionalHome).not.toContain('href="/zh-hant/trips"');
  });

  it("uses one global product navigation task", () => {
    expect(header).toContain("Find dry destinations");
    expect(header).toContain("找少雨目的地");
    expect(header).not.toContain("Plan together");
    expect(header).not.toContain("共同规划");
    expect(header).not.toContain("共同規劃");
    expect(header).not.toContain("tripHref");
  });

  it("returns Top 3 results with explicit limits and no context dropdowns", () => {
    expect(discovery).toContain("const MAX_RESULTS = 3");
    expect(discovery).toContain("rankedResults.slice(0, MAX_RESULTS)");
    expect(discovery).toContain("Optional weather limits");
    expect(discovery).toContain("可选限制条件");
    expect(discovery).not.toContain("<select");
    expect(discovery).not.toContain("Travellers");
    expect(discovery).not.toContain("Trip style");
  });

  it("keeps advanced Trips available but outside acquisition and indexing", () => {
    expect(trips).toContain("Advanced itinerary tools");
    expect(trips).toContain("robots: { index: false, follow: true }");
    expect(sitemap).not.toContain('localizedSitemapEntries("/trips"');
    expect(header).not.toContain("href={tripHref}");
  });

  it("keeps complete three-locale homepage alternates and crawlable discovery", () => {
    expect(englishHome).toContain('buildAlternates("/", "en", ["en", "zh-cn", "zh-hant"])');
    expect(simplifiedHome).toContain('buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"])');
    expect(traditionalHome).toContain(
      'buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"])',
    );
    expect(sitemap).toContain('localizedSitemapEntries("/discover"');
  });
});
