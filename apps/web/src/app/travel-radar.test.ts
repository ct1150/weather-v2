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
  return renderToStaticMarkup(
    createElement(TravelRadarPage, { countryLinks: countries }),
  );
}

describe("time-driven world-map homepage", () => {
  const html = render();

  it("makes the weather period the first decision and keeps the real world map", () => {
    expect(html).toContain("Pick the dates. See where it stays drier.");
    expect(html).toContain("Next 7 days");
    expect(html).toContain("This weekend");
    expect(html).toContain("Custom dates");
    expect(html).toContain("data-home-weather-window");
    expect(html).toContain("World travel weather overview");
    expect(html).toContain("data-world-weather-map-canvas");
    expect(html).not.toContain("world-weather-country-shape");
    expect(html).toContain('href="/jp"');
    expect(html).toContain('href="/th"');
    expect(html).not.toContain('href="/discover"');
    expect(html).not.toContain("Starting city");
    expect(html).not.toContain("Max one-way");
  });

  it("keeps crawlable country weather maps below the time-driven map", () => {
    expect(html).toContain("Explore country weather maps");
    expect(html).toContain("Japan");
    expect(html).toContain("Thailand");
    expect(html).toContain("8 cities");
    expect(html).toContain("7 cities");
  });

  it("renders weather status classes from the server fallback", () => {
    expect(html).toContain("status-excellent");
    expect(html).toContain("status-mixed");
    expect(html).toContain("Sapporo · Osaka · Tokyo");
  });
});
