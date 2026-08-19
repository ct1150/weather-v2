import type { TripCityOption } from "../trips/workspace";
import type { DiscoveryCityResult } from "./weather-discovery";

export type ReachabilityLocale = "en" | "zh-cn" | "zh-hant";
export type ReachabilityMode = "flight" | "rail" | "drive";
export type ReachabilityModeFilter = "any" | ReachabilityMode;
export type ReachabilityOriginId = "sg-singapore" | "hk-hong-kong" | "tw-taipei";

export interface ReachabilityOrigin {
  readonly id: ReachabilityOriginId;
  readonly names: Readonly<Record<ReachabilityLocale, string>>;
}

export interface ReachabilityPreferences {
  readonly originId: ReachabilityOriginId;
  readonly mode: ReachabilityModeFilter;
  readonly maxTravelMinutes: number;
}

export interface ReachabilityEdge {
  readonly originId: ReachabilityOriginId;
  readonly destinationId: string;
  readonly mode: ReachabilityMode;
  readonly typicalMinutes: number;
  readonly verifiedAt: string;
}

export interface ReachableDestination {
  readonly city: TripCityOption;
  readonly edge: ReachabilityEdge;
}

export const MAX_TRAVEL_MINUTE_OPTIONS: ReadonlyArray<number> = Object.freeze([
  180, 240, 360, 480, 720,
]);

export const DEFAULT_REACHABILITY_PREFERENCES: ReachabilityPreferences = Object.freeze({
  originId: "sg-singapore",
  mode: "any",
  maxTravelMinutes: 360,
});

const VERIFIED_AT = "2026-08-19";

const ORIGINS: ReadonlyArray<ReachabilityOrigin> = Object.freeze([
  {
    id: "sg-singapore",
    names: { en: "Singapore", "zh-cn": "新加坡", "zh-hant": "新加坡" },
  },
  {
    id: "hk-hong-kong",
    names: { en: "Hong Kong", "zh-cn": "香港", "zh-hant": "香港" },
  },
  {
    id: "tw-taipei",
    names: { en: "Taipei", "zh-cn": "台北", "zh-hant": "台北" },
  },
]);

function edge(
  originId: ReachabilityOriginId,
  destinationId: string,
  mode: ReachabilityMode,
  typicalMinutes: number,
): ReachabilityEdge {
  return { originId, destinationId, mode, typicalMinutes, verifiedAt: VERIFIED_AT };
}

// Static planning estimates are coarse and conservative. Flight values include a basic airport
// allowance; drive values include a simple border / rest allowance. They are not
// schedules, fares, inventory or guarantees and must be confirmed before booking.
export const REACHABILITY_EDGES: ReadonlyArray<ReachabilityEdge> = Object.freeze([
  edge("sg-singapore", "th-bangkok", "flight", 270),
  edge("sg-singapore", "th-phuket", "flight", 250),
  edge("sg-singapore", "th-chiang-mai", "flight", 310),
  edge("sg-singapore", "th-pattaya", "flight", 330),
  edge("sg-singapore", "th-krabi", "flight", 250),
  edge("sg-singapore", "vn-hanoi", "flight", 320),
  edge("sg-singapore", "vn-ho-chi-minh", "flight", 250),
  edge("sg-singapore", "vn-da-nang", "flight", 285),
  edge("sg-singapore", "vn-hoi-an", "flight", 320),
  edge("sg-singapore", "my-kuala-lumpur", "flight", 190),
  edge("sg-singapore", "my-kuala-lumpur", "drive", 270),
  edge("sg-singapore", "my-penang", "flight", 210),
  edge("sg-singapore", "my-penang", "drive", 480),
  edge("sg-singapore", "my-langkawi", "flight", 220),
  edge("sg-singapore", "my-malacca", "drive", 240),
  edge("sg-singapore", "id-bali", "flight", 300),
  edge("sg-singapore", "id-jakarta", "flight", 240),
  edge("sg-singapore", "id-yogyakarta", "flight", 280),
  edge("sg-singapore", "ph-manila", "flight", 360),
  edge("sg-singapore", "ph-cebu", "flight", 350),
  edge("sg-singapore", "ph-boracay", "flight", 390),
  edge("sg-singapore", "kh-siem-reap", "flight", 250),
  edge("sg-singapore", "kh-phnom-penh", "flight", 260),
  edge("sg-singapore", "jp-tokyo", "flight", 625),
  edge("sg-singapore", "jp-osaka", "flight", 590),
  edge("sg-singapore", "jp-fukuoka", "flight", 520),
  edge("sg-singapore", "kr-seoul", "flight", 590),
  edge("sg-singapore", "kr-busan", "flight", 560),

  edge("hk-hong-kong", "jp-tokyo", "flight", 360),
  edge("hk-hong-kong", "jp-osaka", "flight", 330),
  edge("hk-hong-kong", "jp-kyoto", "flight", 360),
  edge("hk-hong-kong", "jp-sapporo", "flight", 430),
  edge("hk-hong-kong", "jp-fukuoka", "flight", 300),
  edge("hk-hong-kong", "jp-naha", "flight", 270),
  edge("hk-hong-kong", "kr-seoul", "flight", 310),
  edge("hk-hong-kong", "kr-busan", "flight", 300),
  edge("hk-hong-kong", "kr-jeju", "flight", 310),
  edge("hk-hong-kong", "kr-incheon", "flight", 310),
  edge("hk-hong-kong", "th-bangkok", "flight", 330),
  edge("hk-hong-kong", "th-phuket", "flight", 360),
  edge("hk-hong-kong", "th-chiang-mai", "flight", 320),
  edge("hk-hong-kong", "th-krabi", "flight", 390),
  edge("hk-hong-kong", "vn-hanoi", "flight", 270),
  edge("hk-hong-kong", "vn-ho-chi-minh", "flight", 320),
  edge("hk-hong-kong", "vn-da-nang", "flight", 290),
  edge("hk-hong-kong", "vn-hoi-an", "flight", 320),
  edge("hk-hong-kong", "sg-singapore", "flight", 360),
  edge("hk-hong-kong", "my-kuala-lumpur", "flight", 350),
  edge("hk-hong-kong", "my-penang", "flight", 390),
  edge("hk-hong-kong", "my-langkawi", "flight", 420),
  edge("hk-hong-kong", "id-bali", "flight", 450),
  edge("hk-hong-kong", "id-jakarta", "flight", 360),
  edge("hk-hong-kong", "ph-manila", "flight", 280),
  edge("hk-hong-kong", "ph-cebu", "flight", 330),
  edge("hk-hong-kong", "ph-boracay", "flight", 360),
  edge("hk-hong-kong", "kh-siem-reap", "flight", 320),
  edge("hk-hong-kong", "kh-phnom-penh", "flight", 300),

  edge("tw-taipei", "jp-tokyo", "flight", 320),
  edge("tw-taipei", "jp-osaka", "flight", 290),
  edge("tw-taipei", "jp-kyoto", "flight", 320),
  edge("tw-taipei", "jp-sapporo", "flight", 430),
  edge("tw-taipei", "jp-fukuoka", "flight", 250),
  edge("tw-taipei", "jp-naha", "flight", 210),
  edge("tw-taipei", "kr-seoul", "flight", 280),
  edge("tw-taipei", "kr-busan", "flight", 250),
  edge("tw-taipei", "kr-jeju", "flight", 270),
  edge("tw-taipei", "kr-incheon", "flight", 280),
  edge("tw-taipei", "th-bangkok", "flight", 350),
  edge("tw-taipei", "th-phuket", "flight", 390),
  edge("tw-taipei", "th-chiang-mai", "flight", 360),
  edge("tw-taipei", "th-krabi", "flight", 420),
  edge("tw-taipei", "vn-hanoi", "flight", 300),
  edge("tw-taipei", "vn-ho-chi-minh", "flight", 340),
  edge("tw-taipei", "vn-da-nang", "flight", 300),
  edge("tw-taipei", "vn-hoi-an", "flight", 330),
  edge("tw-taipei", "sg-singapore", "flight", 400),
  edge("tw-taipei", "my-kuala-lumpur", "flight", 390),
  edge("tw-taipei", "my-penang", "flight", 420),
  edge("tw-taipei", "my-langkawi", "flight", 450),
  edge("tw-taipei", "id-bali", "flight", 460),
  edge("tw-taipei", "id-jakarta", "flight", 390),
  edge("tw-taipei", "ph-manila", "flight", 260),
  edge("tw-taipei", "ph-cebu", "flight", 300),
  edge("tw-taipei", "ph-boracay", "flight", 330),
  edge("tw-taipei", "kh-siem-reap", "flight", 340),
  edge("tw-taipei", "kh-phnom-penh", "flight", 330),
]);

const MODE_ORDER: Readonly<Record<ReachabilityMode, number>> = Object.freeze({
  drive: 0,
  rail: 1,
  flight: 2,
});

export function listReachabilityOrigins(): ReadonlyArray<ReachabilityOrigin> {
  return ORIGINS;
}

export function reachabilityOriginLabel(
  originId: ReachabilityOriginId,
  locale: ReachabilityLocale,
): string {
  return ORIGINS.find((origin) => origin.id === originId)?.names[locale] ?? originId;
}

export function reachabilityModeLabel(
  mode: ReachabilityModeFilter,
  locale: ReachabilityLocale,
): string {
  const labels: Readonly<
    Record<ReachabilityLocale, Readonly<Record<ReachabilityModeFilter, string>>>
  > = {
    en: { any: "Any supported mode", flight: "Flight", rail: "Rail", drive: "Drive" },
    "zh-cn": { any: "任一支持方式", flight: "飞机", rail: "高铁 / 铁路", drive: "自驾" },
    "zh-hant": { any: "任一支援方式", flight: "飛機", rail: "高鐵 / 鐵路", drive: "自駕" },
  };
  return labels[locale][mode];
}

export function formatTravelMinutes(minutes: number, locale: ReachabilityLocale): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (locale === "en") return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
  if (locale === "zh-cn")
    return remainder === 0 ? `${hours} 小时` : `${hours} 小时 ${remainder} 分`;
  return remainder === 0 ? `${hours} 小時` : `${hours} 小時 ${remainder} 分`;
}

export function listReachabilityModes(
  originId: ReachabilityOriginId,
): ReadonlyArray<ReachabilityMode> {
  return [
    ...new Set(
      REACHABILITY_EDGES.filter((item) => item.originId === originId).map((item) => item.mode),
    ),
  ].sort((left, right) => MODE_ORDER[left] - MODE_ORDER[right]);
}

export function normalizeReachabilityMode(
  originId: ReachabilityOriginId,
  mode: ReachabilityModeFilter,
): ReachabilityModeFilter {
  return mode === "any" || listReachabilityModes(originId).includes(mode) ? mode : "any";
}

function isOrigin(value: string | null): value is ReachabilityOriginId {
  return ORIGINS.some((origin) => origin.id === value);
}

function isMode(value: string | null): value is ReachabilityModeFilter {
  return value === "any" || value === "flight" || value === "rail" || value === "drive";
}

export function parseReachabilityPreferences(search: URLSearchParams): ReachabilityPreferences {
  const rawOrigin = search.get("origin");
  const originId: ReachabilityOriginId = isOrigin(rawOrigin)
    ? rawOrigin
    : DEFAULT_REACHABILITY_PREFERENCES.originId;
  const rawMode = search.get("mode");
  const requestedMode: ReachabilityModeFilter = isMode(rawMode)
    ? rawMode
    : DEFAULT_REACHABILITY_PREFERENCES.mode;
  const rawMinutes = Number(search.get("maxTravel"));
  const maxTravelMinutes = MAX_TRAVEL_MINUTE_OPTIONS.includes(rawMinutes)
    ? rawMinutes
    : DEFAULT_REACHABILITY_PREFERENCES.maxTravelMinutes;
  return {
    originId,
    mode: normalizeReachabilityMode(originId, requestedMode),
    maxTravelMinutes,
  };
}

export function serializeReachabilityPreferences(
  preferences: ReachabilityPreferences,
): URLSearchParams {
  return new URLSearchParams({
    origin: preferences.originId,
    mode: normalizeReachabilityMode(preferences.originId, preferences.mode),
    maxTravel: String(preferences.maxTravelMinutes),
  });
}

export function reachabilityPreferenceKey(preferences: ReachabilityPreferences): string {
  return `${preferences.originId}|${normalizeReachabilityMode(preferences.originId, preferences.mode)}|${preferences.maxTravelMinutes}`;
}

export function listReachableDestinations(
  cities: ReadonlyArray<TripCityOption>,
  preferences: ReachabilityPreferences,
): ReadonlyArray<ReachableDestination> {
  const citiesById = new Map(cities.map((city) => [city.cityId, city]));
  const bestByDestination = new Map<string, ReachabilityEdge>();
  for (const item of REACHABILITY_EDGES) {
    if (item.originId !== preferences.originId) continue;
    if (preferences.mode !== "any" && item.mode !== preferences.mode) continue;
    if (item.typicalMinutes > preferences.maxTravelMinutes) continue;
    if (!citiesById.has(item.destinationId)) continue;
    const current = bestByDestination.get(item.destinationId);
    if (
      current === undefined ||
      item.typicalMinutes < current.typicalMinutes ||
      (item.typicalMinutes === current.typicalMinutes &&
        MODE_ORDER[item.mode] < MODE_ORDER[current.mode])
    ) {
      bestByDestination.set(item.destinationId, item);
    }
  }

  return [...bestByDestination.entries()]
    .map(([destinationId, selectedEdge]) => ({
      city: citiesById.get(destinationId)!,
      edge: selectedEdge,
    }))
    .sort(
      (left, right) =>
        left.edge.typicalMinutes - right.edge.typicalMinutes ||
        left.city.cityName.localeCompare(right.city.cityName),
    );
}

export function rankReachableDiscoveryResults(
  results: ReadonlyArray<DiscoveryCityResult>,
  reachable: ReadonlyArray<ReachableDestination>,
): ReadonlyArray<DiscoveryCityResult> {
  const travelMinutes = new Map(
    reachable.map((item) => [item.city.cityId, item.edge.typicalMinutes] as const),
  );
  return [...results].sort((left, right) => {
    const scoreDifference = (right.score ?? -1) - (left.score ?? -1);
    if (scoreDifference !== 0) return scoreDifference;
    const confidenceDifference = right.confidence - left.confidence;
    if (confidenceDifference !== 0) return confidenceDifference;
    const travelDifference =
      (travelMinutes.get(left.city.cityId) ?? Number.POSITIVE_INFINITY) -
      (travelMinutes.get(right.city.cityId) ?? Number.POSITIVE_INFINITY);
    if (travelDifference !== 0) return travelDifference;
    return left.city.cityName.localeCompare(right.city.cityName);
  });
}
