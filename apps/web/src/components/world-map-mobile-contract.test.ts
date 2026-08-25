import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(join(process.cwd(), "src/components/WorldWeatherMap.tsx"), "utf8");
const geometry = readFileSync(
  join(process.cwd(), "src/components/world-supported-country-geometry.ts"),
  "utf8",
);
const styles = readFileSync(join(process.cwd(), "src/app/world-map.css"), "utf8");

describe("world weather map rendering contract", () => {
  it("uses the real token-free MapLibre basemap instead of hand-drawn continent blobs", () => {
    expect(component).toContain("https://tiles.openfreemap.org/styles/liberty");
    expect(component).toContain('import("maplibre-gl")');
    expect(component).toContain("new maplibregl.Map");
    expect(component).not.toContain("WORLD_LAND_PATH");
    expect(component).not.toContain("world-weather-country-shape");
    expect(component).not.toContain("<svg");
  });

  it("colors real supported-country polygons from the current weather status", () => {
    expect(component).toContain("SUPPORTED_COUNTRY_GEOMETRY");
    expect(component).toContain("map.addSource(COUNTRY_SOURCE_ID");
    expect(component).toContain('type: "fill"');
    expect(component).toContain('"fill-color"');
    expect(component).toContain('data.countryLayer = "ready"');
    for (const code of ["JP", "KR", "TH", "VN", "ID", "MY", "PH", "SG", "CN", "TW"]) {
      expect(geometry).toContain(`\\"code\\":\\"${code}\\"`);
    }
  });

  it("keeps compact country labels for touch and keyboard access without covering the map", () => {
    expect(component).toContain("new maplibregl.Marker");
    expect(component).toContain("world-weather-marker");
    expect(component).toContain("data-world-weather-map-canvas");
    expect(component).toContain("dataset.countryId");
    expect(styles).toContain("min-width: 1.85rem");
    expect(styles).toContain("height: 1.6rem");
  });

  it("uses explicit desktop and mobile map heights without SVG stretching or clipping hacks", () => {
    expect(styles).toContain("height: clamp(22rem, 44vw, 30rem)");
    expect(styles).toContain("height: 20rem");
    expect(styles).not.toContain("transform: scale(1.12)");
    expect(styles).not.toContain("aspect-ratio: 1200 / 620");
    expect(styles).not.toContain("world-weather-land");
  });
});
