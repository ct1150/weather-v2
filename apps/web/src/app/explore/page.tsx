// apps/web/src/app/explore/page.tsx
//
// Weather Explorer (PRD-FR-002, UX-A11Y-001, ENG-PERF-001, UX-STATE-001).
// App Router page (T03): bakes the dataset and projects the `ExplorerViewModel`.
// The accessible, crawlable ranked list is the PRIMARY content; the MapLibre
// interactive map is a progressive enhancement rendered AFTER it. The two share
// one compact read model so they never diverge.
//
// Statically exported (no client runtime for the list; the map hydrates after LCP).

import type { ReactElement } from "react";
import type { Metadata } from "next";
import type { ExplorerViewModel, ExploreMarkerViewModel, ExplorerMapMarker } from "../view-models";
import { getBakedDataset, buildConfig, projectExplorer } from "../../build/bake";
import { ExplorerMap } from "../../components/ExplorerMap";
import { buildAlternates, routeRobots } from "../seo";

export interface ExplorerPageProps {
  readonly viewModel: ExplorerViewModel;
}

const WINDOW_LABELS: Readonly<Record<ExplorerViewModel["window"], string>> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  next_week: "Next week",
};

/** Project the explorer markers onto the shared map read model. */
function toMapMarkers(viewModel: ExplorerViewModel): ExplorerMapMarker[] {
  return viewModel.markers.map((marker: ExploreMarkerViewModel) => ({
    id: marker.cityId,
    latitude: marker.latitude,
    longitude: marker.longitude,
    label: marker.name,
    path: marker.path,
    score: marker.score?.value ?? null,
    theme: viewModel.theme,
  }));
}

export function ExplorerPage({ viewModel }: ExplorerPageProps) {
  const { theme, window: windowKind, activeFilterMeaning, list, state } = viewModel;
  const windowLabel = WINDOW_LABELS[windowKind];
  const mapMarkers = toMapMarkers(viewModel);

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="hero-panel !p-6 sm:!p-9">
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Discover by weather</p>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">
              Weather Explorer
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted">
              Browse every destination, then use the map to see where your best options cluster.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-border/80 bg-surface-elevated px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
              Active view
            </p>
            <p className="mt-1 text-sm font-bold text-foreground">{activeFilterMeaning}</p>
            <p className="mt-0.5 text-xs text-muted">
              {windowLabel}
              {theme ? ` · ${theme}` : ""}
            </p>
          </div>
        </div>
      </section>

      {state === "loading" ? (
        <p role="status" className="mt-8 text-body text-muted">
          Loading destinations…
        </p>
      ) : null}

      {state === "error" ? (
        <p role="alert" className="mt-8 text-body text-danger">
          We couldn’t load the explorer right now. Please try again.
        </p>
      ) : null}

      {state === "empty" ? (
        <p className="mt-8 text-body text-muted">No destinations match this filter yet.</p>
      ) : null}

      {/* Accessible, crawlable primary content. Always present — the map is
          only an enhancement and must never replace this decision path. */}
      {state === "ready" || state === "stale" ? (
        <section aria-label="All destinations" className="mt-12">
          <p className="eyebrow">Destination index</p>
          <h2 className="section-title mt-3">
            All destinations{list.length > 0 ? ` (${list.length})` : ""}
          </h2>
          {list.length > 0 ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((dest) => (
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
          ) : null}
        </section>
      ) : null}

      {/* Progressive MapLibre enhancement (PRD-FR-002). Rendered AFTER the
          list. The map shares the exact lat/long/score read model and degrades
          gracefully (WebGL/script failure leaves the list intact). */}
      {state === "ready" || state === "stale" ? (
        <ExplorerMap markers={mapMarkers} theme={theme} windowLabel={windowLabel} />
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
  return {
    title: "Weather Explorer",
    alternates: buildAlternates("/explore"),
    robots: routeRobots("explore", true),
  };
}

export default async function Page(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const config = buildConfig();
  const viewModel = projectExplorer(dataset, config.defaultLocale, "today", "general");
  return <ExplorerPage viewModel={viewModel} />;
}
