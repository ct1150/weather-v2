// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    detail: "6 lower-rain days",
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
    detail: "4 lower-rain days",
    risk: "mixed",
    filtered: false,
    selected: false,
    ariaLabel: "Shanghai weather",
  },
];

afterEach(() => cleanup());

describe("country map dot density", () => {
  it("places every interactive weather dot directly on its geographic anchor", () => {
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
      expect(style).toContain("left:");
      expect(style).toContain("top:");
      expect(marker.className).toContain("country-weather-dot");
    }

    const selectedPin = screen
      .getAllByTestId("country-weather-pin")
      .find((pin) => pin.getAttribute("data-city-id") === "beijing");
    expect(selectedPin?.className).toContain("is-selected");
  });

  it("keeps cards hidden until hover or keyboard focus and suppresses them on touch screens", () => {
    const css = readFileSync(join(process.cwd(), "src/app/instant-country-map.css"), "utf8");

    expect(css).toContain(".country-weather-dot-tooltip");
    expect(css).toContain("opacity: 0");
    expect(css).toContain("@media (hover: hover) and (pointer: fine)");
    expect(css).toContain(".country-weather-dot:hover .country-weather-dot-tooltip");
    expect(css).toContain(".country-weather-dot:focus-visible .country-weather-dot-tooltip");
    expect(css).toContain("@media (max-width: 639px)");
    expect(css).toContain("display: none");
  });
});
