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

describe("Weather Discovery 2.0 intent engine", () => {
  it("ships seven deterministic travel intents", () => {
    expect(listDiscoveryIntents()).toEqual([
      "dry",
      "outdoor",
      "beach",
      "cool_escape",
      "warm_escape",
      "family_comfort",
      "senior_comfort",
    ]);
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

  it("uses stricter comfort scoring for senior travel", () => {
    const warmWindy = [
      day({ temperatureMinC: 22, temperatureMaxC: 32, windSpeedKph: 28, uvIndex: 9 }),
    ];
    const family = assessDiscoveryWeather(warmWindy, {
      ...DEFAULT_PREFERENCES,
      intent: "family_comfort",
    });
    const senior = assessDiscoveryWeather(warmWindy, {
      ...DEFAULT_PREFERENCES,
      intent: "senior_comfort",
    });

    expect(family.score).not.toBeNull();
    expect(senior.score).not.toBeNull();
    expect(senior.score!).toBeLessThan(family.score!);
  });

  it("fails custom constraints closed when a required metric is missing or exceeded", () => {
    const tooWet = assessDiscoveryWeather([day({ rainProbability: 55 })], {
      ...DEFAULT_PREFERENCES,
      rainProbabilityMax: 30,
    });
    expect(tooWet.passesConstraints).toBe(false);
    expect(tooWet.reasonCodes).toContain("CUSTOM_CONSTRAINT_MISS");

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

  it("round-trips shareable discovery preferences", () => {
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
    const serialized = serializeDiscoveryPreferences(preferences);
    expect(parseDiscoveryPreferences(serialized, { from: "2026-01-01", to: "2026-01-02" })).toEqual(
      preferences,
    );
  });

  it("rejects invalid query values to safe defaults", () => {
    const search = new URLSearchParams(
      "intent=unsafe&from=not-a-date&to=bad&rainMax=999&party=robot&theme=storm",
    );
    expect(
      parseDiscoveryPreferences(search, { from: "2026-08-08", to: "2026-08-10" }),
    ).toEqual({
      ...DEFAULT_PREFERENCES,
      from: "2026-08-08",
      to: "2026-08-10",
    });
  });
});
