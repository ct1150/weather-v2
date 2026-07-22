// @wnr/domain — WMO weather-code -> display label / icon semantics.
//
// Open-Meteo returns the WMO weather interpretation code (`weather_code`). This module
// is the single canonical mapping from that numeric code to a human label and a semantic
// icon name. It previously lived as a 0..3 `switch` inside apps/web/src/build/bake.ts;
// it now lives here (docs/15 §8 #1) so the web build, the API layer, and any future
// read path share ONE mapping that is forward-compatible with the full real WMO set.
//
// Unknown / out-of-range codes (and `null`) degrade gracefully to "Clear" (docs/15 §5).

/** A display description for a WMO weather code. */
export interface WeatherCodeEntry {
  readonly label: string;
  /** Semantic icon name (consumed by the UI icon set). */
  readonly icon: string;
}

/**
 * Canonical Open-Meteo WMO weather-code table.
 * Source: Open-Meteo WMO interpretation codes (0, 1, 2, 3, 45, 48, 51–57, 61–67,
 * 71–77, 80–86, 95, 96, 99).
 */
export const OPEN_METEO_WMO: Readonly<Record<number, WeatherCodeEntry>> = {
  0: { label: "Clear", icon: "sunny" },
  1: { label: "Mainly clear", icon: "sunny" },
  2: { label: "Partly cloudy", icon: "partly-cloudy" },
  3: { label: "Overcast", icon: "cloudy" },
  45: { label: "Fog", icon: "fog" },
  48: { label: "Rime fog", icon: "fog" },
  51: { label: "Light drizzle", icon: "drizzle" },
  53: { label: "Drizzle", icon: "drizzle" },
  55: { label: "Dense drizzle", icon: "drizzle" },
  56: { label: "Light freezing drizzle", icon: "drizzle" },
  57: { label: "Dense freezing drizzle", icon: "drizzle" },
  61: { label: "Light rain", icon: "rain" },
  63: { label: "Rain", icon: "rain" },
  65: { label: "Heavy rain", icon: "rain" },
  66: { label: "Light freezing rain", icon: "rain" },
  67: { label: "Heavy freezing rain", icon: "rain" },
  71: { label: "Light snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  77: { label: "Snow grains", icon: "snow" },
  80: { label: "Rain showers", icon: "showers" },
  81: { label: "Moderate rain showers", icon: "showers" },
  82: { label: "Violent rain showers", icon: "showers" },
  85: { label: "Light snow showers", icon: "snow-showers" },
  86: { label: "Heavy snow showers", icon: "snow-showers" },
  95: { label: "Thunderstorm", icon: "thunderstorm" },
  96: { label: "Thunderstorm with hail", icon: "thunderstorm" },
  99: { label: "Thunderstorm with hail", icon: "thunderstorm" },
};

/** Fallback used for `null` / unknown codes (docs/15 §5: degrade to Clear). */
export const FALLBACK_WEATHER_CODE: WeatherCodeEntry = { label: "Clear", icon: "sunny" };

/**
 * Resolve a WMO weather code to its display entry. `null` / `undefined` / an unknown
 * code all return the "Clear" fallback so callers never have to special-case missing data.
 */
export function describeWeatherCode(code: number | null | undefined): WeatherCodeEntry {
  if (code == null) return FALLBACK_WEATHER_CODE;
  return OPEN_METEO_WMO[code] ?? FALLBACK_WEATHER_CODE;
}
