import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TravelRadarPage } from "./page";

const countries = [
  {
    slug: "jp",
    name: "Japan",
    path: "/jp",
    summary: "Compare popular destinations across Japan.",
    cityCount: 8,
    cityNames: ["Tokyo", "Osaka", "Sapporo", "Okinawa"],
  },
  {
    slug: "th",
    name: "Thailand",
    path: "/th",
    summary: "See northern, capital and island weather together.",
    cityCount: 7,
    cityNames: ["Bangkok", "Chiang Mai", "Phuket", "Koh Samui"],
  },
] as const;

function render(): string {
  return renderToStaticMarkup(createElement(TravelRadarPage, { countryLinks: countries }));
}

describe("country-map homepage", () => {
  const html = render();

  it("makes country selection the only primary product task", () => {
    expect(html).toContain("Pick a country. See where the weather looks better.");
    expect(html).toContain("Choose a country");
    expect(html).toContain('href="/jp"');
    expect(html).toContain('href="/th"');
    expect(html).not.toContain("Starting city");
    expect(html).not.toContain("Max one-way");
    expect(html).not.toContain("Top 3");
    expect(html).not.toContain('href="/discover"');
  });

  it("renders crawlable country and destination context without JavaScript", () => {
    expect(html).toContain("Japan");
    expect(html).toContain("Thailand");
    expect(html).toContain("8 popular destinations");
    expect(html).toContain("Tokyo · Osaka · Sapporo · Okinawa");
    expect(html).toContain("Open weather map");
  });

  it("explains the three-step low-cost interaction", () => {
    expect(html).toContain("Choose a country");
    expect(html).toContain("Read the map");
    expect(html).toContain("Tap a place");
  });
});
