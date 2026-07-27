// apps/web/src/app/page.tsx
//
// Travel Radar homepage (PRD-FR-001, UX-HOME-001, VISION-VALUE-001,
// UX-STATE-001, SEO-STRUCTURED-001).
//
// App Router page (system_design.md T03): at build time it bakes the dataset and
// projects the `TravelRadarViewModel`, then renders the pure presentational
// component. No request-time data path — the page is statically exported.
//
// The time-window selector carries its state in the href, but because this phase
// is a static export there is no client runtime to re-render on the query string;
// the selector links are decorative and the page is rendered for the default
// window. (Switching to Next-on-Pages + a route handler would make it live.)
//
// Progressive enhancement: crawlable recommendation cards render FIRST; the
// MapLibre map hydrates AFTER them and the JSON-LD structured data is
// server-rendered into the static HTML.

import type { ReactElement } from "react";
import type { Metadata } from "next";
import type { TravelRadarViewModel, WindowControl, ExplorerMapMarker } from "./view-models";
import type { Window } from "../api/v1/schemas";
import {
  getBakedDataset,
  buildConfig,
  projectHome,
  buildWindowControls,
  projectHomeMapMarkers,
} from "../build/bake";
import { ExplorerMap } from "../components/ExplorerMap";
import { JsonLd } from "../components/JsonLd";
import { buildAlternates, routeRobots, localeUrl } from "./seo";

export interface TravelRadarPageProps {
  readonly viewModel: TravelRadarViewModel;
  readonly windowControls: ReadonlyArray<WindowControl>;
  /** Progressive-map markers (same compact read model as the explorer map). */
  readonly mapMarkers?: ReadonlyArray<ExplorerMapMarker>;
  /** Server-rendered JSON-LD schema.org node. */
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

function renderScore(score: TravelRadarViewModel["cards"][number]["score"]): string {
  if (score.value === null) {
    if (score.state === "unavailable") return "Unavailable";
    if (score.state === "limited_data") return "Limited data";
    return "—";
  }
  return String(score.value);
}

export function TravelRadarPage({
  viewModel,
  windowControls,
  mapMarkers,
  jsonLd,
}: TravelRadarPageProps) {
  const { cards, freshness, state } = viewModel;
  const showCards = state === "ready" || state === "stale";
  const showMap = showCards && (mapMarkers?.length ?? 0) > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}

      <h1 className="text-3xl font-semibold text-foreground">Where is NOT raining?</h1>
      <p className="mt-2 max-w-2xl text-body text-muted">
        Deterministic travel recommendations from the latest successfully activated weather and
        Travel Score data.
      </p>

      <nav aria-label="Time window" className="mt-6 flex flex-wrap gap-2">
        {windowControls.map((wc) => (
          <a
            key={wc.window}
            href={wc.href}
            aria-current={wc.selected ? "true" : undefined}
            className="rounded-pill border border-border px-4 py-2 text-label text-primary hover:bg-surface-elevated focus-ring"
            aria-label={
              wc.exactDates.length > 0 ? `${wc.label} (${wc.exactDates.join(", ")})` : wc.label
            }
          >
            <span>{wc.label}</span>
            {wc.exactDates.length > 0 ? (
              <span className="ml-2 text-caption text-muted">{wc.exactDates.join(" – ")}</span>
            ) : null}
          </a>
        ))}
      </nav>

      {state === "loading" ? (
        <p role="status" className="mt-8 text-body text-muted">
          Loading recommendations…
        </p>
      ) : null}

      {state === "error" ? (
        <p role="alert" className="mt-8 text-body text-danger">
          We couldn’t load recommendations right now. Please try again.
        </p>
      ) : null}

      {state === "empty" ? (
        <p className="mt-8 text-body text-muted">No destinations match this window yet.</p>
      ) : null}

      {showCards ? (
        <section aria-label="Recommended destinations" className="mt-8">
          <ul className="grid gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <li key={card.destination.cityId}>
                <article className="rounded-lg border border-border bg-surface p-4">
                  <h2 className="text-heading-3 font-semibold">
                    <a
                      href={card.destination.path}
                      className="text-primary hover:underline focus-ring"
                    >
                      {card.destination.cityName}, {card.destination.countryName}
                    </a>
                  </h2>

                  <p className="mt-1 text-body">{card.weather.conditionLabel}</p>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-body-small">
                    <div>
                      <dt className="text-caption text-muted">Travel Score</dt>
                      <dd className="font-medium">{renderScore(card.score)}</dd>
                    </div>
                    <div>
                      <dt className="text-caption text-muted">Temperature</dt>
                      <dd className="font-medium">
                        {card.weather.temperatureMin !== null
                          ? `${card.weather.temperatureMin}°`
                          : "–"}{" "}
                        /{" "}
                        {card.weather.temperatureMax !== null
                          ? `${card.weather.temperatureMax}°`
                          : "–"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-muted">Rain chance</dt>
                      <dd className="font-medium">
                        {card.weather.rainProbability !== null
                          ? `${card.weather.rainProbability}%`
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {card.reasonCodes.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-1" aria-label="Recommendation reasons">
                      {card.reasonCodes.map((rc) => (
                        <li
                          key={rc}
                          className="rounded-pill bg-surface-elevated px-2 py-1 text-caption text-muted"
                        >
                          {rc}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="mt-3 text-caption text-muted">
                    {freshness.updatedLabel}
                    {freshness.stale ? (
                      <span className="ml-2 font-medium text-warning">Stale data</span>
                    ) : null}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Progressive MapLibre enhancement (PRD-FR-001). Rendered AFTER the
          crawlable cards; it shares the same compact read model and degrades
          gracefully if WebGL/script is unavailable. */}
      {showMap ? (
        <ExplorerMap markers={mapMarkers ?? []} theme="general" windowLabel="Today" />
      ) : null}

      <footer className="mt-12 border-t border-border pt-6 text-caption text-muted">
        Recommendations use the latest activated weather and Travel Score; stale results remain
        usable but are labeled.
      </footer>
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Where is NOT raining?",
    alternates: buildAlternates("/"),
    robots: routeRobots("homepage", true),
  };
}

export default async function Page(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const config = buildConfig();
  const activeWindow: Window = "today";
  const viewModel = projectHome(dataset, config, activeWindow);
  const windowControls = buildWindowControls(dataset, config, activeWindow);
  const mapMarkers = projectHomeMapMarkers(dataset, config);

  const featured = dataset.cities.find((b) => b.city.isFeatured);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: "Where Not Rain",
    description:
      "Deterministic, explainable destination recommendations from the latest weather and Travel Score.",
    url: localeUrl("en", "/"),
  };
  if (featured !== undefined) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: featured.city.latitude,
      longitude: featured.city.longitude,
    };
  }

  return (
    <TravelRadarPage
      viewModel={viewModel}
      windowControls={windowControls}
      mapMarkers={mapMarkers}
      jsonLd={jsonLd}
    />
  );
}
