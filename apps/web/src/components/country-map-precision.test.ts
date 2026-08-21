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
import {
  layoutCountryMarkers,
  MAX_MARKER_LEADER_DISTANCE,
  type CountryOutlineMarker,
} from "./CountryOutlineMap";

const CHINA_CITIES: ReadonlyArray<CountryOutlineMarker> = [
  {
    id: "beijing",
    name: "Beijing",
    longitude: 116.4074,
    latitude: 39.9042,
    symbol: "☀️",
    detail: "dry",
    risk: "good",
    filtered: false,
    selected: false,
    ariaLabel: "Beijing weather",
  },
  {
    id: "shanghai",
    name: "Shanghai",
    longitude: 121.4737,
    latitude: 31.2304,
    symbol: "🌤️",
    detail: "mixed",
    risk: "mixed",
    filtered: false,
    selected: false,
    ariaLabel: "Shanghai weather",
  },
  {
    id: "xian",
    name: "Xi'an",
    longitude: 108.9398,
    latitude: 34.3416,
    symbol: "☀️",
    detail: "dry",
    risk: "good",
    filtered: false,
    selected: false,
    ariaLabel: "Xi'an weather",
  },
  {
    id: "chengdu",
    name: "Chengdu",
    longitude: 104.0668,
    latitude: 30.5728,
    symbol: "🌦️",
    detail: "mixed",
    risk: "mixed",
    filtered: false,
    selected: false,
    ariaLabel: "Chengdu weather",
  },
  {
    id: "guangzhou",
    name: "Guangzhou",
    longitude: 113.2644,
    latitude: 23.1291,
    symbol: "🌦️",
    detail: "wet",
    risk: "wet",
    filtered: false,
    selected: false,
    ariaLabel: "Guangzhou weather",
  },
  {
    id: "sanya",
    name: "Sanya",
    longitude: 109.5119,
    latitude: 18.2528,
    symbol: "☀️",
    detail: "dry",
    risk: "good",
    filtered: false,
    selected: false,
    ariaLabel: "Sanya weather",
  },
];

function pathBounds(path: string) {
  const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const xs = values.filter((_, index) => index % 2 === 0);
  const ys = values.filter((_, index) => index % 2 === 1);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function pointInRing(longitude: number, latitude: number, ring: GeneratedCountryMapRing): boolean {
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

function minimumDistanceToRing(
  longitude: number,
  latitude: number,
  ring: GeneratedCountryMapRing,
): number {
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
  rings: ReadonlyArray<GeneratedCountryMapRing>,
  coastlineToleranceDegrees = 0.04,
): boolean {
  return rings.some(
    (ring) =>
      pointInRing(longitude, latitude, ring) ||
      minimumDistanceToRing(longitude, latitude, ring) <= coastlineToleranceDegrees,
  );
}

describe("China country-map geographic precision", () => {
  it("derives the visible outline from real WGS84 boundary rings", () => {
    const geometry = countryMapGeometryOverride("CN");
    expect(geometry).not.toBeNull();
    if (geometry === null) return;

    expect(CHINA_MAP_RINGS).toHaveLength(2);
    expect(CHINA_MAP_RINGS[0].length).toBeGreaterThan(200);
    expect(geometry.path.match(/[ML]/g)?.length ?? 0).toBeGreaterThan(200);
  });

  it("keeps the generated outline and WGS84 cities on the same Mercator frame", () => {
    const geometry = countryMapGeometryOverride("CN");
    expect(geometry).not.toBeNull();
    if (geometry === null) return;

    const southWest = projectCountryMapPoint(
      "CN",
      geometry,
      geometry.minLongitude,
      geometry.minLatitude,
    );
    const northEast = projectCountryMapPoint(
      "CN",
      geometry,
      geometry.maxLongitude,
      geometry.maxLatitude,
    );
    const bounds = pathBounds(geometry.path);

    expect(Math.abs(bounds.minX - southWest.x)).toBeLessThan(1);
    expect(Math.abs(bounds.maxX - northEast.x)).toBeLessThan(1);
    expect(Math.abs(bounds.minY - northEast.y)).toBeLessThan(1);
    expect(Math.abs(bounds.maxY - southWest.y)).toBeLessThan(1);
  });

  it("keeps weather cards close to their exact geographic pins", () => {
    const layout = layoutCountryMarkers("CN", CHINA_CITIES);
    expect(layout).toHaveLength(CHINA_CITIES.length);

    for (const marker of layout) {
      const displacement = Math.hypot(marker.x - marker.anchorX, marker.y - marker.anchorY);
      expect(displacement).toBeLessThanOrEqual(MAX_MARKER_LEADER_DISTANCE + 0.01);
    }
  });

  it("projects major cities in their expected west-east and north-south order", () => {
    const layout = layoutCountryMarkers("CN", CHINA_CITIES);
    const byId = new Map(layout.map((marker) => [marker.id, marker]));

    expect(byId.get("chengdu")!.anchorX).toBeLessThan(byId.get("beijing")!.anchorX);
    expect(byId.get("beijing")!.anchorX).toBeLessThan(byId.get("shanghai")!.anchorX);
    expect(byId.get("beijing")!.anchorY).toBeLessThan(byId.get("guangzhou")!.anchorY);
    expect(byId.get("guangzhou")!.anchorY).toBeLessThan(byId.get("sanya")!.anchorY);
  });
});

describe("all supported country-map geographic precision", () => {
  it("uses generated WGS84 boundaries for every non-China catalogue country", () => {
    const countryIds = geographySeed.countries
      .map((country) => country.id)
      .filter((id) => id !== "CN");
    expect(Object.keys(GENERATED_COUNTRY_MAPS).sort()).toEqual(countryIds.sort());

    for (const countryId of countryIds) {
      const source = GENERATED_COUNTRY_MAPS[countryId];
      const geometry = countryMapGeometryOverride(countryId);
      expect(source?.rings.length, countryId).toBeGreaterThan(0);
      expect(geometry, countryId).not.toBeNull();
      expect(geometry?.path.length ?? 0, countryId).toBeGreaterThan(20);
    }
  });

  it("keeps every catalogue city on or immediately beside real land", () => {
    const misplaced: string[] = [];

    for (const city of geographySeed.cities) {
      if (city.countryId === "CN") continue;
      const source = GENERATED_COUNTRY_MAPS[city.countryId];
      if (source === undefined) {
        misplaced.push(`${city.id}: missing ${city.countryId} boundary`);
        continue;
      }
      if (!isOnOrNearLand(city.longitude, city.latitude, source.rings)) {
        misplaced.push(`${city.id}: ${city.longitude},${city.latitude}`);
      }
    }

    expect(misplaced).toEqual([]);
  });

  it("keeps every catalogue marker inside the projected map frame", () => {
    const outside: string[] = [];

    for (const city of geographySeed.cities) {
      const geometry = countryMapGeometryOverride(city.countryId);
      if (geometry === null) {
        outside.push(`${city.id}: missing geometry`);
        continue;
      }
      const point = projectCountryMapPoint(city.countryId, geometry, city.longitude, city.latitude);
      if (
        point.x < 0 ||
        point.x > COUNTRY_MAP_WIDTH ||
        point.y < 0 ||
        point.y > COUNTRY_MAP_HEIGHT
      ) {
        outside.push(`${city.id}: ${point.x.toFixed(1)},${point.y.toFixed(1)}`);
      }
    }

    expect(outside).toEqual([]);
  });

  it("retains the small islands used by weather-first travel destinations", () => {
    const islandDestinationIds = [
      "naha",
      "phuket",
      "koh-samui",
      "phu-quoc",
      "bali",
      "lombok",
      "boracay",
    ];

    for (const cityId of islandDestinationIds) {
      const city = geographySeed.cities.find((candidate) => candidate.id === cityId);
      expect(city, cityId).toBeDefined();
      if (city === undefined) continue;
      const rings = GENERATED_COUNTRY_MAPS[city.countryId]?.rings ?? [];
      expect(isOnOrNearLand(city.longitude, city.latitude, rings, 0.025), cityId).toBe(true);
    }
  });
});
