// apps/web/src/app/explore/page.tsx
//
// Weather Explorer (PRD-FR-002, UX-A11Y-001, ENG-PERF-001, UX-STATE-001). App
// Router page (T03): bakes the dataset and projects the `ExplorerViewModel`. The
// map is a decorative static SVG poster; the ranked list is the accessible,
// crawlable primary content. Statically exported (no client runtime this phase).

import type { ReactElement } from "react";
import type { ExplorerViewModel, ExploreMarkerViewModel } from "../view-models";
import { getBakedDataset, buildConfig, projectExplorer } from "../../build/bake";

export interface ExplorerPageProps {
  readonly viewModel: ExplorerViewModel;
}

const MAP_WIDTH = 320;
const MAP_HEIGHT = 200;
const MAP_PADDING = 14;

const WINDOW_LABELS: Readonly<Record<ExplorerViewModel["window"], string>> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  next_week: "Next week",
};

/**
 * Project marker lat/long into the static SVG poster box. Single markers are
 * centered; empty sets return no points.
 */
function projectMarkers(
  markers: ReadonlyArray<ExploreMarkerViewModel>,
): ReadonlyArray<{ readonly x: number; readonly y: number; readonly marker: ExploreMarkerViewModel }> {
  if (markers.length === 0) return [];
  if (markers.length === 1) {
    const only = markers[0];
    return only === undefined
      ? []
      : [{ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, marker: only }];
  }
  const lats = markers.map((m) => m.latitude);
  const lngs = markers.map((m) => m.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 1;
  const lngSpan = maxLng - minLng || 1;
  return markers.map((marker) => {
    const x = MAP_PADDING + ((marker.longitude - minLng) / lngSpan) * (MAP_WIDTH - 2 * MAP_PADDING);
    const y = MAP_PADDING + ((maxLat - marker.latitude) / latSpan) * (MAP_HEIGHT - 2 * MAP_PADDING);
    return { x, y, marker };
  });
}

export function ExplorerPage({ viewModel }: ExplorerPageProps) {
  const { theme, window: windowKind, activeFilterMeaning, markers, list, state } = viewModel;
  const windowLabel = WINDOW_LABELS[windowKind];
  const points = projectMarkers(markers);

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

      {/* Accessible, crawlable primary content. The map below is decorative. */}
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

      {/* Decorative map poster. Marked aria-hidden; the list above is the
          accessible, crawlable equivalent (UX-A11Y-001). No external map library. */}
      {state === "ready" || state === "stale" ? (
        <section aria-hidden="true" aria-label="Map preview" className="mt-8">
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="h-auto w-full max-w-md rounded-lg border border-border bg-surface"
            role="img"
            aria-label={`Map preview of ${markers.length} destinations`}
          >
            <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} className="fill-surface-elevated" />
            {points.map((p) => (
              <circle key={p.marker.cityId} cx={p.x} cy={p.y} r={5} className="fill-primary" />
            ))}
          </svg>
          <p className="mt-2 text-caption text-muted">
            {markers.length} destination{markers.length === 1 ? "" : "s"} shown on the map. A full
            accessible list is provided above.
          </p>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-border pt-6 text-caption text-muted">
        The destination list is the authoritative, accessible view; the map is a visual aid.
      </footer>
    </main>
  );
}

export async function generateMetadata(): Promise<{ title: string }> {
  return { title: "Weather Explorer" };
}

export default async function Page(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const config = buildConfig();
  const viewModel = projectExplorer(dataset, config.defaultLocale, "today", "general");
  return <ExplorerPage viewModel={viewModel} />;
}
