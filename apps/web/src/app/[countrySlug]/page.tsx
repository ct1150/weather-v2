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
import { buildAlternates, routeRobots, localeUrl } from "../seo";

export interface CountryPageProps {
  readonly viewModel: CountryPageViewModel;
  /** Server-rendered JSON-LD schema.org node. */
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

function CityList({
  items,
  emptyLabel,
}: {
  items: ReadonlyArray<DestinationLinkViewModel>;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-body text-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
      {items.map((dest) => (
        <li key={dest.cityId}>
          <a
            href={dest.path}
            className="block rounded-lg border border-border bg-surface p-3 text-primary hover:bg-surface-elevated focus-ring"
          >
            <span className="font-medium">{dest.cityName}</span>
            <span className="ml-2 text-body-small text-muted">{dest.countryName}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function CountryPage({ viewModel, jsonLd }: CountryPageProps) {
  const { country, cities, rankings, relatedLinks, state } = viewModel;
  const isReady = state === "ready" || state === "stale";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}

      <h1 className="text-3xl font-semibold text-foreground">{country.name}</h1>
      {country.summary !== null ? (
        <p className="mt-2 max-w-2xl text-body text-muted">{country.summary}</p>
      ) : null}

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

      {isReady ? (
        <>
          <section aria-label="Cities" className="mt-8">
            <h2 className="text-heading-3 font-semibold text-foreground">Cities</h2>
            <CityList items={cities} emptyLabel="No cities listed yet." />
          </section>

          {rankings.map((ranking) => (
            <section key={ranking.theme} aria-label={ranking.title} className="mt-8">
              <h2 className="text-heading-3 font-semibold text-foreground">{ranking.title}</h2>
              <CityList items={ranking.items} emptyLabel="No destinations in this ranking yet." />
            </section>
          ))}

          {relatedLinks.length > 0 ? (
            <section aria-label="Related destinations" className="mt-8">
              <h2 className="text-heading-3 font-semibold text-foreground">Related destinations</h2>
              <CityList items={relatedLinks} emptyLabel="No related destinations yet." />
            </section>
          ) : null}
        </>
      ) : null}

      <footer className="mt-12 border-t border-border pt-6 text-caption text-muted">
        Recommendations use the latest activated weather and Travel Score; stale results remain
        usable but are labeled.
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
    title: country ? `${country.name.en} — Where Not Rain` : "Where Not Rain",
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
