// apps/web/src/app/page.tsx
//
// Travel Radar homepage (PRD-FR-001, UX-HOME-001, VISION-VALUE-001,
// UX-STATE-001, SEO-STRUCTURED-001).
//
// App Router page (system_design.md T03): at build time it bakes the dataset and
// projects the `TravelRadarViewModel`, then renders the pure presentational
// component. No request-time data path — the page is statically exported.
//
// Every time-window read model is baked into the static page. A small client
// controller switches between those deterministic models and preserves the
// selected window in the shareable URL without a request-time data path.
//
// Progressive enhancement: crawlable recommendation cards render FIRST; the
// MapLibre map hydrates AFTER them and the JSON-LD structured data is
// server-rendered into the static HTML.

import type { ReactElement } from "react";
import type { Metadata } from "next";
import type { TravelRadarViewModel, WindowControl, ExplorerMapMarker } from "./view-models";
import type { Window } from "../api/v1/schemas";
import type { SearchCandidate } from "../search/search-destinations";
import {
  getBakedDataset,
  buildConfig,
  projectHome,
  buildWindowControls,
  projectHomeMapMarkers,
} from "../build/bake";
import { DestinationSearch } from "../components/DestinationSearch";
import { ExplorerMap } from "../components/ExplorerMap";
import { JsonLd } from "../components/JsonLd";
import {
  TravelRadarPanel,
  WeatherGlyph,
  isCautionReason,
  reasonLabel,
} from "../components/TravelRadarPanel";
import { WindowExperience } from "../components/WindowExperience";
import { buildAlternates, routeRobots, localeUrl } from "./seo";

export interface TravelRadarPageProps {
  readonly viewModel: TravelRadarViewModel;
  readonly windowControls: ReadonlyArray<WindowControl>;
  /** Progressive-map markers (same compact read model as the explorer map). */
  readonly mapMarkers?: ReadonlyArray<ExplorerMapMarker>;
  readonly searchCandidates?: ReadonlyArray<SearchCandidate>;
  readonly windowViews?: ReadonlyArray<{
    readonly viewModel: TravelRadarViewModel;
    readonly windowControls: ReadonlyArray<WindowControl>;
    readonly mapMarkers: ReadonlyArray<ExplorerMapMarker>;
  }>;
  readonly countryLinks?: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly path: string;
    readonly cityCount: number;
  }>;
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

function tripVerdict(rainProbability: number | null): string {
  if (rainProbability === null) return "Check details";
  if (rainProbability <= 20) return "Strong dry-weather pick";
  if (rainProbability <= 45) return "A workable weather window";
  return "Rain is likely — compare before booking";
}

export function TravelRadarPage({
  viewModel,
  windowControls,
  mapMarkers,
  searchCandidates,
  windowViews,
  countryLinks,
  jsonLd,
}: TravelRadarPageProps) {
  const { cards, freshness, state } = viewModel;
  const showCards = state === "ready" || state === "stale";
  const showMap = showCards && (mapMarkers?.length ?? 0) > 0;
  const rankedCards = [...cards].sort(
    (left, right) => (right.score.value ?? -1) - (left.score.value ?? -1),
  );
  const bestOption = rankedCards[0] ?? null;
  const bestRain = bestOption?.weather.rainProbability ?? null;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}

      <section className="hero-panel">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <p className="eyebrow">Your weather-first trip briefing</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-[4.25rem]">
              Where is NOT raining?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Compare the weather that can change a trip: rain risk, comfortable temperatures, and
              the trade-offs behind every ranking.
            </p>
            {searchCandidates !== undefined && searchCandidates.length > 0 ? (
              <DestinationSearch candidates={searchCandidates} />
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href="/discover"
                className="rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-lg shadow-foreground/15 transition hover:-translate-y-0.5 hover:bg-primary focus-ring"
              >
                I haven't chosen a destination
              </a>
              <a
                href="/trips/new"
                className="rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary/30 hover:bg-surface-elevated focus-ring"
              >
                I already have a trip <span aria-hidden="true">→</span>
              </a>
            </div>
            <a
              href="#recommendations"
              className="mt-3 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline focus-ring"
            >
              Browse today's ranked options
            </a>
          </div>
          {bestOption !== null ? (
            <aside className="decision-board" aria-label="Best available option">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                Best available today
              </p>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold tracking-[-0.04em]">
                    {bestOption.destination.cityName}
                  </p>
                  <p className="mt-1 text-sm text-white/65">{bestOption.destination.countryName}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{renderScore(bestOption.score)}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">
                    Travel Score
                  </p>
                </div>
              </div>
              <div className="mt-6 border-t border-white/15 pt-4">
                <p className="text-sm font-semibold text-white">{tripVerdict(bestRain)}</p>
                <p className="mt-1 text-xs leading-5 text-white/60">
                  {bestRain === null ? "Rain probability unavailable" : `${bestRain}% rain chance`}{" "}
                  · {freshness.updatedLabel}
                </p>
              </div>
            </aside>
          ) : null}
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

      {showCards && windowViews !== undefined ? (
        <WindowExperience
          initialWindow={viewModel.window}
          panels={windowViews.map((windowView) => ({
            window: windowView.viewModel.window,
            panel: (
              <TravelRadarPanel
                viewModel={windowView.viewModel}
                windowControls={windowView.windowControls}
                mapMarkers={windowView.mapMarkers}
              />
            ),
          }))}
        />
      ) : null}

      {showCards && windowViews === undefined ? (
        <section
          id="recommendations"
          aria-label="Recommended destinations"
          className="mt-14 scroll-mt-24"
        >
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Travel radar</p>
              <h2 className="section-title mt-3">Best available weather, ranked</h2>
            </div>
            <p className="hidden text-sm text-muted sm:block">
              {cards.length} places checked · {freshness.updatedLabel}
            </p>
          </div>
          <div className="window-strip mb-6">
            <div className="flex items-center justify-between gap-3 px-1 pb-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">
                When are you going?
              </p>
              <p className="hidden text-xs text-muted sm:block">
                Dates use each destination’s local calendar
              </p>
            </div>
            <nav aria-label="Time window" className="flex gap-2 overflow-x-auto pb-1">
              {windowControls.map((wc) => (
                <a
                  key={wc.window}
                  href={wc.href}
                  aria-current={wc.selected ? "true" : undefined}
                  className={`min-h-11 shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition focus-ring ${wc.selected ? "border-foreground bg-foreground text-white shadow-md shadow-foreground/15" : "border-border bg-surface text-foreground hover:border-primary/30 hover:bg-surface-elevated"}`}
                  aria-label={
                    wc.exactDates.length > 0
                      ? `${wc.label} (${wc.exactDates.join(", ")})`
                      : wc.label
                  }
                >
                  <span>{wc.label}</span>
                  {wc.exactDates.length > 0 ? (
                    <span
                      className={`ml-2 text-xs ${wc.selected ? "text-white/65" : "text-muted"}`}
                    >
                      {wc.exactDates.join(" – ")}
                    </span>
                  ) : null}
                </a>
              ))}
            </nav>
          </div>
          <p className="mb-4 max-w-2xl text-sm leading-6 text-muted">
            Rankings show the strongest options in the current dataset, even when every destination
            has trade-offs. Review the warnings before booking.
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rankedCards.map((card, index) => (
              <li key={card.destination.cityId}>
                <article className="destination-card">
                  <div className="flex items-start justify-between gap-4">
                    <WeatherGlyph condition={card.weather.conditionLabel} />
                    <div className="score-orbit">
                      <div>
                        <p className="text-lg font-bold leading-none text-foreground">
                          {renderScore(card.score)}
                        </p>
                        <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">
                          Score
                        </span>
                      </div>
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

                  <p
                    className={`relative mt-4 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${card.weather.rainProbability !== null && card.weather.rainProbability <= 45 ? "signal-good" : "signal-caution"}`}
                  >
                    {tripVerdict(card.weather.rainProbability)}
                  </p>

                  <dl className="relative mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="metric-block">
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
                    <div className="metric-block">
                      <dt className="text-xs text-muted">Peak rain chance</dt>
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
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isCautionReason(rc) ? "signal-caution" : "signal-good"}`}
                        >
                          {reasonLabel(rc)}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="relative mt-4 text-xs text-muted">
                    {freshness.updatedLabel}
                    {freshness.stale ? (
                      <span className="ml-2 font-medium text-warning">Stale data</span>
                    ) : null}
                  </p>
                  <span className="trip-action" aria-hidden="true">
                    See trip weather <span>→</span>
                  </span>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Progressive MapLibre enhancement (PRD-FR-001). Rendered AFTER the
          crawlable cards; it shares the same compact read model and degrades
          gracefully if WebGL/script is unavailable. */}
      {showMap && windowViews === undefined ? (
        <ExplorerMap markers={mapMarkers ?? []} theme="general" windowLabel="Today" />
      ) : null}

      {countryLinks !== undefined && countryLinks.length > 0 ? (
        <section className="mt-12" aria-labelledby="country-weather-guides">
          <p className="eyebrow">Country weather guides</p>
          <h2 id="country-weather-guides" className="section-title mt-3">
            Compare every city on one country map
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Choose a country, set your exact travel dates, and see all listed cities ranked without
            opening separate forecast pages.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {countryLinks.map((country) => (
              <li key={country.slug}>
                <a href={country.path} className="destination-link focus-ring">
                  <span>
                    <strong className="block text-foreground">{country.name}</strong>
                    <span className="mt-1 block text-xs text-muted">
                      {country.cityCount} travel {country.cityCount === 1 ? "city" : "cities"}
                    </span>
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

export async function generateMetadata(): Promise<Metadata> {
  const title = "Travel weather map: find where it won't rain | Where Not Rain";
  const description =
    "Compare rain, temperature and Travel Scores across 36 destinations in Japan, Korea and Southeast Asia before choosing where and when to travel.";
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates("/", "en", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("homepage", true),
    openGraph: {
      type: "website",
      url: localeUrl("en", "/"),
      siteName: "Where Not Rain",
      title,
      description,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const config = buildConfig();
  const activeWindow: Window = "today";
  const viewModel = projectHome(dataset, config, activeWindow);
  const windowControls = buildWindowControls(dataset, config, activeWindow);
  const mapMarkers = projectHomeMapMarkers(dataset, config, activeWindow);
  const windows: ReadonlyArray<Window> = ["today", "tomorrow", "weekend", "next_week"];
  const windowViews = windows.map((window) => ({
    viewModel: projectHome(dataset, config, window),
    windowControls: buildWindowControls(dataset, config, window),
    mapMarkers: projectHomeMapMarkers(dataset, config, window),
  }));
  const searchCandidates: SearchCandidate[] = dataset.cities.map((baked) => ({
    cityId: baked.city.id,
    names: Object.values(baked.city.name),
    countryNames: Object.values(baked.country.name),
    countrySlug: baked.country.slug,
    citySlug: baked.city.slug,
    path: `/${baked.country.slug}/${baked.city.slug}`,
  }));
  const countryLinks = dataset.countries.map((country) => ({
    slug: country.slug,
    name: country.name.en,
    path: `/${country.slug}`,
    cityCount: (dataset.citiesByCountry.get(country.id) ?? []).length,
  }));

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${localeUrl("en", "/")}#website`,
        name: "Where Not Rain",
        alternateName: "Where is NOT raining?",
        description:
          "Travel weather maps that compare rain, temperature and Travel Scores across destinations.",
        url: localeUrl("en", "/"),
        inLanguage: "en",
      },
      {
        "@type": "Organization",
        "@id": `${localeUrl("en", "/")}#organization`,
        name: "Where Not Rain",
        url: localeUrl("en", "/"),
      },
      {
        "@type": "CollectionPage",
        "@id": `${localeUrl("en", "/")}#webpage`,
        name: "Asian travel weather maps",
        description:
          "Compare rain, temperature and Travel Scores across Japan, Korea and Southeast Asia.",
        url: localeUrl("en", "/"),
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
        isPartOf: { "@id": `${localeUrl("en", "/")}#website` },
        mainEntity: { "@id": `${localeUrl("en", "/")}#countries` },
      },
      {
        "@type": "ItemList",
        "@id": `${localeUrl("en", "/")}#countries`,
        name: "Country travel weather maps",
        numberOfItems: countryLinks.length,
        itemListElement: countryLinks.map((country, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: country.name,
          url: localeUrl("en", country.path),
        })),
      },
    ],
  };

  return (
    <TravelRadarPage
      viewModel={viewModel}
      windowControls={windowControls}
      mapMarkers={mapMarkers}
      searchCandidates={searchCandidates}
      windowViews={windowViews}
      countryLinks={countryLinks}
      jsonLd={jsonLd}
    />
  );
}
