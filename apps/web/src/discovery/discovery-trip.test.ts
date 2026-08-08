import { describe, expect, it } from "vitest";
import type { TripCityOption } from "../trips/workspace";
import {
  allocateDiscoveryDates,
  buildDiscoveryWorkspace,
  discoveryDateRange,
} from "./discovery-trip";

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

describe("Weather Discovery multi-city trip", () => {
  it("builds a bounded inclusive date range", () => {
    expect(discoveryDateRange("2026-08-10", "2026-08-12")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
    expect(discoveryDateRange("2026-08-12", "2026-08-10")).toEqual([]);
    expect(discoveryDateRange("2026-08-01", "2026-08-20")).toEqual([]);
  });

  it("allocates contiguous dates evenly across shortlisted cities", () => {
    const cities = [
      city("jp-tokyo", "Tokyo"),
      city("jp-kyoto", "Kyoto"),
      city("jp-osaka", "Osaka"),
    ];
    const dates = discoveryDateRange("2026-08-10", "2026-08-16");
    const allocations = allocateDiscoveryDates(cities, dates);
    expect(allocations.map((item) => item.dates)).toEqual([
      ["2026-08-10", "2026-08-11", "2026-08-12"],
      ["2026-08-13", "2026-08-14"],
      ["2026-08-15", "2026-08-16"],
    ]);
  });

  it("requires at least one date per selected city", () => {
    const cities = [
      city("jp-tokyo", "Tokyo"),
      city("jp-kyoto", "Kyoto"),
      city("jp-osaka", "Osaka"),
    ];
    expect(allocateDiscoveryDates(cities, ["2026-08-10", "2026-08-11"])).toEqual([]);
  });

  it("creates a chronological new workspace without POI generation", () => {
    const cities = [city("jp-tokyo", "Tokyo"), city("jp-kyoto", "Kyoto")];
    const allocations = allocateDiscoveryDates(
      cities,
      discoveryDateRange("2026-08-10", "2026-08-13"),
    );
    const workspace = buildDiscoveryWorkspace(null, allocations, {
      append: false,
      title: "Weather shortlist trip",
      now: "2026-08-08T00:00:00.000Z",
    });
    expect(workspace?.title).toBe("Weather shortlist trip");
    expect(workspace?.days.map((day) => [day.date, day.cityId])).toEqual([
      ["2026-08-10", "jp-tokyo"],
      ["2026-08-11", "jp-tokyo"],
      ["2026-08-12", "jp-kyoto"],
      ["2026-08-13", "jp-kyoto"],
    ]);
    expect(workspace?.days.every((day) => day.activities.length === 0)).toBe(true);
  });
});
