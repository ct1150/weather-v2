"use client";

import { useEffect, useRef, type ReactElement } from "react";
import type { RoutePlan, RouteWaypoint, RouteAnchor } from "../trips/route-intelligence";
import { MAPLIBRE_STYLE_URL } from "./ExplorerMap";

import "maplibre-gl/dist/maplibre-gl.css";

interface TripExecutionMapProps {
  readonly plan: RoutePlan;
  readonly waypoints: ReadonlyArray<RouteWaypoint>;
  readonly startAnchor: RouteAnchor | null;
  readonly endAnchor: RouteAnchor | null;
}

function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
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

export function TripExecutionMap({
  plan,
  waypoints,
  startAnchor,
  endAnchor,
}: TripExecutionMapProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasWebGL() || containerRef.current === null) return;
    let cancelled = false;
    let map: { remove: () => void } | null = null;

    void import("maplibre-gl")
      .then((module) => {
        if (cancelled || containerRef.current === null) return;
        const maplibregl = module.default;
        const points: Array<[number, number]> = [
          ...(startAnchor ? [[startAnchor.longitude, startAnchor.latitude] as [number, number]] : []),
          ...waypoints.map((item) => [item.longitude, item.latitude] as [number, number]),
          ...(endAnchor ? [[endAnchor.longitude, endAnchor.latitude] as [number, number]] : []),
        ];
        const center: [number, number] = points.length > 0
          ? [
              points.reduce((sum, point) => sum + point[0], 0) / points.length,
              points.reduce((sum, point) => sum + point[1], 0) / points.length,
            ]
          : [120, 30];

        const instance = new maplibregl.Map({
          container: containerRef.current,
          style: MAPLIBRE_STYLE_URL,
          center,
          zoom: points.length > 1 ? 11 : 12,
          attributionControl: { compact: true },
        });
        map = instance;
        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        instance.on("load", () => {
          if (plan.geometry.length >= 2) {
            instance.addSource("trip-route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: plan.geometry.map(([lng, lat]) => [lng, lat]) },
              },
            });
            instance.addLayer({
              id: "trip-route-line",
              type: "line",
              source: "trip-route",
              paint: {
                "line-color": "#2563eb",
                "line-width": 5,
                "line-opacity": 0.85,
              },
            });
          }

          const markerNodes = [
            ...(startAnchor ? [{ ...startAnchor, locked: true }] : []),
            ...waypoints,
            ...(endAnchor ? [{ ...endAnchor, locked: true }] : []),
          ];
          markerNodes.forEach((item, index) => {
            const element = document.createElement("div");
            element.textContent = String(index + 1);
            element.title = item.label;
            Object.assign(element.style, {
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              display: "grid",
              placeItems: "center",
              background: item.locked ? "#dc2626" : "#2563eb",
              color: "#ffffff",
              border: "2px solid #ffffff",
              fontSize: "12px",
              fontWeight: "700",
              boxShadow: "0 4px 12px rgba(15,23,42,0.22)",
            });
            new maplibregl.Marker({ element })
              .setLngLat([item.longitude, item.latitude])
              .addTo(instance);
          });

          if (points.length > 1) {
            const firstPoint = points[0]!;
            const bounds = points.reduce(
              (value, point) => value.extend(point),
              new maplibregl.LngLatBounds(firstPoint, firstPoint),
            );
            instance.fitBounds(bounds, { padding: 52, maxZoom: 14, duration: 0 });
          }
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [endAnchor, plan, startAnchor, waypoints]);

  return (
    <div
      ref={containerRef}
      className="h-[360px] w-full overflow-hidden rounded-2xl border border-border bg-surface sm:h-[520px]"
      role="region"
      aria-label="当天执行路线地图"
      data-route-source={plan.source}
    />
  );
}
