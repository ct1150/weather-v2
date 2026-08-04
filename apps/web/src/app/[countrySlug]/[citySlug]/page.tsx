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
import { buildAlternates, routeRobots, localeUrl } from "../../seo";

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
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eef3ff] text-2xl"
          aria-hidden="true"
        >
          ☀️
        </span>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-elevated p-3">
          <dt className="text-xs text-muted">Temperature</dt>
          <dd className="mt-1 font-bold text-foreground">
            {weather.temperatureMin !== null ? `${weather.temperatureMin}${degree}` : "–"} /{" "}
            {weather.temperatureMax !== null ? `${weather.temperatureMax}${degree}` : "–"}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-elevated p-3">
          <dt className="text-xs text-muted">Rain chance</dt>
          <dd className="mt-1 font-bold text-foreground">
            {weather.rainProbability !== null ? `${weather.rainProbability}%` : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted">Observed at {weather.observedAt}</p>
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
    unit,
    relatedLinks,
    commercial,
  } = viewModel;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}

      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10">
          <a
            href={`/${city.countrySlug}`}
            className="text-xs font-bold text-primary hover:underline focus-ring"
          >
            ← Explore {city.countryName}
          </a>
          <p className="eyebrow mt-7">Destination forecast</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-6xl">
            {`${city.cityName}, ${city.countryName}`}
          </h1>
          <p className="mt-4 text-sm text-muted">
            {city.timezone} · {city.latitude.toFixed(2)}, {city.longitude.toFixed(2)}
          </p>
        </div>
      </section>

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
          <p className="mt-4 text-sm">
            {score.reasonCodes.length > 0 ? (
              <span className="rounded-full bg-[#f4f7ff] px-3 py-1.5 text-xs font-semibold text-primary">
                {score.reasonCodes.join(", ")}
              </span>
            ) : null}
          </p>
        </section>
      </div>

      {/* Forecast window */}
      <section aria-label="Forecast" className="info-panel mt-5">
        <h2 className="text-lg font-bold text-foreground">Forecast window</h2>
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
        {forecastState === "ready" && localDates.length > 0 ? (
          <p className="mt-2 text-body text-muted">Covering {localDates.join(", ")}</p>
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
        <span>Latest activated data · Stale results are always labeled</span>
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
  return {
    title: baked
      ? `${baked.city.name.en}, ${baked.country.name.en} — Where Not Rain`
      : "Where Not Rain",
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

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${baked.city.name.en}, ${baked.country.name.en}`,
    description: `Weather and Travel Score for ${baked.city.name.en}.`,
    url: localeUrl("en", `/${params.countrySlug}/${params.citySlug}`),
    geo: {
      "@type": "GeoCoordinates",
      latitude: baked.city.latitude,
      longitude: baked.city.longitude,
    },
  };

  return <CityPage viewModel={viewModel} jsonLd={jsonLd} />;
}
