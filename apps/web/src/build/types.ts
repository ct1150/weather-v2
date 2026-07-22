// apps/web/src/build/types.ts
//
// Build-time data model for the static-export bake (system_design.md §1.4 / class
// diagram). These types are internal to the bake layer; the projection step turns
// the BakedDataset into the display view models in `../view-models`.

import type { Locale } from "../api/v1/schemas";
import type {
  NormalizedForecast,
  NormalizedDaily,
  ForecastRequest,
} from "@wnr/weather";
import type { TravelScoreResult, WeatherRow } from "@wnr/domain";

export type { Locale, NormalizedForecast, NormalizedDaily, ForecastRequest, WeatherRow };

/** Stable model version frozen into every baked score (reproducibility). */
export const TRAVEL_SCORE_MODEL_VERSION = "travel-score@1";

/** A country in the static geography seed. */
export interface CountrySeed {
  readonly id: string;
  readonly iso2: string;
  readonly slug: string;
  readonly defaultTimezone: string;
  readonly name: Record<Locale, string>;
}

/** A city in the static geography seed. */
export interface CitySeed {
  readonly id: string;
  readonly countryId: string;
  readonly slug: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly isFeatured: boolean;
  readonly name: Record<Locale, string>;
}

/** The complete static geography seed (no D1 this phase). */
export interface GeographySeed {
  readonly countries: ReadonlyArray<CountrySeed>;
  readonly cities: ReadonlyArray<CitySeed>;
}

/** Build-time configuration (DEP-CONFIG-001 subset). */
export interface BuildConfig {
  readonly appEnv: "preview" | "production";
  readonly appBaseUrl: string;
  readonly defaultLocale: Locale;
  readonly supportedLocales: ReadonlyArray<Locale>;
  readonly weatherDataMaxAgeMinutes: number;
  readonly forecastDays: number;
  readonly startDate: string;
  readonly modelVersion: string;
}

/** A city's baked weather + score (one entry in the BakedDataset). */
export type CityScore = TravelScoreResult;

/** One baked city: its seed, resolved country, forecast, and score. */
export interface BakedCity {
  readonly city: CitySeed;
  readonly country: CountrySeed;
  readonly forecast: NormalizedForecast;
  readonly score: CityScore;
}

/** The fully baked, build-time dataset (deterministic, network-free). */
export interface BakedDataset {
  readonly cities: ReadonlyArray<BakedCity>;
  readonly citiesById: ReadonlyMap<string, BakedCity>;
  readonly citiesByCountry: ReadonlyMap<string, ReadonlyArray<BakedCity>>;
  readonly countries: ReadonlyArray<CountrySeed>;
  readonly dataUpdatedAt: string;
}
