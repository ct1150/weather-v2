import { describe, expect, it } from "vitest";

import { createBuildWeatherProvider } from "./bake";

describe("build weather provider selection", () => {
  it("uses deterministic fake weather only in the test environment", () => {
    expect(createBuildWeatherProvider(undefined, "test").id).toBe("fake");
    expect(createBuildWeatherProvider("open-meteo", "test").id).toBe("fake");
  });

  it("defaults every user-facing build to real Open-Meteo weather", () => {
    expect(createBuildWeatherProvider(undefined, "production").id).toBe("open-meteo");
    expect(createBuildWeatherProvider(undefined, "development").id).toBe("open-meteo");
  });

  it("honors an explicit supported provider and rejects unsafe configuration", () => {
    expect(createBuildWeatherProvider("open-meteo", "production").id).toBe("open-meteo");
    expect(createBuildWeatherProvider("fake", "production").id).toBe("fake");
    expect(() => createBuildWeatherProvider("typo", "production")).toThrow(
      /Unknown WEATHER_PRIMARY_PROVIDER/,
    );
    expect(() => createBuildWeatherProvider("weatherapi", "production")).toThrow(/not enabled/);
  });
});
