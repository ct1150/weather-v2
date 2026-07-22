// apps/web/src/app/destination-pages.test.ts
//
// Country + City destination page journey tests (PRD-FR-003, PRD-FR-004,
// DATA-WEATHER-001, UX-STATE-001). The pages render crawlable primary content
// (cities, rankings, weather, Travel Score) and honor the full async-state
// contract, including independent weather/forecast/score regions.
//
// NOTE: `.ts` extension (Verify checks `destination-pages.test.ts` by name), so
// the tree is composed with `createElement` (no JSX).

import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { CountryPage } from "./[countrySlug]/page";
import { CityPage } from "./[countrySlug]/[citySlug]/page";
import type {
  CityHeaderViewModel,
  CityPageViewModel,
  CountryHeaderViewModel,
  CountryPageViewModel,
  DestinationLinkViewModel,
  RankingSectionViewModel,
  ScoreViewModel,
  WeatherSummaryViewModel,
} from "./view-models";

function link(
  cityId: string,
  cityName: string,
  countryName: string,
  path: string,
): DestinationLinkViewModel {
  return { cityId, countrySlug: "", citySlug: "", cityName, countryName, path };
}

// --- Country fixtures -------------------------------------------------------

function countryHeader(): CountryHeaderViewModel {
  return {
    countryId: "JP",
    slug: "jp",
    name: "Japan",
    summary: "An island nation with distinct seasonal weather.",
    defaultTimezone: "Asia/Tokyo",
  };
}

function countryFixture(state: CountryPageViewModel["state"] = "ready"): CountryPageViewModel {
  const rankings: RankingSectionViewModel[] = [
    {
      theme: "beach",
      title: "Best beach escapes",
      items: [
        link("TYO", "Tokyo", "Japan", "/jp/tokyo"),
        link("OSA", "Osaka", "Japan", "/jp/osaka"),
      ],
    },
  ];
  return {
    country: countryHeader(),
    cities: [
      link("TYO", "Tokyo", "Japan", "/jp/tokyo"),
      link("OSA", "Osaka", "Japan", "/jp/osaka"),
    ],
    rankings,
    relatedLinks: [link("SEL", "Seoul", "South Korea", "/kr/seoul")],
    state,
  };
}

// --- City fixtures ----------------------------------------------------------

function cityHeader(): CityHeaderViewModel {
  return {
    cityId: "TYO",
    countrySlug: "jp",
    citySlug: "tokyo",
    cityName: "Tokyo",
    countryName: "Japan",
    timezone: "Asia/Tokyo",
    latitude: 35.68,
    longitude: 139.69,
  };
}

function weather(): WeatherSummaryViewModel {
  return {
    conditionLabel: "Clear",
    temperatureMin: 18,
    temperatureMax: 26,
    rainProbability: 10,
    observedAt: "2026-07-20T00:00:00Z",
  };
}

function score(): ScoreViewModel {
  return { value: 82, state: "available", confidence: 0.9, reasonCodes: ["LOW_RAIN_CHANCE"] };
}

function cityFixture(overrides: Partial<CityPageViewModel> = {}): CityPageViewModel {
  return {
    city: cityHeader(),
    weather: weather(),
    weatherState: "ready",
    score: score(),
    forecastState: "ready",
    localDates: ["2026-07-20", "2026-07-21"],
    unit: "metric",
    relatedLinks: [link("OSA", "Osaka", "Japan", "/jp/osaka")],
    commercial: ["Book a hotel"],
    ...overrides,
  };
}

function renderCountry(vm: CountryPageViewModel): string {
  return renderToStaticMarkup(createElement(CountryPage, { viewModel: vm }));
}

function renderCity(vm: CityPageViewModel): string {
  return renderToStaticMarkup(createElement(CityPage, { viewModel: vm }));
}

describe("Country destination page (PRD-FR-003)", () => {
  const html = renderCountry(countryFixture("ready"));

  it("renders the country name and summary as crawlable primary content", () => {
    expect(html).toContain("Japan");
    expect(html).toContain("island nation");
  });

  it("lists cities with links to their detail pages", () => {
    expect(html).toContain('href="/jp/tokyo"');
    expect(html).toContain('href="/jp/osaka"');
    expect(html).toContain("Tokyo");
    expect(html).toContain("Osaka");
  });

  it("renders curated ranking sections", () => {
    expect(html).toContain("Best beach escapes");
  });

  it("renders related destinations", () => {
    expect(html).toContain('href="/kr/seoul"');
  });

  it("renders the loading state", () => {
    const loading = renderCountry(countryFixture("loading"));
    expect(loading).toContain("Loading country");
    expect(loading).not.toContain('href="/jp/tokyo"');
  });

  it("renders the error state", () => {
    const error = renderCountry(countryFixture("error"));
    expect(error).toContain("couldn’t load this country");
  });
});

describe("City destination page (PRD-FR-004, DATA-WEATHER-001)", () => {
  const html = renderCity(cityFixture());

  it("renders the city + country heading", () => {
    expect(html).toContain("Tokyo, Japan");
  });

  it("renders the current weather observation (DATA-WEATHER-001)", () => {
    expect(html).toContain("Clear");
    expect(html).toContain("18°C");
    expect(html).toContain("26°C");
    expect(html).toContain("10%");
    expect(html).toContain("2026-07-20T00:00:00Z");
  });

  it("renders the Travel Score and its reasons", () => {
    expect(html).toContain("Travel Score");
    expect(html).toContain("82");
    expect(html).toContain("LOW_RAIN_CHANCE");
  });

  it("renders the forecast window dates", () => {
    expect(html).toContain("Covering 2026-07-20, 2026-07-21");
  });

  it("discloses commercial/affiliate links without affecting ranking", () => {
    expect(html).toContain("Book a hotel");
    expect(html).toContain("affiliate");
    expect(html).toContain("do not affect our recommendations");
  });

  it("renders related destinations", () => {
    expect(html).toContain('href="/jp/osaka"');
    expect(html).toContain("Osaka");
  });

  it("honors the weather loading state (UX-STATE-001)", () => {
    const loading = renderCity(cityFixture({ weatherState: "loading", weather: null }));
    expect(loading).toContain("Loading weather");
    expect(loading).not.toContain("Clear");
  });

  it("honors the weather error state", () => {
    const errored = renderCity(cityFixture({ weatherState: "error", weather: null }));
    expect(errored).toContain("couldn’t load the current weather");
  });

  it("honors the forecast empty state", () => {
    const empty = renderCity(cityFixture({ forecastState: "empty" }));
    expect(empty).toContain("No forecast available.");
  });
});
