import type { CSSProperties, ReactElement } from "react";
import {
  COUNTRY_MAP_HEIGHT,
  COUNTRY_MAP_WIDTH,
  countryMapGeometry,
  projectCountryPoint,
} from "./country-map-geometry";

export type CountryOutlineRisk = "good" | "mixed" | "wet" | "unknown";

export interface CountryOutlineMarker {
  readonly id: string;
  readonly name: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly symbol: string;
  readonly detail: string;
  readonly risk: CountryOutlineRisk;
  readonly filtered: boolean;
  readonly selected: boolean;
  readonly ariaLabel: string;
}

interface PositionedCountryMarker extends CountryOutlineMarker {
  readonly anchorX: number;
  readonly anchorY: number;
  readonly x: number;
  readonly y: number;
}

export interface CountryOutlineMapProps {
  readonly countryId: string;
  readonly countryName: string;
  readonly ariaLabel: string;
  readonly markers: ReadonlyArray<CountryOutlineMarker>;
  readonly onSelect: (markerId: string) => void;
}

const MARKER_WIDTH = 220;
const MARKER_HEIGHT = 72;
const EDGE_X = 72;
const EDGE_Y = 48;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function candidateOffsets(): ReadonlyArray<readonly [number, number]> {
  const offsets: Array<readonly [number, number]> = [[0, 0]];
  for (const [radius, steps] of [
    [82, 8],
    [150, 12],
    [230, 16],
    [320, 20],
    [400, 24],
  ] as const) {
    for (let index = 0; index < steps; index += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / steps;
      offsets.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
  }
  return offsets;
}

const CANDIDATE_OFFSETS = candidateOffsets();

function overlapPenalty(
  x: number,
  y: number,
  placed: ReadonlyArray<PositionedCountryMarker>,
): number {
  let penalty = 0;
  for (const other of placed) {
    const horizontal = Math.abs(x - other.x);
    const vertical = Math.abs(y - other.y);
    if (horizontal < MARKER_WIDTH && vertical < MARKER_HEIGHT) {
      penalty += (MARKER_WIDTH - horizontal + 1) * (MARKER_HEIGHT - vertical + 1) * 1_000;
    }
  }
  return penalty;
}

export function layoutCountryMarkers(
  countryId: string,
  markers: ReadonlyArray<CountryOutlineMarker>,
): ReadonlyArray<PositionedCountryMarker> {
  const geometry = countryMapGeometry(countryId);
  const anchored = markers.map((marker) => ({
    marker,
    ...projectCountryPoint(geometry, marker.longitude, marker.latitude),
  }));
  const order = [...anchored].sort(
    (left, right) =>
      left.y - right.y || left.x - right.x || left.marker.id.localeCompare(right.marker.id),
  );
  const placed: PositionedCountryMarker[] = [];
  const byId = new Map<string, PositionedCountryMarker>();

  for (const entry of order) {
    let best: PositionedCountryMarker | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const [offsetX, offsetY] of CANDIDATE_OFFSETS) {
      const rawX = entry.x + offsetX;
      const rawY = entry.y + offsetY;
      const x = clamp(rawX, EDGE_X, COUNTRY_MAP_WIDTH - EDGE_X);
      const y = clamp(rawY, EDGE_Y, COUNTRY_MAP_HEIGHT - EDGE_Y);
      const clampedDistance = Math.hypot(x - rawX, y - rawY);
      const leaderDistance = Math.hypot(x - entry.x, y - entry.y);
      const score = overlapPenalty(x, y, placed) + leaderDistance * 0.8 + clampedDistance * 5_000;
      if (score < bestScore) {
        bestScore = score;
        best = {
          ...entry.marker,
          anchorX: entry.x,
          anchorY: entry.y,
          x,
          y,
        };
      }
      if (score === 0) break;
    }
    const resolved =
      best ??
      ({
        ...entry.marker,
        anchorX: entry.x,
        anchorY: entry.y,
        x: entry.x,
        y: entry.y,
      } satisfies PositionedCountryMarker);
    placed.push(resolved);
    byId.set(resolved.id, resolved);
  }

  return markers
    .map((marker) => byId.get(marker.id))
    .filter((marker): marker is PositionedCountryMarker => marker !== undefined);
}

function markerStyle(marker: PositionedCountryMarker): CSSProperties {
  return {
    left: `${(marker.x / COUNTRY_MAP_WIDTH) * 100}%`,
    top: `${(marker.y / COUNTRY_MAP_HEIGHT) * 100}%`,
  };
}

export function CountryOutlineMap({
  countryId,
  countryName,
  ariaLabel,
  markers,
  onSelect,
}: CountryOutlineMapProps): ReactElement {
  const geometry = countryMapGeometry(countryId);
  const positioned = layoutCountryMarkers(countryId, markers);

  return (
    <div
      className="country-weather-map country-weather-map-primary country-weather-map-instant"
      role="region"
      aria-label={ariaLabel}
      data-testid="country-weather-map"
      data-render-mode="inline-svg"
      data-city-count={positioned.length}
    >
      <svg
        className="country-outline-canvas"
        viewBox={`0 0 ${COUNTRY_MAP_WIDTH} ${COUNTRY_MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${countryName} outline`}
      >
        <title>{countryName}</title>
        <path
          d={geometry.path}
          className="country-outline-shape"
          fillRule="evenodd"
          clipRule="evenodd"
        />
        <g className="country-marker-leaders" aria-hidden="true">
          {positioned.map((marker) => (
            <g key={marker.id}>
              <line x1={marker.anchorX} y1={marker.anchorY} x2={marker.x} y2={marker.y} />
              <circle cx={marker.anchorX} cy={marker.anchorY} r="5" />
            </g>
          ))}
        </g>
      </svg>

      <div className="country-weather-marker-layer">
        {positioned.map((marker) => (
          <button
            key={marker.id}
            type="button"
            className={`country-static-weather-marker risk-${marker.risk}${marker.filtered ? " is-filtered" : ""}`}
            style={markerStyle(marker)}
            aria-label={marker.ariaLabel}
            aria-pressed={marker.selected}
            data-testid="country-weather-marker"
            data-city-id={marker.id}
            data-selected={marker.selected ? "true" : "false"}
            onClick={() => onSelect(marker.id)}
          >
            <span className="country-static-weather-icon" aria-hidden="true">
              {marker.symbol}
            </span>
            <span className="country-static-weather-copy">
              <strong>{marker.name}</strong>
              <small>{marker.detail}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
