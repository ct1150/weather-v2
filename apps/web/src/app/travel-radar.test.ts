// apps/web/src/app/travel-radar.test.ts
//
// Homepage journey tests. The static weather cards and their required fields
// remain crawlable while the primary task is now a least-rain destination
// decision.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TravelRadarPage } from "./page";
import type { TravelRadarViewModel, WindowControl } from "./view-models";

function render(vm: TravelRadarViewModel, windowControls: WindowControl[]): string {
  return renderToStaticMarkup(createElement(TravelRadarPage, { viewModel: vm, windowControls }));
}

function fixture(
  state: TravelRadarViewModel["state"] = "ready",
  stale = false,
): TravelRadarViewModel {
  return {
    window: "today",
    includedDates: ["2026-07-20"],
    state,
    freshness: {
      dataUpdatedAt: "2026-07-20T00:00:00Z",
      stale,
      updatedLabel: stale ? "Updated 5h ago" : "Updated 2h ago",
    },
    cards: [
      {
        destination: {
          cityId: "TYO",
          countrySlug: "jp",
          citySlug: "tokyo",
          cityName: "Tokyo",
          countryName: "Japan",
          path: "/jp/tokyo",
        },
        score: {
          value: 82,
          state: "available",
          confidence: 0.9,
          reasonCodes: ["LOW_RAIN_CHANCE", "COMFORTABLE_TEMPERATURE"],
        },
        weather: {
          conditionLabel: "Clear",
          temperatureMin: 18,
          temperatureMax: 26,
          rainProbability: 10,
          observedAt: "2026-07-20T00:00:00Z",
        },
        reasonCodes: ["LOW_RAIN_CHANCE", "COMFORTABLE_TEMPERATURE"],
      },
      {
        destination: {
          cityId: "SEL",
          countrySlug: "kr",
          citySlug: "seoul",
          cityName: "Seoul",
          countryName: "South Korea",
          path: "/kr/seoul",
        },
        score: {
          value: null,
          state: "unavailable",
          confidence: null,
          reasonCodes: ["LIMITED_DATA"],
        },
        weather: {
          conditionLabel: "Cloudy",
          temperatureMin: 15,
          temperatureMax: 22,
          rainProbability: 40,
          observedAt: "2026-07-20T00:00:00Z",
        },
        reasonCodes: ["LIMITED_DATA"],
      },
    ],
  };
}

function controls(): WindowControl[] {
  return [
    { window: "today", label: "Today", href: "/?window=today", selected: true, exactDates: [] },
    {
      window: "tomorrow",
      label: "Tomorrow",
      href: "/?window=tomorrow",
      selected: false,
      exactDates: [],
    },
    {
      window: "weekend",
      label: "This Weekend",
      href: "/?window=weekend",
      selected: false,
      exactDates: ["2026-07-25", "2026-07-26"],
    },
    {
      window: "next_week",
      label: "Next Week",
      href: "/?window=next_week",
      selected: false,
      exactDates: ["2026-07-27", "2026-08-02"],
    },
  ];
}

describe("Travel Radar homepage — product scope", () => {
  const html = render(fixture("ready"), controls());

  it("makes weather-first destination comparison the primary action", () => {
    expect(html).toContain("Dates fixed.");
    expect(html).toContain("Where is it least likely to rain?");
    expect(html).toContain("Find 3 dry-weather destinations");
    expect(html).toContain('href="/discover"');
    expect(html).not.toContain('href="/trips"');
    expect(html).not.toContain("I already have a trip");
  });

  it("renders the three-step least-rain decision flow", () => {
    expect(html).toContain("Choose dates");
    expect(html).toContain("Add optional limits");
    expect(html).toContain("Compare the Top 3");
  });

  it("exposes every card's required fields in crawlable primary content", () => {
    expect(html).toContain("Tokyo");
    expect(html).toContain("Japan");
    expect(html).toContain("Clear");
    expect(html).toContain("Weather signal");
    expect(html).toContain("82");
    expect(html).toContain("18°");
    expect(html).toContain("26°");
    expect(html).toContain("10%");
    expect(html).toContain("LOW_RAIN_CHANCE");
    expect(html).toContain('href="/jp/tokyo"');
    expect(html).toContain('href="/kr/seoul"');
  });

  it("shows the unavailable score state without fabricating a value", () => {
    expect(html).toContain("Unavailable");
    expect(html).toContain("LIMITED_DATA");
  });
});

describe("Travel Radar homepage — time window + freshness", () => {
  it("exposes exact dates for ambiguous windows and marks the selected window", () => {
    const html = render(fixture("ready"), controls());
    expect(html).toContain('aria-label="This Weekend (2026-07-25, 2026-07-26)"');
    expect(html).toContain('aria-label="Next Week (2026-07-27, 2026-08-02)"');
    expect(html).toContain('aria-current="true"');
  });

  it("visibly labels stale data and never presents it as live", () => {
    const html = render(fixture("ready", true), controls());
    expect(html).toContain("Stale data");
    expect(html).toContain("Updated 5h ago");
  });

  it("labels fresh data with its update time", () => {
    const html = render(fixture("ready", false), controls());
    expect(html).toContain("Updated 2h ago");
    expect(html).not.toContain("Stale data");
  });
});

describe("Travel Radar homepage — async states", () => {
  it("renders the loading state", () => {
    const html = render(fixture("loading"), controls());
    expect(html).toContain("Loading recommendations");
    expect(html).not.toContain('href="/jp/tokyo"');
  });

  it("renders the empty state", () => {
    const html = render(fixture("empty"), controls());
    expect(html).toContain("No destinations match this window yet.");
  });

  it("renders the error state", () => {
    const html = render(fixture("error"), controls());
    expect(html).toContain("load recommendations");
  });
});
