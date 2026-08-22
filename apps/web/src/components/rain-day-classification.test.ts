import { describe, expect, it } from "vitest";
import { isMostlyDryTravelDay } from "./rain-day-classification";

function day(conditionLabel: string, precipitationMm: number | null, rainProbability: number | null) {
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

  it("accepts a genuinely dry low-risk day", () => {
    expect(isMostlyDryTravelDay(day("Clear", 0.5, 30))).toBe(true);
  });

  it("rejects days with too much rain amount or probability", () => {
    expect(isMostlyDryTravelDay(day("Clear", 0.8, 20))).toBe(false);
    expect(isMostlyDryTravelDay(day("Partly cloudy", 0.4, 40))).toBe(false);
  });

  it("requires at least one forecast rain signal", () => {
    expect(isMostlyDryTravelDay(day("Clear", null, null))).toBe(false);
  });
});
