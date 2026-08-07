import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const standard = readFileSync(new URL("./CountryWeatherExplorer.tsx", import.meta.url), "utf8");
const traditional = readFileSync(
  new URL("./TraditionalCountryWeatherExplorer.tsx", import.meta.url),
  "utf8",
);

describe("direct weather discovery to trip UX", () => {
  it("exposes direct trip actions in standard country results", () => {
    expect(standard.match(/<DiscoveryTripAction/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(standard).toContain(
      'workspacePath={locale === "zh-cn" ? "/zh-cn/trips/workspace" : "/trips/workspace"}',
    );
  });

  it("exposes direct trip actions in Traditional Chinese results", () => {
    expect(traditional.match(/<DiscoveryTripAction/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(traditional).toContain('workspacePath="/zh-hant/trips/workspace"');
  });
});
