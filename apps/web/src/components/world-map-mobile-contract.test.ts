import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(join(process.cwd(), "src/components/WorldWeatherMap.tsx"), "utf8");
const styles = readFileSync(join(process.cwd(), "src/app/world-map.css"), "utf8");

describe("mobile world weather map contract", () => {
  it("preserves the world-map aspect ratio instead of stretching and zooming the SVG", () => {
    expect(styles).toContain("aspect-ratio: 1200 / 620");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("transform: none");
    expect(styles).not.toContain("transform: scale(1.12)");
    expect(styles).not.toContain("min-height: 18rem");
  });

  it("keeps each supported-country outline clipped to its geographic viewport", () => {
    expect(component).toContain('overflow="hidden"');
    expect(styles).not.toContain("vector-effect: non-scaling-stroke;\n  transition:");
  });

  it("adds a transparent touch target without changing the visible country shape", () => {
    expect(component).toContain("world-weather-country-touch-target");
    expect(component).toContain("r={30}");
    expect(styles).toContain("pointer-events: all");
    expect(styles).toContain("pointer-events: none");
  });
});
