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

  it("colors real supported-country polygons and gives each feature a stable id", () => {
    expect(component).toContain("SUPPORTED_COUNTRY_GEOMETRY");
    expect(component).toContain("map.addSource(COUNTRY_SOURCE_ID");
    expect(component).toContain("id: feature.properties.code");
    expect(component).toContain('type: "fill"');
    expect(component).toContain('"fill-color"');
    expect(component).toContain('dataset.countryLayer = "ready"');
    for (const code of ["JP", "KR", "TH", "VN", "ID", "MY", "PH", "SG", "CN", "TW"]) {
      expect(geometry).toContain(`properties: { code: "${code}" }`);
    }
  });

  it("uses feature-state hover/tap focus instead of permanent ISO labels", () => {
    expect(component).toContain("setFeatureState");
    expect(component).toContain('"feature-state", "focused"');
    expect(component).toContain('"feature-state", "dimmed"');
    expect(component).toContain("COUNTRY_HALO_LAYER_ID");
    expect(component).toContain("dataset.interactionMode = compactInteraction");
    expect(component).toContain("dataset.highlightedCountry = code");
    expect(component).not.toContain("world-weather-marker");
    expect(styles).not.toContain(".world-weather-marker");
  });

  it("keeps only an enlarged Singapore hotspot and explicit overview CTA", () => {
    expect(component).toContain('item.code === "SG"');
    expect(component).toContain("world-weather-hotspot");
    expect(component).toContain("data-world-weather-overview");
    expect(component).toContain("data-world-weather-overview-link");
    expect(styles).toContain(".world-weather-hotspot");
    expect(styles).toContain("width: 2.2rem");
  });

  it("uses desktop hover guidance and mobile tap-preview guidance", () => {
    expect(component).toContain("desktopHint");
    expect(component).toContain("mobileHint");
    expect(component).toContain('"tap-preview"');
    expect(component).toContain('"hover-open"');
    expect(styles).toContain(".world-weather-hint-mobile");
    expect(styles).toContain(".world-weather-hint-desktop");
  });

  it("uses explicit desktop and mobile map heights without SVG stretching or clipping hacks", () => {
    expect(styles).toContain("height: clamp(22rem, 44vw, 30rem)");
    expect(styles).toContain("height: 20rem");
    expect(styles).not.toContain("aspect-ratio: 1200 / 620");
    expect(styles).not.toContain("world-weather-land");
    expect(styles).not.toContain(".world-weather-map-canvas {\n  transform:");
  });
});
