import { describe, expect, it } from "vitest";
import { CHINA_MAP_RINGS } from "./country-map-cn.generated";
import {
  countryMapGeometryOverride,
  projectCountryMapPoint,
} from "./country-map-geometry-overrides";
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
