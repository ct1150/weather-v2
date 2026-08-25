"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";
import type { WorldWeatherStatus } from "../world/world-overview";
import { countryMapGeometry } from "./country-map-geometry";
import { SUPPORTED_COUNTRY_GEOMETRY } from "./world-supported-country-geometry";

import "maplibre-gl/dist/maplibre-gl.css";

export const WORLD_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const COUNTRY_SOURCE_ID = "world-weather-supported-countries";
const COUNTRY_FILL_LAYER_ID = "world-weather-supported-country-fill";
const COUNTRY_HALO_LAYER_ID = "world-weather-supported-country-halo";
const COUNTRY_OUTLINE_LAYER_ID = "world-weather-supported-country-outline";

export interface WorldWeatherMapCountry {
  readonly countryId?: string;
  readonly slug: string;
  readonly name: string;
  readonly path: string;
  readonly cityCount: number;
  readonly cityNames: ReadonlyArray<string>;
  readonly weatherScore: number | null;
  readonly weatherStatus: WorldWeatherStatus;
}

interface PositionedCountry {
  readonly country: WorldWeatherMapCountry;
  readonly position: number;
  readonly longitude: number;
  readonly latitude: number;
  readonly code: string;
}

interface MapLike {
  readonly remove: () => void;
}

interface MarkerLike {
  readonly remove: () => void;
}

interface FeatureStateMap {
  readonly setFeatureState: (
    target: { readonly source: string; readonly id: string },
    state: { readonly focused: boolean; readonly dimmed: boolean },
  ) => void;
}

const COPY = {
  en: {
    aria: "World travel weather overview",
    desktopHint: "Hover a colored country to preview. Click it to compare cities.",
    mobileHint: "Tap a colored country to preview. Use the card below to open city weather.",
    excellent: "Great options",
    good: "Good options",
    mixed: "Mixed weather",
    poor: "Higher weather risk",
    unknown: "Limited data",
    cities: (count: number) => `${count} destinations`,
    topCities: "Top destinations",
    open: "Open city weather →",
  },
  "zh-cn": {
    aria: "全球旅行天气总览",
    desktopHint: "鼠标移到有颜色的国家可预览，点击即可比较城市天气。",
    mobileHint: "轻触有颜色的国家先预览，再通过下方概览进入城市天气。",
    excellent: "天气很适合",
    good: "较适合出行",
    mixed: "天气一般",
    poor: "天气风险较高",
    unknown: "数据有限",
    cities: (count: number) => `${count} 个目的地`,
    topCities: "推荐目的地",
    open: "查看城市天气 →",
  },
  "zh-hant": {
    aria: "全球旅行天氣總覽",
    desktopHint: "滑鼠移到有顏色的國家可預覽，點擊即可比較城市天氣。",
    mobileHint: "輕觸有顏色的國家先預覽，再透過下方概覽進入城市天氣。",
    excellent: "天氣很適合",
    good: "較適合出行",
    mixed: "天氣一般",
    poor: "天氣風險較高",
    unknown: "資料有限",
    cities: (count: number) => `${count} 個目的地`,
    topCities: "推薦目的地",
    open: "查看城市天氣 →",
  },
} as const;

function statusLabel(locale: BrowserAnalyticsLocale, status: WorldWeatherStatus): string {
  return COPY[locale][status];
}

function countryCenter(country: WorldWeatherMapCountry): {
  readonly longitude: number;
  readonly latitude: number;
  readonly code: string;
} {
  const code = (country.countryId ?? country.slug).slice(0, 2).toUpperCase();
  const geometry = countryMapGeometry(code);
  return {
    longitude: (geometry.minLongitude + geometry.maxLongitude) / 2,
    latitude: (geometry.minLatitude + geometry.maxLatitude) / 2,
    code,
  };
}

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

function applyFeatureFocus(
  map: FeatureStateMap,
  countryCodes: ReadonlyArray<string>,
  focusedCode: string | null,
): void {
  for (const code of countryCodes) {
    map.setFeatureState(
      { source: COUNTRY_SOURCE_ID, id: code },
      {
        focused: focusedCode === code,
        dimmed: focusedCode !== null && focusedCode !== code,
      },
    );
  }
}

function hotspotElement(
  item: PositionedCountry,
  locale: BrowserAnalyticsLocale,
  onActivate: (code: string) => void,
  onOpen: (item: PositionedCountry) => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "world-weather-hotspot";
  button.dataset.countryId = item.code;
  button.dataset.countrySlug = item.country.slug;
  button.setAttribute(
    "aria-label",
    `${item.country.name}: ${statusLabel(locale, item.country.weatherStatus)}`,
  );
  button.addEventListener("mouseenter", () => onActivate(item.code));
  button.addEventListener("focus", () => onActivate(item.code));
  button.addEventListener("click", () => onOpen(item));
  return button;
}

function buildWeatherGeometry(
  positioned: ReadonlyArray<PositionedCountry>,
): Readonly<Record<string, unknown>> {
  const byCode = new Map(positioned.map((item) => [item.code, item] as const));
  return {
    type: "FeatureCollection",
    features: SUPPORTED_COUNTRY_GEOMETRY.features.map((feature) => {
      const item = byCode.get(feature.properties.code);
      return {
        id: feature.properties.code,
        type: "Feature",
        properties: {
          code: feature.properties.code,
          status: item?.country.weatherStatus ?? "unknown",
          score: item?.country.weatherScore ?? -1,
          slug: item?.country.slug ?? "",
          position: item?.position ?? 0,
        },
        geometry: feature.geometry,
      };
    }),
  };
}

export function WorldWeatherMap({
  countries,
  locale,
}: {
  readonly countries: ReadonlyArray<WorldWeatherMapCountry>;
  readonly locale: BrowserAnalyticsLocale;
}): ReactElement {
  const copy = COPY[locale];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLike | null>(null);
  const hotspotRefs = useRef<MarkerLike[]>([]);
  const [activeSlug, setActiveSlug] = useState(countries[0]?.slug ?? "");
  const active = countries.find((country) => country.slug === activeSlug) ?? countries[0] ?? null;

  const positioned = useMemo<ReadonlyArray<PositionedCountry>>(
    () =>
      countries.map((country, index) => ({
        country,
        position: index + 1,
        ...countryCenter(country),
      })),
    [countries],
  );

  const recordOpen = useCallback(
    (country: WorldWeatherMapCountry, position: number): void => {
      emitProductAnalytics({
        locale,
        routeTemplate: "/",
        fields: {
          event: "search_result_clicked",
          destination_id: country.slug,
          result_type: "country",
          position,
        },
      });
    },
    [locale],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    container.dataset.renderState = "loading";
    if (!hasWebGL()) {
      container.dataset.renderState = "fallback";
      return;
    }

    let cancelled = false;

    void (async (): Promise<void> => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (cancelled || containerRef.current === null) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: WORLD_MAP_STYLE_URL,
          center: [111, 20],
          zoom: 1,
          minZoom: 0.55,
          maxZoom: 4.5,
          renderWorldCopies: false,
          attributionControl: { compact: true },
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false,
        });

        const compactInteraction = window.innerWidth <= 640;
        const countryCodes = positioned.map((item) => item.code);
        const featureStateMap = map as unknown as FeatureStateMap;
        const activateCountry = (code: string): void => {
          const item = positioned.find((candidate) => candidate.code === code);
          if (item === undefined) return;
          setActiveSlug(item.country.slug);
          applyFeatureFocus(featureStateMap, countryCodes, code);
          if (containerRef.current !== null) {
            containerRef.current.dataset.highlightedCountry = code;
          }
        };
        const openCountry = (item: PositionedCountry): void => {
          activateCountry(item.code);
          if (compactInteraction) return;
          recordOpen(item.country, item.position);
          window.location.assign(item.country.path);
        };

        mapRef.current = map as unknown as MapLike;
        Reflect.set(containerRef.current, "__wnrWorldMap", map);
        containerRef.current.dataset.interactionMode = compactInteraction
          ? "tap-preview"
          : "hover-open";

        const singapore = positioned.find((item) => item.code === "SG");
        if (singapore !== undefined) {
          const element = hotspotElement(singapore, locale, activateCountry, openCountry);
          hotspotRefs.current = [
            new maplibregl.Marker({ element, anchor: "center" })
              .setLngLat([singapore.longitude, singapore.latitude])
              .addTo(map) as unknown as MarkerLike,
          ];
        }

        map.on("load", () => {
          map.addSource(COUNTRY_SOURCE_ID, {
            type: "geojson",
            data: buildWeatherGeometry(positioned) as never,
          });
          map.addLayer({
            id: COUNTRY_FILL_LAYER_ID,
            type: "fill",
            source: COUNTRY_SOURCE_ID,
            paint: {
              "fill-color": [
                "match",
                ["get", "status"],
                "excellent",
                "#22c55e",
                "good",
                "#84cc16",
                "mixed",
                "#eab308",
                "poor",
                "#f97316",
                "#94a3b8",
              ],
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "focused"], false],
                0.9,
                ["boolean", ["feature-state", "dimmed"], false],
                0.3,
                0.62,
              ],
              "fill-opacity-transition": { duration: 180, delay: 0 },
            },
          });
          map.addLayer({
            id: COUNTRY_HALO_LAYER_ID,
            type: "line",
            source: COUNTRY_SOURCE_ID,
            paint: {
              "line-color": "#60a5fa",
              "line-width": ["case", ["boolean", ["feature-state", "focused"], false], 7, 0],
              "line-opacity": ["case", ["boolean", ["feature-state", "focused"], false], 0.34, 0],
              "line-blur": 3,
              "line-width-transition": { duration: 180, delay: 0 },
              "line-opacity-transition": { duration: 180, delay: 0 },
            },
          });
          map.addLayer({
            id: COUNTRY_OUTLINE_LAYER_ID,
            type: "line",
            source: COUNTRY_SOURCE_ID,
            paint: {
              "line-color": [
                "case",
                ["boolean", ["feature-state", "focused"], false],
                "#2563eb",
                "#ffffff",
              ],
              "line-width": [
                "case",
                ["boolean", ["feature-state", "focused"], false],
                3.2,
                ["interpolate", ["linear"], ["zoom"], 0.5, 0.8, 3, 1.8],
              ],
              "line-opacity": ["case", ["boolean", ["feature-state", "dimmed"], false], 0.42, 0.94],
              "line-width-transition": { duration: 180, delay: 0 },
              "line-opacity-transition": { duration: 180, delay: 0 },
            },
          });

          map.on("mouseenter", COUNTRY_FILL_LAYER_ID, (event) => {
            map.getCanvas().style.cursor = "pointer";
            const code = String(event.features?.[0]?.properties?.code ?? "");
            if (code.length > 0) activateCountry(code);
          });
          map.on("mouseleave", COUNTRY_FILL_LAYER_ID, () => {
            map.getCanvas().style.cursor = "";
            if (compactInteraction) return;
            applyFeatureFocus(featureStateMap, countryCodes, null);
            if (containerRef.current !== null) {
              delete containerRef.current.dataset.highlightedCountry;
            }
          });
          map.on("click", COUNTRY_FILL_LAYER_ID, (event) => {
            const code = String(event.features?.[0]?.properties?.code ?? "");
            const item = positioned.find((candidate) => candidate.code === code);
            if (item !== undefined) openCountry(item);
          });

          map.fitBounds(
            [
              [72, -15],
              [149, 56],
            ],
            {
              padding: compactInteraction ? 16 : 32,
              duration: 0,
              maxZoom: compactInteraction ? 2.15 : 2.35,
            },
          );

          if (containerRef.current !== null) {
            containerRef.current.dataset.renderState = "ready";
            containerRef.current.dataset.countryLayer = "ready";
          }
        });
      } catch {
        if (containerRef.current !== null) {
          containerRef.current.dataset.renderState = "fallback";
        }
        mapRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      for (const hotspot of hotspotRefs.current) hotspot.remove();
      hotspotRefs.current = [];
      if (containerRef.current !== null) {
        Reflect.deleteProperty(containerRef.current, "__wnrWorldMap");
      }
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [locale, positioned, recordOpen]);

  const activePosition = Math.max(
    1,
    countries.findIndex((country) => country.slug === active?.slug) + 1,
  );
  const activeCode = active === null ? "" : countryCenter(active).code;

  return (
    <section className="world-weather-panel" aria-label={copy.aria} data-world-weather-map>
      <div className="world-weather-map-wrap">
        <div
          ref={containerRef}
          className="world-weather-map-canvas"
          data-world-weather-map-canvas
          data-render-state="loading"
          role="region"
          aria-label={copy.aria}
        />
        <p className="world-weather-map-hint">
          <span className="world-weather-hint-desktop">{copy.desktopHint}</span>
          <span className="world-weather-hint-mobile">{copy.mobileHint}</span>
        </p>
      </div>

      {active ? (
        <aside
          key={active.slug}
          className={`world-weather-focus-card status-${active.weatherStatus}`}
          data-world-weather-overview
          data-active-country={activeCode}
        >
          <div>
            <span className="world-weather-focus-status">
              {statusLabel(locale, active.weatherStatus)}
            </span>
            <strong>{active.name}</strong>
            <small>{copy.cities(active.cityCount)}</small>
          </div>
          <div className="world-weather-focus-score" aria-label="weather score">
            {active.weatherScore ?? "—"}
          </div>
          <div className="world-weather-focus-destinations">
            <small>{copy.topCities}</small>
            <p>{active.cityNames.slice(0, 3).join(" · ")}</p>
          </div>
          <a
            href={active.path}
            className="world-weather-focus-link focus-ring"
            data-world-weather-overview-link
            onClick={() => recordOpen(active, activePosition)}
          >
            {copy.open}
          </a>
        </aside>
      ) : null}
    </section>
  );
}
