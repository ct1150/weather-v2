// apps/web/src/search/search-destinations.test.ts
//
// Bounded multilingual fuzzy search tests (PRD-FR-005, API-VALIDATION-001,
// UX-A11Y-001, ENG-PRIVACY-001). Covers invalid-query rejection, exact/prefix/
// fuzzy/multilingual/country matching, result bounding, and the privacy
// guarantee (no logging; results carry only candidate-derived fields).

import { afterEach, describe, expect, it, vi } from "vitest";

import { searchDestinations } from "./search-destinations";
import type { SearchCandidate } from "./search-destinations";

const candidates: SearchCandidate[] = [
  {
    cityId: "TYO",
    names: ["Tokyo", "東京"],
    countryNames: ["Japan", "日本"],
    countrySlug: "jp",
    citySlug: "tokyo",
    path: "/jp/tokyo",
  },
  {
    cityId: "OSA",
    names: ["Osaka", "大阪"],
    countryNames: ["Japan", "日本"],
    countrySlug: "jp",
    citySlug: "osaka",
    path: "/jp/osaka",
  },
  {
    cityId: "LON",
    names: ["London"],
    countryNames: ["United Kingdom"],
    countrySlug: "gb",
    citySlug: "london",
    path: "/gb/london",
  },
  {
    cityId: "PAR",
    names: ["Paris"],
    countryNames: ["France"],
    countrySlug: "fr",
    citySlug: "paris",
    path: "/fr/paris",
  },
  {
    cityId: "NYC",
    names: ["New York"],
    countryNames: ["United States"],
    countrySlug: "us",
    citySlug: "new-york",
    path: "/us/new-york",
  },
];

describe("search-destinations — validation (API-VALIDATION-001)", () => {
  it("rejects an empty query", () => {
    expect(searchDestinations("", candidates)).toEqual([]);
  });

  it("rejects whitespace-only queries", () => {
    expect(searchDestinations("   ", candidates)).toEqual([]);
  });

  it("rejects queries shorter than 2 scalars", () => {
    expect(searchDestinations("a", candidates)).toEqual([]);
  });
});

describe("search-destinations — matching", () => {
  it("returns an exact match at the top with score 1", () => {
    const results = searchDestinations("Tokyo", candidates);
    expect(results[0]?.cityId).toBe("TYO");
    expect(results[0]?.score).toBe(1);
  });

  it("matches a prefix (case-insensitive)", () => {
    const results = searchDestinations("tok", candidates);
    expect(results.some((r) => r.cityId === "TYO")).toBe(true);
  });

  it("tolerates a small typo via fuzzy matching", () => {
    const results = searchDestinations("tokio", candidates);
    expect(results.some((r) => r.cityId === "TYO")).toBe(true);
  });

  it("matches multilingual names (Japanese)", () => {
    const results = searchDestinations("東京", candidates);
    expect(results[0]?.cityId).toBe("TYO");
    expect(results[0]?.name).toBe("東京");
  });

  it("matches by country name", () => {
    const results = searchDestinations("Japan", candidates);
    const ids = results.map((r) => r.cityId);
    expect(ids).toContain("TYO");
    expect(ids).toContain("OSA");
  });

  it("matches multilingual country names", () => {
    const results = searchDestinations("日本", candidates);
    const ids = results.map((r) => r.cityId);
    expect(ids).toContain("TYO");
    expect(ids).toContain("OSA");
  });

  it("matches a multi-word label by a single token", () => {
    const results = searchDestinations("york", candidates);
    expect(results.some((r) => r.cityId === "NYC")).toBe(true);
  });

  it("returns nothing for an unrelated query", () => {
    expect(searchDestinations("zzzzzz", candidates)).toEqual([]);
  });

  it("ranks the most relevant candidate first", () => {
    const results = searchDestinations("lon", candidates);
    expect(results[0]?.cityId).toBe("LON");
  });
});

describe("search-destinations — bounding", () => {
  it("caps results at maxResults", () => {
    const many: SearchCandidate[] = Array.from({ length: 50 }, (_, i) => ({
      cityId: `C${i}`,
      names: [`City${i}`],
      countryNames: ["Nowhere"],
      countrySlug: "now",
      citySlug: `city-${i}`,
      path: `/now/city-${i}`,
    }));
    const results = searchDestinations("city", many, { maxResults: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("caps the query length without throwing", () => {
    const longQuery = "a".repeat(200);
    const results = searchDestinations(longQuery, candidates);
    expect(Array.isArray(results)).toBe(true);
  });

  it("honors a high minScore by excluding weak fuzzy matches", () => {
    const results = searchDestinations("tokio", candidates, { minScore: 0.95 });
    expect(results.some((r) => r.cityId === "TYO")).toBe(false);
  });
});

describe("search-destinations — privacy (ENG-PRIVACY-001)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never logs the query and returns only candidate-derived fields", () => {
    const logSpy = vi.spyOn(console, "log");
    const warnSpy = vi.spyOn(console, "warn");
    const errorSpy = vi.spyOn(console, "error");

    const results = searchDestinations("Tokyo", candidates);

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    const allowedKeys = ["cityId", "countryName", "name", "path", "score"].sort();
    for (const r of results) {
      expect(Object.keys(r).sort()).toEqual(allowedKeys);
    }
  });

  it("does not retain the query between calls (pure function)", () => {
    searchDestinations("Tokyo", candidates);
    const second = searchDestinations("Paris", candidates);
    expect(second[0]?.cityId).toBe("PAR");
    expect(second.some((r) => r.cityId === "TYO")).toBe(false);
  });
});
