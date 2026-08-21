import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const refinements = readFileSync(
  resolve(process.cwd(), "src/app/country-map-refinements.css"),
  "utf8",
);

describe("Weather Atlas frontend design system", () => {
  it("defines a distinctive atlas visual language instead of generic card styling", () => {
    expect(refinements).toContain("--atlas-display");
    expect(refinements).toContain("--atlas-mono");
    expect(refinements).toContain("--atlas-sun");
    expect(refinements).toContain("repeating-radial-gradient");
    expect(refinements).toContain('content: "MAP " counter(atlas-country, decimal-leading-zero)');
  });

  it("treats the country controls and map as one weather instrument", () => {
    expect(refinements).toContain(".country-console-toolbar");
    expect(refinements).toContain(".country-window-button.is-active");
    expect(refinements).toContain(".country-weather-map-instant");
    expect(refinements).toContain(".country-outline-shape");
    expect(refinements).toContain(".country-city-inspector");
  });

  it("keeps responsive and reduced-motion behavior explicit", () => {
    expect(refinements).toContain("@media (max-width: 639px)");
    expect(refinements).toContain('.country-static-weather-marker:not([aria-pressed="true"])');
    expect(refinements).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(refinements).toContain("@keyframes atlas-reveal");
  });
});
