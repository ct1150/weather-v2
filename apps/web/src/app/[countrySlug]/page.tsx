// apps/web/src/app/[countrySlug]/page.tsx
//
// Country destination page (PRD-FR-003, UX-STATE-001). App Router page (T03):
// bakes the dataset, resolves the country from the route `params`, and projects
// the `CountryPageViewModel` for the pure presentational component. Statically
// exported via `generateStaticParams`.

import type { ReactElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CountryPageViewModel, DestinationLinkViewModel } from "../view-models";
import { getBakedDataset, buildConfig, projectCountry } from "../../build/bake";
import { JsonLd } from "../../components/JsonLd";
import { CountryWeatherExplorer } from "../../components/CountryWeatherExplorer";
import { buildAlternates, routeRobots, localeUrl } from "../seo";

export interface CountryPageProps {
  readonly viewModel: CountryPageViewModel;
  /** Server-rendered JSON-LD schema.org node. */
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

function CityList({
  items,
  emptyLabel,
  ranked = false,
}: {
  items: ReadonlyArray<DestinationLinkViewModel>;
  emptyLabel: string;
  ranked?: boolean;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-body text-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((dest, index) => (
        <li key={dest.cityId}>
          <a href={dest.path} className="destination-link focus-ring">
            <span>
              {ranked ? (
                <span className="mr-3 text-xs font-bold text-muted">#{index + 1}</span>
              ) : null}
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
  );
}

export function CountryPage({ viewModel, jsonLd }: CountryPageProps) {
  const {
    country,
    cities,
    rankings,
    relatedLinks,
    weatherCities,
    availableCountries,
    dataUpdatedLabel,
    state,
  } = viewModel;
  const isReady = state === "ready" || state === "stale";
  const hasWeatherConsole =
    isReady &&
    weatherCities !== undefined &&
    weatherCities.length > 0 &&
    availableCountries !== undefined;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}

      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10 max-w-3xl">
          <a href="/" className="text-xs font-bold text-primary hover:underline focus-ring">
            ← Back to Travel Radar
          </a>
          <p className="eyebrow mt-7">Country weather map</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
            Choose the best-weather city in {country.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            {country.summary ??
              `Choose your travel dates, then compare all ${cities.length} listed cities directly on the map—no page hopping required.`}
          </p>
        </div>
      </section>

      {state === "loading" ? (
        <p role="status" className="mt-8 text-body text-muted">
          Loading country…
        </p>
      ) : null}

      {state === "error" ? (
        <p role="alert" className="mt-8 text-body text-danger">
          We couldn’t load this country right now. Please try again.
        </p>
      ) : null}

      {hasWeatherConsole ? (
        <CountryWeatherExplorer
          country={country}
          countries={availableCountries}
          cities={weatherCities}
          updatedLabel={dataUpdatedLabel ?? "Latest available data"}
        />
      ) : isReady ? (
        <>
          <section aria-label="Cities" className="mt-12">
            <p className="eyebrow">Browse the country</p>
            <h2 className="section-title mt-3">Cities</h2>
            <CityList items={cities} emptyLabel="No cities listed yet." />
          </section>

          {rankings.map((ranking) => (
            <section key={ranking.theme} aria-label={ranking.title} className="mt-12">
              <p className="eyebrow">Curated picks</p>
              <h2 className="section-title mt-3">{ranking.title}</h2>
              <CityList
                items={ranking.items}
                emptyLabel="No destinations in this ranking yet."
                ranked
              />
            </section>
          ))}

          {relatedLinks.length > 0 ? (
            <section aria-label="Related destinations" className="mt-12">
              <p className="eyebrow">Keep exploring</p>
              <h2 className="section-title mt-3">Related destinations</h2>
              <CityList items={relatedLinks} emptyLabel="No related destinations yet." />
            </section>
          ) : null}
        </>
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

export async function generateStaticParams(): Promise<ReadonlyArray<{ countrySlug: string }>> {
  const dataset = await getBakedDataset();
  return dataset.countries.map((c) => ({ countrySlug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string };
}): Promise<Metadata> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((c) => c.slug === params.countrySlug);
  return {
    title: country ? country.name.en : "Country guide",
    alternates: buildAlternates(`/${params.countrySlug}`),
    robots: routeRobots("country", true),
  };
}

export default async function Page({
  params,
}: {
  params: { countrySlug: string };
}): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((c) => c.slug === params.countrySlug);
  if (country === undefined) notFound();
  const config = buildConfig();
  const viewModel = projectCountry(dataset, params.countrySlug, config.defaultLocale);

  const firstCity = (dataset.citiesByCountry.get(country.id) ?? [])[0];
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: country.name.en,
    description: `Travel-weather guide for ${country.name.en}.`,
    url: localeUrl("en", `/${country.slug}`),
  };
  if (firstCity !== undefined) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: firstCity.city.latitude,
      longitude: firstCity.city.longitude,
    };
  }

  return <CountryPage viewModel={viewModel} jsonLd={jsonLd} />;
}
