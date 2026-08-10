import { describe, expect, it } from "vitest";
import type { TripCityOption } from "../trips/workspace";
import {
  DISCOVERY_MATCH_SCORE_MIN,
  contextualizeDiscoveryResult,
  contextualizeDiscoveryResults,
} from "./discovery-context";
import type { DiscoveryCityResult, DiscoveryPreferences } from "./weather-discovery";

const city: TripCityOption = {
  cityId: "jp-tokyo",
  countrySlug: "jp",
  citySlug: "tokyo",
  cityName: "Tokyo",
  countryName: "Japan",
  latitude: 35.6,
  longitude: 139.6,
  timezone: "Asia/Tokyo",
  featured: true,
};

function result(overrides: Partial<DiscoveryCityResult> = {}): DiscoveryCityResult {
  return {
    city,
    forecastDays: [],
    score: 88,
    confidence: 1,
    passesConstraints: true,
    reasonCodes: [],
    metrics: {
      days: 3,
      maxRainProbability: 30,
      averageRainProbability: 18,
      totalPrecipitationMm: 2,
      averagePrecipitationMm: 0.7,
      averageMinC: 20,
      averageMaxC: 29,
      maxWindKph: 18,
      maxGustKph: 28,
      maxUv: 7,
    },
    ...overrides,
  };
}

const base: DiscoveryPreferences = {
  intent: "dry",
  from: "2026-08-10",
  to: "2026-08-12",
  rainProbabilityMax: null,
  temperatureMinC: null,
  temperatureMaxC: null,
  windSpeedMaxKph: null,
  partyProfile: null,
  theme: null,
};

describe("discovery party/theme context", () => {
  it("penalizes heat and wind more for seniors", () => {
    const hotWindy = result({
      metrics: {
        ...result().metrics,
        averageMaxC: 34,
        maxWindKph: 32,
        maxUv: 10,
      },
    });
    const adults = contextualizeDiscoveryResult(hotWindy, base);
    const seniors = contextualizeDiscoveryResult(hotWindy, { ...base, partyProfile: "senior" });
    expect(seniors.score!).toBeLessThan(adults.score!);
  });

  it("rewards a suitable beach profile with an explainable reason", () => {
    const beach = contextualizeDiscoveryResult(result(), { ...base, theme: "beach" });
    expect(beach.reasonCodes).toContain("BEACH_READY");
  });

  it("makes indoor context materially different from the weather-exposed baseline", () => {
    const rainy = result({ score: 45 });
    const baseline = contextualizeDiscoveryResult(rainy, base);
    const indoor = contextualizeDiscoveryResult(rainy, { ...base, theme: "indoor" });
    expect(indoor.score!).toBeGreaterThan(baseline.score!);
  });

  it("re-sorts the shared result model after context is applied", () => {
    const safe = result();
    const windy = result({
      city: { ...city, cityId: "jp-osaka", cityName: "Osaka", citySlug: "osaka" },
      score: 92,
      metrics: { ...result().metrics, maxWindKph: 45 },
    });
    const ranked = contextualizeDiscoveryResults([windy, safe], { ...base, theme: "beach" });
    expect(ranked[0]?.city.cityId).toBe("jp-tokyo");
  });

  it("hides cities that do not meaningfully match the selected weather preference", () => {
    const good = result({ score: DISCOVERY_MATCH_SCORE_MIN + 10 });
    const poor = result({
      city: { ...city, cityId: "jp-osaka", cityName: "Osaka", citySlug: "osaka" },
      score: DISCOVERY_MATCH_SCORE_MIN - 1,
    });
    const ranked = contextualizeDiscoveryResults([poor, good], base);
    expect(ranked.map((item) => item.city.cityId)).toEqual(["jp-tokyo"]);
  });
});
