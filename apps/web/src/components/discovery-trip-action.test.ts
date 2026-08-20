import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const standard = readFileSync(
  new URL("./InstantCountryWeatherExplorer.tsx", import.meta.url),
  "utf8",
);
const traditional = readFileSync(
  new URL("./TraditionalCountryWeatherExplorer.tsx", import.meta.url),
  "utf8",
);

describe("country weather map product boundary", () => {
  it("keeps direct trip creation out of the standard country map", () => {
    expect(standard).not.toContain("DiscoveryTripAction");
    expect(standard).not.toContain("/trips/workspace");
    expect(standard).toContain("Open full city forecast");
    expect(standard).toContain("All supported travel destinations at a glance");
  });

  it("uses the same map implementation in Traditional Chinese without trip actions", () => {
    expect(traditional).not.toContain("DiscoveryTripAction");
    expect(traditional).not.toContain("/zh-hant/trips/workspace");
    expect(traditional).toContain("CountryWeatherExplorer");
    expect(traditional).toContain('locale="zh-hant"');
  });
});
