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
  it("keeps the destination-decision identity in all three locales", () => {
    expect(englishHome).toContain("CountryMapHome");
    expect(simplifiedHome).toContain("哪里不下雨？未来14天少雨旅行目的地推荐");
    expect(traditionalHome).toContain("哪裡不下雨？未來14天少雨旅行目的地推薦");
    expect(siteHeader).toContain("哪里不下雨");
    expect(siteHeader).toContain("哪裡不下雨");
    expect(siteHeader).toContain("Find destinations");

    for (const phrase of [
      "Dates fixed. Where is it least likely to rain?",
      "日期定了，去哪儿最不容易下雨？",
      "日期定了，去哪裡最不容易下雨？",
      "Find least-rain destinations",
      "找少雨目的地",
    ]) {
      expect(productionSmoke).toContain(phrase);
    }
  });

  it("keeps the world map as a secondary exploration layer", () => {
    expect(countryMapHome).toContain("WorldWeatherMap");
    expect(countryMapHome).toContain("Explore the world weather map");
    expect(countryMapHome).toContain("浏览世界天气地图");
    expect(countryMapHome).toContain("瀏覽世界天氣地圖");
  });

  it("verifies the immediate complete country map while retiring the optional-limit row", () => {
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

  it("maps good, mixed and wet states to distinct weather-dot semantics", () => {
    expect(instantMapStyles).toContain(".country-weather-dot.risk-good");
    expect(instantMapStyles).toContain("--dot-color: rgb(var(--wnr-success))");
    expect(instantMapStyles).toContain(".country-weather-dot.risk-mixed");
    expect(instantMapStyles).toContain("--dot-color: #f59e0b");
    expect(instantMapStyles).toContain("border-style: dashed");
    expect(instantMapStyles).toContain(".country-weather-dot.risk-wet");
    expect(instantMapStyles).toContain("--dot-color: rgb(var(--wnr-danger))");
    expect(instantMapStyles).toContain("border-width: 2px");
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
});
