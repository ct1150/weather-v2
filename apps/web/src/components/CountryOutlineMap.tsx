"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import { COUNTRY_MAP_HEIGHT, COUNTRY_MAP_WIDTH, countryMapGeometry } from "./country-map-geometry";
import {
  countryMapGeometryOverride,
  projectCountryMapPoint,
} from "./country-map-geometry-overrides";

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

export interface CountryMapRenderedFrame {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Dots now stay exactly on their geographic anchors. */
export const MAX_MARKER_LEADER_DISTANCE = 0;

function resolveCountryGeometry(countryId: string) {
  return countryMapGeometryOverride(countryId) ?? countryMapGeometry(countryId);
}

/**
 * Mirrors SVG preserveAspectRatio="xMidYMid meet" so the HTML marker layer and
 * the SVG outline always share the same rendered coordinate frame.
 */
export function fitCountryMapRenderedFrame(
  width: number,
  height: number,
): CountryMapRenderedFrame {
  if (width <= 0 || height <= 0) {
    return { scale: 0, offsetX: 0, offsetY: 0 };
  }

  const scale = Math.min(width / COUNTRY_MAP_WIDTH, height / COUNTRY_MAP_HEIGHT);
  const renderedWidth = COUNTRY_MAP_WIDTH * scale;
  const renderedHeight = COUNTRY_MAP_HEIGHT * scale;

  return {
    scale,
    offsetX: (width - renderedWidth) / 2,
    offsetY: (height - renderedHeight) / 2,
  };
}

export function layoutCountryMarkers(
  countryId: string,
  markers: ReadonlyArray<CountryOutlineMarker>,
): ReadonlyArray<PositionedCountryMarker> {
  const geometry = resolveCountryGeometry(countryId);
  return markers.map((marker) => {
    const point = projectCountryMapPoint(countryId, geometry, marker.longitude, marker.latitude);
    return {
      ...marker,
      anchorX: point.x,
      anchorY: point.y,
      x: point.x,
      y: point.y,
    };
  });
}

function markerStyle(
  marker: PositionedCountryMarker,
  renderedFrame: CountryMapRenderedFrame | null,
): CSSProperties {
  if (renderedFrame !== null && renderedFrame.scale > 0) {
    return {
      left: `${renderedFrame.offsetX + marker.anchorX * renderedFrame.scale}px`,
      top: `${renderedFrame.offsetY + marker.anchorY * renderedFrame.scale}px`,
    };
  }

  // SSR/jsdom fallback. useLayoutEffect replaces this before browser paint.
  return {
    left: `${(marker.anchorX / COUNTRY_MAP_WIDTH) * 100}%`,
    top: `${(marker.anchorY / COUNTRY_MAP_HEIGHT) * 100}%`,
  };
}

function tooltipPlacement(marker: PositionedCountryMarker): string {
  const horizontal =
    marker.anchorX < COUNTRY_MAP_WIDTH * 0.2
      ? "tooltip-left"
      : marker.anchorX > COUNTRY_MAP_WIDTH * 0.8
        ? "tooltip-right"
        : "tooltip-center";
  const vertical = marker.anchorY < COUNTRY_MAP_HEIGHT * 0.24 ? "tooltip-below" : "tooltip-above";
  return `${horizontal} ${vertical}`;
}

export function CountryOutlineMap({
  countryId,
  countryName,
  ariaLabel,
  markers,
  onSelect,
}: CountryOutlineMapProps): ReactElement {
  const mapRef = useRef<HTMLDivElement>(null);
  const [renderedFrame, setRenderedFrame] = useState<CountryMapRenderedFrame | null>(null);
  const geometry = resolveCountryGeometry(countryId);
  const positioned = layoutCountryMarkers(countryId, markers);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    const updateRenderedFrame = () => {
      const rect = map.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setRenderedFrame(fitCountryMapRenderedFrame(rect.width, rect.height));
    };

    updateRenderedFrame();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateRenderedFrame);
      observer.observe(map);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateRenderedFrame);
    return () => window.removeEventListener("resize", updateRenderedFrame);
  }, []);

  return (
    <div
      ref={mapRef}
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
      </svg>

      <div className="country-weather-dot-layer">
        {positioned.map((marker) => (
          <button
            key={marker.id}
            type="button"
            className={`country-weather-dot risk-${marker.risk}${marker.filtered ? " is-filtered" : ""}${marker.selected ? " is-selected" : ""} ${tooltipPlacement(marker)}`}
            style={markerStyle(marker, renderedFrame)}
            aria-label={marker.ariaLabel}
            aria-pressed={marker.selected}
            data-testid="country-weather-marker"
            data-city-id={marker.id}
            data-selected={marker.selected ? "true" : "false"}
            onClick={() => onSelect(marker.id)}
          >
            <span
              className={`country-weather-dot-core${marker.selected ? " is-selected" : ""}`}
              data-testid="country-weather-pin"
              data-city-id={marker.id}
              aria-hidden="true"
            />
            <span className="country-weather-dot-tooltip" aria-hidden="true">
              <span className="country-weather-dot-tooltip-heading">
                <span>{marker.symbol}</span>
                <strong>{marker.name}</strong>
              </span>
              <small>{marker.detail}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
