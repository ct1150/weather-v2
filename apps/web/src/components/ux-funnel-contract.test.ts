import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const englishHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const simplifiedHome = readFileSync(new URL("../app/zh-cn/page.tsx", import.meta.url), "utf8");
const traditionalHome = readFileSync(new URL("../app/zh-hant/page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("./SiteHeader.tsx", import.meta.url), "utf8");
const explorer = readFileSync(new URL("./CountryWeatherExplorer.tsx", import.meta.url), "utf8");
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

  it("uses one global country-map navigation task", () => {
    expect(header).toContain("Choose a country");
    expect(header).toContain("选择国家");
    expect(header).toContain("選擇國家");
    expect(header).not.toContain("Find dry destinations");
    expect(header).not.toContain("tripHref");
  });

  it("defaults the country map to seven days and keeps limits explicit", () => {
    expect(explorer).toContain('useState<RangePreset>("7d")');
    expect(explorer).toContain("Optional weather limits");
    expect(explorer).toContain("Destinations stay on the map and turn grey");
    expect(explorer).toContain("is-filtered");
    expect(explorer).toContain("weather_discovery_view");
    expect(explorer).toContain("country_viewed");
    expect(explorer).toContain("city_viewed");
    expect(explorer).not.toContain("DiscoveryTripAction");
  });

  it("keeps advanced Trips and legacy discovery available but outside acquisition", () => {
    expect(trips).toContain("Advanced itinerary tools");
    expect(trips).toContain("robots: { index: false, follow: true }");
    expect(legacyDiscovery).toContain("robots: { index: false, follow: true }");
    expect(sitemap).not.toContain('localizedSitemapEntries("/trips"');
    expect(sitemap).not.toContain('localizedSitemapEntries("/discover"');
    expect(sitemap).not.toContain('localizedSitemapEntries("/explore"');
  });

  it("keeps complete three-locale homepage alternates and country/city sitemap routes", () => {
    expect(englishHome).toContain('buildAlternates("/", "en", ["en", "zh-cn", "zh-hant"])');
    expect(simplifiedHome).toContain('buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"])');
    expect(traditionalHome).toContain(
      'buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"])',
    );
    expect(sitemap).toContain("countryPath");
    expect(sitemap).toContain("cityPath");
  });
});
