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
const legacyDiscovery = readFileSync(new URL("../app/discover/page.tsx", import.meta.url), "utf8");

describe("country-first weather-map UX contracts", () => {
  it("gives every homepage one primary country-selection task", () => {
    expect(englishHome).toContain("CountryMapHome");
    expect(simplifiedHome).toContain('locale="zh-cn"');
    expect(traditionalHome).toContain('locale="zh-hant"');
    for (const page of [englishHome, simplifiedHome, traditionalHome]) {
      expect(page).not.toContain("origin");
      expect(page).not.toContain("maxTravel");
      expect(page).not.toContain('href="/discover"');
      expect(page).not.toContain('href="/trips"');
    }
  });

  it("uses the Where Not Rain identity in every locale", () => {
    expect(header).toContain("Choose a country");
    expect(header).toContain("选择国家");
    expect(header).toContain("選擇國家");
    expect(header).toContain("哪里不下雨");
    expect(header).toContain("哪裡不下雨");
    expect(header).not.toContain('"国家天气图"');
    expect(header).not.toContain('"國家天氣圖"');
    expect(simplifiedHome).toContain("哪里不下雨 | Where Not Rain");
    expect(traditionalHome).toContain("哪裡不下雨 | Where Not Rain");
  });

  it("keeps date selection, retires optional limits and makes country changes client-side", () => {
    expect(explorer).toContain('useState<RangePreset>("7d")');
    expect(instantMapStyles).toContain(".country-filter-details");
    expect(instantMapStyles).toContain("display: none !important");
    expect(explorerWrapper).toContain('from "next/link"');
    expect(explorerWrapper).toContain("onChangeCapture={switchCountry}");
    expect(explorerWrapper).toContain("PRESERVED_COUNTRY_QUERY_KEYS");
    expect(explorerWrapper).not.toContain("window.location.assign");
    expect(countryMapHome).toContain('from "next/link"');
    expect(countryMapHome).not.toContain("window.location.assign");
    expect(instantMapStyles).toContain("border: 3px solid var(--marker-risk-color)");
    expect(countryMapHome).toContain("weather_discovery_view");
    expect(countryMapHome).toContain("search_result_clicked");
    expect(explorer).toContain("country_viewed");
    expect(explorer).toContain("city_viewed");
    expect(explorer).not.toContain("DiscoveryTripAction");
  });

  it("keeps advanced Trips and legacy discovery outside acquisition", () => {
    expect(trips).toContain("Advanced itinerary tools");
    expect(trips).toContain("robots: { index: false, follow: true }");
    expect(legacyDiscovery).toContain("robots: { index: false, follow: true }");
    expect(sitemap).not.toContain('localizedSitemapEntries("/trips"');
    expect(sitemap).not.toContain('localizedSitemapEntries("/discover"');
    expect(sitemap).not.toContain('localizedSitemapEntries("/explore"');
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
