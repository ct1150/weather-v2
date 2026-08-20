import { describe, expect, it } from "vitest";
import { geographySeed } from "../build/geography.seed";
import { countryMapGeometryOverride } from "./country-map-geometry-overrides";

describe("China and Taiwan country weather-map catalogue", () => {
  it("adds both country entries with dedicated geometry", () => {
    const hasChina = geographySeed.countries.some(
      (country) => country.id === "CN" && country.slug === "cn",
    );
    const hasTaiwan = geographySeed.countries.some(
      (country) => country.id === "TW" && country.slug === "tw",
    );

    expect(hasChina).toBe(true);
    expect(hasTaiwan).toBe(true);
    expect(countryMapGeometryOverride("CN")).not.toBeNull();
    expect(countryMapGeometryOverride("TW")).not.toBeNull();
  });

  it("covers the initial travel destinations", () => {
    const china = geographySeed.cities.filter((city) => city.countryId === "CN");
    const taiwan = geographySeed.cities.filter((city) => city.countryId === "TW");

    expect(china).toHaveLength(12);
    expect(taiwan).toHaveLength(8);
    for (const id of ["beijing", "shanghai", "xian", "chengdu", "sanya"]) {
      expect(china.some((city) => city.id === id)).toBe(true);
    }
    for (const id of ["taipei", "taichung", "tainan", "kaohsiung", "hualien", "kenting"]) {
      expect(taiwan.some((city) => city.id === id)).toBe(true);
    }
  });
});
