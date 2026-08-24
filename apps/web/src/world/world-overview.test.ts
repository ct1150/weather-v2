import { describe, expect, it } from "vitest";
import type { BakedCity } from "../build/types";
import { summarizeCountryWeather, worldWeatherStatus } from "./world-overview";

function city(id: string, score: number | null): BakedCity {
  return {
    city: { id },
    score: { score },
  } as unknown as BakedCity;
}

describe("world weather overview", () => {
  it("uses the top three visible city scores for the country summary", () => {
    const summary = summarizeCountryWeather([
      city("a", 45),
      city("b", 91),
      city("c", 72),
      city("d", 84),
      city("hidden", null),
    ]);

    expect(summary.score).toBe(82);
    expect(summary.status).toBe("excellent");
    expect(summary.topCityIds).toEqual(["b", "d", "c"]);
  });

  it("keeps countries with no visible scores explicitly unknown", () => {
    expect(summarizeCountryWeather([city("a", null)]).status).toBe("unknown");
    expect(worldWeatherStatus(null)).toBe("unknown");
  });

  it("maps country scores to stable visual buckets", () => {
    expect(worldWeatherStatus(80)).toBe("excellent");
    expect(worldWeatherStatus(65)).toBe("good");
    expect(worldWeatherStatus(50)).toBe("mixed");
    expect(worldWeatherStatus(49)).toBe("poor");
  });
});
