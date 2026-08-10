import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativeUrl: string): string {
  return readFileSync(new URL(relativeUrl, import.meta.url), "utf8");
}

describe("weather-sync production provider deployment contract", () => {
  it("declares Open-Meteo explicitly in default, preview and production Worker vars", () => {
    const wrangler = read("../wrangler.toml");
    expect(wrangler).toMatch(/\[vars\][\s\S]*WEATHER_PRIMARY_PROVIDER\s*=\s*"open-meteo"/u);
    expect(wrangler).toMatch(
      /\[env\.preview\.vars\][\s\S]*WEATHER_PRIMARY_PROVIDER\s*=\s*"open-meteo"/u,
    );
    expect(wrangler).toMatch(
      /\[env\.production\.vars\][\s\S]*WEATHER_PRIMARY_PROVIDER\s*=\s*"open-meteo"/u,
    );
  });
});
