// apps/web/src/app/destination-pages.test.ts
//
// Country + City destination page journey tests. Country pages now use one
// map-first weather interaction, while city pages keep detailed weather and
// existing compatibility surfaces.
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
  CountryWeatherCityViewModel,
  DestinationLinkViewModel,
  LocalDate,
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

function countryWeatherCity(
  cityId: string,
  cityName: string,
  path: string,
  latitude: number,
  longitude: number,
  rain: ReadonlyArray<number>,
): CountryWeatherCityViewModel {
  return {
    cityId,
    cityName,
    countryName: "Japan",
    path,
    latitude,
    longitude,
    timezone: "Asia/Tokyo",
    days: rain.map((probability, index) => ({
      localDate: `2026-07-${String(index + 20).padStart(2, "0")}` as LocalDate,
      weather: {
        conditionLabel: probability > 60 ? "Rain showers" : "Clear",
        temperatureMin: 18 + index,
        temperatureMax: 26 + index,
        rainProbability: probability,
        precipitationMm: probability > 60 ? 9 : 0.5,
        windSpeedMax: 18 + index,
        observedAt: "2026-07-20T00:00:00Z",
      },
      score: { value: 85, state: "available", confidence: 0.9, reasonCodes: [] },
    })),
  };
}

function countryFixture(state: CountryPageViewModel["state"] = "ready"): CountryPageViewModel {
  return {
    country: countryHeader(),
    cities: [
      link("TYO", "Tokyo", "Japan", "/jp/tokyo"),
      link("OSA", "Osaka", "Japan", "/jp/osaka"),
    ],
    rankings: [
      {
        theme: "beach",
        title: "Best beach escapes",
        items: [
          link("TYO", "Tokyo", "Japan", "/jp/tokyo"),
          link("OSA", "Osaka", "Japan", "/jp/osaka"),
        ],
      },
    ],
    relatedLinks: [link("SEL", "Seoul", "South Korea", "/kr/seoul")],
    weatherCities: [
      countryWeatherCity("TYO", "Tokyo", "/jp/tokyo", 35.68, 139.69, [20, 75]),
      countryWeatherCity("OSA", "Osaka", "/jp/osaka", 34.69, 135.5, [15, 25]),
    ],
    availableCountries: [
      { slug: "jp", name: "Japan", path: "/jp" },
      { slug: "kr", name: "South Korea", path: "/kr" },
    ],
    dataUpdatedLabel: "Updated 2026-07-20",
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

function renderChineseCountry(vm: CountryPageViewModel): string {
  return renderToStaticMarkup(createElement(CountryPage, { viewModel: vm, locale: "zh-cn" }));
}

function renderCity(vm: CityPageViewModel): string {
  return renderToStaticMarkup(createElement(CityPage, { viewModel: vm }));
}

describe("Country weather-map page", () => {
  const html = renderCountry(countryFixture("ready"));

  it("renders the country-first map identity as crawlable primary content", () => {
    expect(html).toContain("Japan travel weather at a glance");
    expect(html).toContain("All supported travel destinations at a glance");
    expect(html).toContain("Next 7 days");
    expect(html).toContain('data-testid="country-weather-map"');
  });

  it("lists every mapped city with links to detailed forecasts", () => {
    expect(html).toContain("/jp/tokyo?start=2026-07-20&amp;end=2026-07-21");
    expect(html).toContain("/jp/osaka?start=2026-07-20&amp;end=2026-07-21");
    expect(html).toContain("Tokyo");
    expect(html).toContain("Osaka");
  });

  it("does not reintroduce rankings, cross-country recommendations or trip actions", () => {
    expect(html).not.toContain("Best beach escapes");
    expect(html).not.toContain('href="/kr/seoul"');
    expect(html).not.toContain("Build this trip");
    expect(html).not.toContain("Travel Score");
  });

  it("renders the map loading state", () => {
    const loading = renderCountry(countryFixture("loading"));
    expect(loading).toContain("Loading the country weather map");
    expect(loading).not.toContain('data-testid="country-weather-map"');
  });

  it("renders the map error state", () => {
    const error = renderCountry(countryFixture("error"));
    expect(error).toContain("The weather map is unavailable right now");
  });

  it("renders Simplified Chinese country navigation and map heading", () => {
    const localized = countryFixture("ready");
    const html = renderChineseCountry({
      ...localized,
      country: { ...countryHeader(), name: "日本", summary: "一次比较日本不同地区的天气。" },
      availableCountries: [
        { slug: "jp", name: "日本", path: "/zh-cn/jp" },
        { slug: "kr", name: "韩国", path: "/zh-cn/kr" },
      ],
      weatherCities: localized.weatherCities?.map((city) => ({
        ...city,
        countryName: "日本",
        path: `/zh-cn${city.path}`,
      })),
    });
    expect(html).toContain("哪里不下雨");
    expect(html).toContain("一张图看懂日本哪里天气更好");
    expect(html).toContain("全部已收录旅行地天气一目了然");
    expect(html).toContain("未来 7 天");
  });
});

describe("City destination page (PRD-FR-004, DATA-WEATHER-001)", () => {
  const html = renderCity(cityFixture());

  it("renders the city + country heading", () => {
    expect(html).toContain("Tokyo, Japan");
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/jp"');
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
