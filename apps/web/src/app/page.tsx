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

function reasonLabel(reason: string): string {
  return reason
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function WeatherGlyph({ condition }: { condition: string }): ReactElement {
  const rainy = /rain|storm|shower/i.test(condition);
  const cloudy = /cloud|overcast|fog/i.test(condition);
  return (
    <span
      className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef3ff] text-primary"
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
        {rainy || cloudy ? (
          <>
            <path
              d="M8.2 21h15.1a4.7 4.7 0 0 0 .1-9.4A7.5 7.5 0 0 0 9.3 14 3.6 3.6 0 0 0 8.2 21Z"
              fill="currentColor"
              opacity=".82"
            />
            {rainy ? (
              <path
                d="m11 24-1.2 2m6.8-2-1.2 2m6.8-2L21 26"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : null}
          </>
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
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}

      <section className="hero-panel">
        <div className="relative z-10 max-w-3xl">
          <p className="eyebrow">Weather-led travel inspiration</p>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-[-0.045em] text-foreground sm:text-6xl">
            Where is NOT raining?
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Find your next clear-sky escape with transparent recommendations built from fresh
            weather forecasts and a practical Travel Score.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#recommendations"
              className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-[#203f8d] focus-ring"
            >
              See best destinations
            </a>
            <a
              href="/explore"
              className="rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary/30 hover:bg-surface-elevated focus-ring"
            >
              Explore the map <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="relative z-10 mt-9 border-t border-border/70 pt-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">Plan for</p>
          <nav aria-label="Time window" className="flex gap-2 overflow-x-auto pb-1">
            {windowControls.map((wc) => (
              <a
                key={wc.window}
                href={wc.href}
                aria-current={wc.selected ? "true" : undefined}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition focus-ring ${wc.selected ? "border-primary bg-primary text-white shadow-md shadow-primary/20" : "border-border bg-surface text-foreground hover:border-primary/30 hover:bg-surface-elevated"}`}
                aria-label={
                  wc.exactDates.length > 0 ? `${wc.label} (${wc.exactDates.join(", ")})` : wc.label
                }
              >
                <span>{wc.label}</span>
                {wc.exactDates.length > 0 ? (
                  <span className={`ml-2 text-xs ${wc.selected ? "text-white/75" : "text-muted"}`}>
                    {wc.exactDates.join(" – ")}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
        </div>
      </section>

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
        <section
          id="recommendations"
          aria-label="Recommended destinations"
          className="mt-14 scroll-mt-24"
        >
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Travel radar</p>
              <h2 className="section-title mt-3">Clearer skies, ranked for you</h2>
            </div>
            <p className="hidden text-sm text-muted sm:block">{cards.length} places compared</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, index) => (
              <li key={card.destination.cityId}>
                <article className="destination-card">
                  <div className="flex items-start justify-between gap-4">
                    <WeatherGlyph condition={card.weather.conditionLabel} />
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                        Travel Score
                      </span>
                      <p className="text-2xl font-bold leading-none text-foreground">
                        {renderScore(card.score)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    #{index + 1} · {card.destination.countryName}
                  </p>
                  <h3 className="mt-1 text-xl font-bold tracking-[-0.02em]">
                    <a
                      href={card.destination.path}
                      className="before:absolute before:inset-0 text-foreground transition-colors hover:text-primary focus-ring"
                    >
                      {card.destination.cityName}
                    </a>
                  </h3>

                  <p className="mt-1 text-sm font-medium text-primary">
                    {card.weather.conditionLabel}
                  </p>

                  <dl className="relative mt-5 grid grid-cols-2 gap-3 rounded-xl bg-surface-elevated p-3 text-sm">
                    <div className="border-r border-border">
                      <dt className="text-xs text-muted">Temperature</dt>
                      <dd className="mt-0.5 font-bold text-foreground">
                        {card.weather.temperatureMin !== null
                          ? `${card.weather.temperatureMin}°`
                          : "–"}{" "}
                        /{" "}
                        {card.weather.temperatureMax !== null
                          ? `${card.weather.temperatureMax}°`
                          : "–"}
                      </dd>
                    </div>
                    <div className="pl-1">
                      <dt className="text-xs text-muted">Rain chance</dt>
                      <dd className="mt-0.5 font-bold text-foreground">
                        {card.weather.rainProbability !== null
                          ? `${card.weather.rainProbability}%`
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {card.reasonCodes.length > 0 ? (
                    <ul
                      className="relative mt-4 flex flex-wrap gap-1.5"
                      aria-label="Recommendation reasons"
                    >
                      {card.reasonCodes.map((rc) => (
                        <li
                          key={rc}
                          aria-label={`Reason: ${rc}`}
                          className="rounded-full border border-[#dce5fa] bg-[#f4f7ff] px-2.5 py-1 text-[11px] font-semibold text-primary"
                        >
                          {reasonLabel(rc)}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="relative mt-4 border-t border-border/70 pt-3 text-xs text-muted">
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

      <footer className="page-footer">
        <span>Where Not Rain · Weather-led travel inspiration</span>
        <span>Latest activated data · Stale results are always labeled</span>
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
