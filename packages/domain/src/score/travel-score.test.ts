import { describe, it, expect } from "vitest";
import {
  rainFactor,
  temperatureFactor,
  comfortFactor,
  humidityFactor,
  windSpeedFactor,
  windGustFactor,
  windFactor,
  uvFactor,
  cloudFactor,
  visibilityFactor,
  calculateTravelScore,
  type WeatherRow,
} from "./travel-score.js";

// General-model weights mirrored for the independent weighted-mean cross-check.
const W = {
  rain: 0.3,
  temperature: 0.2,
  comfort: 0.15,
  humidity: 0.1,
  wind: 0.1,
  uv: 0.075,
  cloud: 0.075,
};

function weightedMean(row: WeatherRow): { base: number; confidence: number } {
  const named: Record<string, number | null> = {
    rain: rainFactor(row.precipitationProbability, row.precipitationMm),
    temperature: temperatureFactor(row.temperatureC),
    comfort: comfortFactor(row.apparentTemperatureC),
    humidity: humidityFactor(row.humidity),
    wind: windFactor(row.windSpeedKph, row.windGustKph),
    uv: uvFactor(row.uvIndex),
    cloud: cloudFactor(row.cloudCover),
  };
  let weightSum = 0;
  let acc = 0;
  for (const key of Object.keys(named) as ReadonlyArray<string>) {
    const v = named[key];
    if (v != null) {
      weightSum += W[key as keyof typeof W];
      acc += v * W[key as keyof typeof W];
    }
  }
  return { base: weightSum > 0 ? acc / weightSum : 0, confidence: weightSum };
}

describe("Travel Score factors — exact normalization segments", () => {
  it("temperatureFactor hits every endpoint and neighbor", () => {
    expect(temperatureFactor(-1)).toBe(0);
    expect(temperatureFactor(0)).toBe(0);
    expect(temperatureFactor(5)).toBeCloseTo(25, 6);
    expect(temperatureFactor(10)).toBe(50);
    expect(temperatureFactor(14)).toBeCloseTo(75, 6);
    expect(temperatureFactor(18)).toBe(100);
    expect(temperatureFactor(22)).toBe(100);
    expect(temperatureFactor(26)).toBe(100);
    expect(temperatureFactor(29)).toBeCloseTo(80, 6);
    expect(temperatureFactor(32)).toBe(60);
    expect(temperatureFactor(36)).toBeCloseTo(30, 6);
    expect(temperatureFactor(40)).toBe(0);
    expect(temperatureFactor(50)).toBe(0);
  });

  it("humidityFactor hits every endpoint and neighbor", () => {
    expect(humidityFactor(10)).toBe(0);
    expect(humidityFactor(20)).toBe(0);
    expect(humidityFactor(25)).toBeCloseTo(50, 6);
    expect(humidityFactor(30)).toBe(100);
    expect(humidityFactor(45)).toBe(100);
    expect(humidityFactor(60)).toBe(100);
    expect(humidityFactor(70)).toBeCloseTo(70, 6);
    expect(humidityFactor(80)).toBe(40);
    expect(humidityFactor(90)).toBeCloseTo(20, 6);
    expect(humidityFactor(100)).toBe(0);
  });

  it("rainFactor combines probability and amount, and is missing on invalid inputs", () => {
    expect(rainFactor(0, 0)).toBe(100);
    expect(rainFactor(50, 5)).toBe(50); // min(50, 65)
    expect(rainFactor(100, 0)).toBe(0);
    expect(rainFactor(10, 50)).toBe(0); // amount past 30 -> 0
    expect(rainFactor(50, -1)).toBeNull();
    expect(rainFactor(120, 0)).toBeNull();
    expect(rainFactor(null, 0)).toBeNull();
  });

  it("windFactor is the min of speed and gust factors", () => {
    expect(windSpeedFactor(5)).toBe(100);
    expect(windSpeedFactor(25)).toBe(60);
    expect(windSpeedFactor(40)).toBe(0);
    expect(windGustFactor(20)).toBe(100);
    expect(windGustFactor(35)).toBeCloseTo(50, 6);
    expect(windGustFactor(50)).toBe(0);
    expect(windFactor(10, 20)).toBe(100);
    expect(windFactor(30, 30)).toBeCloseTo(40, 6);
    expect(windFactor(null, 20)).toBeNull();
  });

  it("uvFactor, cloudFactor, and visibilityFactor hit endpoints", () => {
    expect(uvFactor(2)).toBe(100);
    expect(uvFactor(5)).toBe(80);
    expect(uvFactor(8)).toBe(40);
    expect(uvFactor(11)).toBe(0);
    expect(cloudFactor(20)).toBe(100);
    expect(cloudFactor(60)).toBe(60);
    expect(cloudFactor(100)).toBe(0);
    expect(visibilityFactor(1000)).toBe(0);
    expect(visibilityFactor(5000)).toBe(50);
    expect(visibilityFactor(10000)).toBe(100);
  });
});

describe("calculateTravelScore — deterministic weighted mean kernel", () => {
  const fullRow: WeatherRow = {
    precipitationProbability: 10,
    precipitationMm: 0,
    temperatureC: 22,
    apparentTemperatureC: 21,
    humidity: 55,
    windSpeedKph: 8,
    windGustKph: 15,
    uvIndex: 3,
    cloudCover: 40,
    visibilityM: 20000,
  };

  it("complete-factor result equals the exact weighted mean and is an integer 0..100", () => {
    const result = calculateTravelScore({ row: fullRow, modelVersion: "mv1" });
    const { base } = weightedMean(fullRow);
    expect(result.confidence).toBeCloseTo(1, 6);
    expect(result.hidden).toBe(false);
    expect(result.score).toBe(Math.round(base));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(result.score)).toBe(true);
  });

  it("is deterministic for identical inputs and model version", () => {
    const a = calculateTravelScore({ row: fullRow, modelVersion: "mv1" });
    const b = calculateTravelScore({ row: fullRow, modelVersion: "mv1" });
    expect(a.score).toBe(b.score);
    expect(a.reasonCodes).toEqual(b.reasonCodes);
    expect(a.modelVersion).toBe("mv1");
  });

  it("a subset of available factors yields the proportional weighted mean and confidence", () => {
    // rain + temperature + comfort + humidity => confidence 0.75 (above the 0.7 gate).
    const partial: WeatherRow = {
      precipitationProbability: 10,
      precipitationMm: 0,
      temperatureC: 22,
      apparentTemperatureC: 21,
      humidity: 55,
    };
    const result = calculateTravelScore({ row: partial, modelVersion: "mv1" });
    const { base, confidence } = weightedMean(partial);
    expect(confidence).toBeCloseTo(W.rain + W.temperature + W.comfort + W.humidity, 6);
    expect(result.hidden).toBe(false);
    expect(result.score).toBe(Math.round(base));
  });

  it("never substitutes a missing factor with the best value (confidence falls)", () => {
    const noRain: WeatherRow = { temperatureC: 22, apparentTemperatureC: 21, humidity: 55, windSpeedKph: 8, windGustKph: 15, uvIndex: 3, cloudCover: 40 };
    const all: WeatherRow = { ...noRain, precipitationProbability: 0, precipitationMm: 0 };
    const rNoRain = calculateTravelScore({ row: noRain, modelVersion: "mv1" });
    const rAll = calculateTravelScore({ row: all, modelVersion: "mv1" });
    // Without rain, the weighted mean excludes the rain weight, so the result differs and confidence is lower.
    expect(rNoRain.confidence).toBeLessThan(rAll.confidence);
  });

  it("confidence below 0.7 hides the score with LIMITED_DATA", () => {
    const sparse: WeatherRow = { precipitationProbability: 10, precipitationMm: 0 };
    const result = calculateTravelScore({ row: sparse, modelVersion: "mv1" });
    expect(result.confidence).toBeCloseTo(W.rain, 6);
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.hidden).toBe(true);
    expect(result.score).toBeNull();
    expect(result.reasonCodes).toContain("LIMITED_DATA");
  });

  it("an empty row produces no score and LIMITED_DATA", () => {
    const result = calculateTravelScore({ row: {}, modelVersion: "mv1" });
    expect(result.score).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.hidden).toBe(true);
    expect(result.reasonCodes).toEqual(["LIMITED_DATA"]);
  });

  it("emits stable reason codes for clear vs hazardous conditions", () => {
    const clear: WeatherRow = {
      precipitationProbability: 5,
      precipitationMm: 0,
      temperatureC: 24,
      apparentTemperatureC: 23,
      humidity: 50,
      windSpeedKph: 6,
      windGustKph: 12,
      uvIndex: 1,
      cloudCover: 30,
    };
    const codes = calculateTravelScore({ row: clear, modelVersion: "mv1" }).reasonCodes;
    expect(codes).toContain("LOW_RAIN_CHANCE");
    expect(codes).toContain("COMFORTABLE_TEMPERATURE");
    expect(codes).toContain("CALM_WIND");

    const heavy: WeatherRow = {
      precipitationProbability: 95,
      precipitationMm: 40,
      temperatureC: 24,
      apparentTemperatureC: 23,
      humidity: 50,
      windSpeedKph: 6,
      windGustKph: 12,
      uvIndex: 9,
      cloudCover: 30,
    };
    const heavyCodes = calculateTravelScore({ row: heavy, modelVersion: "mv1" }).reasonCodes;
    expect(heavyCodes).toContain("HEAVY_RAIN_RISK");
    expect(heavyCodes).toContain("HIGH_UV_CAUTION");
  });

  it("applies the hazard penalty when provided (forward-compatible, MVP default 0)", () => {
    const result = calculateTravelScore({ row: fullRow, modelVersion: "mv1", hazardPenalty: 20 });
    const expected = Math.round(weightedMean(fullRow).base) - 20;
    expect(result.score).toBe(Math.max(0, expected));
  });
});
