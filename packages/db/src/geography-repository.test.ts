import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryD1 } from "@wnr/test-utils";
import type { D1DatabaseLike } from "@wnr/test-utils";
import {
  GeographyRepository,
  GeographyValidationError,
  parseAliasesJson,
  type CountryCanonical,
  type CityCanonical,
} from "./geography-repository.js";

// Authoritative geography schema (DATA-GEOGRAPHY-001). Used here only to provision the
// in-memory D1 for the repository tests; the migration in task 4 owns the durable DDL.
const GEOGRAPHY_SCHEMA = `
CREATE TABLE countries (
  id TEXT PRIMARY KEY,
  iso2 TEXT NOT NULL UNIQUE,
  iso3 TEXT NOT NULL UNIQUE,
  default_timezone TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE country_translations (
  country_id TEXT NOT NULL REFERENCES countries(id),
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  PRIMARY KEY (country_id, locale)
);
CREATE TABLE cities (
  id TEXT PRIMARY KEY,
  country_id TEXT NOT NULL REFERENCES countries(id),
  slug TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timezone TEXT NOT NULL,
  population INTEGER,
  elevation_m REAL,
  is_featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  search_weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (country_id, slug)
);
CREATE TABLE city_translations (
  city_id TEXT NOT NULL REFERENCES cities(id),
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  seo_title TEXT,
  seo_description TEXT,
  PRIMARY KEY (city_id, locale)
);
`;

const TS = "2026-07-20T00:00:00Z";

function makeCountry(): CountryCanonical {
  return {
    id: "pt",
    iso2: "PT",
    iso3: "PRT",
    defaultTimezone: "Europe/Lisbon",
    slug: "portugal",
    status: "active",
    createdAt: TS,
    updatedAt: TS,
  };
}

function makeCity(countryId = "pt"): CityCanonical {
  return {
    id: "lisbon",
    countryId,
    slug: "lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
    timezone: "Europe/Lisbon",
    population: 504718,
    elevationM: 2,
    isFeatured: true,
    status: "active",
    searchWeight: 1.5,
    createdAt: TS,
    updatedAt: TS,
  };
}

describe("GeographyRepository — canonical + localized persistence", () => {
  let db: D1DatabaseLike;
  let repo: GeographyRepository;

  beforeEach(async () => {
    db = createInMemoryD1();
    await db.exec(GEOGRAPHY_SCHEMA);
    repo = new GeographyRepository(db);
  });

  it("round-trips a country and its localized name by slug", async () => {
    await repo.insertCountry(makeCountry(), [
      { countryId: "pt", locale: "en", name: "Portugal" },
      { countryId: "pt", locale: "es", name: "Portugal" },
    ]);
    const country = await repo.getCountryBySlug("portugal");
    expect(country?.id).toBe("pt");
    expect(country?.iso2).toBe("PT");
    expect(await repo.getCountryTranslation("pt", "en")).toMatchObject({ name: "Portugal", locale: "en" });
  });

  it("round-trips a city and its localized name + aliases by slug", async () => {
    await repo.insertCountry(makeCountry(), [{ countryId: "pt", locale: "en", name: "Portugal" }]);
    await repo.insertCity(makeCity(), [
      { cityId: "lisbon", locale: "en", name: "Lisbon", aliases: ["Lisboa", "Lx"] },
      { cityId: "lisbon", locale: "pt", name: "Lisboa", aliases: ["Lisbon"] },
    ]);
    const city = await repo.getCityBySlug("pt", "lisbon");
    expect(city?.latitude).toBeCloseTo(38.7223);
    expect(city?.isFeatured).toBe(true);
    expect(await repo.getCityTranslation("lisbon", "en")).toMatchObject({ name: "Lisbon" });
  });

  it("resolves localized names to ONE canonical city (no locale-specific duplicates)", async () => {
    await repo.insertCountry(makeCountry(), [{ countryId: "pt", locale: "en", name: "Portugal" }]);
    await repo.insertCity(makeCity(), [
      { cityId: "lisbon", locale: "en", name: "Lisbon", aliases: [] },
      { cityId: "lisbon", locale: "pt", name: "Lisboa", aliases: [] },
    ]);
    const byEn = await repo.resolveCityByLocalizedName("en", "Lisbon");
    const byPt = await repo.resolveCityByLocalizedName("pt", "Lisboa");
    expect(byEn?.id).toBe("lisbon");
    expect(byPt?.id).toBe("lisbon");
    // Same canonical entity regardless of locale.
    expect(byEn?.id).toBe(byPt?.id);
  });

  it("resolves a localized alias to the canonical city", async () => {
    await repo.insertCountry(makeCountry(), [{ countryId: "pt", locale: "en", name: "Portugal" }]);
    await repo.insertCity(makeCity(), [
      { cityId: "lisbon", locale: "en", name: "Lisbon", aliases: ["Lisboa", "Lx"] },
    ]);
    const resolved = await repo.resolveCityByAlias("en", "Lisboa");
    expect(resolved?.id).toBe("lisbon");
  });

  it("stores metric/SI coordinates unchanged regardless of display unit", async () => {
    await repo.insertCountry(makeCountry(), [{ countryId: "pt", locale: "en", name: "Portugal" }]);
    const city = makeCity();
    await repo.insertCity(city, [{ cityId: "lisbon", locale: "en", name: "Lisbon", aliases: [] }]);
    const stored = await repo.getCityBySlug("pt", "lisbon");
    // No unit conversion happens at persistence time.
    expect(stored?.latitude).toBe(city.latitude);
    expect(stored?.longitude).toBe(city.longitude);
    expect(stored?.elevationM).toBe(city.elevationM);
  });
});

describe("GeographyRepository — validation rejects bad data before persistence", () => {
  let db: D1DatabaseLike;
  let repo: GeographyRepository;

  beforeEach(async () => {
    db = createInMemoryD1();
    await db.exec(GEOGRAPHY_SCHEMA);
    repo = new GeographyRepository(db);
  });

  it("rejects latitude outside -90..90", async () => {
    const city = { ...makeCity(), latitude: -91 };
    await expect(repo.insertCity(city, [])).rejects.toBeInstanceOf(GeographyValidationError);
  });

  it("rejects longitude outside -180..180", async () => {
    const city = { ...makeCity(), longitude: 200 };
    await expect(repo.insertCity(city, [])).rejects.toBeInstanceOf(GeographyValidationError);
  });

  it("rejects an unsupported status value", async () => {
    const city = { ...makeCity(), status: "pending" as CityCanonical["status"] };
    await expect(repo.insertCity(city, [])).rejects.toBeInstanceOf(GeographyValidationError);
  });

  it("rejects an invalid time zone", async () => {
    const city = { ...makeCity(), timezone: "Not/A Zone" };
    await expect(repo.insertCity(city, [])).rejects.toBeInstanceOf(GeographyValidationError);
  });

  it("rejects an invalid locale in a translation", async () => {
    await repo.insertCountry(makeCountry(), []);
    const country = makeCountry();
    await expect(
      repo.insertCountry(country, [{ countryId: "pt", locale: "EN", name: "Portugal" }]),
    ).rejects.toBeInstanceOf(GeographyValidationError);
  });

  it("rejects malformed alias JSON", async () => {
    await repo.insertCountry(makeCountry(), [{ countryId: "pt", locale: "en", name: "Portugal" }]);
    const city = makeCity();
    await expect(
      repo.insertCity(city, [{ cityId: "lisbon", locale: "en", name: "Lisbon", aliases: ["x"] as unknown as string[] }]),
    ).resolves.toBeUndefined();
    // Directly corrupt the stored JSON to prove the parser rejects malformed content.
    await db.prepare("UPDATE city_translations SET aliases_json = ? WHERE city_id = ?").bind("{bad", "lisbon").run();
    await expect(repo.getCityTranslation("lisbon", "en")).rejects.toBeInstanceOf(GeographyValidationError);
  });

  it("rejects a non-ASCII slug", async () => {
    const country = { ...makeCountry(), slug: "Portugal" };
    await expect(repo.insertCountry(country, [])).rejects.toBeInstanceOf(GeographyValidationError);
  });
});

describe("parseAliasesJson", () => {
  it("parses a valid JSON string array", () => {
    expect(parseAliasesJson('["a","b"]')).toEqual(["a", "b"]);
  });
  it("rejects malformed JSON", () => {
    expect(() => parseAliasesJson("{bad")).toThrow(GeographyValidationError);
  });
  it("rejects a non-array payload", () => {
    expect(() => parseAliasesJson('{"a":1}')).toThrow(GeographyValidationError);
  });
  it("rejects arrays containing non-strings", () => {
    expect(() => parseAliasesJson("[1,2]")).toThrow(GeographyValidationError);
  });
});
