import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

describe("Phase 9 commercial surface separation contract", () => {
  it("places Discovery commerce only after a single-destination trip decision", () => {
    const discovery = source("components/WeatherDiscoveryPlannerV2.tsx");
    expect(discovery).toContain(
      'import { ContextualAffiliateSurface } from "./ContextualAffiliateSurface";',
    );
    expect(discovery).toContain(
      "tripReady && selectedResults.length === 1 && selectedResults[0] !== undefined",
    );
    expect(discovery).toContain('stage: "discovery_decided"');
    expect(discovery).toContain('data-commerce-after-decision="discovery-trip-created"');

    const tripSection = discovery.indexOf('aria-labelledby="discovery-trip"');
    const commerce = discovery.indexOf('data-commerce-after-decision="discovery-trip-created"');
    expect(tripSection).toBeGreaterThanOrEqual(0);
    expect(commerce).toBeGreaterThan(tripSection);
  });

  it("places weather-replan commerce only behind an actual replacement proposal", () => {
    const replan = source("components/TripReplanPanel.tsx");
    expect(replan).toContain('change.kind === "replace_activity"');
    expect(replan).toContain('stage: "weather_replan"');
    expect(replan).toContain('weatherAction: "indoor_fallback"');
    expect(replan).toContain('data-commerce-after-decision="weather-indoor-fallback"');
  });

  it("keeps commercial dependencies out of weather/discovery/risk/replan algorithms", () => {
    for (const file of [
      "discovery/weather-discovery.ts",
      "trips/activity-risk.ts",
      "trips/replan-solver.ts",
    ]) {
      const text = source(file);
      expect(text).not.toContain("ContextualAffiliateSurface");
      expect(text).not.toContain("resolveContextualAffiliateSurface");
      expect(text).not.toContain("contextual-conversion");
      expect(text).not.toContain("affiliate-adapter");
    }
  });

  it("keeps the UI zero-fill by default when deployment commercial config is absent", () => {
    const surface = source("components/ContextualAffiliateSurface.tsx");
    expect(surface).toContain('process.env.NEXT_PUBLIC_AFFILIATE_OFFERS_JSON ?? ""');
    expect(surface).toContain('process.env.NEXT_PUBLIC_AFFILIATE_SLOTS ?? ""');
    expect(surface).toContain("if (items.length === 0) return null;");
  });
});
