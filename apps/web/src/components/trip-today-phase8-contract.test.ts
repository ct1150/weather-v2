import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

describe("Phase 8 Today Mode contract", () => {
  it("resolves the active day from destination timezone and structured activities", () => {
    const resolver = source("../trips/today-mode.ts");
    const panel = source("./TripTodayPanel.tsx");
    expect(resolver).toContain("Intl.DateTimeFormat");
    expect(resolver).toContain("timeZone: timezone");
    expect(resolver).toContain("resolveActiveTripDay");
    expect(resolver).toContain("nextExecutableActivity");
    expect(panel).toContain('data-trip-today="phase8"');
  });

  it("uses real hourly data and only emits weather-supported guidance", () => {
    const panel = source("./TripTodayPanel.tsx");
    expect(panel).toContain("/api/v1/trip-hourly");
    expect(panel).toContain("assessActivityHourlyRisk");
    expect(panel).toContain('data-today-guidance="weather-supported"');
    expect(panel).toContain("hourlyAvailable");
  });

  it("surfaces fixed execution items, open insights and accepted replan audit", () => {
    const panel = source("./TripTodayPanel.tsx");
    expect(panel).toContain("fixedExecutionActivities");
    expect(panel).toContain("listCloudWeatherInsights");
    expect(panel).toContain("listCloudTripActivity");
    expect(panel).toContain('item.payload.operation === "replan"');
  });

  it("ships execution copy in all three product languages", () => {
    const panel = source("./TripTodayPanel.tsx");
    expect(panel).toContain("Today / execution mode");
    expect(panel).toContain("今天 / 执行模式");
    expect(panel).toContain("今天 / 執行模式");
  });
});
