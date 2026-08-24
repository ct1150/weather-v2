import { describe, expect, it } from "vitest";
import { isMostlyDryTravelDay } from "./rain-day-classification";

function day(
  conditionLabel: string,
  precipitationMm: number | null,
  rainProbability: number | null,
) {
  return {
    weather: {
      conditionLabel,
      precipitationMm,
      rainProbability,
    },
  };
}

describe("mostly-dry travel day classification", () => {
  it("does not call drizzle dry even when the amount is tiny", () => {
    expect(isMostlyDryTravelDay(day("Light drizzle", 0.2, 20))).toBe(false);
    expect(isMostlyDryTravelDay(day("Drizzle", 0.1, 15))).toBe(false);
  });

  it("accepts a dry daily condition when expected precipitation is tiny", () => {
    expect(isMostlyDryTravelDay(day("Clear", 0.5, 30))).toBe(true);
    expect(isMostlyDryTravelDay(day("Clear", 0.2, 55))).toBe(true);
    expect(isMostlyDryTravelDay(day("Partly cloudy", 0.4, 60))).toBe(true);
  });

  it("rejects a dry-looking day when the expected precipitation amount is too high", () => {
    expect(isMostlyDryTravelDay(day("Clear", 0.8, 20))).toBe(false);
    expect(isMostlyDryTravelDay(day("Partly cloudy", 1.2, 25))).toBe(false);
  });

  it("uses rain probability only when precipitation amount is unavailable", () => {
    expect(isMostlyDryTravelDay(day("Clear", null, 35))).toBe(true);
    expect(isMostlyDryTravelDay(day("Clear", null, 55))).toBe(false);
  });

  it("does not classify unknown conditions as rain-free", () => {
    expect(isMostlyDryTravelDay(day("Weather unavailable", 0, 10))).toBe(false);
    expect(isMostlyDryTravelDay(day("Variable weather", 0.2, 20))).toBe(false);
  });

  it("requires at least one forecast rain signal", () => {
    expect(isMostlyDryTravelDay(day("Clear", null, null))).toBe(false);
  });
});
