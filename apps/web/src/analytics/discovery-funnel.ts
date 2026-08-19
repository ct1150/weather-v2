import type { DiscoveryFunnelContext } from "@wnr/analytics";
import type { DiscoveryPreferences } from "../discovery/weather-discovery";
import type { ReachabilityPreferences } from "../discovery/reachability";

const DAY_MS = 86_400_000;

function utcDay(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

export function daysUntilDepartureBucket(
  from: string,
  now: Date,
): DiscoveryFunnelContext["days_until_departure_bucket"] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const difference = Math.max(0, Math.floor((utcDay(from) - today) / DAY_MS));
  if (difference <= 2) return "0-2d";
  if (difference <= 7) return "3-7d";
  if (difference <= 14) return "8-14d";
  return "15d+";
}

export function discoveryTripLengthDays(from: string, to: string): number {
  const difference = Math.floor((utcDay(to) - utcDay(from)) / DAY_MS) + 1;
  return Math.min(16, Math.max(1, difference));
}

export function buildDiscoveryFunnelContext(input: {
  readonly preferences: DiscoveryPreferences;
  readonly reachability: ReachabilityPreferences;
  readonly now?: Date;
}): DiscoveryFunnelContext {
  const { preferences, reachability } = input;
  return {
    origin_id: reachability.originId,
    transport_mode: reachability.mode,
    max_travel_minutes:
      reachability.maxTravelMinutes as DiscoveryFunnelContext["max_travel_minutes"],
    days_until_departure_bucket: daysUntilDepartureBucket(
      preferences.from,
      input.now ?? new Date(),
    ),
    trip_length_days: discoveryTripLengthDays(preferences.from, preferences.to),
    rain_limit_set: preferences.rainProbabilityMax !== null,
    wind_limit_set: preferences.windSpeedMaxKph !== null,
    temperature_limit_set:
      preferences.temperatureMinC !== null || preferences.temperatureMaxC !== null,
  };
}
