import { describe, expect, it } from "vitest";
import type { TripCityOption, TripForecastDay } from "../trips/workspace";
import {
  assessDiscoveryWeather,
  listDiscoveryIntents,
  parseDiscoveryPreferences,
  rankDiscoveryCities,
  serializeDiscoveryPreferences,
  type DiscoveryPreferences,
} from "./weather-discovery";

const DEFAULT_PREFERENCES: DiscoveryPreferences = {
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

function day(overrides: Partial<TripForecastDay> = {}): TripForecastDay {
  return {
    cityId: "jp-tokyo",
    date: "2026-08-10",
    weatherCode: 1,
    condition: "Mainly clear",
    temperatureMinC: 20,
    temperatureMaxC: 28,
    precipitationMm: 0.5,
    rainProbability: 15,
    windSpeedKph: 14,
    windGustKph: 22,
    uvIndex: 6,
    cloudCover: 20,
    visibilityM: 10_000,
    sunrise: "05:00",
    sunset: "18:30",
    dataQuality: "ok",
    ...overrides,
  };
}

function city(id: string, name: string): TripCityOption {
  return {
    cityId: id,
    countrySlug: "jp",
    citySlug: name.toLowerCase(),
    cityName: name,
    countryName: "Japan",
    latitude: 35,
    longitude: 139,
    timezone: "Asia/Tokyo",
    featured: false,
  };
}

describe("least-rain discovery engine", () => {
  it("exposes one deterministic product intent", () => {
    expect(listDiscoveryIntents()).toEqual(["dry"]);
  });

  it("ranks a dry window above a rainy one", () => {
    const dry = assessDiscoveryWeather([day()], DEFAULT_PREFERENCES);
    const rainy = assessDiscoveryWeather(
      [day({ rainProbability: 85, precipitationMm: 22 })],
      DEFAULT_PREFERENCES,
    );

    expect(dry.score).not.toBeNull();
    expect(rainy.score).not.toBeNull();
    expect(dry.score!).toBeGreaterThan(rainy.score!);
    expect(dry.reasonCodes).toContain("DRY_WINDOW");
    expect(rainy.reasonCodes).toContain("RAIN_RISK");
  });

  it("does not collapse multi-day dry scores when cities share one peak-rain day", () => {
    const cities = [city("jp-tokyo", "Tokyo"), city("jp-osaka", "Osaka")];
    const forecast = [
      day({ cityId: "jp-tokyo", date: "2026-08-10", rainProbability: 100, precipitationMm: 18 }),
      day({ cityId: "jp-tokyo", date: "2026-08-11", rainProbability: 15, precipitationMm: 0.2 }),
      day({ cityId: "jp-tokyo", date: "2026-08-12", rainProbability: 10, precipitationMm: 0.1 }),
      day({ cityId: "jp-osaka", date: "2026-08-10", rainProbability: 100, precipitationMm: 8 }),
      day({ cityId: "jp-osaka", date: "2026-08-11", rainProbability: 85, precipitationMm: 7 }),
      day({ cityId: "jp-osaka", date: "2026-08-12", rainProbability: 80, precipitationMm: 6 }),
    ];

    const results = rankDiscoveryCities(cities, forecast, DEFAULT_PREFERENCES);

    expect(results.map((result) => result.city.cityId)).toEqual(["jp-tokyo", "jp-osaka"]);
    expect(results[0]?.score).not.toBe(results[1]?.score);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? -1);
    expect(results.map((result) => result.score)).not.toEqual([25, 25]);
  });

  it("keeps dry scoring comparable when the same daily weather is repeated", () => {
    const oneDay = assessDiscoveryWeather(
      [day({ rainProbability: 40, precipitationMm: 2 })],
      DEFAULT_PREFERENCES,
    );
    const fourDays = assessDiscoveryWeather(
      [
        day({ date: "2026-08-10", rainProbability: 40, precipitationMm: 2 }),
        day({ date: "2026-08-11", rainProbability: 40, precipitationMm: 2 }),
        day({ date: "2026-08-12", rainProbability: 40, precipitationMm: 2 }),
        day({ date: "2026-08-13", rainProbability: 40, precipitationMm: 2 }),
      ],
      { ...DEFAULT_PREFERENCES, to: "2026-08-13" },
    );

    expect(oneDay.score).toBe(fourDays.score);
  });

  it("applies optional limits as hard filters", () => {
    const tooWet = assessDiscoveryWeather([day({ rainProbability: 55 })], {
      ...DEFAULT_PREFERENCES,
      rainProbabilityMax: 30,
    });
    expect(tooWet.passesConstraints).toBe(false);
    expect(tooWet.reasonCodes).toContain("CUSTOM_CONSTRAINT_MISS");

    const tooHot = assessDiscoveryWeather([day({ temperatureMaxC: 34 })], {
      ...DEFAULT_PREFERENCES,
      temperatureMaxC: 30,
    });
    expect(tooHot.passesConstraints).toBe(false);

    const missingWind = assessDiscoveryWeather([day({ windSpeedKph: null })], {
      ...DEFAULT_PREFERENCES,
      windSpeedMaxKph: 25,
    });
    expect(missingWind.passesConstraints).toBe(false);
  });

  it("returns limited data rather than an optimistic score", () => {
    const result = assessDiscoveryWeather(
      [
        day({
          rainProbability: null,
          precipitationMm: null,
          temperatureMinC: null,
          temperatureMaxC: null,
          windSpeedKph: null,
          uvIndex: null,
        }),
      ],
      DEFAULT_PREFERENCES,
    );
    expect(result.score).toBeNull();
    expect(result.reasonCodes).toEqual(["LIMITED_DATA"]);
  });

  it("ranks cities once from the same filtered result model", () => {
    const cities = [city("jp-tokyo", "Tokyo"), city("jp-osaka", "Osaka")];
    const forecast = [
      day({ cityId: "jp-tokyo", rainProbability: 70, precipitationMm: 12 }),
      day({ cityId: "jp-osaka", rainProbability: 10, precipitationMm: 0.1 }),
    ];
    const results = rankDiscoveryCities(cities, forecast, DEFAULT_PREFERENCES);
    expect(results.map((result) => result.city.cityId)).toEqual(["jp-osaka", "jp-tokyo"]);
  });

  it("round-trips dates and optional limits in dry-only mode", () => {
    const preferences: DiscoveryPreferences = {
      intent: "family_comfort",
      from: "2026-08-11",
      to: "2026-08-14",
      rainProbabilityMax: 35,
      temperatureMinC: 16,
      temperatureMaxC: 29,
      windSpeedMaxKph: 24,
      partyProfile: "family",
      theme: "outdoor",
    };
    const parsed = parseDiscoveryPreferences(serializeDiscoveryPreferences(preferences), {
      from: "2026-01-01",
      to: "2026-01-02",
    });
    expect(parsed).toEqual({
      ...preferences,
      intent: "dry",
      partyProfile: null,
      theme: null,
    });
  });

  it("normalizes legacy intent and context links to dry-only mode", () => {
    const search = new URLSearchParams(
      "intent=beach&party=family&theme=outdoor&from=2026-08-11&to=2026-08-14&rainMax=40",
    );
    expect(parseDiscoveryPreferences(search, { from: "2026-01-01", to: "2026-01-02" })).toEqual({
      ...DEFAULT_PREFERENCES,
      from: "2026-08-11",
      to: "2026-08-14",
      rainProbabilityMax: 40,
    });
  });

  it("rejects invalid query values to safe defaults", () => {
    const search = new URLSearchParams(
      "intent=unsafe&from=not-a-date&to=bad&rainMax=999&party=robot&theme=storm",
    );
    expect(parseDiscoveryPreferences(search, { from: "2026-08-08", to: "2026-08-10" })).toEqual({
      ...DEFAULT_PREFERENCES,
      from: "2026-08-08",
      to: "2026-08-10",
    });
  });
});
