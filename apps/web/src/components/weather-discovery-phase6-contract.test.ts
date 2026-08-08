import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const planner = readFileSync(new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../discovery/weather-discovery.ts", import.meta.url), "utf8");
const context = readFileSync(new URL("../discovery/discovery-context.ts", import.meta.url), "utf8");
const trip = readFileSync(new URL("../discovery/discovery-trip.ts", import.meta.url), "utf8");
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
  it("ships seven deterministic weather intents and context scoring", () => {
    for (const intent of [
      "dry",
      "outdoor",
      "beach",
      "cool_escape",
      "warm_escape",
      "family_comfort",
      "senior_comfort",
    ]) {
      expect(engine).toContain(`\"${intent}\"`);
    }
    expect(context).toContain("partyProfile");
    expect(context).toContain("preferences.theme");
    expect(planner).toContain("contextualizeDiscoveryResults");
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

  it("keeps filters and shortlist shareable through URL state", () => {
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

  it("ships English, Simplified Chinese and Traditional Chinese discovery routes", () => {
    expect(englishRoute).toContain('locale="en"');
    expect(simplifiedRoute).toContain('locale="zh-cn"');
    expect(traditionalRoute).toContain('locale="zh-hant"');
    expect(planner).toContain("Weather Discovery 2.0");
    expect(planner).toContain("天气探索 2.0");
    expect(planner).toContain("天氣探索 2.0");
  });
});
