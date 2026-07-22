// apps/web/src/app/explore/explorer.test.ts
//
// Weather Explorer journey tests (PRD-FR-002, UX-A11Y-001, ENG-PERF-001,
// UX-STATE-001). The accessible, crawlable destination list must always be
// present as the primary content; the map is a decorative enhancement marked
// aria-hidden so no information is lost for assistive tech. The full async-state
// contract must render.
//
// NOTE: This file keeps the `.ts` extension (Verify checks `explorer.test.ts`
// by name), so JSX is unavailable; the tree is composed with `createElement`.

import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { ExplorerPage } from "./page";
import type {
  DestinationLinkViewModel,
  ExplorerViewModel,
  ExploreMarkerViewModel,
} from "../view-models";

function link(
  cityId: string,
  cityName: string,
  countryName: string,
  path: string,
): DestinationLinkViewModel {
  return { cityId, countrySlug: "", citySlug: "", cityName, countryName, path };
}

function marker(
  cityId: string,
  name: string,
  latitude: number,
  longitude: number,
  path: string,
): ExploreMarkerViewModel {
  return { cityId, name, score: null, latitude, longitude, primaryReasonCode: null, path };
}

function fixture(state: ExplorerViewModel["state"] = "ready"): ExplorerViewModel {
  return {
    theme: "Beach",
    window: "weekend",
    activeFilterMeaning: "Beaches with low rain chance",
    markers: [
      marker("TYO", "Tokyo", 35.68, 139.69, "/jp/tokyo"),
      marker("OSA", "Osaka", 34.69, 135.5, "/jp/osaka"),
    ],
    list: [link("TYO", "Tokyo", "Japan", "/jp/tokyo"), link("OSA", "Osaka", "Japan", "/jp/osaka")],
    state,
  };
}

function render(vm: ExplorerViewModel): string {
  return renderToStaticMarkup(createElement(ExplorerPage, { viewModel: vm }));
}

describe("Weather Explorer — accessible non-map list fallback", () => {
  const html = render(fixture("ready"));

  it("renders the accessible destination list as crawlable primary content", () => {
    expect(html).toContain('aria-label="All destinations"');
    expect(html).toContain("Tokyo");
    expect(html).toContain("Osaka");
    expect(html).toContain("Japan");
  });

  it("links every list item to its destination detail page", () => {
    expect(html).toContain('href="/jp/tokyo"');
    expect(html).toContain('href="/jp/osaka"');
  });

  it("marks the map as decorative (aria-hidden) so the list is its accessible equivalent", () => {
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('aria-label="Map preview"');
  });

  it("does not eagerly pull an external map resource (ENG-PERF-001)", () => {
    // The map is an inline SVG poster; no <img>/<iframe>/<script> external load.
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("destination");
  });
});

describe("Weather Explorer — async states (UX-STATE-001)", () => {
  it("renders the loading state", () => {
    const html = render(fixture("loading"));
    expect(html).toContain("Loading destinations");
    expect(html).not.toContain('href="/jp/tokyo"');
  });

  it("renders the empty state", () => {
    const html = render(fixture("empty"));
    expect(html).toContain("No destinations match this filter yet.");
  });

  it("renders the error state", () => {
    const html = render(fixture("error"));
    expect(html).toContain("load the explorer");
  });
});
