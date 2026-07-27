// @vitest-environment jsdom
//
// apps/web/src/app/explore/explorer-map.test.tsx
//
// Interactive MapLibre map (PRD-FR-002, UX-A11Y-001, ENG-PERF-001).
// The map is mocked (no WebGL in jsdom): the manual mock records
// `new maplibregl.Map(...)` and exposes `addSource`/`addLayer` stubs.
// We assert: (a) the map section renders with the correct accessible name,
// (b) the map is initialized with the no-API-key OpenFreeMap style,
// (c) the crawlable ranked list remains present in the page DOM, and
// (d) markers flow through to the clustered GeoJSON source.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";

import { ExplorerMap, MAPLIBRE_STYLE_URL } from "../../components/ExplorerMap";
import { ExplorerPage } from "./page";
import type { ExplorerViewModel, ExplorerMapMarker } from "../view-models";

// Shared, test-only mock state (vi.hoisted guarantees the same `Map` fn
// instance is visible inside the factory AND in the assertions below).
const hoisted = vi.hoisted(() => {
  const createdMaps: Array<{
    addSource: ReturnType<typeof vi.fn>;
    addLayer: ReturnType<typeof vi.fn>;
  }> = [];
  const Map = vi.fn().mockImplementation((_options: Record<string, unknown>) => {
    const map = {
      addControl: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      on: vi.fn((event: string, _layer: unknown, cb?: () => void) => {
        const callback = (typeof _layer === "function" ? _layer : cb) as (() => void) | undefined;
        if (event === "load" && typeof callback === "function") {
          // Fire synchronously so addSource/addLayer run in the same effect tick
          // (no microtask-timing dependency in the test).
          callback();
        }
      }),
      remove: vi.fn(),
      flyTo: vi.fn(),
      easeTo: vi.fn(),
      jumpTo: vi.fn(),
      getSource: vi.fn(() => ({
        getClusterExpansionZoom: () => Promise.resolve(3),
      })),
      queryRenderedFeatures: vi.fn(() => []),
    };
    createdMaps.push(map);
    return map;
  });
  const NavigationControl = class {
    // Mock control — no-op.
  };
  return { createdMaps, Map, NavigationControl };
});

vi.mock("maplibre-gl", () => ({
  default: { Map: hoisted.Map, NavigationControl: hoisted.NavigationControl },
}));

const MARKERS: ReadonlyArray<ExplorerMapMarker> = [
  {
    id: "TYO",
    label: "Tokyo",
    latitude: 35.68,
    longitude: 139.69,
    path: "/jp/tokyo",
    score: 82,
    theme: "general",
  },
  {
    id: "OSA",
    label: "Osaka",
    latitude: 34.69,
    longitude: 135.5,
    path: "/jp/osaka",
    score: 60,
    theme: "general",
  },
];

function explorerFixture(): ExplorerViewModel {
  return {
    theme: "general",
    window: "today",
    activeFilterMeaning: "All destinations",
    markers: MARKERS.map((m) => ({
      cityId: m.id,
      name: m.label,
      score:
        m.score === null
          ? null
          : { value: m.score, state: "available", confidence: 0.9, reasonCodes: [] },
      latitude: m.latitude,
      longitude: m.longitude,
      primaryReasonCode: null,
      path: m.path,
    })),
    list: [
      {
        cityId: "TYO",
        countrySlug: "jp",
        citySlug: "tokyo",
        cityName: "Tokyo",
        countryName: "Japan",
        path: "/jp/tokyo",
      },
      {
        cityId: "OSA",
        countrySlug: "jp",
        citySlug: "osaka",
        cityName: "Osaka",
        countryName: "Japan",
        path: "/jp/osaka",
      },
    ],
    state: "ready",
  };
}

beforeEach(() => {
  // jsdom has no WebGL; simulate a context so the enhancement inits.
  (window as unknown as { WebGLRenderingContext: unknown }).WebGLRenderingContext = class {};
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({}),
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExplorerMap — interactive enhancement", () => {
  it("renders the map container region with the correct accessible name", async () => {
    const { container } = render(
      createElement(ExplorerMap, { markers: MARKERS, theme: "general", windowLabel: "Today" }),
    );
    const region = container?.querySelector('[data-testid="explorer-map"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("region");
    // The accessible name lives on the wrapping <section>.
    const section = region?.closest("section");
    expect(section?.getAttribute("aria-label")).toBe("Interactive weather map");
  });

  it("initializes MapLibre with the no-API-key OpenFreeMap style", async () => {
    render(
      createElement(ExplorerMap, { markers: MARKERS, theme: "general", windowLabel: "Today" }),
    );
    await waitFor(() => expect(hoisted.Map).toHaveBeenCalled());
    const firstCall = (
      hoisted.Map as unknown as { mock: { calls: Array<[Record<string, unknown>, unknown]> } }
    ).mock.calls[0];
    const initOptions = firstCall[0];
    expect(initOptions.style).toBe(MAPLIBRE_STYLE_URL);
    expect(MAPLIBRE_STYLE_URL).toBe("https://tiles.openfreemap.org/styles/liberty");
  });

  it("flows markers into the clustered GeoJSON source", async () => {
    render(
      createElement(ExplorerMap, { markers: MARKERS, theme: "general", windowLabel: "Today" }),
    );
    await waitFor(() => {
      const last = hoisted.createdMaps[hoisted.createdMaps.length - 1];
      expect(last?.addSource).toHaveBeenCalled();
    });
    const last = hoisted.createdMaps[hoisted.createdMaps.length - 1];
    const addSourceMock = last!.addSource as unknown as {
      mock: { calls: Array<[unknown, unknown]> };
    };
    const sourceCall = addSourceMock.mock.calls.find((c) => c[0] === "destinations");
    expect(sourceCall).toBeDefined();
    const spec = sourceCall![1] as {
      type: string;
      data: {
        type: string;
        features: Array<{ geometry: { coordinates: number[] } }>;
      };
    };
    // The source spec carries type:"geojson"; its `data` is the FeatureCollection.
    expect(spec.type).toBe("geojson");
    expect(spec.data.type).toBe("FeatureCollection");
    expect(spec.data.features.length).toBe(MARKERS.length);
    // Coordinates flow through verbatim.
    expect(spec.data.features[0].geometry.coordinates).toEqual([
      MARKERS[0].longitude,
      MARKERS[0].latitude,
    ]);
  });
});

describe("ExplorerPage — map enhancement does not replace the accessible list", () => {
  it("keeps the crawlable ranked list AND renders the map container", async () => {
    const { container } = render(createElement(ExplorerPage, { viewModel: explorerFixture() }));
    // Primary crawlable content remains.
    expect(screen.getByText("Tokyo")).toBeTruthy();
    expect(screen.getByText("Osaka")).toBeTruthy();
    expect(container?.querySelector('a[href="/jp/tokyo"]')).not.toBeNull();
    // Map enhancement present (after the list).
    expect(container?.querySelector('[data-testid="explorer-map"]')).not.toBeNull();
    // Map inits against the no-key style.
    await waitFor(() => expect(hoisted.Map).toHaveBeenCalled());
    const firstCall = (
      hoisted.Map as unknown as { mock: { calls: Array<[Record<string, unknown>, unknown]> } }
    ).mock.calls[0];
    expect(firstCall[0].style).toBe(MAPLIBRE_STYLE_URL);
  });
});
