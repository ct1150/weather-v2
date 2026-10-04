import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const planner = readFileSync(new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../discovery/weather-discovery.ts", import.meta.url), "utf8");
const reachability = readFileSync(new URL("../discovery/reachability.ts", import.meta.url), "utf8");
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

describe("advanced least-rain destination discovery contract", () => {
  it("exposes one active least-rain intent and normalizes legacy links", () => {
    expect(engine).toContain('const INTENTS: ReadonlyArray<WeatherDiscoveryIntent> = ["dry"]');
    expect(engine).toContain('intent: "dry"');
    expect(engine).toContain("partyProfile: null");
    expect(engine).toContain("theme: null");
    expect(engine).not.toContain('search.set("party"');
    expect(engine).not.toContain('search.set("theme"');
    expect(planner).toContain('data-discovery-intent="dry"');
    expect(planner).not.toContain("contextualizeDiscoveryResults");
    expect(planner).not.toContain("Travellers");
    expect(planner).not.toContain("Trip style");
  });

  it("keeps the bounded static reachability matrix only in the advanced route", () => {
    expect(reachability).toContain('"sg-singapore" | "hk-hong-kong" | "tw-taipei"');
    expect(reachability).toContain("listReachableDestinations");
    expect(reachability).toContain("rankReachableDiscoveryResults");
    expect(reachability).toContain("Static planning estimates");
    expect(planner).toContain("Starting city");
    expect(planner).toContain("Max one-way planning time");
    expect(planner).toContain("eligibleCities");
    expect(planner).toContain("chunks(eligibleCities, MAX_CITIES_PER_REQUEST)");
    expect(planner).toContain("rankReachableDiscoveryResults");
  });

  it("returns only the Top 3 and preserves four explicit hard limits", () => {
    expect(planner).toContain("const MAX_RESULTS = 3");
    expect(planner).toContain("rankedResults.slice(0, MAX_RESULTS)");
    expect(planner).toContain("rainProbabilityMax");
    expect(planner).toContain("temperatureMinC");
    expect(planner).toContain("temperatureMaxC");
    expect(planner).toContain("windSpeedMaxKph");
    expect(planner).toContain("A destination is excluded when it exceeds any limit");
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

  it("keeps origin, transport, travel time, dates, limits and shortlist shareable", () => {
    expect(engine).toContain("parseDiscoveryPreferences");
    expect(engine).toContain("serializeDiscoveryPreferences");
    expect(reachability).toContain("parseReachabilityPreferences");
    expect(reachability).toContain("serializeReachabilityPreferences");
    expect(planner).toContain('search.set("cities"');
    expect(planner).toContain("window.history.replaceState");
  });

  it("records an explicit destination choice before commercial surfaces", () => {
    expect(planner).toContain('event: "destination_selected"');
    expect(planner).toContain('data-commerce-after-decision="destination-selected"');
    expect(planner).toContain('stage: "discovery_decided"');
    expect(planner).toContain("hasTrip: false");
    expect(planner).not.toContain("buildDiscoveryWorkspace");
  });

  it("keeps localized advanced routes reachable but outside acquisition", () => {
    expect(englishRoute).toContain('locale="en"');
    expect(simplifiedRoute).toContain('locale="zh-cn"');
    expect(traditionalRoute).toContain('locale="zh-hant"');
    for (const route of [englishRoute, simplifiedRoute, traditionalRoute]) {
      expect(route).toContain("robots: { index: false, follow: true }");
    }
    expect(englishRoute).toContain("Advanced least-rain shortlist");
    expect(simplifiedRoute).toContain("高级少雨候选工具");
    expect(traditionalRoute).toContain("進階少雨候選工具");
    expect(planner).toContain("Least-rain destination finder");
    expect(planner).toContain("少雨目的地工具");
    expect(planner).not.toContain("Weather Discovery 2.0");
    expect(planner).not.toContain("Phase 7");
  });
});
