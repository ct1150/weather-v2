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

describe("weather-first destination-decision UX contracts", () => {
  it("gives every homepage one primary destination-decision task while keeping the map", () => {
    expect(englishHome).toContain("CountryMapHome");
    expect(simplifiedHome).toContain('locale="zh-cn"');
    expect(traditionalHome).toContain('locale="zh-hant"');
    for (const page of [englishHome, simplifiedHome, traditionalHome]) {
      expect(page).not.toContain("origin");
      expect(page).not.toContain("maxTravel");
    }
    expect(countryMapHome).toContain('"/discover"');
    expect(countryMapHome).toContain("Find least-rain destinations");
    expect(countryMapHome).toContain("找少雨目的地");
    expect(countryMapHome).toContain("WorldWeatherMap");
  });

  it("uses the Where Not Rain identity and destination finder in every locale", () => {
    expect(header).toContain("Find destinations");
    expect(header).toContain("找目的地");
    expect(header).toContain("哪里不下雨");
    expect(header).toContain("哪裡不下雨");
    expect(header).toContain("/discover");
    expect(simplifiedHome).toContain("哪里不下雨？未来14天少雨旅行目的地推荐");
    expect(traditionalHome).toContain("哪裡不下雨？未來14天少雨旅行目的地推薦");
  });

  it("keeps date selection, retires optional limits and switches countries from local state", () => {
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
    expect(instantMapStyles).toContain(".country-weather-dot:hover .country-weather-dot-tooltip");
    expect(explorer).toContain("country_viewed");
    expect(explorer).toContain("city_viewed");
    expect(explorer).not.toContain("DiscoveryTripAction");
  });

  it("promotes least-rain discovery while keeping advanced Trips outside acquisition", () => {
    expect(trips).toContain("Advanced itinerary tools");
    expect(trips).toContain("robots: { index: false, follow: true }");
    expect(discovery).toContain("robots: { index: true, follow: true }");
    expect(discovery).not.toContain("Legacy least-rain finder");
    expect(sitemap).toContain('localizedSitemapEntries("/discover"');
    expect(sitemap).not.toContain('localizedSitemapEntries("/trips"');
    expect(sitemap).not.toContain('localizedSitemapEntries("/explore"');
    expect(manifest).toContain('"start_url": "/discover"');
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
