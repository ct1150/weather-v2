import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Weather Atlas country selectors", () => {
  it("keeps country selectors visually integrated with the atlas design", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/country-select-refinements.css"),
      "utf8",
    );

    expect(css).toContain(".country-map-home-picker");
    expect(css).toContain(".country-select-label .country-select");
    expect(css).toContain('content: "⌖"');
    expect(css).toContain("appearance: none");
    expect(css).toContain("rgb(var(--atlas-sun))");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("min-height: 3.55rem");
  });
});
