import {
  normalizeActivityItems,
  type LegacyActivityContext,
  type TripActivity,
} from "./activity-intelligence";
import { findWeatherFallbacks, poiName, type CuratedPoi, type PoiLocale } from "./poi-catalog";
import type { TripForecastDay, TripWorkspaceDay } from "./workspace";

export type ConcretePlanBReason = "rain" | "wind" | "heat" | "cold" | "uv";

export interface ConcretePlanBCandidate {
  readonly poi: CuratedPoi;
  readonly label: string;
}

export interface ConcretePlanB {
  readonly affectedActivity: TripActivity;
  readonly reason: ConcretePlanBReason;
  readonly fixed: boolean;
  readonly candidates: ReadonlyArray<ConcretePlanBCandidate>;
}

function activityItems(day: TripWorkspaceDay): ReadonlyArray<TripActivity> {
  const context: LegacyActivityContext = {
    dayId: day.id,
    cityId: day.cityId,
    dayTheme: day.theme,
    dayFlexible: day.flexible,
    dayNotes: day.notes,
  };
  return normalizeActivityItems(day.activityItems, day.activities, context);
}

function riskReason(activity: TripActivity, forecast: TripForecastDay): ConcretePlanBReason | null {
  if (activity.weatherSensitivity.includes("rain") && (forecast.rainProbability ?? 0) >= 60)
    return "rain";
  if (
    activity.weatherSensitivity.includes("wind") &&
    ((forecast.windSpeedKph ?? 0) >= 30 || (forecast.windGustKph ?? 0) >= 45)
  )
    return "wind";
  if (activity.weatherSensitivity.includes("heat") && (forecast.temperatureMaxC ?? -99) >= 34)
    return "heat";
  if (activity.weatherSensitivity.includes("cold") && (forecast.temperatureMinC ?? 99) <= 8)
    return "cold";
  if (activity.weatherSensitivity.includes("uv") && (forecast.uvIndex ?? 0) >= 9) return "uv";
  return null;
}

export function resolveConcretePlanB(
  day: TripWorkspaceDay,
  forecast: TripForecastDay | null,
  locale: PoiLocale,
): ConcretePlanB | null {
  if (forecast === null || day.cityId.length === 0) return null;
  for (const activity of activityItems(day)) {
    if (activity.environment === "indoor") continue;
    const reason = riskReason(activity, forecast);
    if (reason === null) continue;
    const candidates = findWeatherFallbacks(day.cityId, activity.poiId, 3).map((poi) => ({
      poi,
      label: poiName(poi, locale),
    }));
    return {
      affectedActivity: activity,
      reason,
      fixed: activity.flexibility === "fixed" || activity.reservation === "required",
      candidates,
    };
  }
  return null;
}
