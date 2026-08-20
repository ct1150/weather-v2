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
const explorerWrapper = readFileSync(new URL("./CountryWeatherExplorer.tsx", import.meta.url), "utf8");
const explorer = readFileSync(
  new URL("./InstantCountryWeatherExplorer.tsx", import.meta.url),
  "utf8",
);
const outlineMap = readFileSync(new URL("./CountryOutlineMap.tsx", import.meta.url), "utf8");
const instantMapStyles = readFileSync(
  new URL("../app/instant-country-map.css", import.meta.url),
  "utf8",
);
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
  it("checks the same country-first homepage copy in all three locales", () => {
    for (const [page, phrases] of [
      [englishHome, ["Country travel weather maps", "CountryMapHome"]],
      [simplifiedHome, ["国家旅行天气地图", 'locale="zh-cn"']],
      [traditionalHome, ["國家旅行天氣地圖", 'locale="zh-hant"']],
    ] as const) {
      for (const phrase of phrases) expect(page).toContain(phrase);
    }

    for (const phrase of [
      "Pick a country. See where the weather looks better.",
      "选择一个国家，一张图看懂哪里天气更好。",
      "選擇一個國家，一張圖看懂哪裡天氣更好。",
    ]) {
      expect(productionSmoke).toContain(phrase);
    }
  });

  it("verifies immediate complete-map copy and seven-day controls", () => {
    expect(englishCountry).toContain("all ${cities.length} supported travel destinations immediately");
    expect(traditionalCountry).toContain("目前目錄全部 {cities.length}");
    for (const phrase of [
      "All supported travel destinations at a glance",
      "全部已收录旅行地天气一目了然",
      "全部已收錄旅行地天氣一目了然",
    ]) {
      expect(explorer).toContain(phrase);
      expect(productionSmoke).toContain(phrase);
    }
    expect(explorer).toContain('"7d"');
    expect(explorer).toContain("Optional weather limits");
    expect(explorer).toContain("超出限制的目的地不会消失");
    expect(explorer).toContain("no external map tiles delay the first result");
  });

  it("renders map geometry and every supplied marker in the initial React tree", () => {
    expect(outlineMap).toContain('data-render-mode="inline-svg"');
    expect(outlineMap).toContain('data-testid="country-weather-marker"');
    expect(outlineMap).toContain("markers={mapMarkers}");
    expect(outlineMap).toContain("positioned.map");
    expect(instantMapStyles).toContain(".country-weather-map-instant");
    expect(instantMapStyles).toContain(".country-static-weather-marker");
    expect(productionSmoke).toContain('data-render-mode="inline-svg"');
    expect(productionSmoke).toContain('data-city-count="8"');
    expect(productionSmoke).toContain('data-testid="country-weather-marker"');
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
