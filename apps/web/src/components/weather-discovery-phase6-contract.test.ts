import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const planner = readFileSync(new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../discovery/weather-discovery.ts", import.meta.url), "utf8");
const trip = readFileSync(new URL("../discovery/discovery-trip.ts", import.meta.url), "utf8");
const focusCss = readFileSync(new URL("../app/discovery-focus.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const englishRoute = readFileSync(new URL("../app/discover/page.tsx", import.meta.url), "utf8");
const simplifiedRoute = readFileSync(
  new URL("../app/zh-cn/discover/page.tsx", import.meta.url),
  "utf8",
);
const traditionalRoute = readFileSync(
  new URL("../app/zh-hant/discover/page.tsx", import.meta.url),
  "utf8",
);

describe("Weather Discovery Phase 6 contract", () => {
  it("exposes one active least-rain intent and normalizes legacy links", () => {
    expect(engine).toContain('const INTENTS: ReadonlyArray<WeatherDiscoveryIntent> = ["dry"]');
    expect(engine).toContain('intent: "dry"');
    expect(engine).toContain("partyProfile: null");
    expect(engine).toContain("theme: null");
    expect(engine).toContain('intent: "dry",\n    from: preferences.from');
    expect(engine).not.toContain('search.set("party"');
    expect(engine).not.toContain('search.set("theme"');
    expect(planner).toContain("listDiscoveryIntents().map");
  });

  it("removes trip-context dropdowns from the active UI while preserving optional limits", () => {
    expect(layout).toContain('import "./discovery-focus.css"');
    expect(focusCss).toContain("details > .mt-4.grid.gap-6 > :first-child");
    expect(focusCss).toContain("display: none");
    expect(planner).toContain("rainProbabilityMax");
    expect(planner).toContain("temperatureMinC");
    expect(planner).toContain("temperatureMaxC");
    expect(planner).toContain("windSpeedMaxKph");
    expect(planner).toContain("copy.constraints");
  });

  it("keeps forecast reads bounded and provider-isolated", () => {
    expect(planner).toContain("MAX_CITIES_PER_REQUEST = 12");
    expect(planner).toContain("/api/v1/trip-cities");
    expect(planner).toContain("/api/v1/trip-forecast");
    expect(planner).toContain("FORECAST_SNAPSHOT_CHANGED");
    expect(planner).not.toContain("open-meteo.com");
    expect(planner).not.toContain("api.open-meteo.com");
    expect(trip).toContain("dates.length < 16");
  });

  it("uses one ranked result model for cards, shortlist and map", () => {
    expect(planner).toContain("const results = useMemo");
    expect(planner).toContain("results.map((result)");
    expect(planner).toContain("const markers = useMemo");
    expect(planner).toContain("MAX_SHORTLIST = 4");
    expect(planner).toContain("selectedResults");
  });

  it("keeps dates, optional limits and shortlist shareable through URL state", () => {
    expect(engine).toContain("parseDiscoveryPreferences");
    expect(engine).toContain("serializeDiscoveryPreferences");
    expect(planner).toContain('search.set("cities"');
    expect(planner).toContain("window.history.replaceState");
  });

  it("creates multi-city trip scaffolding without generating POIs", () => {
    expect(trip).toContain("allocateDiscoveryDates");
    expect(trip).toContain("addDestinationRangeToWorkspace");
    expect(planner).toContain("buildDiscoveryWorkspace");
    expect(planner).toContain("clearCloudMetadata");
    expect(trip).not.toContain("poi");
  });

  it("ships localized discovery routes with user-facing product language", () => {
    expect(englishRoute).toContain('locale="en"');
    expect(simplifiedRoute).toContain('locale="zh-cn"');
    expect(traditionalRoute).toContain('locale="zh-hant"');
    expect(planner).toContain("Find the right destination");
    expect(planner).toContain("按天气找目的地");
    expect(planner).toContain("按天氣找目的地");
    expect(planner).not.toContain("Weather Discovery 2.0");
    expect(planner).not.toContain("天气探索 2.0");
    expect(planner).not.toContain("天氣探索 2.0");
  });
});
