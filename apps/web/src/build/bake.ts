// apps/web/src/build/bake.ts
//
// Build-time data pipeline (system_design.md §1.4 / class diagram `BakePipeline`).
//
// Deterministically synthesizes weather with the MVP FAKE adapter
// (`FakeWeatherProvider`, network-free, no credentials) and computes the Travel
// Score with `@wnr/domain`, then bakes everything into a `BakedDataset` that is
// projected onto the display view models consumed by the App Router pages.
//
// This runs ONCE at `next build` time (memoized via `getBakedDataset`). The static
// export freezes the result into HTML, so the deployed site needs no runtime data
// path, no D1/KV, and no Workers — satisfying DEP-FREE-001.

import { FakeWeatherProvider } from "@wnr/weather";
import type { NormalizedDaily } from "@wnr/weather";
import { calculateTravelScore, describeWeatherCode } from "@wnr/domain";
import type { TravelScoreInput, WeatherRow } from "@wnr/domain";
import { computeStale } from "../api/v1/schemas";
import type { Locale, Window, Theme, LocalDate, ReasonCode } from "../api/v1/schemas";

import { geographySeed } from "./geography.seed";
import { TRAVEL_SCORE_MODEL_VERSION } from "./types";
import type {
  GeographySeed,
  BuildConfig,
  BakedDataset,
  BakedCity,
  CityScore,
  CitySeed,
  CountrySeed,
} from "./types";
import type {
  TravelRadarViewModel,
  DestinationCardViewModel,
  FreshnessViewModel,
  ScoreViewModel,
  WeatherSummaryViewModel,
  WindowControl,
  CountryPageViewModel,
  CountryHeaderViewModel,
  RankingSectionViewModel,
  CityPageViewModel,
  CityHeaderViewModel,
  ExplorerViewModel,
  ExploreMarkerViewModel,
  ExplorerMapMarker,
  DestinationLinkViewModel,
} from "../app/view-models";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Build the runtime config from `process.env` with safe defaults (DEP-CONFIG-001). */
export function buildConfig(): BuildConfig {
  const appEnv: "preview" | "production" =
    process.env.APP_ENV === "preview" ? "preview" : "production";
  const defaultLocale = (process.env.DEFAULT_LOCALE as Locale) ?? "en";
  const supported = (process.env.SUPPORTED_LOCALES ?? "en,ja,ko,zh-cn,zh-tw")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Locale => s.length > 0);
  const maxAge = Number(process.env.WEATHER_DATA_MAX_AGE_MINUTES ?? "60");
  return {
    appEnv,
    appBaseUrl: process.env.APP_BASE_URL ?? "https://where-not-rain.pages.dev",
    defaultLocale: defaultLocale,
    supportedLocales: supported.length > 0 ? supported : ["en"],
    weatherDataMaxAgeMinutes: Number.isFinite(maxAge) && maxAge > 0 ? maxAge : 60,
    forecastDays: 7,
    startDate: todayISO(),
    modelVersion: TRAVEL_SCORE_MODEL_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Weather -> score helpers
// ---------------------------------------------------------------------------

/** Map a normalized daily aggregate onto the Travel Score weather row. */
function buildWeatherRow(day: NormalizedDaily): WeatherRow {
  return {
    precipitationProbability: day.precipitationProbabilityMax,
    precipitationMm: day.precipitationMm,
    temperatureC: day.tempMaxC,
    apparentTemperatureC: day.apparentMaxC,
    humidity: day.humidityMean,
    windSpeedKph: day.windSpeedMaxKph,
    windGustKph: day.windGustMaxKph,
    uvIndex: day.uvIndexMax,
    cloudCover: day.cloudCoverMean,
    visibilityM: day.visibilityMeanM,
  };
}

/** Compute the Travel Score for one day (fetched == asOf => never stale). */
export function computeCityScore(day: NormalizedDaily, modelVersion: string): CityScore {
  const row: WeatherRow = buildWeatherRow(day);
  const input: TravelScoreInput = {
    row,
    modelVersion,
    fetchedAt: `${day.localDate}T00:00:00Z`,
    asOf: `${day.localDate}T00:00:00Z`,
  };
  return calculateTravelScore(input);
}

/** Human-readable condition label from a normalized WMO weather code. */
function weatherSummary(day: NormalizedDaily): WeatherSummaryViewModel {
  return {
    conditionLabel: describeWeatherCode(day.weatherCode).label,
    temperatureMin: day.tempMinC,
    temperatureMax: day.tempMaxC,
    rainProbability: day.precipitationProbabilityMax,
    observedAt: `${day.localDate}T12:00:00Z`,
  };
}

function scoreViewModel(score: CityScore): ScoreViewModel {
  return {
    value: score.score,
    state: score.hidden ? "limited_data" : "available",
    confidence: score.confidence,
    reasonCodes: score.reasonCodes as ReadonlyArray<ReasonCode>,
  };
}

function destinationLink(
  city: CitySeed,
  country: CountrySeed,
  locale: Locale,
): DestinationLinkViewModel {
  const cityName = city.name[locale] ?? city.name.en;
  const countryName = country.name[locale] ?? country.name.en;
  return {
    cityId: city.id,
    countrySlug: country.slug,
    citySlug: city.slug,
    cityName,
    countryName,
    path: `/${country.slug}/${city.slug}`,
  };
}

// ---------------------------------------------------------------------------
// Bake pipeline
// ---------------------------------------------------------------------------

/**
 * Aggregates `FakeWeatherProvider` (deterministic weather) and `@wnr/domain`
 * (Travel Score) over the geography seed into a single `BakedDataset`.
 */
export class BakePipeline {
  constructor(
    private readonly provider: FakeWeatherProvider,
    private readonly seed: GeographySeed,
    private readonly config: BuildConfig,
  ) {}

  async bake(): Promise<BakedDataset> {
    const bakedCities: BakedCity[] = [];
    for (const city of this.seed.cities) {
      const country = this.seed.countries.find((c) => c.id === city.countryId);
      if (country === undefined) continue;

      const forecast = await this.provider.fetchForecast({
        cityId: city.id,
        latitude: city.latitude,
        longitude: city.longitude,
        timezone: city.timezone,
        days: this.config.forecastDays,
        startDate: this.config.startDate,
      });
      const first = forecast[0];
      if (first === undefined) continue;
      const day0 = first.days[0];
      if (day0 === undefined) continue;
      const score = computeCityScore(day0, this.config.modelVersion);
      bakedCities.push({ city, country, forecast: first, score });
    }

    const citiesById = new Map<string, BakedCity>();
    const citiesByCountry = new Map<string, BakedCity[]>();
    for (const baked of bakedCities) {
      citiesById.set(baked.city.id, baked);
      const arr = citiesByCountry.get(baked.city.countryId);
      if (arr === undefined) {
        citiesByCountry.set(baked.city.countryId, [baked]);
      } else {
        arr.push(baked);
      }
    }

    return {
      cities: bakedCities,
      citiesById,
      citiesByCountry,
      countries: this.seed.countries,
      dataUpdatedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Memoized dataset accessor (runs the bake exactly once per build)
// ---------------------------------------------------------------------------

let cachePromise: Promise<BakedDataset> | null = null;

/** Returns the baked dataset, computing it once and caching the promise. */
export function getBakedDataset(): Promise<BakedDataset> {
  if (cachePromise !== null) return cachePromise;
  const config = buildConfig();
  const provider = new FakeWeatherProvider();
  const pipeline = new BakePipeline(provider, geographySeed, config);
  cachePromise = pipeline.bake();
  return cachePromise;
}

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

const WINDOW_DAYS: Record<Window, ReadonlyArray<number>> = {
  today: [0],
  tomorrow: [1],
  weekend: [5, 6],
  next_week: [2, 3, 4],
};

const WINDOW_LABELS: Record<Window, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  next_week: "Next week",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "YYYY-MM-DD" -> "Mon D" for window-control labels. */
function shortDate(localDate: LocalDate): string {
  const parts = localDate.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) return localDate;
  return `${MONTHS[m - 1] ?? ""} ${d}`;
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function freshness(dataset: BakedDataset, config: BuildConfig): FreshnessViewModel {
  const now = dataset.dataUpdatedAt;
  const stale = computeStale(dataset.dataUpdatedAt, now, config.weatherDataMaxAgeMinutes);
  return {
    dataUpdatedAt: dataset.dataUpdatedAt,
    stale,
    updatedLabel: `Updated ${formatUpdated(dataset.dataUpdatedAt)}`,
  };
}

// ---------------------------------------------------------------------------
// Projections -> view models
// ---------------------------------------------------------------------------

/** Build the homepage time-window selector (static hrefs; default window selected). */
export function buildWindowControls(
  dataset: BakedDataset,
  _config: BuildConfig,
  selected: Window,
): ReadonlyArray<WindowControl> {
  const firstCity = dataset.cities[0];
  return (Object.keys(WINDOW_DAYS) as Window[]).map((window) => {
    const exactDates = firstCity
      ? WINDOW_DAYS[window]
          .map((i) => firstCity.forecast.days[i]?.localDate ?? null)
          .filter((d): d is LocalDate => d !== null)
          .map(shortDate)
      : [];
    return {
      window,
      label: WINDOW_LABELS[window],
      href: `/?window=${window}`,
      selected: window === selected,
      exactDates,
    };
  });
}

/** Project the homepage "Travel Radar" view for a given window. */
export function projectHome(
  dataset: BakedDataset,
  config: BuildConfig,
  window: Window,
): TravelRadarViewModel {
  const dayIndices = WINDOW_DAYS[window];
  const primaryDayIndex = dayIndices[0] ?? 0;

  const cards: DestinationCardViewModel[] = [];
  for (const baked of dataset.cities) {
    if (!baked.city.isFeatured) continue;
    const day = baked.forecast.days[primaryDayIndex] ?? baked.forecast.days[0];
    if (day === undefined) continue;
    const score = computeCityScore(day, config.modelVersion);
    cards.push({
      destination: destinationLink(baked.city, baked.country, config.defaultLocale),
      score: scoreViewModel(score),
      weather: weatherSummary(day),
      reasonCodes: score.reasonCodes as ReadonlyArray<ReasonCode>,
    });
  }

  const includedDates: LocalDate[] = dataset.cities[0]
    ? dayIndices
        .map((i) => dataset.cities[0]?.forecast.days[i]?.localDate ?? null)
        .filter((d): d is LocalDate => d !== null)
    : [];

  return {
    window,
    includedDates,
    cards,
    freshness: freshness(dataset, config),
    state: "ready",
  };
}

/** Project a country destination page. Assumes the slug resolves to a country. */
export function projectCountry(
  dataset: BakedDataset,
  countrySlug: string,
  locale: Locale,
): CountryPageViewModel {
  const country = dataset.countries.find((c) => c.slug === countrySlug);
  const countryCities =
    country === undefined ? [] : (dataset.citiesByCountry.get(country.id) ?? []);

  const cityLinks = countryCities.map((b) => destinationLink(b.city, b.country, locale));

  const ranked = [...countryCities]
    .sort((a, b) => (b.score.score ?? -1) - (a.score.score ?? -1))
    .slice(0, 5)
    .map((b) => destinationLink(b.city, b.country, locale));

  const rankings: RankingSectionViewModel[] = [
    { theme: "general", title: "Top destinations", items: ranked },
  ];

  const relatedLinks = dataset.cities
    .filter((b) => country !== undefined && b.city.countryId !== country.id)
    .slice(0, 4)
    .map((b) => destinationLink(b.city, b.country, locale));

  const header: CountryHeaderViewModel = country
    ? {
        countryId: country.id,
        slug: country.slug,
        name: country.name[locale] ?? country.name.en,
        summary: null,
        defaultTimezone: country.defaultTimezone,
      }
    : {
        countryId: "",
        slug: countrySlug,
        name: countrySlug,
        summary: null,
        defaultTimezone: "UTC",
      };

  return {
    country: header,
    cities: cityLinks,
    rankings,
    relatedLinks,
    state: "ready",
  };
}

/** Project a city destination page. Assumes the slugs resolve to a city. */
export function projectCity(
  dataset: BakedDataset,
  countrySlug: string,
  citySlug: string,
  locale: Locale,
): CityPageViewModel {
  const country = dataset.countries.find((c) => c.slug === countrySlug);
  const baked = dataset.cities.find(
    (b) => b.city.slug === citySlug && country !== undefined && b.city.countryId === country.id,
  );

  const day0 = baked?.forecast.days[0];
  const header: CityHeaderViewModel = baked
    ? {
        cityId: baked.city.id,
        countrySlug,
        citySlug: baked.city.slug,
        cityName: baked.city.name[locale] ?? baked.city.name.en,
        countryName: country?.name[locale] ?? country?.name.en ?? "",
        timezone: baked.city.timezone,
        latitude: baked.city.latitude,
        longitude: baked.city.longitude,
      }
    : {
        cityId: citySlug,
        countrySlug,
        citySlug,
        cityName: citySlug,
        countryName: countrySlug,
        timezone: "UTC",
        latitude: 0,
        longitude: 0,
      };

  const relatedLinks =
    country === undefined
      ? []
      : (dataset.citiesByCountry.get(country.id) ?? [])
          .filter((b) => baked !== undefined && b.city.id !== baked.city.id)
          .map((b) => destinationLink(b.city, b.country, locale));

  return {
    city: header,
    weather: day0 === undefined ? null : weatherSummary(day0),
    weatherState: day0 === undefined ? "empty" : "ready",
    score: baked === undefined ? scoreViewModelFallback() : scoreViewModel(baked.score),
    forecastState: "ready",
    localDates: baked ? baked.forecast.days.map((d) => d.localDate) : [],
    forecastDays: baked
      ? baked.forecast.days.map((day) => ({
          localDate: day.localDate,
          weather: weatherSummary(day),
          score: scoreViewModel(computeCityScore(day, TRAVEL_SCORE_MODEL_VERSION)),
        }))
      : [],
    unit: "metric",
    relatedLinks,
    commercial: [],
  };
}

function scoreViewModelFallback(): ScoreViewModel {
  return { value: null, state: "unavailable", confidence: null, reasonCodes: [] };
}

/**
 * Project the homepage "progressive map" markers (PRD-FR-001, PRD-FR-002):
 * one `ExplorerMapMarker` per featured city, sharing the exact lat/long/score
 * that the ranked cards and the explorer list use. The homepage progressive map
 * is the same compact read model as the explorer map.
 */
export function projectHomeMapMarkers(
  dataset: BakedDataset,
  config: BuildConfig,
  window: Window = "today",
): ReadonlyArray<ExplorerMapMarker> {
  const primaryDayIndex = WINDOW_DAYS[window][0] ?? 0;
  return dataset.cities
    .filter((b) => b.city.isFeatured)
    .map((b) => {
      const day = b.forecast.days[primaryDayIndex] ?? b.forecast.days[0];
      const score = day === undefined ? null : computeCityScore(day, config.modelVersion);
      return {
        id: b.city.id,
        latitude: b.city.latitude,
        longitude: b.city.longitude,
        label: b.city.name[config.defaultLocale] ?? b.city.name.en,
        path: `/${b.country.slug}/${b.city.slug}`,
        score: score === null || score.hidden ? null : score.score,
        theme: "general",
      } satisfies ExplorerMapMarker;
    });
}

/** Project the Weather Explorer view (decorative map + crawlable list). */
export function projectExplorer(
  dataset: BakedDataset,
  locale: Locale,
  window: Window,
  theme: Theme,
): ExplorerViewModel {
  const markers: ExploreMarkerViewModel[] = dataset.cities
    .filter((b) => b.city.isFeatured)
    .map((b) => ({
      cityId: b.city.id,
      name: b.city.name[locale] ?? b.city.name.en,
      score: b.score.hidden ? null : scoreViewModel(b.score),
      latitude: b.city.latitude,
      longitude: b.city.longitude,
      primaryReasonCode: (b.score.reasonCodes[0] as ReasonCode | undefined) ?? null,
      path: `/${b.country.slug}/${b.city.slug}`,
    }));

  const list = dataset.cities.map((b) => destinationLink(b.city, b.country, locale));

  return {
    theme,
    window,
    activeFilterMeaning: "All destinations",
    markers,
    list,
    state: "ready",
  };
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

/** Current date as YYYY-MM-DD (UTC), used as the 7-day forecast start. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
