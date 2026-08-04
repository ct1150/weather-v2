// apps/web/src/components/ExplorerMap.tsx
//
// Interactive MapLibre enhancement (PRD-FR-002, UX-A11Y-001, ENG-PERF-001,
// UX-STATE-001). Client component that hydrates AFTER the accessible, crawlable
// ranked list (rendered by the parent page). The map shares one compact read
// model (`ExplorerMapMarker`) with that list so the two never diverge.
//
// Design guarantees:
//   - NO API KEY: uses the free, token-less OpenFreeMap "liberty" style.
//   - Progressive enhancement: if WebGL is unavailable the map silently degrades
//     and the list remains the equivalent decision path (never blocks LCP).
//   - Keyboard / reduced-motion aware: clustering + list fallback share the model;
//     map flyTo is skipped under `prefers-reduced-motion: reduce`.
//   - Clean teardown on unmount.
//
// The library is loaded via a dynamic `import()` inside the effect so it is never
// evaluated during static-export prerender (keeping the server bundle free of any
// browser-only top-level side effects).

"use client";

import { useEffect, useId, useRef, type ReactElement } from "react";
import type { ExplorerMapMarker } from "../app/view-models";

import "maplibre-gl/dist/maplibre-gl.css";

/** Free, no-token vector style (OpenFreeMap "liberty"). */
export const MAPLIBRE_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Semantic palette hex values (mirror globals.css tokens; JS-only, no CSS literal). */
const COLOR_PRIMARY = "#2563eb"; // primary  (high score)
const COLOR_WARNING = "#d97706"; // warning  (mid score)
const COLOR_DANGER = "#dc2626"; // danger   (low score)
const COLOR_MUTED = "#6b7280"; // muted   (no score)

export interface ExplorerMapProps {
  readonly markers: ReadonlyArray<ExplorerMapMarker>;
  readonly theme: string;
  readonly windowLabel: string;
}

type MapInstance = {
  readonly addControl: (control: unknown, position?: string) => void;
  readonly on: (event: string, layerOrCb: unknown, cb?: (e: MapEvent) => void) => void;
  readonly addSource: (id: string, spec: SourceSpecification) => void;
  readonly addLayer: (spec: LayerSpecification) => void;
  readonly remove: () => void;
  readonly jumpTo: (options: { center: [number, number]; zoom: number }) => void;
  readonly easeTo: (options: { center: [number, number]; zoom: number }) => void;
  readonly getSource: (id: string) => GeoJsonSourceLike | undefined;
  readonly queryRenderedFeatures: (
    point: { x: number; y: number },
    layers: ReadonlyArray<string>,
  ) => ReadonlyArray<{
    geometry?: { coordinates: [number, number] };
    properties?: Record<string, unknown>;
  }>;
};

interface MapEvent {
  readonly point?: { x: number; y: number };
}

interface GeoJsonSourceLike {
  getClusterExpansionZoom: (clusterId: number) => Promise<number> | number;
}

interface SourceSpecification {
  readonly type: "geojson";
  readonly data: GeoJsonFeatureCollection;
  readonly cluster?: boolean;
  readonly clusterRadius?: number;
  readonly clusterMaxZoom?: number;
}

interface LayerSpecification {
  readonly id: string;
  readonly type: "circle" | "symbol";
  readonly source: string;
  readonly filter?: unknown;
  readonly layout?: Record<string, unknown>;
  readonly paint?: Record<string, unknown>;
}

interface GeoJsonFeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: ReadonlyArray<GeoJsonFeature>;
}

interface GeoJsonFeature {
  readonly type: "Feature";
  readonly geometry: { readonly type: "Point"; readonly coordinates: [number, number] };
  readonly properties: Record<string, unknown>;
}

function scoreColor(score: number | null): string {
  if (score === null) return COLOR_MUTED;
  if (score >= 75) return COLOR_PRIMARY;
  if (score >= 50) return COLOR_WARNING;
  return COLOR_DANGER;
}

/** Feature-collection projection shared by the map source and (implicitly) the list. */
function toFeatureCollection(markers: ReadonlyArray<ExplorerMapMarker>): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((marker) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [marker.longitude, marker.latitude] },
      properties: {
        id: marker.id,
        label: marker.label,
        path: marker.path,
        theme: marker.theme,
        score: marker.score,
        color: scoreColor(marker.score),
      },
    })),
  };
}

/** True only when a WebGL context can actually be created (graceful degrade). */
function hasWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function centroid(markers: ReadonlyArray<ExplorerMapMarker>): [number, number] {
  if (markers.length === 0) return [20, 0];
  const sum = markers.reduce(
    (acc, m) => ({ lat: acc.lat + m.latitude, lng: acc.lng + m.longitude }),
    { lat: 0, lng: 0 },
  );
  return [sum.lng / markers.length, sum.lat / markers.length];
}

export function ExplorerMap({ markers, theme, windowLabel }: ExplorerMapProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const labelId = useId();

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    if (!hasWebGL()) return; // Degrade: list is the accessible equivalent.

    let cancelled = false;

    (async (): Promise<void> => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (cancelled || containerRef.current === null) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: MAPLIBRE_STYLE_URL,
          center: centroid(markers),
          zoom: markers.length > 1 ? 1.5 : 4,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        }) as unknown as MapInstance;

        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

        const data = toFeatureCollection(markers);

        map.on("load", () => {
          map.addSource("destinations", {
            type: "geojson",
            data,
            cluster: true,
            clusterRadius: 50,
            clusterMaxZoom: 8,
          });

          // Cluster bubbles.
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "destinations",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": COLOR_PRIMARY,
              "circle-radius": ["step", ["get", "point_count"], 14, 10, 20, 30, 26],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.85,
            },
          });

          // Cluster counts.
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "destinations",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
            },
            paint: { "text-color": "#ffffff" },
          });

          // Unclustered destination points, colored by score/theme.
          map.addLayer({
            id: "unclustered",
            type: "circle",
            source: "destinations",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ["get", "color"],
              "circle-radius": 7,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });

          const navigate = (feature: GeoJsonFeature | undefined): void => {
            const path = feature?.properties?.["path"];
            if (typeof path === "string" && path.length > 0) {
              window.location.assign(path);
            }
          };

          map.on("click", "clusters", (e: MapEvent) => {
            const point = e.point;
            if (point === undefined) return;
            const clicked = map.queryRenderedFeatures(point, ["clusters"])[0];
            const clusterId = clicked?.properties?.["cluster_id"];
            if (typeof clusterId !== "number") return;
            const source = map.getSource("destinations");
            if (source === undefined) return;
            Promise.resolve(source.getClusterExpansionZoom(clusterId))
              .then((zoom) => {
                const coordinates = clicked?.geometry?.coordinates;
                if (coordinates === undefined) return;
                if (prefersReducedMotion()) {
                  map.jumpTo({ center: coordinates, zoom });
                } else {
                  map.easeTo({ center: coordinates, zoom });
                }
              })
              .catch(() => undefined);
          });

          map.on("click", "unclustered", (e: MapEvent) => {
            const point = e.point;
            if (point === undefined) return;
            const feature = map.queryRenderedFeatures(point, ["unclustered"])[0] as
              GeoJsonFeature | undefined;
            navigate(feature);
          });
        });
      } catch {
        // Any map/bootstrap failure must not break the page; the list remains.
        mapRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current !== null) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [markers, theme, windowLabel]);

  return (
    <section aria-label="Interactive weather map" className="mt-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Visual overview</p>
          <h2 id={labelId} className="section-title mt-3">
            Weather map
          </h2>
        </div>
        <p className="max-w-xl text-xs leading-5 text-muted sm:text-right">
          See how options cluster for {windowLabel || "this window"}
          {theme ? ` · ${theme}` : ""}. Prefer a simple comparison? Use the destination list above.
        </p>
      </div>
      <div
        ref={containerRef}
        role="region"
        aria-labelledby={labelId}
        data-testid="explorer-map"
        className="mt-5 h-[360px] w-full overflow-hidden rounded-2xl border-4 border-white bg-surface shadow-[0_18px_50px_rgba(31,46,78,0.12)] sm:h-[480px]"
      />
    </section>
  );
}

export default ExplorerMap;
