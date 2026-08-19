from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def path(relative: str) -> Path:
    return ROOT / relative


def replace_once(relative: str, old: str, new: str) -> None:
    target = path(relative)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{relative}: expected one match, found {count}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


def write(relative: str, content: str) -> None:
    target = path(relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


reachability = r'''import type { TripCityOption } from "../trips/workspace";
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

// Coarse, conservative planning estimates. Flight values include a basic airport
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
  const labels: Readonly<Record<ReachabilityLocale, Readonly<Record<ReachabilityModeFilter, string>>>> = {
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
  if (locale === "zh-cn") return remainder === 0 ? `${hours} 小时` : `${hours} 小时 ${remainder} 分`;
  return remainder === 0 ? `${hours} 小時` : `${hours} 小時 ${remainder} 分`;
}

export function listReachabilityModes(originId: ReachabilityOriginId): ReadonlyArray<ReachabilityMode> {
  return [...new Set(REACHABILITY_EDGES.filter((item) => item.originId === originId).map((item) => item.mode))]
    .sort((left, right) => MODE_ORDER[left] - MODE_ORDER[right]);
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
  const originId = isOrigin(search.get("origin"))
    ? search.get("origin")!
    : DEFAULT_REACHABILITY_PREFERENCES.originId;
  const requestedMode = isMode(search.get("mode"))
    ? search.get("mode")!
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
      (item.typicalMinutes === current.typicalMinutes && MODE_ORDER[item.mode] < MODE_ORDER[current.mode])
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
'''
write("apps/web/src/discovery/reachability.ts", reachability)

reachability_test = r'''import { describe, expect, it } from "vitest";
import type { TripCityOption } from "../trips/workspace";
import type { DiscoveryCityResult } from "./weather-discovery";
import {
  DEFAULT_REACHABILITY_PREFERENCES,
  formatTravelMinutes,
  listReachabilityModes,
  listReachabilityOrigins,
  listReachableDestinations,
  parseReachabilityPreferences,
  rankReachableDiscoveryResults,
  serializeReachabilityPreferences,
} from "./reachability";

function city(cityId: string, cityName = cityId): TripCityOption {
  return {
    cityId,
    countrySlug: cityId.slice(0, 2),
    citySlug: cityId,
    cityName,
    countryName: "Country",
    latitude: 0,
    longitude: 0,
    timezone: "UTC",
    featured: false,
  };
}

function result(cityId: string, score = 80, confidence = 1): DiscoveryCityResult {
  return {
    city: city(cityId),
    forecastDays: [],
    score,
    confidence,
    passesConstraints: true,
    reasonCodes: [],
    metrics: {
      days: 1,
      maxRainProbability: 10,
      averageRainProbability: 10,
      totalPrecipitationMm: 0,
      averagePrecipitationMm: 0,
      averageMinC: 20,
      averageMaxC: 28,
      maxWindKph: 10,
      maxGustKph: 15,
      maxUv: 5,
    },
  };
}

const CITIES = [
  city("my-kuala-lumpur", "Kuala Lumpur"),
  city("my-malacca", "Malacca"),
  city("my-penang", "Penang"),
  city("th-bangkok", "Bangkok"),
  city("jp-tokyo", "Tokyo"),
];

describe("static reachability phase 1", () => {
  it("starts with three bounded origin hubs", () => {
    expect(listReachabilityOrigins().map((origin) => origin.id)).toEqual([
      "sg-singapore",
      "hk-hong-kong",
      "tw-taipei",
    ]);
    expect(listReachabilityModes("sg-singapore")).toEqual(["drive", "flight"]);
    expect(listReachabilityModes("hk-hong-kong")).toEqual(["flight"]);
  });

  it("parses and serializes bounded shareable query state", () => {
    const parsed = parseReachabilityPreferences(
      new URLSearchParams("origin=hk-hong-kong&mode=flight&maxTravel=480"),
    );
    expect(parsed).toEqual({ originId: "hk-hong-kong", mode: "flight", maxTravelMinutes: 480 });
    expect(parseReachabilityPreferences(serializeReachabilityPreferences(parsed))).toEqual(parsed);
  });

  it("normalizes unsupported origin, mode and travel limits to safe defaults", () => {
    expect(
      parseReachabilityPreferences(
        new URLSearchParams("origin=unknown&mode=rail&maxTravel=999"),
      ),
    ).toEqual(DEFAULT_REACHABILITY_PREFERENCES);
    expect(
      parseReachabilityPreferences(
        new URLSearchParams("origin=hk-hong-kong&mode=drive&maxTravel=360"),
      ),
    ).toEqual({ originId: "hk-hong-kong", mode: "any", maxTravelMinutes: 360 });
  });

  it("filters destinations before weather ranking", () => {
    const reachable = listReachableDestinations(CITIES, {
      originId: "sg-singapore",
      mode: "drive",
      maxTravelMinutes: 300,
    });
    expect(reachable.map((item) => item.city.cityId)).toEqual([
      "my-malacca",
      "my-kuala-lumpur",
    ]);
    expect(reachable.every((item) => item.edge.mode === "drive")).toBe(true);
  });

  it("uses the shortest supported edge when any mode is allowed", () => {
    const reachable = listReachableDestinations(CITIES, {
      originId: "sg-singapore",
      mode: "any",
      maxTravelMinutes: 360,
    });
    const kualaLumpur = reachable.find((item) => item.city.cityId === "my-kuala-lumpur");
    expect(kualaLumpur?.edge).toMatchObject({ mode: "flight", typicalMinutes: 190 });
    expect(reachable.some((item) => item.city.cityId === "jp-tokyo")).toBe(false);
  });

  it("uses travel time only as a tie-break after dry score and confidence", () => {
    const reachable = listReachableDestinations(CITIES, {
      originId: "sg-singapore",
      mode: "flight",
      maxTravelMinutes: 360,
    });
    const ranked = rankReachableDiscoveryResults(
      [result("th-bangkok"), result("my-kuala-lumpur")],
      reachable,
    );
    expect(ranked.map((item) => item.city.cityId)).toEqual([
      "my-kuala-lumpur",
      "th-bangkok",
    ]);
    const weatherWinner = rankReachableDiscoveryResults(
      [result("th-bangkok", 95), result("my-kuala-lumpur", 80)],
      reachable,
    );
    expect(weatherWinner[0]?.city.cityId).toBe("th-bangkok");
  });

  it("formats planning times for every active locale", () => {
    expect(formatTravelMinutes(190, "en")).toBe("3h 10m");
    expect(formatTravelMinutes(240, "zh-cn")).toBe("4 小时");
    expect(formatTravelMinutes(270, "zh-hant")).toBe("4 小時 30 分");
  });
});
'''
write("apps/web/src/discovery/reachability.test.ts", reachability_test)

component = "apps/web/src/components/WeatherDiscoveryPlannerV2.tsx"
replace_once(
    component,
    'import { discoveryDateRange } from "../discovery/discovery-trip";\n',
    'import { discoveryDateRange } from "../discovery/discovery-trip";\nimport {\n'
    '  DEFAULT_REACHABILITY_PREFERENCES,\n'
    '  MAX_TRAVEL_MINUTE_OPTIONS,\n'
    '  formatTravelMinutes,\n'
    '  listReachabilityModes,\n'
    '  listReachabilityOrigins,\n'
    '  listReachableDestinations,\n'
    '  normalizeReachabilityMode,\n'
    '  parseReachabilityPreferences,\n'
    '  rankReachableDiscoveryResults,\n'
    '  reachabilityModeLabel,\n'
    '  reachabilityOriginLabel,\n'
    '  reachabilityPreferenceKey,\n'
    '  serializeReachabilityPreferences,\n'
    '  type ReachabilityModeFilter,\n'
    '  type ReachabilityOriginId,\n'
    '  type ReachabilityPreferences,\n'
    '} from "../discovery/reachability";\n',
)
replace_once(
    component,
    '''interface StoredDestinationSelection {
  readonly cityId: string;
  readonly from: string;
  readonly to: string;
}''',
    '''interface StoredDestinationSelection {
  readonly cityId: string;
  readonly from: string;
  readonly to: string;
  readonly reachabilityKey: string;
}''',
)

copy_replacements = [
    (
        '''    when: "Travel dates",
    from: "From",
    to: "To",
    intent: "Ranking goal",''',
        '''    when: "Travel dates",
    from: "From",
    to: "To",
    reachability: "Reachability",
    origin: "Starting city",
    transport: "Transport",
    maxTravel: "Max one-way planning time",
    reachabilityHelp:
      "Static planning estimates include a basic airport or station allowance and exclude fares, availability and delays.",
    coverage: "Initial starting hubs: Singapore, Hong Kong and Taipei.",
    intent: "Ranking goal",''',
    ),
    (
        '''    noMatches: "No destinations match every selected limit. Relax one limit and try again.",
    results: "Top 3 least-rain destinations",
    checked: "eligible destinations checked",''',
        '''    noMatches: "No reachable destinations match every weather limit. Relax one limit and try again.",
    noReachable:
      "No supported destination fits this travel-time limit. Increase the limit or change transport.",
    results: "Top 3 least-rain destinations",
    checked: "eligible destinations checked",
    reachable: "reachable destinations",
    weatherEligible: "meet weather limits",''',
    ),
    (
        '''    uvMetric: "Peak UV",
    forecast: "Daily outlook",''',
        '''    uvMetric: "Peak UV",
    travelEstimate: "Typical one-way planning time",
    estimateNote: "Static estimate — verify transport before booking",
    forecast: "Daily outlook",''',
    ),
    (
        '    filtersShare: "Dates, limits and comparison choices stay in the URL for sharing.",',
        '    filtersShare:\n      "Starting city, transport, travel-time limit, dates and weather limits stay in the URL for sharing.",',
    ),
    (
        '''    when: "出行日期",
    from: "开始",
    to: "结束",
    intent: "排序目标",''',
        '''    when: "出行日期",
    from: "开始",
    to: "结束",
    reachability: "可达范围",
    origin: "出发城市",
    transport: "交通方式",
    maxTravel: "最长单程规划时间",
    reachabilityHelp: "静态规划时间包含基础机场或车站预留，不包含价格、余票和延误。",
    coverage: "首批支持出发地：新加坡、香港和台北。",
    intent: "排序目标",''',
    ),
    (
        '''    noMatches: "没有目的地同时满足全部限制条件，可以放宽一个条件后再试。",
    results: "最少雨的 3 个目的地",
    checked: "个符合条件的目的地已参与排序",''',
        '''    noMatches: "可达目的地中没有城市同时满足全部天气限制，可以放宽一个条件后再试。",
    noReachable: "当前交通方式和单程时间内没有支持的目的地，可以增加时间或更换交通方式。",
    results: "最少雨的 3 个目的地",
    checked: "个符合条件的目的地已参与排序",
    reachable: "个可达目的地",
    weatherEligible: "个满足天气限制",''',
    ),
    (
        '''    uvMetric: "最高 UV",
    forecast: "逐日天气",''',
        '''    uvMetric: "最高 UV",
    travelEstimate: "典型单程规划时间",
    estimateNote: "静态估算，预订前请确认实际交通",
    forecast: "逐日天气",''',
    ),
    (
        '    filtersShare: "日期、限制条件和对比选择会写入 URL，可直接分享。",',
        '    filtersShare: "出发地、交通方式、单程时间、日期和天气限制会写入 URL，可直接分享。",',
    ),
    (
        '''    when: "出行日期",
    from: "開始",
    to: "結束",
    intent: "排序目標",''',
        '''    when: "出行日期",
    from: "開始",
    to: "結束",
    reachability: "可達範圍",
    origin: "出發城市",
    transport: "交通方式",
    maxTravel: "最長單程規劃時間",
    reachabilityHelp: "靜態規劃時間包含基礎機場或車站預留，不包含價格、餘票和延誤。",
    coverage: "首批支援出發地：新加坡、香港和台北。",
    intent: "排序目標",''',
    ),
    (
        '''    noMatches: "沒有目的地同時符合全部限制條件，可以放寬一個條件後再試。",
    results: "最少雨的 3 個目的地",
    checked: "個符合條件的目的地已參與排序",''',
        '''    noMatches: "可達目的地中沒有城市同時符合全部天氣限制，可以放寬一個條件後再試。",
    noReachable: "目前交通方式和單程時間內沒有支援的目的地，可以增加時間或更換交通方式。",
    results: "最少雨的 3 個目的地",
    checked: "個符合條件的目的地已參與排序",
    reachable: "個可達目的地",
    weatherEligible: "個符合天氣限制",''',
    ),
    (
        '''    uvMetric: "最高 UV",
    forecast: "逐日天氣",''',
        '''    uvMetric: "最高 UV",
    travelEstimate: "典型單程規劃時間",
    estimateNote: "靜態估算，預訂前請確認實際交通",
    forecast: "逐日天氣",''',
    ),
    (
        '    filtersShare: "日期、限制條件和比較選擇會寫入 URL，可直接分享。",',
        '    filtersShare: "出發地、交通方式、單程時間、日期和天氣限制會寫入 URL，可直接分享。",',
    ),
]
for old, new in copy_replacements:
    replace_once(component, old, new)

replace_once(
    component,
    '''    return typeof value.cityId === "string" &&
      typeof value.from === "string" &&
      typeof value.to === "string"
      ? { cityId: value.cityId, from: value.from, to: value.to }
      : null;''',
    '''    return typeof value.cityId === "string" &&
      typeof value.from === "string" &&
      typeof value.to === "string" &&
      typeof value.reachabilityKey === "string"
      ? {
          cityId: value.cityId,
          from: value.from,
          to: value.to,
          reachabilityKey: value.reachabilityKey,
        }
      : null;''',
)
replace_once(
    component,
    '''  const [draft, setDraft] = useState<DiscoveryPreferences>(initialPreferences);
  const [applied, setApplied] = useState<DiscoveryPreferences>(initialPreferences);''',
    '''  const [draft, setDraft] = useState<DiscoveryPreferences>(initialPreferences);
  const [applied, setApplied] = useState<DiscoveryPreferences>(initialPreferences);
  const [draftReachability, setDraftReachability] = useState<ReachabilityPreferences>(
    DEFAULT_REACHABILITY_PREFERENCES,
  );
  const [appliedReachability, setAppliedReachability] = useState<ReachabilityPreferences>(
    DEFAULT_REACHABILITY_PREFERENCES,
  );''',
)
replace_once(
    component,
    '''    const parsed = parseDiscoveryPreferences(search, { from: fallback.from, to: fallback.to });
    const stored = readStoredSelection();
    setDraft(parsed);
    setApplied(parsed);
    setShortlist((search.get("cities") ?? "").split(",").filter(Boolean).slice(0, MAX_SHORTLIST));
    if (stored?.from === parsed.from && stored.to === parsed.to) {
      setSelectedDestinationId(stored.cityId);
    }''',
    '''    const parsed = parseDiscoveryPreferences(search, { from: fallback.from, to: fallback.to });
    const reachability = parseReachabilityPreferences(search);
    const stored = readStoredSelection();
    setDraft(parsed);
    setApplied(parsed);
    setDraftReachability(reachability);
    setAppliedReachability(reachability);
    setShortlist((search.get("cities") ?? "").split(",").filter(Boolean).slice(0, MAX_SHORTLIST));
    if (
      stored?.from === parsed.from &&
      stored.to === parsed.to &&
      stored.reachabilityKey === reachabilityPreferenceKey(reachability)
    ) {
      setSelectedDestinationId(stored.cityId);
    }''',
)
replace_once(
    component,
    '''  const loadForecast = useCallback(async (): Promise<void> => {''',
    '''  const reachableDestinations = useMemo(
    () => listReachableDestinations(cities, appliedReachability),
    [appliedReachability, cities],
  );
  const eligibleCities = useMemo(
    () => reachableDestinations.map((item) => item.city),
    [reachableDestinations],
  );
  const reachabilityByCity = useMemo(
    () => new Map(reachableDestinations.map((item) => [item.city.cityId, item.edge] as const)),
    [reachableDestinations],
  );

  const loadForecast = useCallback(async (): Promise<void> => {''',
)
replace_once(
    component,
    '''    if (discoveryDateRange(applied.from, applied.to).length === 0) {
      setState("error");
      setMessage(copy.invalidRange);
      return;
    }
    setState("loading");''',
    '''    if (discoveryDateRange(applied.from, applied.to).length === 0) {
      setState("error");
      setMessage(copy.invalidRange);
      return;
    }
    if (eligibleCities.length === 0) {
      setForecast([]);
      setUpdatedAt("");
      setStale(false);
      setState("ready");
      return;
    }
    setState("loading");''',
)
replace_once(component, "for (const batch of chunks(cities, MAX_CITIES_PER_REQUEST))", "for (const batch of chunks(eligibleCities, MAX_CITIES_PER_REQUEST))")
replace_once(
    component,
    '''  }, [apiLocale, applied, cities, copy.invalidRange, copy.unavailable, locale]);''',
    '''  }, [
    apiLocale,
    applied,
    cities.length,
    copy.invalidRange,
    copy.unavailable,
    eligibleCities,
    locale,
  ]);''',
)
replace_once(
    component,
    '''  const rankedResults = useMemo(
    () => rankDiscoveryCities(cities, forecast, applied),
    [applied, cities, forecast],
  );''',
    '''  const weatherRankedResults = useMemo(
    () => rankDiscoveryCities(eligibleCities, forecast, applied),
    [applied, eligibleCities, forecast],
  );
  const rankedResults = useMemo(
    () => rankReachableDiscoveryResults(weatherRankedResults, reachableDestinations),
    [reachableDestinations, weatherRankedResults],
  );''',
)
replace_once(
    component,
    '''  const updateUrl = useCallback(
    (preferences: DiscoveryPreferences, selected: ReadonlyArray<string>): void => {
      const search = serializeDiscoveryPreferences(preferences);
      if (selected.length > 0) search.set("cities", selected.join(","));
      window.history.replaceState({}, "", `${window.location.pathname}?${search.toString()}`);
    },
    [],
  );''',
    '''  const updateUrl = useCallback(
    (
      preferences: DiscoveryPreferences,
      reachability: ReachabilityPreferences,
      selected: ReadonlyArray<string>,
    ): void => {
      const search = serializeDiscoveryPreferences(preferences);
      for (const [key, value] of serializeReachabilityPreferences(reachability)) {
        search.set(key, value);
      }
      if (selected.length > 0) search.set("cities", selected.join(","));
      window.history.replaceState({}, "", `${window.location.pathname}?${search.toString()}`);
    },
    [],
  );''',
)
replace_once(
    component,
    '''    setSelectedDestinationId(null);
    window.localStorage.removeItem(SELECTED_DESTINATION_STORAGE_KEY);
    setApplied(draft);
    updateUrl(draft, shortlist);
  }, [copy.invalidRange, draft, shortlist, updateUrl]);''',
    '''    setSelectedDestinationId(null);
    window.localStorage.removeItem(SELECTED_DESTINATION_STORAGE_KEY);
    setApplied(draft);
    setAppliedReachability(draftReachability);
    updateUrl(draft, draftReachability, shortlist);
  }, [copy.invalidRange, draft, draftReachability, shortlist, updateUrl]);''',
)
replace_once(component, "        updateUrl(applied, next);", "        updateUrl(applied, appliedReachability, next);")
replace_once(
    component,
    '''    [applied, copy.shortlistFull, locale, updateUrl],''',
    '''    [applied, appliedReachability, copy.shortlistFull, locale, updateUrl],''',
)
replace_once(
    component,
    '''          cityId: result.city.cityId,
          from: applied.from,
          to: applied.to,
        } satisfies StoredDestinationSelection),''',
    '''          cityId: result.city.cityId,
          from: applied.from,
          to: applied.to,
          reachabilityKey: reachabilityPreferenceKey(appliedReachability),
        } satisfies StoredDestinationSelection),''',
)
replace_once(
    component,
    '''    [applied.from, applied.to, copy.selectionSaved, locale],''',
    '''    [applied.from, applied.to, appliedReachability, copy.selectionSaved, locale],''',
)
replace_once(
    component,
    '''  return (
    <main id="main-content"''',
    '''  const originOptions = listReachabilityOrigins();
  const availableModes = listReachabilityModes(draftReachability.originId);

  return (
    <main id="main-content"''',
)
old_form = '''        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <p className="eyebrow">{copy.when}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                {copy.from}
                <input
                  type="date"
                  value={draft.from}
                  className="min-h-11 rounded-xl border border-border bg-white px-3"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, from: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                {copy.to}
                <input
                  type="date"
                  value={draft.to}
                  className="min-h-11 rounded-xl border border-border bg-white px-3"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, to: event.target.value }))
                  }
                />
              </label>
            </div>
          </div>

          <div data-discovery-intent="dry">
            <p className="eyebrow">{copy.intent}</p>
            <div className="mt-3 inline-flex min-h-11 items-center rounded-full border border-foreground bg-foreground px-4 text-sm font-semibold text-white">
              {copy.intentValue}
            </div>
          </div>
        </div>'''
new_form = '''        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="eyebrow">{copy.when}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                {copy.from}
                <input
                  type="date"
                  value={draft.from}
                  className="min-h-11 rounded-xl border border-border bg-white px-3"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, from: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                {copy.to}
                <input
                  type="date"
                  value={draft.to}
                  className="min-h-11 rounded-xl border border-border bg-white px-3"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, to: event.target.value }))
                  }
                />
              </label>
            </div>
          </div>

          <div>
            <p className="eyebrow">{copy.reachability}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                {copy.origin}
                <select
                  value={draftReachability.originId}
                  className="min-h-11 rounded-xl border border-border bg-white px-3"
                  onChange={(event) => {
                    const originId = event.target.value as ReachabilityOriginId;
                    setDraftReachability((current) => ({
                      ...current,
                      originId,
                      mode: normalizeReachabilityMode(originId, current.mode),
                    }));
                  }}
                >
                  {originOptions.map((origin) => (
                    <option key={origin.id} value={origin.id}>
                      {reachabilityOriginLabel(origin.id, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                {copy.transport}
                <select
                  value={draftReachability.mode}
                  className="min-h-11 rounded-xl border border-border bg-white px-3"
                  onChange={(event) =>
                    setDraftReachability((current) => ({
                      ...current,
                      mode: event.target.value as ReachabilityModeFilter,
                    }))
                  }
                >
                  <option value="any">{reachabilityModeLabel("any", locale)}</option>
                  {availableModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {reachabilityModeLabel(mode, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                {copy.maxTravel}
                <select
                  value={draftReachability.maxTravelMinutes}
                  className="min-h-11 rounded-xl border border-border bg-white px-3"
                  onChange={(event) =>
                    setDraftReachability((current) => ({
                      ...current,
                      maxTravelMinutes: Number(event.target.value),
                    }))
                  }
                >
                  {MAX_TRAVEL_MINUTE_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {formatTravelMinutes(minutes, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">{copy.reachabilityHelp}</p>
            <p className="mt-1 text-xs font-semibold text-muted">{copy.coverage}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3" data-discovery-intent="dry">
          <p className="eyebrow">{copy.intent}</p>
          <div className="inline-flex min-h-11 items-center rounded-full border border-foreground bg-foreground px-4 text-sm font-semibold text-white">
            {copy.intentValue}
          </div>
        </div>'''
replace_once(component, old_form, new_form)
replace_once(
    component,
    '''                {rankedResults.length} {copy.checked}''',
    '''                {eligibleCities.length} {copy.reachable} · {rankedResults.length} {copy.weatherEligible}''',
)
replace_once(
    component,
    '''                {copy.noMatches}''',
    '''                {eligibleCities.length === 0 ? copy.noReachable : copy.noMatches}''',
)
replace_once(
    component,
    '''                  const shortlisted = shortlist.includes(result.city.cityId);
                  const chosen = selectedDestinationId === result.city.cityId;''',
    '''                  const shortlisted = shortlist.includes(result.city.cityId);
                  const chosen = selectedDestinationId === result.city.cityId;
                  const travel = reachabilityByCity.get(result.city.cityId);''',
)
replace_once(
    component,
    '''                        </dl>
                        <ul className="relative mt-4 flex flex-wrap gap-1.5">''',
    '''                        </dl>
                        {travel !== undefined ? (
                          <div className="relative mt-4 rounded-xl border border-border bg-surface-elevated p-3">
                            <p className="text-xs text-muted">{copy.travelEstimate}</p>
                            <p className="mt-1 font-bold text-foreground">
                              {reachabilityModeLabel(travel.mode, locale)} · {formatTravelMinutes(travel.typicalMinutes, locale)}
                            </p>
                            <p className="mt-1 text-[11px] leading-4 text-muted">{copy.estimateNote}</p>
                          </div>
                        ) : null}
                        <ul className="relative mt-4 flex flex-wrap gap-1.5">''',
)
replace_once(
    component,
    '''                    carDependent: false,''',
    '''                    carDependent:
                      reachabilityByCity.get(selectedDestination.city.cityId)?.mode === "drive",''',
)

# Discovery metadata now describes the bounded reachability query.
replace_once(
    "apps/web/src/app/discover/page.tsx",
    '''const description =
  "Choose travel dates, apply optional rain, temperature and wind limits, then compare the three destinations with the lowest rain risk.";''',
    '''const description =
  "Choose a supported starting hub, travel dates, transport mode and maximum one-way planning time, then compare the three reachable destinations with the lowest rain risk.";''',
)
replace_once(
    "apps/web/src/app/discover/page.tsx",
    'title: "Find the least-rain travel destination",',
    'title: "Find reachable least-rain destinations",',
)
replace_once(
    "apps/web/src/app/zh-cn/discover/page.tsx",
    'const description = "选择出行日期和可选天气限制，只比较整体降雨风险最低的 3 个旅行目的地。";',
    'const description = "选择支持的出发地、交通方式、最长单程规划时间和日期，只比较可达范围内整体降雨风险最低的 3 个目的地。";',
)
replace_once(
    "apps/web/src/app/zh-cn/discover/page.tsx",
    'title: "哪里不下雨：少雨目的地 Top 3",',
    'title: "可达范围内哪里不下雨：Top 3",',
)
replace_once(
    "apps/web/src/app/zh-hant/discover/page.tsx",
    'const description = "選擇出行日期和可選天氣限制，只比較整體降雨風險最低的 3 個旅行目的地。";',
    'const description = "選擇支援的出發地、交通方式、最長單程規劃時間和日期，只比較可達範圍內整體降雨風險最低的 3 個目的地。";',
)
replace_once(
    "apps/web/src/app/zh-hant/discover/page.tsx",
    'title: "哪裡不下雨：少雨目的地 Top 3",',
    'title: "可達範圍內哪裡不下雨：Top 3",',
)

# Homepage copy introduces the new eligibility step without turning transport into ranking.
replace_once(
    "apps/web/src/app/page.tsx",
    '''              Choose your dates, apply optional rain, temperature and wind limits, and compare only
              the three destinations with the strongest dry-weather signal.''',
    '''              Start from Singapore, Hong Kong or Taipei, set a one-way travel-time limit, then compare
              only the three reachable destinations with the strongest dry-weather signal.''',
)
replace_once(
    "apps/web/src/app/page.tsx",
    '["01", "Choose dates", "Set the exact travel window within the forecast horizon."],',
    '["01", "Set origin and dates", "Choose a supported starting hub and exact travel window."],',
)
replace_once(
    "apps/web/src/app/zh-cn/page.tsx",
    '''            选择出行日期，按整体降雨风险筛选目的地；也可以设置温度、风速和最高降雨概率限制，只看最值得比较的
            3 个结果。''',
    '''            从新加坡、香港或台北出发，设置最长单程时间和出行日期，再在可达范围内只看整体降雨风险最低的 3
            个结果。''',
)
replace_once(
    "apps/web/src/app/zh-cn/page.tsx",
    '["01", "选择准确日期", "在未来14天预报窗口内确定开始和结束日期。"],',
    '["01", "选择出发地和日期", "从首批支持枢纽出发，并确定未来14天内的旅行窗口。"],',
)
replace_once(
    "apps/web/src/app/zh-hant/page.tsx",
    '''            選擇出行日期，按整體降雨風險篩選目的地；也可以設定溫度、風速和最高降雨機率限制，只看最值得比較的
            3 個結果。''',
    '''            從新加坡、香港或台北出發，設定最長單程時間和出行日期，再在可達範圍內只看整體降雨風險最低的 3
            個結果。''',
)
replace_once(
    "apps/web/src/app/zh-hant/page.tsx",
    '["01", "選擇準確日期", "在未來14天預報窗口內確定開始和結束日期。"],',
    '["01", "選擇出發地和日期", "從首批支援樞紐出發，並確定未來14天內的旅行窗口。"],',
)

# Contract tests move from “no selects” to “only explicit reachability selects”.
weather_contract = r'''import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const planner = readFileSync(new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../discovery/weather-discovery.ts", import.meta.url), "utf8");
const reachability = readFileSync(new URL("../discovery/reachability.ts", import.meta.url), "utf8");
const trip = readFileSync(new URL("../discovery/discovery-trip.ts", import.meta.url), "utf8");
const englishRoute = readFileSync(new URL("../app/discover/page.tsx", import.meta.url), "utf8");
const simplifiedRoute = readFileSync(
  new URL("../app/zh-cn/discover/page.tsx", import.meta.url),
  "utf8",
);
const traditionalRoute = readFileSync(
  new URL("../app/zh-hant/discover/page.tsx", import.meta.url),
  "utf8",
);

describe("least-rain destination discovery contract", () => {
  it("exposes one active least-rain intent and normalizes legacy links", () => {
    expect(engine).toContain('const INTENTS: ReadonlyArray<WeatherDiscoveryIntent> = ["dry"]');
    expect(engine).toContain('intent: "dry"');
    expect(engine).toContain("partyProfile: null");
    expect(engine).toContain("theme: null");
    expect(engine).not.toContain('search.set("party"');
    expect(engine).not.toContain('search.set("theme"');
    expect(planner).toContain('data-discovery-intent="dry"');
    expect(planner).not.toContain("contextualizeDiscoveryResults");
    expect(planner).not.toContain("Travellers");
    expect(planner).not.toContain("Trip style");
  });

  it("filters by a bounded static reachability matrix before weather ranking", () => {
    expect(reachability).toContain('"sg-singapore" | "hk-hong-kong" | "tw-taipei"');
    expect(reachability).toContain("listReachableDestinations");
    expect(reachability).toContain("rankReachableDiscoveryResults");
    expect(reachability).toContain("Static planning estimates");
    expect(planner).toContain("Starting city");
    expect(planner).toContain("Max one-way planning time");
    expect(planner).toContain("eligibleCities");
    expect(planner).toContain("chunks(eligibleCities, MAX_CITIES_PER_REQUEST)");
    expect(planner).toContain("rankReachableDiscoveryResults");
  });

  it("returns only the Top 3 and preserves four explicit hard limits", () => {
    expect(planner).toContain("const MAX_RESULTS = 3");
    expect(planner).toContain("rankedResults.slice(0, MAX_RESULTS)");
    expect(planner).toContain("rainProbabilityMax");
    expect(planner).toContain("temperatureMinC");
    expect(planner).toContain("temperatureMaxC");
    expect(planner).toContain("windSpeedMaxKph");
    expect(planner).toContain("A destination is excluded when it exceeds any limit");
  });

  it("keeps forecast reads bounded and provider-isolated", () => {
    expect(planner).toContain("MAX_CITIES_PER_REQUEST = 12");
    expect(planner).toContain("/api/v1/trip-cities");
    expect(planner).toContain("/api/v1/trip-forecast");
    expect(planner).toContain("FORECAST_SNAPSHOT_CHANGED");
    expect(planner).not.toContain("open-meteo.com");
    expect(planner).not.toContain("api.open-meteo.com");
    expect(trip).toContain("dates.length < 16");
  });

  it("keeps origin, transport, travel time, dates, limits and shortlist shareable", () => {
    expect(engine).toContain("parseDiscoveryPreferences");
    expect(engine).toContain("serializeDiscoveryPreferences");
    expect(reachability).toContain("parseReachabilityPreferences");
    expect(reachability).toContain("serializeReachabilityPreferences");
    expect(planner).toContain('search.set("cities"');
    expect(planner).toContain("window.history.replaceState");
  });

  it("records an explicit destination choice before commercial surfaces", () => {
    expect(planner).toContain('event: "destination_selected"');
    expect(planner).toContain('data-commerce-after-decision="destination-selected"');
    expect(planner).toContain('stage: "discovery_decided"');
    expect(planner).toContain("hasTrip: false");
    expect(planner).not.toContain("buildDiscoveryWorkspace");
  });

  it("ships localized crawlable routes with one product promise", () => {
    expect(englishRoute).toContain('locale="en"');
    expect(simplifiedRoute).toContain('locale="zh-cn"');
    expect(traditionalRoute).toContain('locale="zh-hant"');
    expect(planner).toContain("Least-rain destination finder");
    expect(planner).toContain("少雨目的地工具");
    expect(planner).not.toContain("Weather Discovery 2.0");
    expect(planner).not.toContain("Phase 7");
  });
});
'''
write("apps/web/src/components/weather-discovery-phase6-contract.test.ts", weather_contract)

ux_contract = r'''import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const englishHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const simplifiedHome = readFileSync(new URL("../app/zh-cn/page.tsx", import.meta.url), "utf8");
const traditionalHome = readFileSync(new URL("../app/zh-hant/page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("./SiteHeader.tsx", import.meta.url), "utf8");
const discovery = readFileSync(new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const trips = readFileSync(new URL("../app/trips/page.tsx", import.meta.url), "utf8");

describe("OPC least-rain decision UX contracts", () => {
  it("gives every homepage one primary least-rain task", () => {
    expect(englishHome).toContain("Where is it least likely to rain?");
    expect(englishHome).toContain("Find 3 dry-weather destinations");
    expect(englishHome).not.toContain('href="/trips"');

    expect(simplifiedHome).toContain("日期定了，去哪里更不容易下雨？");
    expect(simplifiedHome).toContain("找 3 个少雨目的地");
    expect(simplifiedHome).not.toContain('href="/zh-cn/trips"');

    expect(traditionalHome).toContain("日期定了，去哪裡更不容易下雨？");
    expect(traditionalHome).toContain("找 3 個少雨目的地");
    expect(traditionalHome).not.toContain('href="/zh-hant/trips"');
  });

  it("uses one global product navigation task", () => {
    expect(header).toContain("Find dry destinations");
    expect(header).toContain("找少雨目的地");
    expect(header).not.toContain("Plan together");
    expect(header).not.toContain("共同规划");
    expect(header).not.toContain("共同規劃");
    expect(header).not.toContain("tripHref");
  });

  it("returns Top 3 with explicit reachability and weather limits only", () => {
    expect(discovery).toContain("const MAX_RESULTS = 3");
    expect(discovery).toContain("rankedResults.slice(0, MAX_RESULTS)");
    expect(discovery).toContain("Starting city");
    expect(discovery).toContain("Transport");
    expect(discovery).toContain("Max one-way planning time");
    expect(discovery).toContain("Optional weather limits");
    expect(discovery).not.toContain("Travellers");
    expect(discovery).not.toContain("Trip style");
  });

  it("keeps advanced Trips available but outside acquisition and indexing", () => {
    expect(trips).toContain("Advanced itinerary tools");
    expect(trips).toContain("robots: { index: false, follow: true }");
    expect(sitemap).not.toContain('localizedSitemapEntries("/trips"');
    expect(header).not.toContain("href={tripHref}");
  });

  it("keeps complete three-locale homepage alternates and crawlable discovery", () => {
    expect(englishHome).toContain('buildAlternates("/", "en", ["en", "zh-cn", "zh-hant"])');
    expect(simplifiedHome).toContain('buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"])');
    expect(traditionalHome).toContain(
      'buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"])',
    );
    expect(sitemap).toContain('localizedSitemapEntries("/discover"');
  });
});
'''
write("apps/web/src/components/ux-funnel-contract.test.ts", ux_contract)

production_contract = path("apps/web/src/components/production-smoke-copy-contract.test.ts").read_text(encoding="utf-8")
production_contract = production_contract.replace(
    '["Least-rain destination finder", "Where is it least likely to rain on your dates?"],',
    '[\n    "Least-rain destination finder",\n    "Where is it least likely to rain on your dates?",\n    "Starting city",\n    "Max one-way planning time",\n  ],',
)
production_contract = production_contract.replace(
    '["少雨目的地工具", "这几天去哪里更不容易下雨？"],',
    '["少雨目的地工具", "这几天去哪里更不容易下雨？", "出发城市", "最长单程规划时间"],',
)
production_contract = production_contract.replace(
    '["少雨目的地工具", "這幾天去哪裡更不容易下雨？"],',
    '["少雨目的地工具", "這幾天去哪裡更不容易下雨？", "出發城市", "最長單程規劃時間"],',
)
write("apps/web/src/components/production-smoke-copy-contract.test.ts", production_contract)

smoke = path("tooling/deploy/weather-discovery-smoke.mjs").read_text(encoding="utf-8")
smoke = smoke.replace(
    '''  requireText(
    english,
    "Where is it least likely to rain on your dates?",
    "English discovery route",
  );''',
    '''  requireText(
    english,
    "Where is it least likely to rain on your dates?",
    "English discovery route",
  );
  requireText(english, "Starting city", "English discovery route");
  requireText(english, "Max one-way planning time", "English discovery route");''',
)
smoke = smoke.replace(
    '  requireText(simplified, "这几天去哪里更不容易下雨？", "Simplified discovery route");',
    '  requireText(simplified, "这几天去哪里更不容易下雨？", "Simplified discovery route");\n  requireText(simplified, "出发城市", "Simplified discovery route");\n  requireText(simplified, "最长单程规划时间", "Simplified discovery route");',
)
smoke = smoke.replace(
    '  requireText(traditional, "這幾天去哪裡更不容易下雨？", "Traditional discovery route");',
    '  requireText(traditional, "這幾天去哪裡更不容易下雨？", "Traditional discovery route");\n  requireText(traditional, "出發城市", "Traditional discovery route");\n  requireText(traditional, "最長單程規劃時間", "Traditional discovery route");',
)
write("tooling/deploy/weather-discovery-smoke.mjs", smoke)

# Documentation: Phase 1 is a bounded eligibility layer, never a mixed score.
replace_once(
    "README.md",
    '''Automated least-rain destination decision tool for a one-person company. Users choose travel dates, optionally set explicit weather limits, and receive only the three destinations with the lowest rain risk in the supported dataset.''',
    '''Automated least-rain destination decision tool for a one-person company. Users choose a supported starting hub, travel dates, transport mode and maximum one-way planning time, then receive only the three reachable destinations with the lowest rain risk.''',
)
replace_once(
    "README.md",
    '''choose dates
→ optionally exclude places that are too wet, hot, cold or windy
→ compare the Top 3 least-rain destinations''',
    '''choose origin, transport and maximum one-way planning time
→ choose dates and optionally exclude places that are too wet, hot, cold or windy
→ compare the Top 3 reachable least-rain destinations''',
)

prd_path = path("docs/superpowers/product/2026-08-19-founder-prd-opc-dry-destination-engine.md")
prd = prd_path.read_text(encoding="utf-8")
prd = prd.replace(
    '''choose travel dates
→ optionally apply explicit weather limits
→ receive Top 3 least-rain destinations''',
    '''choose a supported starting hub, transport mode and maximum one-way planning time
→ choose travel dates and optionally apply explicit weather limits
→ receive Top 3 reachable least-rain destinations''',
)
prd = prd.replace(
    '''## 5. Ranking contract''',
    '''## 5. Reachability contract

Reachability is an eligibility layer, not part of the weather score.

The first release uses a bounded static matrix for Singapore, Hong Kong and Taipei. It supports only transport modes represented by maintained edges and a coarse maximum one-way planning time. Estimates are intentionally conservative, include a basic airport or station allowance and exclude fares, inventory and delays.

```text
origin + transport + maximum time
→ eligible destination set
→ weather hard limits
→ least-rain ranking
```

Transport time may break a tie only after dry score and forecast confidence. It must never outrank a destination with a better dry score.

## 6. Ranking contract''',
)
for old, new in [
    ("## 6. Optional hard limits", "## 7. Optional hard limits"),
    ("## 7. Output contract", "## 8. Output contract"),
    ("## 8. Selection and commerce", "## 9. Selection and commerce"),
    ("## 9. Advanced tools", "## 10. Advanced tools"),
    ("## 10. Explicit non-goals", "## 11. Explicit non-goals"),
    ("## 11. North-star metric", "## 12. North-star metric"),
]:
    prd = prd.replace(old, new)
prd = prd.replace(
    '''- forecast freshness;
- selection and comparison actions.''',
    '''- forecast freshness;
- selected transport mode and static one-way planning estimate;
- selection and comparison actions.''',
)
prd_path.write_text(prd, encoding="utf-8")

plan_path = path("docs/superpowers/plans/2026-08-19-opc-product-cutover-phase0.md")
plan = plan_path.read_text(encoding="utf-8")
plan = plan.replace(
    '''## Phase 1 — origin and reachability

Add a bounded, static reachability dataset:

```text
origin
+ transport mode
+ maximum one-way travel time
→ eligible destination set
→ least-rain Top 3
```

No live fare, inventory or schedule dependency is required for the first release.''',
    '''## Phase 1 — origin and reachability

Status: implemented in the Phase 1 reachability change.

- bounded starting hubs: Singapore, Hong Kong and Taipei;
- static, conservative flight / drive planning estimates;
- transport options shown only when the selected origin has maintained edges;
- maximum one-way planning-time filter;
- reachability applied before weather API batching and ranking;
- transport time used only as a tie-break after dry score and forecast confidence;
- origin, mode and travel time serialized into shareable URLs;
- no live fare, inventory, route or schedule dependency.

```text
origin + transport + maximum one-way planning time
→ eligible destination set
→ weather hard limits
→ least-rain Top 3
```''',
)
plan_path.write_text(plan, encoding="utf-8")

phase1_doc = r'''# OPC Phase 1 — static origin and reachability

Date: 2026-08-19  
Status: Implemented

## Goal

Answer a narrower and more useful question:

> From a supported starting hub, which destinations are reachable within the user's travel-time limit and least likely to rain on the selected dates?

## Initial coverage

Starting hubs:

- Singapore;
- Hong Kong;
- Taipei.

Transport modes are exposed only when a maintained edge exists. Singapore currently supports flight and drive estimates; Hong Kong and Taipei currently expose flight estimates. Rail remains in the domain vocabulary but is not shown until the destination dataset contains a useful supported rail network.

## Data contract

The reachability dataset is static, type-checked and versioned with the application. Every edge contains:

```text
origin
→ destination
→ transport mode
→ conservative typical planning minutes
→ verified date
```

Flight estimates include a basic airport allowance. Drive estimates include a simple border / rest allowance. They are not live schedules, fares, availability or guarantees.

## Ranking contract

```text
reachability filter
→ weather hard limits
→ dry score
→ forecast confidence
→ travel time tie-break
```

Travel time never changes the dry score and never moves a worse-weather destination ahead of a better-weather destination.

## URL contract

The finder serializes:

```text
origin
mode
maxTravel
from
to
weather limits
shortlist
```

Old links without reachability state normalize to Singapore, any supported mode and six hours.

## OPC guardrails

- no runtime transport provider;
- no live schedule or price API;
- no new Worker or database;
- no change to Weather Provider boundaries;
- forecasts are requested only for eligible cities, reducing read traffic;
- unsupported combinations fail closed with a clear no-result state.
'''
write("docs/superpowers/plans/2026-08-19-opc-reachability-phase1.md", phase1_doc)

# Extend the scope contract to cover the new Phase 1 document.
scope_test = path("apps/web/src/components/group-decision-scope-contract.test.ts").read_text(encoding="utf-8")
scope_test = scope_test.replace(
    '''const executionPlan = readFileSync(
  new URL(
    "../../../../docs/superpowers/plans/2026-08-19-opc-product-cutover-phase0.md",
    import.meta.url,
  ),
  "utf8",
);''',
    '''const executionPlan = readFileSync(
  new URL(
    "../../../../docs/superpowers/plans/2026-08-19-opc-product-cutover-phase0.md",
    import.meta.url,
  ),
  "utf8",
);
const reachabilityPlan = readFileSync(
  new URL(
    "../../../../docs/superpowers/plans/2026-08-19-opc-reachability-phase1.md",
    import.meta.url,
  ),
  "utf8",
);''',
)
scope_test = scope_test.replace(
    '''  it("phases reachability, conversion and voting after the product cutover", () => {
    expect(executionPlan).toContain("Phase 0 — OPC product cutover");
    expect(executionPlan).toContain("Phase 1 — origin and reachability");
    expect(executionPlan).toContain("Phase 2 — selection, monetization and retention");
    expect(executionPlan).toContain("Phase 3 — evidence-gated lightweight voting");
  });''',
    '''  it("implements reachability before conversion and voting", () => {
    expect(executionPlan).toContain("Phase 0 — OPC product cutover");
    expect(executionPlan).toContain("Phase 1 — origin and reachability");
    expect(executionPlan).toContain("Status: implemented");
    expect(executionPlan).toContain("Phase 2 — selection, monetization and retention");
    expect(executionPlan).toContain("Phase 3 — evidence-gated lightweight voting");
    expect(reachabilityPlan).toContain("Singapore");
    expect(reachabilityPlan).toContain("Hong Kong");
    expect(reachabilityPlan).toContain("Taipei");
    expect(reachabilityPlan).toContain("Travel time never changes the dry score");
  });''',
)
write("apps/web/src/components/group-decision-scope-contract.test.ts", scope_test)

print("Reachability Phase 1 files updated")
