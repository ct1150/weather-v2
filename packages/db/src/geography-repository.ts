// @wnr/db — canonical geography + localized persistence (DATA-GEOGRAPHY-001).
//
// D1 stores canonical identifiers and stable ASCII slugs SEPARATELY from localized display
// content (country_translations / city_translations). All coordinates, time zones, status
// values, locale values, aliases, and numeric ranges are validated BEFORE persistence, so a
// malformed row can never reach the database. Localized names/aliases resolve back to the
// single canonical city/country id — they never create locale-specific entity duplicates.
//
// The D1 port is imported as a type only, so @wnr/db carries no runtime dependency on the
// test fake that implements it.

import type { D1DatabaseLike } from "@wnr/test-utils";

export type CountryStatus = "active" | "deprecated";
export type CityStatus = "active" | "deprecated";

/** Canonical, locale-independent country record. */
export interface CountryCanonical {
  readonly id: string;
  readonly iso2: string;
  readonly iso3: string;
  readonly defaultTimezone: string;
  readonly slug: string;
  readonly status: CountryStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Localized country display content. */
export interface CountryTranslation {
  readonly countryId: string;
  readonly locale: string;
  readonly name: string;
  readonly seoTitle?: string | null;
  readonly seoDescription?: string | null;
}

/** Canonical, locale-independent city record. SI/metric units are stored as-is. */
export interface CityCanonical {
  readonly id: string;
  readonly countryId: string;
  readonly slug: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly population?: number | null;
  readonly elevationM?: number | null;
  readonly isFeatured: boolean;
  readonly status: CityStatus;
  readonly searchWeight: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Localized city display content, including search aliases. */
export interface CityTranslation {
  readonly cityId: string;
  readonly locale: string;
  readonly name: string;
  readonly aliases: ReadonlyArray<string>;
  readonly summary?: string | null;
  readonly seoTitle?: string | null;
  readonly seoDescription?: string | null;
}

/** Thrown when a canonical or localized record fails pre-persistence validation. */
export class GeographyValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(`Invalid geography field "${field}": ${message}`);
    this.name = "GeographyValidationError";
    this.field = field;
  }
}

const COUNTRY_STATUSES: ReadonlyArray<CountryStatus> = ["active", "deprecated"];
const CITY_STATUSES: ReadonlyArray<CityStatus> = ["active", "deprecated"];

const ASCII_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO2 = /^[A-Z]{2}$/;
const ISO3 = /^[A-Z]{3}$/;
// IANA-ish: Area(/Subarea)*, e.g. "Europe/Lisbon", "UTC", "America/Argentina/Buenos_Aires".
const TIMEZONE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+]+)*$/;
// BCP-47-ish: language(-region)*, e.g. "en", "en-US", "zh-Hant".
const LOCALE = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})*$/;

function validateAsciiSlug(value: string, field: string): void {
  if (typeof value !== "string" || !ASCII_SLUG.test(value)) {
    throw new GeographyValidationError(field, "expected a stable lowercase ASCII slug");
  }
}

function validateTimezone(value: string, field: string): void {
  if (typeof value !== "string" || !TIMEZONE.test(value)) {
    throw new GeographyValidationError(field, "expected an IANA-style time zone");
  }
}

function validateLocale(value: string, field: string): void {
  if (typeof value !== "string" || !LOCALE.test(value)) {
    throw new GeographyValidationError(field, "expected a BCP-47 locale");
  }
}

function validateLatitude(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -90 || value > 90) {
    throw new GeographyValidationError(field, "latitude must be within -90..90");
  }
}

function validateLongitude(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -180 || value > 180) {
    throw new GeographyValidationError(field, "longitude must be within -180..180");
  }
}

/** Validate and normalize an aliases JSON string into a string array. */
export function parseAliasesJson(json: string): ReadonlyArray<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new GeographyValidationError("aliases_json", "malformed JSON");
  }
  if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
    throw new GeographyValidationError("aliases_json", "must be a JSON array of strings");
  }
  return parsed;
}

function validateCountry(country: CountryCanonical): void {
  if (!country.id) throw new GeographyValidationError("id", "required");
  if (typeof country.iso2 !== "string" || !ISO2.test(country.iso2))
    throw new GeographyValidationError("iso2", "expected two uppercase letters");
  if (typeof country.iso3 !== "string" || !ISO3.test(country.iso3))
    throw new GeographyValidationError("iso3", "expected three uppercase letters");
  validateTimezone(country.defaultTimezone, "defaultTimezone");
  validateAsciiSlug(country.slug, "slug");
  if (!COUNTRY_STATUSES.includes(country.status))
    throw new GeographyValidationError("status", "unsupported country status");
  if (typeof country.createdAt !== "string" || !country.createdAt)
    throw new GeographyValidationError("createdAt", "required ISO timestamp");
  if (typeof country.updatedAt !== "string" || !country.updatedAt)
    throw new GeographyValidationError("updatedAt", "required ISO timestamp");
}

function validateCountryTranslation(t: CountryTranslation): void {
  if (!t.countryId) throw new GeographyValidationError("countryId", "required");
  validateLocale(t.locale, "locale");
  if (typeof t.name !== "string" || !t.name) throw new GeographyValidationError("name", "required");
}

function validateCity(city: CityCanonical): void {
  if (!city.id) throw new GeographyValidationError("id", "required");
  if (!city.countryId) throw new GeographyValidationError("countryId", "required");
  validateAsciiSlug(city.slug, "slug");
  validateLatitude(city.latitude, "latitude");
  validateLongitude(city.longitude, "longitude");
  validateTimezone(city.timezone, "timezone");
  if (city.population != null && (typeof city.population !== "number" || city.population < 0))
    throw new GeographyValidationError("population", "must be a non-negative number");
  if (city.elevationM != null && typeof city.elevationM !== "number")
    throw new GeographyValidationError("elevationM", "must be a number");
  if (typeof city.isFeatured !== "boolean")
    throw new GeographyValidationError("isFeatured", "must be a boolean");
  if (!CITY_STATUSES.includes(city.status))
    throw new GeographyValidationError("status", "unsupported city status");
  if (typeof city.searchWeight !== "number" || !Number.isFinite(city.searchWeight) || city.searchWeight <= 0)
    throw new GeographyValidationError("searchWeight", "must be a positive number");
  if (typeof city.createdAt !== "string" || !city.createdAt)
    throw new GeographyValidationError("createdAt", "required ISO timestamp");
  if (typeof city.updatedAt !== "string" || !city.updatedAt)
    throw new GeographyValidationError("updatedAt", "required ISO timestamp");
}

function validateCityTranslation(t: CityTranslation): void {
  if (!t.cityId) throw new GeographyValidationError("cityId", "required");
  validateLocale(t.locale, "locale");
  if (typeof t.name !== "string" || !t.name) throw new GeographyValidationError("name", "required");
  if (!Array.isArray(t.aliases) || !t.aliases.every((a) => typeof a === "string"))
    throw new GeographyValidationError("aliases", "must be a string array");
}

// --- Row mapping helpers (D1 returns snake_case columns as unknown-typed values) ---------

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new GeographyValidationError(field, "expected string");
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number") throw new GeographyValidationError(field, "expected number");
  return value;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  throw new GeographyValidationError(field, "expected boolean");
}

function mapCountryRow(row: Record<string, unknown>): CountryCanonical {
  const status = asString(row.status, "status");
  if (!COUNTRY_STATUSES.includes(status as CountryStatus))
    throw new GeographyValidationError("status", "unsupported country status in storage");
  return {
    id: asString(row.id, "id"),
    iso2: asString(row.iso2, "iso2"),
    iso3: asString(row.iso3, "iso3"),
    defaultTimezone: asString(row.default_timezone, "default_timezone"),
    slug: asString(row.slug, "slug"),
    status: status as CountryStatus,
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  };
}

function mapCityRow(row: Record<string, unknown>): CityCanonical {
  const status = asString(row.status, "status");
  if (!CITY_STATUSES.includes(status as CityStatus))
    throw new GeographyValidationError("status", "unsupported city status in storage");
  const population = row.population;
  const elevationM = row.elevation_m;
  return {
    id: asString(row.id, "id"),
    countryId: asString(row.country_id, "country_id"),
    slug: asString(row.slug, "slug"),
    latitude: asNumber(row.latitude, "latitude"),
    longitude: asNumber(row.longitude, "longitude"),
    timezone: asString(row.timezone, "timezone"),
    population: population == null ? null : asNumber(population, "population"),
    elevationM: elevationM == null ? null : asNumber(elevationM, "elevation_m"),
    isFeatured: asBoolean(row.is_featured, "is_featured"),
    status: status as CityStatus,
    searchWeight: asNumber(row.search_weight, "search_weight"),
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  };
}

function mapCountryTranslation(row: Record<string, unknown>): CountryTranslation {
  const seoTitle = row.seo_title;
  const seoDescription = row.seo_description;
  return {
    countryId: asString(row.country_id, "country_id"),
    locale: asString(row.locale, "locale"),
    name: asString(row.name, "name"),
    seoTitle: typeof seoTitle === "string" ? seoTitle : null,
    seoDescription: typeof seoDescription === "string" ? seoDescription : null,
  };
}

function mapCityTranslation(row: Record<string, unknown>): CityTranslation {
  const aliases = parseAliasesJson(asString(row.aliases_json, "aliases_json"));
  const summary = row.summary;
  const seoTitle = row.seo_title;
  const seoDescription = row.seo_description;
  return {
    cityId: asString(row.city_id, "city_id"),
    locale: asString(row.locale, "locale"),
    name: asString(row.name, "name"),
    aliases,
    summary: typeof summary === "string" ? summary : null,
    seoTitle: typeof seoTitle === "string" ? seoTitle : null,
    seoDescription: typeof seoDescription === "string" ? seoDescription : null,
  };
}

/**
 * Repository for canonical geography and its localized overlays.
 * All mutations are validated before any SQL runs.
 */
export class GeographyRepository {
  private readonly db: D1DatabaseLike;

  constructor(db: D1DatabaseLike) {
    this.db = db;
  }

  async insertCountry(
    country: CountryCanonical,
    translations: ReadonlyArray<CountryTranslation>,
  ): Promise<void> {
    validateCountry(country);
    for (const t of translations) {
      validateCountryTranslation(t);
      if (t.countryId !== country.id)
        throw new GeographyValidationError("countryId", "translation must reference the inserted country");
    }
    await this.db
      .prepare(
        "INSERT INTO countries (id, iso2, iso3, default_timezone, slug, status, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(country.id, country.iso2, country.iso3, country.defaultTimezone, country.slug, country.status, country.createdAt, country.updatedAt)
      .run();
    for (const t of translations) {
      await this.db
        .prepare(
          "INSERT INTO country_translations (country_id, locale, name, seo_title, seo_description) " +
            "VALUES (?, ?, ?, ?, ?)",
        )
        .bind(t.countryId, t.locale, t.name, t.seoTitle ?? null, t.seoDescription ?? null)
        .run();
    }
  }

  async insertCity(
    city: CityCanonical,
    translations: ReadonlyArray<CityTranslation>,
  ): Promise<void> {
    validateCity(city);
    for (const t of translations) {
      validateCityTranslation(t);
      if (t.cityId !== city.id)
        throw new GeographyValidationError("cityId", "translation must reference the inserted city");
    }
    await this.db
      .prepare(
        "INSERT INTO cities (id, country_id, slug, latitude, longitude, timezone, population, elevation_m, " +
          "is_featured, status, search_weight, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        city.id,
        city.countryId,
        city.slug,
        city.latitude,
        city.longitude,
        city.timezone,
        city.population ?? null,
        city.elevationM ?? null,
        city.isFeatured ? 1 : 0,
        city.status,
        city.searchWeight,
        city.createdAt,
        city.updatedAt,
      )
      .run();
    for (const t of translations) {
      await this.db
        .prepare(
          "INSERT INTO city_translations (city_id, locale, name, aliases_json, summary, seo_title, seo_description) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          t.cityId,
          t.locale,
          t.name,
          JSON.stringify(t.aliases),
          t.summary ?? null,
          t.seoTitle ?? null,
          t.seoDescription ?? null,
        )
        .run();
    }
  }

  async getCountryBySlug(slug: string): Promise<CountryCanonical | null> {
    const row = await this.db
      .prepare("SELECT * FROM countries WHERE slug = ?")
      .bind(slug)
      .first();
    return row == null ? null : mapCountryRow(row as Record<string, unknown>);
  }

  async getCityBySlug(countryId: string, slug: string): Promise<CityCanonical | null> {
    const row = await this.db
      .prepare("SELECT * FROM cities WHERE country_id = ? AND slug = ?")
      .bind(countryId, slug)
      .first();
    return row == null ? null : mapCityRow(row as Record<string, unknown>);
  }

  async getCountryTranslation(countryId: string, locale: string): Promise<CountryTranslation | null> {
    const row = await this.db
      .prepare("SELECT * FROM country_translations WHERE country_id = ? AND locale = ?")
      .bind(countryId, locale)
      .first();
    return row == null ? null : mapCountryTranslation(row as Record<string, unknown>);
  }

  async getCityTranslation(cityId: string, locale: string): Promise<CityTranslation | null> {
    const row = await this.db
      .prepare("SELECT * FROM city_translations WHERE city_id = ? AND locale = ?")
      .bind(cityId, locale)
      .first();
    return row == null ? null : mapCityTranslation(row as Record<string, unknown>);
  }

  /** Resolve a localized city name back to its single canonical city (no locale duplicates). */
  async resolveCityByLocalizedName(locale: string, name: string): Promise<CityCanonical | null> {
    validateLocale(locale, "locale");
    const row = await this.db
      .prepare(
        "SELECT c.* FROM cities c JOIN city_translations t ON t.city_id = c.id " +
          "WHERE t.locale = ? AND lower(t.name) = lower(?) LIMIT 1",
      )
      .bind(locale, name)
      .first();
    return row == null ? null : mapCityRow(row as Record<string, unknown>);
  }

  /** Resolve a localized search alias back to its single canonical city (no locale duplicates). */
  async resolveCityByAlias(locale: string, alias: string): Promise<CityCanonical | null> {
    validateLocale(locale, "locale");
    const result = await this.db
      .prepare("SELECT city_id, aliases_json FROM city_translations WHERE locale = ?")
      .bind(locale)
      .all();
    for (const r of result.results as ReadonlyArray<Record<string, unknown>>) {
      const aliases = parseAliasesJson(asString(r.aliases_json, "aliases_json"));
      if (aliases.includes(alias)) {
        const city = await this.getCityById(asString(r.city_id, "city_id"));
        if (city != null) return city;
      }
    }
    return null;
  }

  private async getCityById(id: string): Promise<CityCanonical | null> {
    const row = await this.db.prepare("SELECT * FROM cities WHERE id = ?").bind(id).first();
    return row == null ? null : mapCityRow(row as Record<string, unknown>);
  }
}
