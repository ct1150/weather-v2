import type { CountryMapGeometry } from "./country-map-geometry";

/**
 * Dedicated country geometries for catalogue entries that are not yet part of the
 * original phase-one geometry set. The China path is normalized to the exact
 * projection frame used by projectCountryPoint so real WGS84 city coordinates and
 * the visible outline share the same drawing extent instead of drifting apart.
 */
const OVERRIDES: Readonly<Record<string, CountryMapGeometry>> = {
  CN: {
    path: "M95.5,215.9L140.5,147.4L230.5,112.6L314.6,66.9L415.3,86.5L516.0,56.0L614.3,86.5L713.8,121.3L826.3,157.2L919.9,219.2L879.6,275.7L909.2,343.2L839.4,406.3L737.5,426.9L673.5,486.8L578.8,472.6L494.7,502.0L408.2,462.8L322.9,444.3L253.0,392.1L178.4,363.8L123.9,312.7L80.1,263.8L95.5,215.9ZM587.1,541.2L606.0,533.5L623.8,543.3L617.9,559.6L597.7,564.0L583.5,553.1L587.1,541.2Z",
    minLongitude: 73,
    maxLongitude: 135,
    minLatitude: 17,
    maxLatitude: 54.5,
  },
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
