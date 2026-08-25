import { describe, expect, it } from "vitest";
import { assessRainWindow, RAIN_WINDOW_THRESHOLDS } from "./rain-window-risk";

describe("rain-window travel risk", () => {
  it("keeps a mostly-dry 7-day window green when remaining rain is light", () => {
    expect(
      assessRainWindow({
        dayCount: 7,
        dryDays: 5,
        totalRainMm: 5.6,
        maxDailyRainMm: 3.2,
        maxRainProbability: 70,
      }).risk,
    ).toBe("good");
  });

  it("keeps a mostly-dry window out of green when one day has a meaningful burst", () => {
    expect(
      assessRainWindow({
        dayCount: 7,
        dryDays: 6,
        totalRainMm: 30,
        maxDailyRainMm: 30,
        maxRainProbability: 85,
      }).risk,
    ).toBe("mixed");
  });

  it("classifies a genuine half-dry half-rainy window as mixed", () => {
    expect(
      assessRainWindow({
        dayCount: 7,
        dryDays: 4,
        totalRainMm: 9,
        maxDailyRainMm: 5,
        maxRainProbability: 75,
      }).risk,
    ).toBe("mixed");
  });

  it("classifies scarce dry opportunities as wet", () => {
    expect(
      assessRainWindow({
        dayCount: 7,
        dryDays: 2,
        totalRainMm: 18,
        maxDailyRainMm: 7,
        maxRainProbability: 90,
      }).risk,
    ).toBe("wet");
  });

  it("classifies broadly heavy rain as wet even when some dry days remain", () => {
    expect(
      assessRainWindow({
        dayCount: 7,
        dryDays: 4,
        totalRainMm: 42,
        maxDailyRainMm: 16,
        maxRainProbability: 95,
      }).risk,
    ).toBe("wet");
  });

  it("treats an extreme single-day rainfall event as wet", () => {
    expect(
      assessRainWindow({
        dayCount: 7,
        dryDays: 6,
        totalRainMm: 52,
        maxDailyRainMm: 52,
        maxRainProbability: 95,
      }).risk,
    ).toBe("wet");
  });

  it("returns unknown when the window has no rain signal", () => {
    expect(
      assessRainWindow({
        dayCount: 7,
        dryDays: 0,
        totalRainMm: null,
        maxDailyRainMm: null,
        maxRainProbability: null,
      }).risk,
    ).toBe("unknown");
  });

  it("keeps the approved product thresholds explicit", () => {
    expect(RAIN_WINDOW_THRESHOLDS.goodDryRatio).toBe(0.7);
    expect(RAIN_WINDOW_THRESHOLDS.wetDryRatio).toBe(0.4);
    expect(RAIN_WINDOW_THRESHOLDS.goodAverageRainMm).toBe(1.5);
    expect(RAIN_WINDOW_THRESHOLDS.wetAverageRainMm).toBe(5);
  });
});
