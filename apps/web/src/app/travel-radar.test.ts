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

describe("world-map homepage", () => {
  const html = render();

  it("makes the real-map canvas the primary discovery task", () => {
    expect(html).toContain("See the world first. Then decide where to go.");
    expect(html).toContain("World travel weather overview");
    expect(html).toContain("data-world-weather-map-canvas");
    expect(html).not.toContain("world-weather-country-shape");
    expect(html).toContain('href="/jp"');
    expect(html).toContain('href="/th"');
    expect(html).not.toContain("Starting city");
    expect(html).not.toContain("Max one-way");
    expect(html).not.toContain('href="/discover"');
  });

  it("keeps crawlable supported-country links as a compact fallback", () => {
    expect(html).toContain("Supported countries");
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
