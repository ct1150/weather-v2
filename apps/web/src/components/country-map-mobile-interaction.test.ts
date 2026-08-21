import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  join(process.cwd(), "src/components/InstantCountryWeatherExplorer.tsx"),
  "utf8",
);
const styles = readFileSync(join(process.cwd(), "src/app/instant-country-map.css"), "utf8");

describe("mobile country-map comparison interaction", () => {
  it("keeps marker selection on the map instead of forcing a scroll to the inspector", () => {
    expect(component).not.toContain("scrollIntoView");
    expect(component).toContain("if (summary !== undefined) selectCity(summary);");
    expect(component).toContain("可继续点击其他圆点比较");
  });

  it("keeps the selected marker summary visible on touch screens", () => {
    expect(styles).toContain(".country-weather-dot.is-selected .country-weather-dot-tooltip");
    expect(styles).toContain("max-width: min(11rem, 62vw)");
    expect(styles).toContain("opacity: 1");
    expect(styles).toContain("visibility: visible");
  });
});
