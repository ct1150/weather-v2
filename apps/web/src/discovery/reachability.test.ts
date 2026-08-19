import { describe, expect, it } from "vitest";
import type { TripCityOption } from "../trips/workspace";
import type { DiscoveryCityResult } from "./weather-discovery";
import {
  DEFAULT_REACHABILITY_PREFERENCES,
  formatTravelMinutes,
  listReachabilityModes,
  listReachabilityOrigins,
  listReachableDestinations,
  parseReachabilityPreferences,
  rankReachableDiscoveryResults,
  serializeReachabilityPreferences,
} from "./reachability";

function city(cityId: string, cityName = cityId): TripCityOption {
  return {
    cityId,
    countrySlug: cityId.slice(0, 2),
    citySlug: cityId,
    cityName,
    countryName: "Country",
    latitude: 0,
    longitude: 0,
    timezone: "UTC",
    featured: false,
  };
}

function result(cityId: string, score = 80, confidence = 1): DiscoveryCityResult {
  return {
    city: city(cityId),
    forecastDays: [],
    score,
    confidence,
    passesConstraints: true,
    reasonCodes: [],
    metrics: {
      days: 1,
      maxRainProbability: 10,
      averageRainProbability: 10,
      totalPrecipitationMm: 0,
      averagePrecipitationMm: 0,
      averageMinC: 20,
      averageMaxC: 28,
      maxWindKph: 10,
      maxGustKph: 15,
      maxUv: 5,
    },
  };
}

const CITIES = [
  city("my-kuala-lumpur", "Kuala Lumpur"),
  city("my-malacca", "Malacca"),
  city("my-penang", "Penang"),
  city("th-bangkok", "Bangkok"),
  city("jp-tokyo", "Tokyo"),
];

describe("static reachability phase 1", () => {
  it("starts with three bounded origin hubs", () => {
    expect(listReachabilityOrigins().map((origin) => origin.id)).toEqual([
      "sg-singapore",
      "hk-hong-kong",
      "tw-taipei",
    ]);
    expect(listReachabilityModes("sg-singapore")).toEqual(["drive", "flight"]);
    expect(listReachabilityModes("hk-hong-kong")).toEqual(["flight"]);
  });

  it("parses and serializes bounded shareable query state", () => {
    const parsed = parseReachabilityPreferences(
      new URLSearchParams("origin=hk-hong-kong&mode=flight&maxTravel=480"),
    );
    expect(parsed).toEqual({ originId: "hk-hong-kong", mode: "flight", maxTravelMinutes: 480 });
    expect(parseReachabilityPreferences(serializeReachabilityPreferences(parsed))).toEqual(parsed);
  });

  it("normalizes unsupported origin, mode and travel limits to safe defaults", () => {
    expect(
      parseReachabilityPreferences(new URLSearchParams("origin=unknown&mode=rail&maxTravel=999")),
    ).toEqual(DEFAULT_REACHABILITY_PREFERENCES);
    expect(
      parseReachabilityPreferences(
        new URLSearchParams("origin=hk-hong-kong&mode=drive&maxTravel=360"),
      ),
    ).toEqual({ originId: "hk-hong-kong", mode: "any", maxTravelMinutes: 360 });
  });

  it("filters destinations before weather ranking", () => {
    const reachable = listReachableDestinations(CITIES, {
      originId: "sg-singapore",
      mode: "drive",
      maxTravelMinutes: 300,
    });
    expect(reachable.map((item) => item.city.cityId)).toEqual(["my-malacca", "my-kuala-lumpur"]);
    expect(reachable.every((item) => item.edge.mode === "drive")).toBe(true);
  });

  it("uses the shortest supported edge when any mode is allowed", () => {
    const reachable = listReachableDestinations(CITIES, {
      originId: "sg-singapore",
      mode: "any",
      maxTravelMinutes: 360,
    });
    const kualaLumpur = reachable.find((item) => item.city.cityId === "my-kuala-lumpur");
    expect(kualaLumpur?.edge).toMatchObject({ mode: "flight", typicalMinutes: 190 });
    expect(reachable.some((item) => item.city.cityId === "jp-tokyo")).toBe(false);
  });

  it("uses travel time only as a tie-break after dry score and confidence", () => {
    const reachable = listReachableDestinations(CITIES, {
      originId: "sg-singapore",
      mode: "flight",
      maxTravelMinutes: 360,
    });
    const ranked = rankReachableDiscoveryResults(
      [result("th-bangkok"), result("my-kuala-lumpur")],
      reachable,
    );
    expect(ranked.map((item) => item.city.cityId)).toEqual(["my-kuala-lumpur", "th-bangkok"]);
    const weatherWinner = rankReachableDiscoveryResults(
      [result("th-bangkok", 95), result("my-kuala-lumpur", 80)],
      reachable,
    );
    expect(weatherWinner[0]?.city.cityId).toBe("th-bangkok");
  });

  it("formats planning times for every active locale", () => {
    expect(formatTravelMinutes(190, "en")).toBe("3h 10m");
    expect(formatTravelMinutes(240, "zh-cn")).toBe("4 小时");
    expect(formatTravelMinutes(270, "zh-hant")).toBe("4 小時 30 分");
  });
});
