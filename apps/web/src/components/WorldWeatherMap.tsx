"use client";

import { useMemo, useState, type ReactElement } from "react";
import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";
import type { WorldWeatherStatus } from "../world/world-overview";
import { COUNTRY_MAP_HEIGHT, COUNTRY_MAP_WIDTH, countryMapGeometry } from "./country-map-geometry";

const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 620;

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

const COPY = {
  en: {
    aria: "World travel weather overview",
    hint: "Tap a highlighted country to see its cities",
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
    hint: "点击高亮国家，直接查看城市天气",
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
    hint: "點擊高亮國家，直接查看城市天氣",
    excellent: "天氣很適合",
    good: "較適合出行",
    mixed: "天氣一般",
    poor: "天氣風險較高",
    unknown: "資料有限",
    cities: (count: number) => `${count} 個目的地`,
    open: "查看城市天氣 →",
  },
} as const;

function projectX(longitude: number): number {
  return ((longitude + 180) / 360) * WORLD_WIDTH;
}

function projectY(latitude: number): number {
  return ((90 - latitude) / 180) * WORLD_HEIGHT;
}

function statusLabel(locale: BrowserAnalyticsLocale, status: WorldWeatherStatus): string {
  return COPY[locale][status];
}

const WORLD_LAND_PATH = [
  "M72 164 C110 95 210 74 300 105 C340 128 344 174 310 203 C280 230 246 245 230 292 C209 334 162 327 139 287 C106 258 72 218 72 164Z",
  "M322 290 C357 264 397 277 419 315 C444 354 432 414 401 469 C372 518 335 515 320 461 C300 401 289 333 322 290Z",
  "M520 139 C583 82 697 72 786 104 C840 120 884 151 932 168 C970 184 981 218 947 243 C902 274 850 260 817 278 C765 308 716 306 674 281 C628 254 586 247 546 224 C514 204 495 170 520 139Z",
  "M734 286 C780 255 846 267 884 302 C912 330 902 365 871 383 C835 404 798 394 770 373 C742 351 714 317 734 286Z",
  "M925 398 C963 374 1017 386 1040 420 C1060 450 1040 482 1004 492 C963 501 930 477 916 449 C907 430 910 411 925 398Z",
].join(" ");

export function WorldWeatherMap({
  countries,
  locale,
}: {
  readonly countries: ReadonlyArray<WorldWeatherMapCountry>;
  readonly locale: BrowserAnalyticsLocale;
}): ReactElement {
  const copy = COPY[locale];
  const [activeSlug, setActiveSlug] = useState(countries[0]?.slug ?? "");
  const active = countries.find((country) => country.slug === activeSlug) ?? countries[0] ?? null;

  const positioned = useMemo(
    () =>
      countries.map((country, index) => {
        const geometry = countryMapGeometry(country.countryId ?? country.slug);
        const x = projectX(geometry.minLongitude);
        const right = projectX(geometry.maxLongitude);
        const y = projectY(geometry.maxLatitude);
        const bottom = projectY(geometry.minLatitude);
        return {
          country,
          position: index + 1,
          geometry,
          x,
          y,
          width: Math.max(12, right - x),
          height: Math.max(12, bottom - y),
          centerX: (x + right) / 2,
          centerY: (y + bottom) / 2,
        };
      }),
    [countries],
  );

  function recordOpen(country: WorldWeatherMapCountry, position: number): void {
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
  }

  const activePosition = Math.max(
    1,
    countries.findIndex((country) => country.slug === active?.slug) + 1,
  );

  return (
    <section className="world-weather-panel" aria-label={copy.aria} data-world-weather-map>
      <div className="world-weather-map-wrap">
        <svg
          className="world-weather-map"
          viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
          role="img"
          aria-label={copy.aria}
          preserveAspectRatio="xMidYMid meet"
        >
          <path d={WORLD_LAND_PATH} className="world-weather-land" />
          {positioned.map(
            ({ country, position, geometry, x, y, width, height, centerX, centerY }) => (
              <a
                key={country.slug}
                href={country.path}
                aria-label={`${country.name}: ${statusLabel(locale, country.weatherStatus)}`}
                className={`world-weather-country-link status-${country.weatherStatus}`}
                onMouseEnter={() => setActiveSlug(country.slug)}
                onFocus={() => setActiveSlug(country.slug)}
                onClick={() => recordOpen(country, position)}
              >
                <svg
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  viewBox={`0 0 ${COUNTRY_MAP_WIDTH} ${COUNTRY_MAP_HEIGHT}`}
                  preserveAspectRatio="xMidYMid meet"
                  overflow="hidden"
                >
                  <path
                    d={geometry.path}
                    className="world-weather-country-shape"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                </svg>
                <circle
                  cx={centerX}
                  cy={centerY}
                  r={30}
                  className="world-weather-country-touch-target"
                />
                <circle cx={centerX} cy={centerY} r={8} className="world-weather-country-hit" />
              </a>
            ),
          )}
        </svg>
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
