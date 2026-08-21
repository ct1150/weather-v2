import { readFile, writeFile } from "node:fs/promises";

const componentPath = "apps/web/src/components/InstantCountryWeatherExplorer.tsx";
const cssPath = "apps/web/src/app/instant-country-map.css";
const testPath = "apps/web/src/components/country-map-mobile-interaction.test.ts";

let component = await readFile(componentPath, "utf8");

component = component.replace(
  'import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";',
  'import { useEffect, useMemo, useState, type ReactElement } from "react";',
);

component = component.replace(
  '    mapHint: (count: number) =>\n      `${count} destinations appear as weather-colored dots. Hover for a quick summary; click or tap for daily detail.`,',
  '    mapHint: (count: number) =>\n      `${count} destinations appear as weather-colored dots. Hover on desktop; on mobile, tap a dot to keep a quick summary beside it and tap another dot to compare. Scroll down only when you want the daily forecast.`,',
);
component = component.replace(
  '    mapHint: (count: number) =>\n      `地图只显示 ${count} 个按天气着色的地点圆点。鼠标移到圆点可快速查看，点击或轻触后看逐日预报。`,',
  '    mapHint: (count: number) =>\n      `地图显示 ${count} 个按天气着色的地点圆点。手机轻触圆点会在原地显示摘要，可继续点击其他圆点比较；需要逐日天气时再向下查看。`,',
);
component = component.replace(
  '    mapHint: (count: number) =>\n      `地圖只顯示 ${count} 個按天氣著色的地點圓點。滑鼠移到圓點可快速查看，點擊或輕觸後看逐日預報。`,',
  '    mapHint: (count: number) =>\n      `地圖顯示 ${count} 個按天氣著色的地點圓點。手機輕觸圓點會在原地顯示摘要，可繼續點擊其他圓點比較；需要逐日天氣時再向下查看。`,',
);

component = component.replace('  const inspectorRef = useRef<HTMLElement | null>(null);\n', '');

const oldSelectCity = `  function selectCity(summary: CitySummary, scrollOnMobile = false): void {\n    setSelectedCityId(summary.city.cityId);\n    writeUrl(preset, customRange, filters, summary.city.cityId);\n    emitProductAnalytics({\n      locale,\n      routeTemplate: "/[country]",\n      fields: {\n        event: "city_viewed",\n        city_id: summary.city.cityId,\n        country_code: country.countryId,\n      },\n    });\n    if (\n      scrollOnMobile &&\n      typeof window.matchMedia === "function" &&\n      window.matchMedia("(max-width: 1023px)").matches\n    ) {\n      window.setTimeout(\n        () => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),\n        0,\n      );\n    }\n  }\n\n  function selectMarker(markerId: string): void {\n    const summary = summaries.find((item) => item.city.cityId === markerId);\n    if (summary !== undefined) selectCity(summary, true);\n  }`;

const newSelectCity = `  function selectCity(summary: CitySummary): void {\n    setSelectedCityId(summary.city.cityId);\n    writeUrl(preset, customRange, filters, summary.city.cityId);\n    emitProductAnalytics({\n      locale,\n      routeTemplate: "/[country]",\n      fields: {\n        event: "city_viewed",\n        city_id: summary.city.cityId,\n        country_code: country.countryId,\n      },\n    });\n  }\n\n  function selectMarker(markerId: string): void {\n    const summary = summaries.find((item) => item.city.cityId === markerId);\n    if (summary !== undefined) selectCity(summary);\n  }`;

if (!component.includes(oldSelectCity)) {
  throw new Error("selectCity block did not match expected source");
}
component = component.replace(oldSelectCity, newSelectCity);
component = component.replace('          <aside\n            ref={inspectorRef}\n            className="country-city-inspector"', '          <aside\n            className="country-city-inspector"');

await writeFile(componentPath, component, "utf8");

let css = await readFile(cssPath, "utf8");
const oldMobileTooltip = `  .country-weather-dot-tooltip {\n    display: none;\n  }`;
const newMobileTooltip = `  .country-weather-dot-tooltip {\n    display: none;\n  }\n\n  .country-weather-dot.is-selected .country-weather-dot-tooltip {\n    display: grid;\n    max-width: min(11rem, 62vw);\n    opacity: 1;\n    visibility: visible;\n  }\n\n  .country-weather-dot.is-selected.tooltip-center .country-weather-dot-tooltip {\n    transform: translate(-50%, 0);\n  }\n\n  .country-weather-dot.is-selected.tooltip-left .country-weather-dot-tooltip,\n  .country-weather-dot.is-selected.tooltip-right .country-weather-dot-tooltip {\n    transform: translate(0, 0);\n  }`;
if (!css.includes(oldMobileTooltip)) {
  throw new Error("mobile tooltip block did not match expected source");
}
css = css.replace(oldMobileTooltip, newMobileTooltip);
await writeFile(cssPath, css, "utf8");

const test = `import { readFileSync } from "node:fs";\nimport { join } from "node:path";\nimport { describe, expect, it } from "vitest";\n\nconst component = readFileSync(\n  join(process.cwd(), "src/components/InstantCountryWeatherExplorer.tsx"),\n  "utf8",\n);\nconst styles = readFileSync(join(process.cwd(), "src/app/instant-country-map.css"), "utf8");\n\ndescribe("mobile country-map comparison interaction", () => {\n  it("keeps marker selection on the map instead of forcing a scroll to the inspector", () => {\n    expect(component).not.toContain("scrollIntoView");\n    expect(component).toContain("if (summary !== undefined) selectCity(summary);");\n    expect(component).toContain("可继续点击其他圆点比较");\n  });\n\n  it("keeps the selected marker summary visible on touch screens", () => {\n    expect(styles).toContain(".country-weather-dot.is-selected .country-weather-dot-tooltip");\n    expect(styles).toContain("max-width: min(11rem, 62vw)");\n    expect(styles).toContain("opacity: 1");\n    expect(styles).toContain("visibility: visible");\n  });\n});\n`;
await writeFile(testPath, test, "utf8");
