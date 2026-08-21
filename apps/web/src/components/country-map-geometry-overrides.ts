import {
  COUNTRY_MAP_HEIGHT,
  COUNTRY_MAP_WIDTH,
  projectCountryPoint,
  type CountryMapGeometry,
} from "./country-map-geometry";
import { CHINA_MAP_BOUNDS, CHINA_MAP_RINGS } from "./country-map-cn.generated";

const COUNTRY_MAP_PADDING = 56;
const MAX_MERCATOR_LATITUDE = 85.05112878;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function longitudeRadians(longitude: number): number {
  return (longitude * Math.PI) / 180;
}

function mercatorY(latitude: number): number {
  const clamped = clamp(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
  const radians = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function projectMercatorPoint(
  geometry: CountryMapGeometry,
  longitude: number,
  latitude: number,
): { readonly x: number; readonly y: number } {
  const minX = longitudeRadians(geometry.minLongitude);
  const maxX = longitudeRadians(geometry.maxLongitude);
  const minY = mercatorY(geometry.minLatitude);
  const maxY = mercatorY(geometry.maxLatitude);
  const xSpan = Math.max(0.001, maxX - minX);
  const ySpan = Math.max(0.001, maxY - minY);
  const scale = Math.min(
    (COUNTRY_MAP_WIDTH - COUNTRY_MAP_PADDING * 2) / xSpan,
    (COUNTRY_MAP_HEIGHT - COUNTRY_MAP_PADDING * 2) / ySpan,
  );
  const projectedWidth = xSpan * scale;
  const projectedHeight = ySpan * scale;
  const offsetX = (COUNTRY_MAP_WIDTH - projectedWidth) / 2;
  const offsetY = (COUNTRY_MAP_HEIGHT - projectedHeight) / 2;
  const x = longitudeRadians(longitude);
  const y = mercatorY(latitude);

  return {
    x: offsetX + (x - minX) * scale,
    y: offsetY + (maxY - y) * scale,
  };
}

function chinaPath(frame: CountryMapGeometry): string {
  return CHINA_MAP_RINGS.map((ring) =>
    ring
      .map(([longitude, latitude], index) => {
        const point = projectMercatorPoint(frame, longitude, latitude);
        return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      })
      .join("") + "Z",
  ).join("");
}

const CHINA_FRAME: CountryMapGeometry = {
  path: "",
  ...CHINA_MAP_BOUNDS,
};

const CHINA_GEOMETRY: CountryMapGeometry = {
  ...CHINA_FRAME,
  path: chinaPath(CHINA_FRAME),
};

/**
 * Dedicated country geometries for catalogue entries that are not part of the
 * original phase-one geometry set. China is generated from simplified WGS84
 * boundary rings and projected with the same Web Mercator function used for its
 * destination anchors, so outline and city positions cannot drift independently.
 */
const OVERRIDES: Readonly<Record<string, CountryMapGeometry>> = {
  CN: CHINA_GEOMETRY,
  TW: {
    path: "M514,76C553,107 579,154 590,205C603,264 585,328 559,384C536,434 508,487 476,545C443,506 424,458 417,407C408,345 418,278 435,218C452,157 476,105 514,76Z",
    minLongitude: 119.4,
    maxLongitude: 122.2,
    minLatitude: 21.4,
    maxLatitude: 25.7,
  },
};

export function countryMapGeometryOverride(countryId: string): CountryMapGeometry | null {
  return OVERRIDES[countryId.toUpperCase()] ?? null;
}

export function projectCountryMapPoint(
  countryId: string,
  geometry: CountryMapGeometry,
  longitude: number,
  latitude: number,
): { readonly x: number; readonly y: number } {
  if (countryId.toUpperCase() === "CN") {
    return projectMercatorPoint(geometry, longitude, latitude);
  }
  return projectCountryPoint(geometry, longitude, latitude);
}
