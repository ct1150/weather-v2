import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TravelRadarPage } from "./page";

const countries = [
  {
    countryId: "JP",
    slug: "jp",
    name: "Japan",
    path: "/jp",
    summary: "Compare popular destinations across Japan.",
    cityCount: 8,
    cityNames: ["Sapporo", "Osaka", "Tokyo", "Okinawa"],
    weatherScore: 82,
    weatherStatus: "excellent" as const,
  },
  {
    countryId: "TH",
    slug: "th",
    name: "Thailand",
    path: "/th",
    summary: "See northern, capital and island weather together.",
    cityCount: 7,
    cityNames: ["Chiang Mai", "Bangkok", "Phuket", "Koh Samui"],
    weatherScore: 61,
    weatherStatus: "mixed" as const,
  },
] as const;

function render(): string {
  return renderToStaticMarkup(createElement(TravelRadarPage, { countryLinks: countries }));
}

describe("destination-decision homepage", () => {
  const html = render();

  it("makes least-rain destination discovery primary while retaining the real world map", () => {
    expect(html).toContain("Dates fixed. Where is it least likely to rain?");
    expect(html).toContain("Find least-rain destinations");
    expect(html).toContain('href="/discover"');
    expect(html).toContain("World travel weather overview");
    expect(html).toContain("data-world-weather-map-canvas");
    expect(html).not.toContain("world-weather-country-shape");
    expect(html).toContain('href="/jp"');
    expect(html).toContain('href="/th"');
    expect(html).not.toContain("Starting city");
    expect(html).not.toContain("Max one-way");
  });

  it("keeps crawlable country weather maps as secondary exploration", () => {
    expect(html).toContain("Explore country weather maps");
    expect(html).toContain("Japan");
    expect(html).toContain("Thailand");
    expect(html).toContain("8 cities");
    expect(html).toContain("7 cities");
  });

  it("renders weather status classes from country aggregation", () => {
    expect(html).toContain("status-excellent");
    expect(html).toContain("status-mixed");
    expect(html).toContain("Sapporo · Osaka · Tokyo");
  });
});
