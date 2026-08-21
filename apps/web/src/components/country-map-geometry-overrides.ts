import {
  COUNTRY_MAP_HEIGHT,
  COUNTRY_MAP_WIDTH,
  projectCountryPoint,
  type CountryMapGeometry,
} from "./country-map-geometry";
import { CHINA_MAP_BOUNDS, CHINA_MAP_RINGS } from "./country-map-cn.generated";
import {
  GENERATED_COUNTRY_MAPS,
  type GeneratedCountryMapRing,
  type GeneratedCountryMapSource,
} from "./country-map-world.generated";

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

function ringsPath(
  frame: CountryMapGeometry,
  rings: ReadonlyArray<GeneratedCountryMapRing>,
): string {
  return rings
    .map(
      (ring) =>
        ring
          .map(([longitude, latitude], index) => {
            const point = projectMercatorPoint(frame, longitude, latitude);
            return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
          })
          .join("") + "Z",
    )
    .join("");
}

function generatedGeometry(source: GeneratedCountryMapSource): CountryMapGeometry {
  const frame: CountryMapGeometry = {
    path: "",
    ...source.frame,
  };
  return {
    ...frame,
    path: ringsPath(frame, source.rings),
  };
}

const CHINA_FRAME: CountryMapGeometry = {
  path: "",
  ...CHINA_MAP_BOUNDS,
};

const CHINA_GEOMETRY: CountryMapGeometry = {
  ...CHINA_FRAME,
  path: ringsPath(CHINA_FRAME, CHINA_MAP_RINGS),
};

const GENERATED_OVERRIDES: Readonly<Record<string, CountryMapGeometry>> = Object.fromEntries(
  Object.entries(GENERATED_COUNTRY_MAPS).map(([countryId, source]) => [
    countryId,
    generatedGeometry(source),
  ]),
);

/**
 * All supported country outlines and destination anchors now originate in WGS84
 * and share the same Web Mercator projection. This prevents a country silhouette
 * and its city dots from drifting independently.
 */
const OVERRIDES: Readonly<Record<string, CountryMapGeometry>> = {
  ...GENERATED_OVERRIDES,
  CN: CHINA_GEOMETRY,
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
  const normalizedCountryId = countryId.toUpperCase();
  if (normalizedCountryId === "CN" || GENERATED_COUNTRY_MAPS[normalizedCountryId] !== undefined) {
    return projectMercatorPoint(geometry, longitude, latitude);
  }
  return projectCountryPoint(geometry, longitude, latitude);
}
