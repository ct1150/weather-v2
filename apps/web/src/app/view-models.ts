// apps/web/src/app/view-models.ts
//
// Display-ready view models for the read pages. These carry domain meaning and
// localized presentation intent but NO persistence rows, provider DTOs, HTTP
// metadata, or raw natural-language prose (design.md "Travel Radar homepage",
// "Weather Explorer", "Country and city decision pages"). Presenters project
// them onto i18n/SEO adapters.

import type { LocalDate, ReasonCode, ScoreState, Window } from "../api/v1/schemas";

export type { LocalDate, ReasonCode, ScoreState, Window };

/** Complete async-state contract for a surface (UX-STATE-001). */
export type AsyncStateKind = "ready" | "loading" | "empty" | "error" | "stale";

export interface FreshnessViewModel {
  readonly dataUpdatedAt: string;
  readonly stale: boolean;
  /** Localized "Updated … ago" label, already computed by the presenter. */
  readonly updatedLabel: string;
}

export interface DestinationLinkViewModel {
  readonly cityId: string;
  readonly countrySlug: string;
  readonly citySlug: string;
  readonly cityName: string;
  readonly countryName: string;
  /** Canonical href, e.g. `/jp/tokyo`. */
  readonly path: string;
}

export interface ScoreViewModel {
  readonly value: number | null;
  readonly state: ScoreState;
  readonly confidence: number | null;
  readonly reasonCodes: ReadonlyArray<ReasonCode>;
}

export interface WeatherSummaryViewModel {
  /** Data-derived, localized condition label (never a generated claim). */
  readonly conditionLabel: string;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
  /** 0..100; null when unavailable. */
  readonly rainProbability: number | null;
  /** Expected precipitation total for the city-local day, in millimetres. */
  readonly precipitationMm?: number | null;
  /** Maximum sustained wind during the local day, in km/h. */
  readonly windSpeedMax?: number | null;
  readonly observedAt: string;
}

export interface DestinationCardViewModel {
  readonly destination: DestinationLinkViewModel;
  readonly score: ScoreViewModel;
  readonly weather: WeatherSummaryViewModel;
  readonly reasonCodes: ReadonlyArray<ReasonCode>;
}

export interface TravelRadarViewModel {
  readonly window: Window;
  readonly includedDates: ReadonlyArray<LocalDate>;
  readonly cards: ReadonlyArray<DestinationCardViewModel>;
  readonly freshness: FreshnessViewModel;
  readonly state: AsyncStateKind;
}

export interface WindowControl {
  readonly window: Window;
  /** Visible label, e.g. "This Weekend". */
  readonly label: string;
  /** Canonical href carrying the shareable window state. */
  readonly href: string;
  readonly selected: boolean;
  /** Exact city-local dates for ambiguous labels (weekend/next_week). */
  readonly exactDates: ReadonlyArray<string>;
}

// --- Weather Explorer (T12) -------------------------------------------------

export interface ExploreMarkerViewModel {
  readonly cityId: string;
  readonly name: string;
  readonly score: ScoreViewModel | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly primaryReasonCode: ReasonCode | null;
  readonly path: string;
}

/**
 * Compact read model shared by the interactive MapLibre map and the accessible
 * ranked list (PRD-FR-002). One model feeds both the map markers and the
 * crawlable list fallback so they never diverge.
 */
export interface ExplorerMapMarker {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string;
  /** Canonical destination href the marker navigates to on activation. */
  readonly path: string;
  /** Travel Score 0..100, or null when hidden/unavailable. */
  readonly score: number | null;
  /** Active theme meaning (e.g. "general", "beach"). */
  readonly theme: string;
}

export interface ExplorerViewModel {
  readonly theme: string;
  readonly window: Window;
  /** Human-readable meaning of the active filter (e.g. "Beach"). */
  readonly activeFilterMeaning: string;
  readonly markers: ReadonlyArray<ExploreMarkerViewModel>;
  /** Equivalent ranked-list fallback destinations. */
  readonly list: ReadonlyArray<DestinationLinkViewModel>;
  readonly state: AsyncStateKind;
}

// --- Country / City decision pages (T13) -----------------------------------

export interface CountryHeaderViewModel {
  readonly countryId: string;
  readonly slug: string;
  readonly name: string;
  readonly summary: string | null;
  readonly defaultTimezone: string;
}

export interface RankingSectionViewModel {
  readonly theme: string;
  readonly title: string;
  readonly items: ReadonlyArray<DestinationLinkViewModel>;
}

export interface CountryPageViewModel {
  readonly country: CountryHeaderViewModel;
  readonly cities: ReadonlyArray<DestinationLinkViewModel>;
  readonly rankings: ReadonlyArray<RankingSectionViewModel>;
  readonly relatedLinks: ReadonlyArray<DestinationLinkViewModel>;
  readonly availableCountries?: ReadonlyArray<CountryOptionViewModel>;
  readonly weatherCities?: ReadonlyArray<CountryWeatherCityViewModel>;
  readonly dataUpdatedLabel?: string;
  readonly state: AsyncStateKind;
}

export interface CountryOptionViewModel {
  readonly slug: string;
  readonly name: string;
  readonly path: string;
}

export interface CountryWeatherDayViewModel {
  readonly localDate: LocalDate;
  readonly weather: WeatherSummaryViewModel;
  readonly score: ScoreViewModel;
}

export interface CountryWeatherCityViewModel {
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly path: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly days: ReadonlyArray<CountryWeatherDayViewModel>;
}

export interface CityHeaderViewModel {
  readonly cityId: string;
  readonly countrySlug: string;
  readonly citySlug: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly timezone: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface CityForecastDayViewModel {
  readonly localDate: LocalDate;
  readonly weather: WeatherSummaryViewModel;
  readonly score: ScoreViewModel;
}

export interface CityPageViewModel {
  readonly city: CityHeaderViewModel;
  readonly weather: WeatherSummaryViewModel | null;
  readonly weatherState: AsyncStateKind;
  readonly score: ScoreViewModel;
  readonly forecastState: AsyncStateKind;
  readonly localDates: ReadonlyArray<LocalDate>;
  /** Detailed, city-local daily outlook when the baked provider exposes it. */
  readonly forecastDays?: ReadonlyArray<CityForecastDayViewModel>;
  readonly unit: "metric" | "imperial";
  readonly relatedLinks: ReadonlyArray<DestinationLinkViewModel>;
  readonly commercial: ReadonlyArray<string>;
}
