// @wnr/domain — WMO weather-code mapping (T05).
import { describe, it, expect } from "vitest";
import { describeWeatherCode, OPEN_METEO_WMO, FALLBACK_WEATHER_CODE } from "./weather-code.js";

describe("describeWeatherCode — full Open-Meteo WMO set", () => {
  it("maps the clear / cloudy baseline (0..3)", () => {
    expect(describeWeatherCode(0).label).toBe("Clear");
    expect(describeWeatherCode(1).label).toBe("Mainly clear");
    expect(describeWeatherCode(2).label).toBe("Partly cloudy");
    expect(describeWeatherCode(3).label).toBe("Overcast");
  });

  it("maps fog codes (45, 48)", () => {
    expect(describeWeatherCode(45).label).toBe("Fog");
    expect(describeWeatherCode(48).label).toBe("Rime fog");
  });

  it("maps drizzle codes (51, 53, 55, 56, 57)", () => {
    expect(describeWeatherCode(51).label).toBe("Light drizzle");
    expect(describeWeatherCode(53).label).toBe("Drizzle");
    expect(describeWeatherCode(55).label).toBe("Dense drizzle");
    expect(describeWeatherCode(56).label).toBe("Light freezing drizzle");
    expect(describeWeatherCode(57).label).toBe("Dense freezing drizzle");
  });

  it("maps rain codes (61, 63, 65, 66, 67)", () => {
    expect(describeWeatherCode(61).label).toBe("Light rain");
    expect(describeWeatherCode(63).label).toBe("Rain");
    expect(describeWeatherCode(65).label).toBe("Heavy rain");
    expect(describeWeatherCode(66).label).toBe("Light freezing rain");
    expect(describeWeatherCode(67).label).toBe("Heavy freezing rain");
  });

  it("maps snow codes (71, 73, 75, 77)", () => {
    expect(describeWeatherCode(71).label).toBe("Light snow");
    expect(describeWeatherCode(73).label).toBe("Snow");
    expect(describeWeatherCode(75).label).toBe("Heavy snow");
    expect(describeWeatherCode(77).label).toBe("Snow grains");
  });

  it("maps shower codes (80, 81, 82, 85, 86)", () => {
    expect(describeWeatherCode(80).label).toBe("Rain showers");
    expect(describeWeatherCode(81).label).toBe("Moderate rain showers");
    expect(describeWeatherCode(82).label).toBe("Violent rain showers");
    expect(describeWeatherCode(85).label).toBe("Light snow showers");
    expect(describeWeatherCode(86).label).toBe("Heavy snow showers");
  });

  it("maps thunderstorm codes (95, 96, 99)", () => {
    expect(describeWeatherCode(95).label).toBe("Thunderstorm");
    expect(describeWeatherCode(96).label).toBe("Thunderstorm with hail");
    expect(describeWeatherCode(99).label).toBe("Thunderstorm with hail");
  });

  it("assigns a semantic icon to each entry", () => {
    expect(describeWeatherCode(0).icon).toBe("sunny");
    expect(describeWeatherCode(3).icon).toBe("cloudy");
    expect(describeWeatherCode(63).icon).toBe("rain");
    expect(describeWeatherCode(95).icon).toBe("thunderstorm");
  });

  it("degrades unknown and null codes to the Clear fallback", () => {
    expect(describeWeatherCode(null).label).toBe("Clear");
    expect(describeWeatherCode(undefined).label).toBe("Clear");
    expect(describeWeatherCode(123).label).toBe(FALLBACK_WEATHER_CODE.label);
    expect(describeWeatherCode(-1).label).toBe("Clear");
  });

  it("covers the full documented WMO code set", () => {
    const expected = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85,
      86, 95, 96, 99,
    ];
    for (const code of expected) {
      expect(OPEN_METEO_WMO[code], `missing mapping for ${code}`).toBeDefined();
      expect(OPEN_METEO_WMO[code]?.label.length).toBeGreaterThan(0);
    }
    expect(Object.keys(OPEN_METEO_WMO)).toHaveLength(expected.length);
  });
});
