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
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-foreground">Weather Explorer</h1>
      <p className="mt-2 max-w-2xl text-body text-muted">
        {activeFilterMeaning} · {windowLabel}
        {theme ? ` · ${theme}` : ""}
      </p>

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
        <section aria-label="All destinations" className="mt-8">
          <h2 className="text-heading-3 font-semibold text-foreground">
            All destinations{list.length > 0 ? ` (${list.length})` : ""}
          </h2>
          {list.length > 0 ? (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {list.map((dest) => (
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
          ) : null}
        </section>
      ) : null}

      {/* Progressive MapLibre enhancement (PRD-FR-002). Rendered AFTER the
          list. The map shares the exact lat/long/score read model and degrades
          gracefully (WebGL/script failure leaves the list intact). */}
      {state === "ready" || state === "stale" ? (
        <ExplorerMap markers={mapMarkers} theme={theme} windowLabel={windowLabel} />
      ) : null}

      <footer className="mt-12 border-t border-border pt-6 text-caption text-muted">
        The destination list is the authoritative, accessible view; the map is a visual aid.
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
