// apps/web/src/app/[countrySlug]/[citySlug]/page.tsx
//
// City destination page (PRD-FR-004, DATA-WEATHER-001, UX-STATE-001). App Router
// page (T03): bakes the dataset, resolves country+city from `params`, and projects
// the `CityPageViewModel`. Statically exported via `generateStaticParams`.

import type { ReactElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type {
  CityPageViewModel,
  DestinationLinkViewModel,
  ScoreViewModel,
  WeatherSummaryViewModel,
} from "../../view-models";
import { getBakedDataset, buildConfig, projectCity } from "../../../build/bake";
import { JsonLd } from "../../../components/JsonLd";
import { CityTripBridge } from "../../../components/CityTripBridge";
import { CityDirectAnswer } from "../../../components/CityDirectAnswer";
import { buildAlternates, routeRobots, localeUrl, citySearchCopy } from "../../seo";

export interface CityPageProps {
  readonly viewModel: CityPageViewModel;
  /** Server-rendered JSON-LD schema.org node. */
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

function renderScoreValue(score: ScoreViewModel): string {
  if (score.value === null) {
    if (score.state === "unavailable") return "Unavailable";
    if (score.state === "limited_data") return "Limited data";
    return "—";
  }
  return String(score.value);
}

function reasonLabel(reason: string): string {
  return reason
    .toLowerCase()
    .split("_")
    .map((word) => (word === "uv" ? "UV" : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function isCautionReason(reason: string): boolean {
  return /RISK|CAUTION|LIMITED|UNAVAILABLE/i.test(reason);
}

function formatObservation(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function WeatherGlyph({ condition }: { condition: string }): ReactElement {
  const cloudy = /cloud|overcast|fog|rain|storm|shower/i.test(condition);
  return (
    <span
      className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-elevated text-primary"
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8">
        {cloudy ? (
          <path
            d="M7.5 22h16a5 5 0 0 0 .2-10 8 8 0 0 0-15 2.8A3.8 3.8 0 0 0 7.5 22Z"
            fill="currentColor"
            opacity=".82"
          />
        ) : (
          <>
            <circle cx="16" cy="16" r="5.5" fill="currentColor" />
            <path
              d="M16 4v3m0 18v3M4 16h3m18 0h3M7.5 7.5l2.2 2.2m12.6 12.6 2.2 2.2m0-17-2.2 2.2M9.7 22.3l-2.2 2.2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </span>
  );
}

function WeatherSummary({
  weather,
  unit,
}: {
  weather: WeatherSummaryViewModel;
  unit: "metric" | "imperial";
}) {
  const degree = unit === "metric" ? "°C" : "°F";
  return (
    <div className="info-panel h-full">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
            Current condition
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">{weather.conditionLabel}</p>
        </div>
        <WeatherGlyph condition={weather.conditionLabel} />
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="metric-block">
          <dt className="text-xs text-muted">Temperature</dt>
          <dd className="mt-1 font-bold text-foreground">
            {weather.temperatureMin !== null ? `${weather.temperatureMin}${degree}` : "–"} /{" "}
            {weather.temperatureMax !== null ? `${weather.temperatureMax}${degree}` : "–"}
          </dd>
        </div>
        <div className="metric-block">
          <dt className="text-xs text-muted">Peak rain chance</dt>
          <dd className="mt-1 font-bold text-foreground">
            {weather.rainProbability !== null ? `${weather.rainProbability}%` : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted">
        Updated <time dateTime={weather.observedAt}>{formatObservation(weather.observedAt)}</time>
      </p>
    </div>
  );
}

export function CityPage({ viewModel, jsonLd }: CityPageProps) {
  const {
    city,
    weather,
    weatherState,
    score,
    forecastState,
    localDates,
    forecastDays,
    unit,
    relatedLinks,
    commercial,
  } = viewModel;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}

      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10">
          <nav aria-label="Breadcrumb" className="country-breadcrumb">
            <ol>
              <li>
                <a href="/" className="focus-ring">
                  Travel Radar
                </a>
              </li>
              <li>
                <a href={`/${city.countrySlug}`} className="focus-ring">
                  {city.countryName}
                </a>
              </li>
              <li aria-current="page">{city.cityName}</li>
            </ol>
          </nav>
          <p className="eyebrow mt-7">Destination forecast</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-6xl">
            {`${city.cityName}, ${city.countryName}`}
          </h1>
          <p className="mt-4 text-sm text-muted">
            {city.timezone} · {city.latitude.toFixed(2)}, {city.longitude.toFixed(2)}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            See which of the next seven days are mostly rain-free, how much rain is expected and the
            temperature range, then compare other destinations across {city.countryName}.
          </p>
        </div>
      </section>

      <CityDirectAnswer cityName={city.cityName} forecastDays={forecastDays ?? []} locale="en" />

      <CityTripBridge
        locale="en"
        cityId={city.cityId}
        cityName={city.cityName}
        countryName={city.countryName}
        defaultDate={localDates[0] ?? ""}
        workspacePath="/trips/workspace"
      />

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {/* Current weather (DATA-WEATHER-001) */}
        <section aria-label="Current weather">
          <h2 className="sr-only">Weather now</h2>
          {weatherState === "loading" ? (
            <p role="status" className="mt-2 text-body text-muted">
              Loading weather…
            </p>
          ) : null}
          {weatherState === "error" ? (
            <p role="alert" className="mt-2 text-body text-danger">
              We couldn’t load the current weather.
            </p>
          ) : null}
          {weatherState === "empty" ? (
            <p className="mt-2 text-body text-muted">No current weather available.</p>
          ) : null}
          {weatherState === "ready" && weather !== null ? (
            <div>
              <WeatherSummary weather={weather} unit={unit} />
            </div>
          ) : null}
        </section>

        {/* Travel Score */}
        <section aria-label="Travel Score" className="info-panel h-full">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Travel Score</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-bold tracking-[-0.05em] text-foreground">
              {renderScoreValue(score)}
            </span>
            {score.value !== null ? (
              <span className="mb-1 text-sm font-semibold text-muted">/ 100</span>
            ) : null}
          </div>
          {score.reasonCodes.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Travel Score reasons">
              {score.reasonCodes.map((reason) => (
                <li
                  key={reason}
                  aria-label={`Reason: ${reason}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${isCautionReason(reason) ? "signal-caution" : "signal-good"}`}
                >
                  {reasonLabel(reason)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      {/* Forecast window */}
      <section aria-label="Forecast" className="info-panel mt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Plan the days</p>
            <h2 className="section-title mt-3">7-day trip outlook</h2>
          </div>
          <p className="text-xs text-muted">Dates and weather use {city.timezone}</p>
        </div>
        {forecastState === "loading" ? (
          <p role="status" className="mt-2 text-body text-muted">
            Loading forecast…
          </p>
        ) : null}
        {forecastState === "error" ? (
          <p role="alert" className="mt-2 text-body text-danger">
            We couldn’t load the forecast.
          </p>
        ) : null}
        {forecastState === "empty" ? (
          <p className="mt-2 text-body text-muted">No forecast available.</p>
        ) : null}
        {forecastState === "ready" && (forecastDays?.length ?? 0) > 0 ? (
          <ol className="forecast-timeline mt-6">
            {forecastDays?.map((day, index) => (
              <li key={day.localDate} className="forecast-day">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                    {index === 0 ? "Today" : index === 1 ? "Tomorrow" : `Day ${index + 1}`}
                  </p>
                  <time
                    dateTime={day.localDate}
                    className="mt-1 block text-sm font-bold text-foreground"
                  >
                    {day.localDate}
                  </time>
                </div>
                <div className="sm:text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {day.weather.conditionLabel}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {day.weather.temperatureMin ?? "–"}° / {day.weather.temperatureMax ?? "–"}°
                  </p>
                </div>
                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <span
                    className={
                      day.weather.rainProbability !== null && day.weather.rainProbability <= 45
                        ? "text-sm font-bold text-success"
                        : "text-sm font-bold text-accent"
                    }
                  >
                    {day.weather.rainProbability ?? "—"}% peak rain
                  </span>
                  <span className="min-w-12 text-right text-sm font-bold text-foreground">
                    {renderScoreValue(day.score)}
                    <span className="block text-[9px] uppercase tracking-[0.1em] text-muted">
                      Score
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : forecastState === "ready" && localDates.length > 0 ? (
          <p className="mt-4 text-body text-muted">Covering {localDates.join(", ")}</p>
        ) : null}
      </section>

      {/* Commercial / affiliate links — clearly disclosed (no effect on ranking). */}
      {commercial.length > 0 ? (
        <section aria-label="Travel services" className="info-panel mt-5">
          <h2 className="text-lg font-bold text-foreground">Travel services</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {commercial.map((item, index) => (
              <li
                key={index}
                className="rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-caption text-muted">
            These are affiliate links; they do not affect our recommendations.
          </p>
        </section>
      ) : null}

      {/* Related destinations */}
      {relatedLinks.length > 0 ? (
        <section aria-label="Related destinations" className="mt-12">
          <p className="eyebrow">Keep exploring</p>
          <h2 className="section-title mt-3">Related destinations</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedLinks.map((dest: DestinationLinkViewModel) => (
              <li key={dest.cityId}>
                <a href={dest.path} className="destination-link focus-ring">
                  <span>
                    <span className="font-bold text-foreground">{dest.cityName}</span>
                    <span className="ml-2 text-xs text-muted">{dest.countryName}</span>
                  </span>
                  <span aria-hidden="true" className="text-lg text-primary">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="page-footer">
        <span>Where Not Rain · Weather-led travel inspiration</span>
        <span>
          Forecast data by <a href="https://open-meteo.com/">Open-Meteo</a> · Derived Travel Score
        </span>
      </footer>
    </main>
  );
}

export async function generateStaticParams(): Promise<
  ReadonlyArray<{ countrySlug: string; citySlug: string }>
> {
  const dataset = await getBakedDataset();
  return dataset.cities.map((b) => ({ countrySlug: b.country.slug, citySlug: b.city.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}): Promise<Metadata> {
  const dataset = await getBakedDataset();
  const baked = dataset.cities.find(
    (b) => b.city.slug === params.citySlug && b.country.slug === params.countrySlug,
  );
  const searchCopy = baked ? citySearchCopy(baked.city.name.en, baked.country.name.en) : null;
  return {
    title: searchCopy?.title ?? "Destination travel weather",
    description:
      searchCopy?.description ??
      "See which of the next seven days are mostly rain-free, plus expected rain and temperature for this destination.",
    alternates: buildAlternates(`/${params.countrySlug}/${params.citySlug}`),
    robots: routeRobots("city", true),
  };
}

export default async function Page({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const baked = dataset.cities.find(
    (b) => b.city.slug === params.citySlug && b.country.slug === params.countrySlug,
  );
  if (baked === undefined) notFound();
  const config = buildConfig();
  const viewModel = projectCity(dataset, params.countrySlug, params.citySlug, config.defaultLocale);
  const searchCopy = citySearchCopy(baked.city.name.en, baked.country.name.en);

  const pageUrl = localeUrl("en", `/${params.countrySlug}/${params.citySlug}`);
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  const placeId = `${pageUrl}#place`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: searchCopy.title,
        description: searchCopy.description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
        breadcrumb: { "@id": breadcrumbId },
        mainEntity: { "@id": placeId },
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Travel Radar", item: localeUrl("en", "/") },
          {
            "@type": "ListItem",
            position: 2,
            name: baked.country.name.en,
            item: localeUrl("en", `/${baked.country.slug}`),
          },
          { "@type": "ListItem", position: 3, name: baked.city.name.en, item: pageUrl },
        ],
      },
      {
        "@type": "Place",
        "@id": placeId,
        name: `${baked.city.name.en}, ${baked.country.name.en}`,
        description: searchCopy.description,
        url: pageUrl,
        geo: {
          "@type": "GeoCoordinates",
          latitude: baked.city.latitude,
          longitude: baked.city.longitude,
        },
        containedInPlace: {
          "@type": "Country",
          name: baked.country.name.en,
          url: localeUrl("en", `/${baked.country.slug}`),
        },
      },
    ],
  };

  return <CityPage viewModel={viewModel} jsonLd={jsonLd} />;
}
