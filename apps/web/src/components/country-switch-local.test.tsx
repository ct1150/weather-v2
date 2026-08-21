// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CountryHeaderViewModel,
  CountryWeatherCityViewModel,
  LocalDate,
  ScoreViewModel,
} from "../app/view-models";
import {
  CountryWeatherExplorer,
  type CountryWeatherDataset,
} from "./CountryWeatherExplorer";

const SCORE: ScoreViewModel = {
  value: 90,
  state: "available",
  confidence: 0.9,
  reasonCodes: [],
};

function country(countryId: string, slug: string, name: string): CountryHeaderViewModel {
  return {
    countryId,
    slug,
    name,
    summary: null,
    defaultTimezone: countryId === "KR" ? "Asia/Seoul" : "Asia/Tokyo",
  };
}

function city(
  cityId: string,
  cityName: string,
  countryName: string,
  path: string,
  latitude: number,
  longitude: number,
): CountryWeatherCityViewModel {
  return {
    cityId,
    cityName,
    countryName,
    path,
    latitude,
    longitude,
    timezone: countryName === "South Korea" ? "Asia/Seoul" : "Asia/Tokyo",
    days: [0, 1, 2].map((offset) => ({
      localDate: `2026-08-${String(21 + offset).padStart(2, "0")}` as LocalDate,
      weather: {
        conditionLabel: "Clear",
        temperatureMin: 20,
        temperatureMax: 29,
        rainProbability: 10,
        precipitationMm: 0.5,
        windSpeedMax: 12,
        observedAt: "2026-08-21T00:00:00Z",
      },
      score: SCORE,
    })),
  };
}

const JAPAN = country("JP", "jp", "Japan");
const KOREA = country("KR", "kr", "South Korea");
const TOKYO = city("tokyo", "Tokyo", "Japan", "/jp/tokyo", 35.68, 139.69);
const SEOUL = city("seoul", "Seoul", "South Korea", "/kr/seoul", 37.56, 126.98);
const DATASETS: ReadonlyArray<CountryWeatherDataset> = [
  { path: "/jp", country: JAPAN, cities: [TOKYO], updatedLabel: "Updated now" },
  { path: "/kr", country: KOREA, cities: [SEOUL], updatedLabel: "Updated now" },
];

beforeEach(() => {
  window.history.replaceState({}, "", "/jp?range=3d");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("local country switching", () => {
  it("swaps map data and URL immediately without route-prefetch links", async () => {
    const { container } = render(
      <main>
        <span data-country-map-breadcrumb>Japan</span>
        <h1 data-country-map-title>Japan travel weather at a glance</h1>
        <p data-country-map-description>Japan description</p>
        <CountryWeatherExplorer
          country={JAPAN}
          countries={[
            { slug: "jp", name: "Japan", path: "/jp" },
            { slug: "kr", name: "South Korea", path: "/kr" },
          ]}
          cities={[TOKYO]}
          updatedLabel="Updated now"
          locale="en"
          countryDatasets={DATASETS}
        />
      </main>,
    );

    expect(
      container.querySelector('[data-country-switch-mode="local-state-history"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="country-prefetch-links"]')).toBeNull();
    expect(screen.getByText("Tokyo")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Choose country"), { target: { value: "/kr" } });

    await waitFor(() => expect(screen.getByText("Seoul")).toBeTruthy());
    expect(window.location.pathname).toBe("/kr");
    expect(window.location.search).toBe("?range=3d");
    expect(screen.getByText("South Korea travel weather at a glance")).toBeTruthy();
    expect(screen.getByText("South Korea").textContent).toBe("South Korea");
    expect(document.title).toBe("South Korea travel weather — Where Not Rain");
  });

  it("restores the cached map on browser history events", async () => {
    render(
      <main>
        <span data-country-map-breadcrumb>Japan</span>
        <h1 data-country-map-title>Japan travel weather at a glance</h1>
        <p data-country-map-description>Japan description</p>
        <CountryWeatherExplorer
          country={JAPAN}
          countries={[
            { slug: "jp", name: "Japan", path: "/jp" },
            { slug: "kr", name: "South Korea", path: "/kr" },
          ]}
          cities={[TOKYO]}
          updatedLabel="Updated now"
          locale="en"
          countryDatasets={DATASETS}
        />
      </main>,
    );

    fireEvent.change(screen.getByLabelText("Choose country"), { target: { value: "/kr" } });
    await waitFor(() => expect(screen.getByText("Seoul")).toBeTruthy());

    window.history.replaceState({}, "", "/jp?range=3d");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => expect(screen.getByText("Tokyo")).toBeTruthy());
    expect(window.location.pathname).toBe("/jp");
    expect(document.title).toBe("Japan travel weather — Where Not Rain");
  });
});
