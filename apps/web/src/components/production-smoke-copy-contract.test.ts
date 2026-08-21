import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stagedSmoke = new URL(
  "../../../../tooling/one-off/production-smoke.country-map.yml",
  import.meta.url,
);
const productionSmoke = readFileSync(
  existsSync(stagedSmoke)
    ? stagedSmoke
    : new URL("../../../../.github/workflows/production-smoke.yml", import.meta.url),
  "utf8",
);
const explorerWrapper = readFileSync(
  new URL("./CountryWeatherExplorer.tsx", import.meta.url),
  "utf8",
);
const explorer = readFileSync(
  new URL("./InstantCountryWeatherExplorer.tsx", import.meta.url),
  "utf8",
);
const outlineMap = readFileSync(new URL("./CountryOutlineMap.tsx", import.meta.url), "utf8");
const instantMapStyles = readFileSync(
  new URL("../app/instant-country-map.css", import.meta.url),
  "utf8",
);
const countryMapHome = readFileSync(new URL("./CountryMapHome.tsx", import.meta.url), "utf8");
const siteHeader = readFileSync(new URL("./SiteHeader.tsx", import.meta.url), "utf8");
const favicon = readFileSync(new URL("../../public/favicon.svg", import.meta.url), "utf8");
const englishHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const simplifiedHome = readFileSync(new URL("../app/zh-cn/page.tsx", import.meta.url), "utf8");
const traditionalHome = readFileSync(new URL("../app/zh-hant/page.tsx", import.meta.url), "utf8");
const englishCountry = readFileSync(
  new URL("../app/[countrySlug]/page.tsx", import.meta.url),
  "utf8",
);
const traditionalCountry = readFileSync(
  new URL("../app/zh-hant/[countrySlug]/page.tsx", import.meta.url),
  "utf8",
);

describe("production smoke copy contract", () => {
  it("keeps the country-first identity in all three locales", () => {
    expect(englishHome).toContain("CountryMapHome");
    expect(simplifiedHome).toContain("哪里不下雨 | Where Not Rain");
    expect(traditionalHome).toContain("哪裡不下雨 | Where Not Rain");
    expect(siteHeader).toContain("哪里不下雨");
    expect(siteHeader).toContain("哪裡不下雨");

    for (const phrase of [
      "Pick a country. See where the weather looks better.",
      "选择一个国家，一张图看懂哪里天气更好。",
      "選擇一個國家，一張圖看懂哪裡天氣更好。",
      "哪里不下雨",
      "哪裡不下雨",
    ]) {
      expect(productionSmoke).toContain(phrase);
    }
  });

  it("verifies the immediate complete map while retiring the optional-limit row", () => {
    expect(englishCountry).toContain(
      "all ${cities.length} supported travel destinations immediately",
    );
    expect(traditionalCountry).toContain("目前目錄全部 {cities.length}");
    for (const phrase of [
      "All supported travel destinations at a glance",
      "全部已收录旅行地天气一目了然",
      "全部已收錄旅行地天氣一目了然",
    ]) {
      expect(explorer).toContain(phrase);
      expect(productionSmoke).toContain(phrase);
    }
    expect(explorer).toContain('useState<RangePreset>("7d")');
    expect(instantMapStyles).toContain(".country-filter-details");
    expect(instantMapStyles).toContain("display: none !important");
    expect(instantMapStyles).toContain("Legacy shared URLs must not dim destinations");
  });

  it("renders map geometry and every supplied marker in the initial React tree", () => {
    expect(outlineMap).toContain('data-render-mode="inline-svg"');
    expect(outlineMap).toContain('data-testid="country-weather-marker"');
    expect(explorer).toContain("markers={mapMarkers}");
    expect(outlineMap).toContain("positioned.map");
    expect(instantMapStyles).toContain(".country-weather-map-instant");
    expect(productionSmoke).toContain('data-render-mode="inline-svg"');
    expect(productionSmoke).toContain('data-city-count="8"');
    expect(productionSmoke).toContain('data-testid="country-weather-marker"');
  });

  it("maps good, mixed and wet states to explicit weather-dot colors", () => {
    expect(instantMapStyles).toContain(".country-weather-dot.risk-good");
    expect(instantMapStyles).toContain("--dot-color: rgb(var(--wnr-success))");
    expect(instantMapStyles).toContain(".country-weather-dot.risk-mixed");
    expect(instantMapStyles).toContain("--dot-color: rgb(var(--wnr-warning))");
    expect(instantMapStyles).toContain(".country-weather-dot.risk-wet");
    expect(instantMapStyles).toContain("--dot-color: rgb(var(--wnr-accent))");
    expect(instantMapStyles).toContain("background: var(--dot-color)");
    expect(instantMapStyles).toContain(".country-weather-dot:hover .country-weather-dot-tooltip");
  });

  it("switches supported countries from local data without route-prefetch work", () => {
    expect(explorerWrapper).toContain('data-country-switch-mode="local-state-history"');
    expect(explorerWrapper).toContain("window.history.pushState");
    expect(explorerWrapper).toContain('window.addEventListener("popstate"');
    expect(explorerWrapper).toContain("PRESERVED_COUNTRY_QUERY_KEYS");
    expect(explorerWrapper).not.toContain('from "next/link"');
    expect(explorerWrapper).not.toContain("country-prefetch-links");
    expect(countryMapHome).toContain('from "next/link"');
    expect(countryMapHome).not.toContain("window.location.assign");
  });

  it("uses a high-contrast sun favicon", () => {
    expect(favicon).toContain('aria-label="Where Not Rain sun"');
    expect(favicon).toContain("#fbbf24");
    expect(favicon).not.toContain(">W<");
  });

  it("does not load the remote MapLibre tile stack in the active country map", () => {
    expect(explorerWrapper).not.toContain("maplibre-gl");
    expect(explorer).not.toContain("maplibre-gl");
    expect(explorer).not.toContain("MAPLIBRE_STYLE_URL");
    expect(outlineMap).not.toContain("maplibre-gl");
  });

  it("does not restore origin, reachability or Top 3 acquisition copy", () => {
    for (const obsolete of [
      "Find 3 dry-weather destinations",
      "找 3 个少雨目的地",
      "找 3 個少雨目的地",
      "Starting city",
      "出发城市",
      "出發城市",
      "Max one-way planning time",
      "最长单程规划时间",
      "最長單程規劃時間",
    ]) {
      expect(productionSmoke).not.toContain(obsolete);
    }
  });
});
