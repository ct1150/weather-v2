import { describe, expect, it } from "vitest";

import { geographySeed } from "./geography.seed";

describe("phase-one geography catalogue", () => {
  it("covers 56 weather-distinct destinations across ten country map entries", () => {
    expect(geographySeed.countries).toHaveLength(10);
    expect(geographySeed.cities).toHaveLength(56);
    expect(new Set(geographySeed.cities.map((city) => city.id)).size).toBe(56);
    expect(new Set(geographySeed.cities.map((city) => `${city.countryId}/${city.slug}`)).size).toBe(
      56,
    );
  });

  it("keeps every coordinate, time zone and localized name usable", () => {
    for (const city of geographySeed.cities) {
      expect(city.latitude).toBeGreaterThanOrEqual(-90);
      expect(city.latitude).toBeLessThanOrEqual(90);
      expect(city.longitude).toBeGreaterThanOrEqual(-180);
      expect(city.longitude).toBeLessThanOrEqual(180);
      expect(city.timezone).toContain("/");
      expect(Object.values(city.name).every((name) => name.trim().length > 0)).toBe(true);
    }
  });

  it("limits the homepage to a curated cross-region set", () => {
    const featured = geographySeed.cities.filter((city) => city.isFeatured);
    expect(featured.length).toBeGreaterThanOrEqual(10);
    expect(featured.length).toBeLessThanOrEqual(13);
    expect(new Set(featured.map((city) => city.countryId)).size).toBe(8);
  });
});
