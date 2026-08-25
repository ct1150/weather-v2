import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(process.cwd(), "src/app/instant-country-map.css"), "utf8");
const explorer = readFileSync(
  join(process.cwd(), "src/components/InstantCountryWeatherExplorer.tsx"),
  "utf8",
);

describe("rain-risk visual semantics", () => {
  it("uses distinct success, amber and danger colors", () => {
    expect(styles).toContain(".country-weather-dot.risk-good");
    expect(styles).toContain("--dot-color: rgb(var(--wnr-success))");
    expect(styles).toContain("--dot-color: #f59e0b");
    expect(styles).toContain("--dot-color: rgb(var(--wnr-danger))");
    expect(styles).not.toMatch(/risk-wet[\s\S]{0,160}--dot-color:\s*rgb\(var\(--wnr-accent\)\)/);
  });

  it("does not rely on color alone to separate amber and red", () => {
    expect(styles).toContain(".country-weather-dot.risk-mixed .country-weather-dot-core::after");
    expect(styles).toContain("border-style: dashed");
    expect(styles).toContain(".country-weather-dot.risk-wet .country-weather-dot-core::after");
    expect(styles).toContain("border-width: 2px");
    expect(styles).toContain(".country-map-legend .legend-wet");
  });

  it("feeds the same window classifier into map and destination-list risk classes", () => {
    expect(explorer).toContain('import { assessRainWindow } from "./rain-window-risk"');
    expect(explorer).toContain("const risk: Risk = assessRainWindow({");
    expect(explorer).toContain("risk: summary.risk");
    expect(explorer).toContain("country-city-choice risk-${summary.risk}");
  });
});
