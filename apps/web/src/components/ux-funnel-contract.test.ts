import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const englishHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const simplifiedHome = readFileSync(new URL("../app/zh-cn/page.tsx", import.meta.url), "utf8");
const traditionalHome = readFileSync(new URL("../app/zh-hant/page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("./SiteHeader.tsx", import.meta.url), "utf8");
const discovery = readFileSync(new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

const tripPages = [
  [
    readFileSync(new URL("../app/trips/page.tsx", import.meta.url), "utf8"),
    '<MyTripsDashboard locale="en" />',
  ],
  [
    readFileSync(new URL("../app/zh-cn/trips/page.tsx", import.meta.url), "utf8"),
    '<MyTripsDashboard locale="zh-cn" />',
  ],
  [
    readFileSync(new URL("../app/zh-hant/trips/page.tsx", import.meta.url), "utf8"),
    '<MyTripsDashboard locale="zh-hant" />',
  ],
] as const;

describe("search-to-retention P0 UX contracts", () => {
  it("splits first-time visitors by task on every homepage", () => {
    expect(englishHome).toContain('href="/discover"');
    expect(englishHome).toContain("I haven't chosen a destination");
    expect(englishHome).toContain('href="/trips/new"');
    expect(simplifiedHome).toContain("还没决定去哪");
    expect(simplifiedHome).toContain('href="/zh-cn/trips/new"');
    expect(traditionalHome).toContain("還沒決定去哪");
    expect(traditionalHome).toContain('href="/zh-hant/trips/new"');
  });

  it("publishes complete three-locale homepage alternates", () => {
    expect(englishHome).toContain('buildAlternates("/", "en", ["en", "zh-cn", "zh-hant"])');
    expect(simplifiedHome).toContain('buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"])');
    expect(traditionalHome).toContain(
      'buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"])',
    );
  });

  it("uses task language in the global navigation", () => {
    expect(header).toContain("Find a destination");
    expect(header).toContain("Plan a trip");
    expect(header).toContain("找目的地");
    expect(header).toContain("规划行程");
    expect(header).toContain("規劃行程");
  });

  it("shows product value before account state on trip landing pages", () => {
    for (const [source, dashboard] of tripPages) {
      const heroIndex = source.indexOf('<section className="trip-hero">');
      const dashboardIndex = source.indexOf(dashboard);
      expect(heroIndex).toBeGreaterThan(-1);
      expect(dashboardIndex).toBeGreaterThan(heroIndex);
    }
  });

  it("keeps advanced discovery controls optional and removes internal release language", () => {
    expect(discovery).toContain("<details");
    expect(discovery).toContain("Refine for your trip");
    expect(discovery).toContain("更多旅行偏好");
    expect(discovery).not.toContain("Weather Discovery 2.0");
    expect(discovery).not.toContain("天气探索 2.0");
    expect(discovery).not.toContain("天氣探索 2.0");
    expect(discovery).not.toContain("Phase 7");
    expect(discovery).not.toContain("persisted forecast snapshot");
  });

  it("uses a responsive shortlist comparison instead of a forced desktop-width table", () => {
    expect(discovery).toContain("sm:grid-cols-2 xl:grid-cols-4");
    expect(discovery).not.toContain("min-w-[760px]");
    expect(discovery).not.toContain("gridTemplateColumns");
  });

  it("makes the localized discovery application crawlable", () => {
    expect(sitemap).toContain('localizedSitemapEntries("/discover"');
    for (const path of [
      "../app/discover/page.tsx",
      "../app/zh-cn/discover/page.tsx",
      "../app/zh-hant/discover/page.tsx",
    ]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain('buildAlternates("/discover"');
      expect(source).toContain('"@type": "WebApplication"');
      expect(source).toContain("<JsonLd schema={jsonLd} />");
    }
  });
});
