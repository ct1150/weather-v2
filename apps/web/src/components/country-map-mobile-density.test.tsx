// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CountryOutlineMap, type CountryOutlineMarker } from "./CountryOutlineMap";

const MARKERS: ReadonlyArray<CountryOutlineMarker> = [
  {
    id: "beijing",
    name: "Beijing",
    longitude: 116.4074,
    latitude: 39.9042,
    symbol: "☀️",
    detail: "6/7 dry",
    risk: "good",
    filtered: false,
    selected: true,
    ariaLabel: "Beijing weather",
  },
  {
    id: "shanghai",
    name: "Shanghai",
    longitude: 121.4737,
    latitude: 31.2304,
    symbol: "🌤️",
    detail: "4/7 dry",
    risk: "mixed",
    filtered: false,
    selected: false,
    ariaLabel: "Shanghai weather",
  },
];

afterEach(() => cleanup());

describe("country map mobile density", () => {
  it("exposes exact anchor positions to the responsive marker layout", () => {
    render(
      <CountryOutlineMap
        countryId="CN"
        countryName="China"
        ariaLabel="China weather map"
        markers={MARKERS}
        onSelect={vi.fn()}
      />,
    );

    for (const marker of screen.getAllByTestId("country-weather-marker")) {
      const style = marker.getAttribute("style") ?? "";
      expect(style).toContain("--anchor-left");
      expect(style).toContain("--anchor-top");
    }

    const selectedPin = screen
      .getAllByTestId("country-weather-pin")
      .find((pin) => pin.getAttribute("data-city-id") === "beijing");
    expect(selectedPin?.className).toContain("is-selected");
  });

  it("collapses mobile markers to anchor chips and one selected bottom card", () => {
    const css = readFileSync(new URL("../app/instant-country-map.css", import.meta.url), "utf8");

    expect(css).toContain("@media (max-width: 639px)");
    expect(css).toContain("left: var(--anchor-left) !important");
    expect(css).toContain("top: var(--anchor-top) !important");
    expect(css).toContain(".country-marker-leaders");
    expect(css).toContain("display: none");
    expect(css).toContain('.country-static-weather-marker[aria-pressed="true"]');
    expect(css).toContain("bottom: 0.7rem");
  });
});
