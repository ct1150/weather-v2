"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";
import type { WorldWeatherStatus } from "../world/world-overview";
import { countryMapGeometry } from "./country-map-geometry";

import "maplibre-gl/dist/maplibre-gl.css";

export const WORLD_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

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
  readonly on: (event: string, callback: () => void) => void;
  readonly remove: () => void;
}

interface MarkerLike {
  readonly remove: () => void;
}

const COPY = {
  en: {
    aria: "World travel weather overview",
    hint: "Weather bubbles show supported countries. Tap one to compare its cities.",
    excellent: "Great options",
    good: "Good options",
    mixed: "Mixed weather",
    poor: "Higher weather risk",
    unknown: "Limited data",
    cities: (count: number) => `${count} destinations`,
    open: "Open city weather →",
  },
  "zh-cn": {
    aria: "全球旅行天气总览",
    hint: "彩色天气气泡代表已支持国家，点击即可比较该国城市天气。",
    excellent: "天气很适合",
    good: "较适合出行",
    mixed: "天气一般",
    poor: "天气风险较高",
    unknown: "数据有限",
    cities: (count: number) => `${count} 个目的地`,
    open: "查看城市天气 →",
  },
  "zh-hant": {
    aria: "全球旅行天氣總覽",
    hint: "彩色天氣氣泡代表已支援國家，點擊即可比較該國城市天氣。",
    excellent: "天氣很適合",
    good: "較適合出行",
    mixed: "天氣一般",
    poor: "天氣風險較高",
    unknown: "資料有限",
    cities: (count: number) => `${count} 個目的地`,
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

function markerElement(
  item: PositionedCountry,
  locale: BrowserAnalyticsLocale,
  onActivate: (slug: string) => void,
  onOpen: (country: WorldWeatherMapCountry, position: number) => void,
): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = item.country.path;
  link.className = `world-weather-marker status-${item.country.weatherStatus}`;
  link.dataset.countryId = item.code;
  link.dataset.countrySlug = item.country.slug;
  link.setAttribute(
    "aria-label",
    `${item.country.name}: ${statusLabel(locale, item.country.weatherStatus)}`,
  );

  const score = document.createElement("strong");
  score.textContent = item.country.weatherScore === null ? "—" : String(item.country.weatherScore);
  score.className = "world-weather-marker-score";

  const code = document.createElement("span");
  code.textContent = item.code;
  code.className = "world-weather-marker-code";

  link.append(score, code);
  link.addEventListener("mouseenter", () => onActivate(item.country.slug));
  link.addEventListener("focus", () => onActivate(item.country.slug));
  link.addEventListener("click", () => onOpen(item.country, item.position));
  return link;
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
  const markerRefs = useRef<MarkerLike[]>([]);
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
          center: [105, 18],
          zoom: window.innerWidth <= 640 ? 0.95 : 1.15,
          minZoom: 0.55,
          maxZoom: 4.5,
          renderWorldCopies: false,
          attributionControl: { compact: true },
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false,
        }) as unknown as MapLike;

        mapRef.current = map;

        markerRefs.current = positioned.map((item) => {
          const element = markerElement(item, locale, setActiveSlug, recordOpen);
          return new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat([item.longitude, item.latitude])
            .addTo(map as never) as unknown as MarkerLike;
        });

        map.on("load", () => {
          if (containerRef.current !== null) {
            containerRef.current.dataset.renderState = "ready";
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
      for (const marker of markerRefs.current) marker.remove();
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [locale, positioned, recordOpen]);

  const activePosition = Math.max(
    1,
    countries.findIndex((country) => country.slug === active?.slug) + 1,
  );

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
        <p className="world-weather-map-hint">{copy.hint}</p>
      </div>

      {active ? (
        <a
          href={active.path}
          className={`world-weather-focus-card status-${active.weatherStatus} focus-ring`}
          onClick={() => recordOpen(active, activePosition)}
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
          <p>{active.cityNames.slice(0, 3).join(" · ")}</p>
          <span>{copy.open}</span>
        </a>
      ) : null}
    </section>
  );
}
