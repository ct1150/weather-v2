import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const englishHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const simplifiedHome = readFileSync(new URL("../app/zh-cn/page.tsx", import.meta.url), "utf8");
const traditionalHome = readFileSync(new URL("../app/zh-hant/page.tsx", import.meta.url), "utf8");
const countryMapHome = readFileSync(new URL("./CountryMapHome.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("./SiteHeader.tsx", import.meta.url), "utf8");
const explorerWrapper = readFileSync(
  new URL("./CountryWeatherExplorer.tsx", import.meta.url),
  "utf8",
);
const explorer = readFileSync(
  new URL("./InstantCountryWeatherExplorer.tsx", import.meta.url),
  "utf8",
);
const instantMapStyles = readFileSync(
  new URL("../app/instant-country-map.css", import.meta.url),
  "utf8",
);
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const trips = readFileSync(new URL("../app/trips/page.tsx", import.meta.url), "utf8");
const discovery = readFileSync(new URL("../app/discover/page.tsx", import.meta.url), "utf8");
const manifest = readFileSync(
  new URL("../../public/manifest.webmanifest", import.meta.url),
  "utf8",
);

describe("time-first weather-map UX contracts", () => {
  it("makes time selection and the world map the homepage product", () => {
    expect(englishHome).toContain("CountryMapHome");
    expect(simplifiedHome).toContain('locale="zh-cn"');
    expect(traditionalHome).toContain('locale="zh-hant"');
    expect(countryMapHome).toContain('useState<HomeWeatherPreset>("7d")');
    expect(countryMapHome).toContain("resolveHomeWeatherDates");
    expect(countryMapHome).toContain("data-home-weather-window");
    expect(countryMapHome).toContain("Next 7 days");
    expect(countryMapHome).toContain("This weekend");
    expect(countryMapHome).toContain("Custom dates");
    expect(countryMapHome).toContain("WorldWeatherMap");
    expect(countryMapHome).not.toContain('"/discover"');
    expect(countryMapHome).not.toContain("Starting city");
    expect(countryMapHome).not.toContain("Max one-way");
  });

  it("uses the Where Not Rain identity and rain-map navigation in every locale", () => {
    expect(header).toContain("View rain map");
    expect(header).toContain("看少雨地图");
    expect(header).toContain("看少雨地圖");
    expect(header).toContain("#world-weather-map");
    expect(header).not.toContain("/discover");
    expect(simplifiedHome).toContain("哪里不下雨？本周末和未来7天少雨地图");
    expect(traditionalHome).toContain("哪裡不下雨？本週末和未來7天少雨地圖");
  });

  it("keeps detailed country maps date-driven and local-state navigable", () => {
    expect(explorer).toContain('useState<RangePreset>("7d")');
    expect(instantMapStyles).toContain(".country-filter-details");
    expect(instantMapStyles).toContain("display: none !important");
    expect(explorerWrapper).toContain('data-country-switch-mode="local-state-history"');
    expect(explorerWrapper).toContain("onChangeCapture={switchCountry}");
    expect(explorerWrapper).toContain("window.history.pushState");
    expect(explorerWrapper).toContain('window.addEventListener("popstate"');
    expect(explorerWrapper).toContain("PRESERVED_COUNTRY_QUERY_KEYS");
    expect(explorerWrapper).not.toContain('from "next/link"');
    expect(explorerWrapper).not.toContain("country-prefetch-links");
    expect(countryMapHome).toContain('from "next/link"');
    expect(countryMapHome).not.toContain("window.location.assign");
    expect(instantMapStyles).toContain(".country-weather-dot.risk-good");
    expect(instantMapStyles).toContain("--dot-color: rgb(var(--wnr-success))");
    expect(explorer).toContain("country_viewed");
    expect(explorer).toContain("city_viewed");
  });

  it("keeps advanced discovery and Trips outside acquisition", () => {
    expect(trips).toContain("Advanced itinerary tools");
    expect(trips).toContain("robots: { index: false, follow: true }");
    expect(discovery).toContain("robots: { index: false, follow: true }");
    expect(discovery).toContain("Advanced least-rain shortlist");
    expect(sitemap).not.toContain('localizedSitemapEntries("/discover"');
    expect(sitemap).not.toContain('localizedSitemapEntries("/trips"');
    expect(sitemap).not.toContain('localizedSitemapEntries("/explore"');
    expect(manifest).toContain('"start_url": "/"');
    expect(manifest).not.toContain('"start_url": "/discover"');
  });

  it("keeps complete three-locale alternates and destination sitemap routes", () => {
    expect(englishHome).toContain('buildAlternates("/", "en", ["en", "zh-cn", "zh-hant"])');
    expect(simplifiedHome).toContain('buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"])');
    expect(traditionalHome).toContain(
      'buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"])',
    );
    expect(sitemap).toContain("countryPath");
    expect(sitemap).toContain("cityPath");
  });
});