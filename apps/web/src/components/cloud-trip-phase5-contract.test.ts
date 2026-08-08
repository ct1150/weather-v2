import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controls = readFileSync(new URL("./CloudTripControls.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./TripWeatherIntelligencePanel.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../trips/weather-intelligence-client.ts", import.meta.url), "utf8");

describe("Cloud Trip phase 5 UX contract", () => {
  it("integrates weather intelligence into signed-in cloud trips", () => {
    expect(controls).toContain("TripWeatherIntelligencePanel");
    expect(controls).toContain("tripId={metadata.cloudTripId}");
    expect(panel).toContain('data-weather-intelligence="phase-5"');
  });

  it("keeps weather changes decision-first instead of silently rewriting the itinerary", () => {
    expect(panel).toContain("listCloudWeatherInsights");
    expect(panel).toContain("refreshCloudTripWeather");
    expect(panel).toContain("convertCloudWeatherInsightToDecision");
    expect(panel).not.toContain("updateCloudTrip(");
    expect(client).toContain("/weather-insights?limit=50");
    expect(client).toContain("/weather-refresh");
    expect(client).toContain("/decision");
  });

  it("keeps Viewer read only", () => {
    expect(panel).toContain('const writable = accessRole !== "viewer"');
    expect(panel).toContain("if (!writable) return");
  });

  it("ships English, Simplified Chinese and Traditional Chinese weather language", () => {
    expect(panel).toContain('open: "Weather changes"');
    expect(panel).toContain('open: "天气变化"');
    expect(panel).toContain('open: "天氣變化"');
    expect(panel).toContain('createDecision: "Create decision"');
    expect(panel).toContain('createDecision: "形成协作决定"');
    expect(panel).toContain('createDecision: "形成協作決定"');
  });
});
