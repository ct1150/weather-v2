import { describe, expect, it } from "vitest";
import {
  PILOT_POI_CITY_IDS,
  findCuratedPoi,
  findWeatherFallbacks,
  listCuratedPois,
  poiName,
} from "./poi-catalog";

describe("Phase 7 curated POI catalogue", () => {
  it("covers all seven pilot cities with a meaningful curated base", () => {
    expect(PILOT_POI_CITY_IDS).toHaveLength(7);
    for (const cityId of PILOT_POI_CITY_IDS) {
      const items = listCuratedPois(cityId);
      expect(items.length, cityId).toBeGreaterThanOrEqual(50);
      expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
      expect(items.every((item) => item.cityId === cityId)).toBe(true);
    }
  });

  it("keeps required structured weather attributes on every POI", () => {
    for (const cityId of PILOT_POI_CITY_IDS) {
      for (const item of listCuratedPois(cityId)) {
        expect(item.latitude).toBeGreaterThanOrEqual(-90);
        expect(item.latitude).toBeLessThanOrEqual(90);
        expect(item.longitude).toBeGreaterThanOrEqual(-180);
        expect(item.longitude).toBeLessThanOrEqual(180);
        expect(item.typicalDurationMinutes).toBeGreaterThan(0);
        expect(["curated-v1", "openstreetmap-v1"]).toContain(item.provenance);
        expect(item.name.en.length).toBeGreaterThan(0);
        expect(item.name["zh-cn"].length).toBeGreaterThan(0);
        expect(item.name["zh-hant"].length).toBeGreaterThan(0);
      }
    }
  });

  it("returns indoor fallback candidates without returning the affected POI", () => {
    const fallback = findWeatherFallbacks("jp-kyoto", "jp-kyoto-arashiyama", 3);
    expect(fallback).toHaveLength(3);
    expect(fallback.every((item) => item.environment === "indoor")).toBe(true);
    expect(fallback.map((item) => item.id)).not.toContain("jp-kyoto-arashiyama");
  });

  it("supports stable lookup and three-language names", () => {
    const item = findCuratedPoi("jp-tokyo-national-museum");
    expect(item).not.toBeNull();
    expect(poiName(item!, "en")).toBe("Tokyo National Museum");
    expect(poiName(item!, "zh-cn")).toBe("东京国立博物馆");
    expect(poiName(item!, "zh-hant")).toBe("東京國立博物館");
  });
});
