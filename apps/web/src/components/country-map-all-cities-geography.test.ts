import { describe, expect, it } from "vitest";
import { geographySeed } from "../build/geography.seed";
import { COUNTRY_MAP_HEIGHT, COUNTRY_MAP_WIDTH } from "./country-map-geometry";
import { CHINA_MAP_RINGS } from "./country-map-cn.generated";
import {
  countryMapGeometryOverride,
  projectCountryMapPoint,
} from "./country-map-geometry-overrides";
import {
  GENERATED_COUNTRY_MAPS,
  type GeneratedCountryMapRing,
} from "./country-map-world.generated";

type Ring = ReadonlyArray<readonly [number, number]>;

function pointInRing(longitude: number, latitude: number, ring: Ring): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[previous];
    const crossesLatitude = y1 > latitude !== y2 > latitude;
    if (!crossesLatitude) continue;
    const intersection = ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1;
    if (longitude < intersection) inside = !inside;
  }
  return inside;
}

function squaredSegmentDistance(
  longitude: number,
  latitude: number,
  start: readonly [number, number],
  end: readonly [number, number],
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    return (longitude - start[0]) ** 2 + (latitude - start[1]) ** 2;
  }

  const ratio = Math.max(
    0,
    Math.min(1, ((longitude - start[0]) * dx + (latitude - start[1]) * dy) / (dx * dx + dy * dy)),
  );
  const nearestLongitude = start[0] + ratio * dx;
  const nearestLatitude = start[1] + ratio * dy;
  return (longitude - nearestLongitude) ** 2 + (latitude - nearestLatitude) ** 2;
}

function minimumDistanceToRing(longitude: number, latitude: number, ring: Ring): number {
  let minimum = Infinity;
  for (let index = 1; index < ring.length; index += 1) {
    minimum = Math.min(
      minimum,
      squaredSegmentDistance(longitude, latitude, ring[index - 1], ring[index]),
    );
  }
  return Math.sqrt(minimum);
}

function isOnOrNearLand(
  longitude: number,
  latitude: number,
  rings: ReadonlyArray<Ring>,
  coastlineToleranceDegrees = 0.04,
): boolean {
  return rings.some(
    (ring) =>
      pointInRing(longitude, latitude, ring) ||
      minimumDistanceToRing(longitude, latitude, ring) <= coastlineToleranceDegrees,
  );
}

function ringsForCountry(countryId: string): ReadonlyArray<Ring> {
  if (countryId === "CN") return CHINA_MAP_RINGS;
  return (GENERATED_COUNTRY_MAPS[countryId]?.rings ?? []) as ReadonlyArray<GeneratedCountryMapRing>;
}

describe("all catalogue city map positions", () => {
  it("has real boundary geometry for every supported country", () => {
    const missing = geographySeed.countries
      .map((country) => country.id)
      .filter((countryId) => ringsForCountry(countryId).length === 0);

    expect(missing).toEqual([]);
  });

  it("keeps every catalogue city on land or within a small coastline tolerance", () => {
    const misplaced: string[] = [];

    for (const city of geographySeed.cities) {
      const rings = ringsForCountry(city.countryId);
      if (!isOnOrNearLand(city.longitude, city.latitude, rings)) {
        misplaced.push(`${city.countryId}/${city.id}: ${city.longitude},${city.latitude}`);
      }
    }

    expect(misplaced).toEqual([]);
  });

  it("keeps every catalogue city inside its projected SVG map frame", () => {
    const outside: string[] = [];

    for (const city of geographySeed.cities) {
      const geometry = countryMapGeometryOverride(city.countryId);
      if (geometry === null) {
        outside.push(`${city.countryId}/${city.id}: missing geometry`);
        continue;
      }

      const point = projectCountryMapPoint(city.countryId, geometry, city.longitude, city.latitude);
      if (
        point.x < 0 ||
        point.x > COUNTRY_MAP_WIDTH ||
        point.y < 0 ||
        point.y > COUNTRY_MAP_HEIGHT
      ) {
        outside.push(`${city.countryId}/${city.id}: ${point.x.toFixed(1)},${point.y.toFixed(1)}`);
      }
    }

    expect(outside).toEqual([]);
  });
});
