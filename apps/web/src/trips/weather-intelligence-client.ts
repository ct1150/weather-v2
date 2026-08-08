import { TRIP_API_BASE } from "./auth-client";

export type WeatherInsightSeverity = "watch" | "action";
export type WeatherRecommendationKind = "adjust_timing" | "activate_plan_b";
export type WeatherInsightReasonCode =
  | "RAIN_PROBABILITY_JUMP"
  | "HEAVY_RAIN_THRESHOLD"
  | "PRECIPITATION_VOLUME_JUMP"
  | "WIND_THRESHOLD"
  | "GUST_THRESHOLD"
  | "HEAT_THRESHOLD"
  | "COLD_THRESHOLD"
  | "UV_THRESHOLD";

export interface TripWeatherObservation {
  readonly snapshotId: string;
  readonly cityId: string;
  readonly date: string;
  readonly observedAt: string;
  readonly rainProbability: number | null;
  readonly precipitationMm: number | null;
  readonly temperatureMinC: number | null;
  readonly temperatureMaxC: number | null;
  readonly windSpeedKph: number | null;
  readonly windGustKph: number | null;
  readonly uvIndex: number | null;
}

export interface CloudWeatherInsight {
  readonly id: string;
  readonly dayId: string;
  readonly dayNumber: number;
  readonly cityId: string;
  readonly cityName: string;
  readonly date: string;
  readonly previousSnapshotId: string;
  readonly snapshotId: string;
  readonly severity: WeatherInsightSeverity;
  readonly recommendation: WeatherRecommendationKind;
  readonly impactScore: number;
  readonly reasonCodes: ReadonlyArray<WeatherInsightReasonCode>;
  readonly previous: TripWeatherObservation;
  readonly current: TripWeatherObservation;
  readonly status: "open" | "converted";
  readonly decisionId: string | null;
  readonly createdAt: string;
  readonly convertedAt: string | null;
}

export interface CloudWeatherRefreshReport {
  readonly tripId: string;
  readonly snapshotId: string | null;
  readonly baselinesCreated: number;
  readonly observationsCreated: number;
  readonly insightsCreated: number;
  readonly actionableInsightsCreated: number;
}

interface ApiEnvelope<T> {
  readonly data?: T;
  readonly error?: { readonly code?: string };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${TRIP_API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.code ?? `HTTP_${response.status}`);
  }
  return payload.data;
}

export async function listCloudWeatherInsights(
  tripId: string,
): Promise<ReadonlyArray<CloudWeatherInsight>> {
  const result = await api<{ readonly items: ReadonlyArray<CloudWeatherInsight> }>(
    `/api/v1/trips/${encodeURIComponent(tripId)}/weather-insights?limit=50`,
  );
  return result.items;
}

export async function refreshCloudTripWeather(tripId: string): Promise<CloudWeatherRefreshReport> {
  return api<CloudWeatherRefreshReport>(
    `/api/v1/trips/${encodeURIComponent(tripId)}/weather-refresh`,
    { method: "POST" },
  );
}

export async function convertCloudWeatherInsightToDecision(
  tripId: string,
  insightId: string,
): Promise<{ readonly decisionId: string; readonly existing: boolean }> {
  return api<{ readonly decisionId: string; readonly existing: boolean }>(
    `/api/v1/trips/${encodeURIComponent(tripId)}/weather-insights/${encodeURIComponent(insightId)}/decision`,
    { method: "POST" },
  );
}
