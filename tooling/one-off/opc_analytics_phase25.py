from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one occurrence, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: regex expected one occurrence, found {count}: {pattern[:120]!r}")
    write(path, updated)


# ---------------------------------------------------------------------------
# Shared analytics event contract
# ---------------------------------------------------------------------------

events_path = "packages/analytics/src/events.ts"
replace_once(
    events_path,
    'export type TripCreationSource = "weather_discovery" | "workspace";\n',
    '''export type TripCreationSource = "weather_discovery" | "workspace";

export type DiscoveryOriginId = "sg-singapore" | "hk-hong-kong" | "tw-taipei";
export type DiscoveryTransportMode = "any" | "flight" | "rail" | "drive";
export type DaysUntilDepartureBucket = "0-2d" | "3-7d" | "8-14d" | "15d+";
export type DiscoveryNoResultReason =
  | "no_reachable"
  | "weather_limits"
  | "forecast_unavailable";

export interface DiscoveryFunnelContext {
  readonly origin_id: DiscoveryOriginId;
  readonly transport_mode: DiscoveryTransportMode;
  readonly max_travel_minutes: 180 | 240 | 360 | 480 | 720;
  readonly days_until_departure_bucket: DaysUntilDepartureBucket;
  readonly trip_length_days: number;
  readonly rain_limit_set: boolean;
  readonly wind_limit_set: boolean;
  readonly temperature_limit_set: boolean;
}

export interface DiscoveryRetentionEventContext extends DiscoveryFunnelContext {
  readonly shortlist_count: number;
}
''',
)

replace_once(
    events_path,
    '''export interface WeatherDiscoveryViewEvent {
  readonly event: "weather_discovery_view";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
}
''',
    '''export interface WeatherDiscoveryViewEvent {
  readonly event: "weather_discovery_view";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
}

export interface DiscoveryQuerySubmittedEvent extends DiscoveryFunnelContext {
  readonly event: "discovery_query_submitted";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
}

export interface DiscoveryResultsReturnedEvent extends DiscoveryFunnelContext {
  readonly event: "discovery_results_returned";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly reachable_count: number;
  readonly result_count: number;
}

export interface DiscoveryNoResultsEvent extends DiscoveryFunnelContext {
  readonly event: "discovery_no_results";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly reachable_count: number;
  readonly no_result_reason: DiscoveryNoResultReason;
}

export interface SearchSavedEvent extends DiscoveryRetentionEventContext {
  readonly event: "search_saved";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
}

export interface SavedSearchOpenedEvent extends DiscoveryRetentionEventContext {
  readonly event: "saved_search_opened";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
}

export interface SavedSearchRemovedEvent extends DiscoveryRetentionEventContext {
  readonly event: "saved_search_removed";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
}

export interface ShareLinkCopiedEvent extends DiscoveryRetentionEventContext {
  readonly event: "share_link_copied";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
}

export interface CalendarReminderDownloadedEvent extends DiscoveryRetentionEventContext {
  readonly event: "calendar_reminder_downloaded";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly reminder_count: number;
}
''',
)

replace_once(
    events_path,
    '''export interface DestinationSelectedEvent {
  readonly event: "destination_selected";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly destination_id: string;
  readonly position: number;
}
''',
    '''export interface DestinationSelectedEvent extends Partial<DiscoveryFunnelContext> {
  readonly event: "destination_selected";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly destination_id: string;
  readonly position: number;
}
''',
)

replace_once(
    events_path,
    '''  | WeatherDiscoveryViewEvent
  | DestinationShortlistedEvent
''',
    '''  | WeatherDiscoveryViewEvent
  | DiscoveryQuerySubmittedEvent
  | DiscoveryResultsReturnedEvent
  | DiscoveryNoResultsEvent
  | SearchSavedEvent
  | SavedSearchOpenedEvent
  | SavedSearchRemovedEvent
  | ShareLinkCopiedEvent
  | CalendarReminderDownloadedEvent
  | DestinationShortlistedEvent
''',
)

replace_once(
    events_path,
    '''export const SEARCH_RESULT_TYPES: ReadonlyArray<SearchResultType> = Object.freeze([
  "city",
  "country",
  "article",
]);
''',
    '''export const SEARCH_RESULT_TYPES: ReadonlyArray<SearchResultType> = Object.freeze([
  "city",
  "country",
  "article",
]);

export const DISCOVERY_ORIGIN_IDS: ReadonlyArray<DiscoveryOriginId> = Object.freeze([
  "sg-singapore",
  "hk-hong-kong",
  "tw-taipei",
]);

export const DISCOVERY_TRANSPORT_MODES: ReadonlyArray<DiscoveryTransportMode> = Object.freeze([
  "any",
  "flight",
  "rail",
  "drive",
]);

export const DISCOVERY_MAX_TRAVEL_MINUTES = Object.freeze([180, 240, 360, 480, 720] as const);

export const DAYS_UNTIL_DEPARTURE_BUCKETS: ReadonlyArray<DaysUntilDepartureBucket> = Object.freeze([
  "0-2d",
  "3-7d",
  "8-14d",
  "15d+",
]);

export const DISCOVERY_NO_RESULT_REASONS: ReadonlyArray<DiscoveryNoResultReason> = Object.freeze([
  "no_reachable",
  "weather_limits",
  "forecast_unavailable",
]);
''',
)

replace_once(
    events_path,
    '''  "weather_discovery_view",
  "destination_shortlisted",
''',
    '''  "weather_discovery_view",
  "discovery_query_submitted",
  "discovery_results_returned",
  "discovery_no_results",
  "search_saved",
  "saved_search_opened",
  "saved_search_removed",
  "share_link_copied",
  "calendar_reminder_downloaded",
  "destination_shortlisted",
''',
)

replace_once(
    events_path,
    '''function asBoundedPositiveInt(v: unknown, max: number): v is number {
  return asPositiveInt(v) && v <= max;
}
''',
    '''function asBoundedPositiveInt(v: unknown, max: number): v is number {
  return asPositiveInt(v) && v <= max;
}

function asBoundedNonNegativeInt(v: unknown, max: number): v is number {
  return asNonNegativeInt(v) && v <= max;
}
''',
)

replace_once(
    events_path,
    '''function isTripCreationSource(v: unknown): v is TripCreationSource {
  return v === "weather_discovery" || v === "workspace";
}
''',
    '''function isTripCreationSource(v: unknown): v is TripCreationSource {
  return v === "weather_discovery" || v === "workspace";
}

function parseDiscoveryFunnelContext(
  obj: Record<string, unknown>,
): ValidationResult<DiscoveryFunnelContext> {
  const origin = obj.origin_id;
  if (!DISCOVERY_ORIGIN_IDS.includes(origin as DiscoveryOriginId)) {
    return failV("invalid_origin_id");
  }
  const mode = obj.transport_mode;
  if (!DISCOVERY_TRANSPORT_MODES.includes(mode as DiscoveryTransportMode)) {
    return failV("invalid_transport_mode");
  }
  const maxTravel = obj.max_travel_minutes;
  if (!DISCOVERY_MAX_TRAVEL_MINUTES.includes(maxTravel as 180 | 240 | 360 | 480 | 720)) {
    return failV("invalid_max_travel_minutes");
  }
  const departureBucket = obj.days_until_departure_bucket;
  if (!DAYS_UNTIL_DEPARTURE_BUCKETS.includes(departureBucket as DaysUntilDepartureBucket)) {
    return failV("invalid_days_until_departure_bucket");
  }
  const tripLength = obj.trip_length_days;
  if (!asBoundedPositiveInt(tripLength, 16)) return failV("invalid_trip_length_days");
  const rainLimit = obj.rain_limit_set;
  const windLimit = obj.wind_limit_set;
  const temperatureLimit = obj.temperature_limit_set;
  if (
    typeof rainLimit !== "boolean" ||
    typeof windLimit !== "boolean" ||
    typeof temperatureLimit !== "boolean"
  ) {
    return failV("invalid_limit_flags");
  }
  return okV({
    origin_id: origin as DiscoveryOriginId,
    transport_mode: mode as DiscoveryTransportMode,
    max_travel_minutes: maxTravel as 180 | 240 | 360 | 480 | 720,
    days_until_departure_bucket: departureBucket as DaysUntilDepartureBucket,
    trip_length_days: tripLength,
    rain_limit_set: rainLimit,
    wind_limit_set: windLimit,
    temperature_limit_set: temperatureLimit,
  });
}

function parseDiscoveryRetentionContext(
  obj: Record<string, unknown>,
): ValidationResult<DiscoveryRetentionEventContext> {
  const context = parseDiscoveryFunnelContext(obj);
  if (!context.ok) return context;
  const shortlistCount = obj.shortlist_count;
  if (!asBoundedNonNegativeInt(shortlistCount, 3)) return failV("invalid_shortlist_count");
  return okV({ ...context.value, shortlist_count: shortlistCount });
}

function parseOptionalDiscoveryFunnelContext(
  obj: Record<string, unknown>,
): ValidationResult<Partial<DiscoveryFunnelContext>> {
  const keys = [
    "origin_id",
    "transport_mode",
    "max_travel_minutes",
    "days_until_departure_bucket",
    "trip_length_days",
    "rain_limit_set",
    "wind_limit_set",
    "temperature_limit_set",
  ] as const;
  const present = keys.filter((key) => obj[key] !== undefined);
  if (present.length === 0) return okV({});
  if (present.length !== keys.length) return failV("incomplete_discovery_context");
  return parseDiscoveryFunnelContext(obj);
}
''',
)

replace_once(
    events_path,
    '''    case "weather_discovery_view":
      return okV<AnalyticsEvent>({ ...common, event: "weather_discovery_view" });

    case "destination_shortlisted": {
''',
    '''    case "weather_discovery_view":
      return okV<AnalyticsEvent>({ ...common, event: "weather_discovery_view" });

    case "discovery_query_submitted": {
      const context = parseDiscoveryFunnelContext(obj);
      if (!context.ok) return context;
      return okV<AnalyticsEvent>({
        ...common,
        ...context.value,
        event: "discovery_query_submitted",
      });
    }

    case "discovery_results_returned": {
      const context = parseDiscoveryFunnelContext(obj);
      if (!context.ok) return context;
      const reachableCount = obj.reachable_count;
      const resultCount = obj.result_count;
      if (!asBoundedPositiveInt(reachableCount, 100)) return failV("invalid_reachable_count");
      if (!asBoundedPositiveInt(resultCount, 3)) return failV("invalid_result_count");
      return okV<AnalyticsEvent>({
        ...common,
        ...context.value,
        event: "discovery_results_returned",
        reachable_count: reachableCount,
        result_count: resultCount,
      });
    }

    case "discovery_no_results": {
      const context = parseDiscoveryFunnelContext(obj);
      if (!context.ok) return context;
      const reachableCount = obj.reachable_count;
      if (!asBoundedNonNegativeInt(reachableCount, 100)) {
        return failV("invalid_reachable_count");
      }
      const reason = obj.no_result_reason;
      if (!DISCOVERY_NO_RESULT_REASONS.includes(reason as DiscoveryNoResultReason)) {
        return failV("invalid_no_result_reason");
      }
      return okV<AnalyticsEvent>({
        ...common,
        ...context.value,
        event: "discovery_no_results",
        reachable_count: reachableCount,
        no_result_reason: reason as DiscoveryNoResultReason,
      });
    }

    case "search_saved":
    case "saved_search_opened":
    case "saved_search_removed":
    case "share_link_copied": {
      const context = parseDiscoveryRetentionContext(obj);
      if (!context.ok) return context;
      return okV<AnalyticsEvent>({ ...common, ...context.value, event });
    }

    case "calendar_reminder_downloaded": {
      const context = parseDiscoveryRetentionContext(obj);
      if (!context.ok) return context;
      const reminderCount = obj.reminder_count;
      if (!asBoundedPositiveInt(reminderCount, 3)) return failV("invalid_reminder_count");
      return okV<AnalyticsEvent>({
        ...common,
        ...context.value,
        event: "calendar_reminder_downloaded",
        reminder_count: reminderCount,
      });
    }

    case "destination_shortlisted": {
''',
)

replace_once(
    events_path,
    '''      const position = obj.position;
      if (!asBoundedPositiveInt(position, 3)) return failV("invalid_position");
      return okV<AnalyticsEvent>({
        ...common,
        event: "destination_selected",
        destination_id: id,
        position,
      });
''',
    '''      const position = obj.position;
      if (!asBoundedPositiveInt(position, 3)) return failV("invalid_position");
      const context = parseOptionalDiscoveryFunnelContext(obj);
      if (!context.ok) return context;
      return okV<AnalyticsEvent>({
        ...common,
        ...context.value,
        event: "destination_selected",
        destination_id: id,
        position,
      });
''',
)

replace_once(
    events_path,
    '''    case "weather_discovery_view":
    case "weather_insight_opened":
      return {};
    case "destination_shortlisted":
      return { destination_id: e.destination_id };
    case "trip_created":
''',
    '''    case "weather_discovery_view":
    case "weather_insight_opened":
      return {};
    case "discovery_query_submitted":
      return { ...e };
    case "discovery_results_returned":
      return { ...e };
    case "discovery_no_results":
      return { ...e };
    case "search_saved":
    case "saved_search_opened":
    case "saved_search_removed":
    case "share_link_copied":
    case "calendar_reminder_downloaded":
      return { ...e };
    case "destination_shortlisted":
      return { destination_id: e.destination_id };
    case "destination_selected":
      return { ...e };
    case "trip_created":
''',
)

replace_once(
    events_path,
    '''/** Project an event into a bounded, PII-free observability log. */
export function toStructuredLog(event: AnalyticsEvent, requestId?: string): StructuredLog {
''',
    '''export interface AnalyticsEngineProjection {
  readonly indexes: readonly [string];
  readonly blobs: ReadonlyArray<string>;
  readonly doubles: ReadonlyArray<number>;
}

/**
 * Stable Analytics Engine schema. Empty strings and -1 mean “not applicable”.
 * The schema is documented in tooling/analytics/README.md and intentionally
 * contains no URL, account, user, session, device, email or free-text fields.
 */
export function projectAnalyticsEvent(event: AnalyticsEvent): AnalyticsEngineProjection {
  const fields = boundedFields(event);
  const text = (key: string): string =>
    typeof fields[key] === "string" ? (fields[key] as string) : "";
  const numeric = (key: string): number =>
    typeof fields[key] === "number" ? (fields[key] as number) : -1;
  const flag = (key: string): number =>
    typeof fields[key] === "boolean" ? (fields[key] ? 1 : 0) : -1;
  const destinationOrCity = text("destination_id") || text("city_id");
  const providerOrNetwork = text("provider_id") || text("network_id");
  const keyOrCountry = text("destination_key") || text("country_code");
  const positionOrRank = numeric("position") >= 0 ? numeric("position") : numeric("rank");
  const genericCount =
    numeric("destination_count") >= 0
      ? numeric("destination_count")
      : numeric("change_count");

  return {
    indexes: [event.event],
    blobs: [
      event.locale,
      event.route_template,
      text("origin_id"),
      text("transport_mode"),
      text("days_until_departure_bucket"),
      text("no_result_reason"),
      destinationOrCity,
      text("result_type"),
      text("source"),
      text("category"),
      text("placement"),
      providerOrNetwork,
      keyOrCountry,
      text("window"),
      text("theme"),
    ],
    doubles: [
      numeric("max_travel_minutes"),
      numeric("trip_length_days"),
      numeric("reachable_count"),
      numeric("result_count"),
      positionOrRank,
      numeric("shortlist_count"),
      numeric("reminder_count"),
      flag("rain_limit_set"),
      flag("wind_limit_set"),
      flag("temperature_limit_set"),
      genericCount,
      flag("fallback_included"),
    ],
  };
}

/** Project an event into a bounded, PII-free observability log. */
export function toStructuredLog(event: AnalyticsEvent, requestId?: string): StructuredLog {
''',
)

# Add contract tests for the new events and fixed Analytics Engine projection.
funnel_path = "packages/analytics/src/funnel-events.test.ts"
replace_once(
    funnel_path,
    '''      {
        ...common,
        event: "destination_shortlisted",
''',
    '''      {
        ...common,
        event: "discovery_query_submitted",
        route_template: "/discover",
        origin_id: "sg-singapore",
        transport_mode: "flight",
        max_travel_minutes: 360,
        days_until_departure_bucket: "3-7d",
        trip_length_days: 3,
        rain_limit_set: true,
        wind_limit_set: false,
        temperature_limit_set: false,
      },
      {
        ...common,
        event: "discovery_results_returned",
        route_template: "/discover",
        origin_id: "sg-singapore",
        transport_mode: "flight",
        max_travel_minutes: 360,
        days_until_departure_bucket: "3-7d",
        trip_length_days: 3,
        rain_limit_set: true,
        wind_limit_set: false,
        temperature_limit_set: false,
        reachable_count: 12,
        result_count: 3,
      },
      {
        ...common,
        event: "discovery_no_results",
        route_template: "/discover",
        origin_id: "hk-hong-kong",
        transport_mode: "flight",
        max_travel_minutes: 240,
        days_until_departure_bucket: "0-2d",
        trip_length_days: 2,
        rain_limit_set: true,
        wind_limit_set: true,
        temperature_limit_set: true,
        reachable_count: 0,
        no_result_reason: "no_reachable",
      },
      {
        ...common,
        event: "search_saved",
        route_template: "/discover",
        origin_id: "tw-taipei",
        transport_mode: "any",
        max_travel_minutes: 480,
        days_until_departure_bucket: "8-14d",
        trip_length_days: 4,
        rain_limit_set: false,
        wind_limit_set: false,
        temperature_limit_set: false,
        shortlist_count: 2,
      },
      {
        ...common,
        event: "calendar_reminder_downloaded",
        route_template: "/discover",
        origin_id: "tw-taipei",
        transport_mode: "any",
        max_travel_minutes: 480,
        days_until_departure_bucket: "8-14d",
        trip_length_days: 4,
        rain_limit_set: false,
        wind_limit_set: false,
        temperature_limit_set: false,
        shortlist_count: 2,
        reminder_count: 3,
      },
      {
        ...common,
        event: "destination_shortlisted",
''',
)

replace_once(
    funnel_path,
    '''import { validateAnalyticsEvent } from "./events";
''',
    '''import { projectAnalyticsEvent, validateAnalyticsEvent } from "./events";
''',
)

replace_once(
    funnel_path,
    '''  it("rejects itinerary text and sensitive user/session/location fields", () => {
''',
    '''  it("projects discovery events into a stable Analytics Engine schema", () => {
    const result = validateAnalyticsEvent({
      ...common,
      event: "discovery_results_returned",
      route_template: "/discover",
      origin_id: "sg-singapore",
      transport_mode: "flight",
      max_travel_minutes: 360,
      days_until_departure_bucket: "3-7d",
      trip_length_days: 3,
      rain_limit_set: true,
      wind_limit_set: false,
      temperature_limit_set: false,
      reachable_count: 12,
      result_count: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const point = projectAnalyticsEvent(result.value);
    expect(point.indexes).toEqual(["discovery_results_returned"]);
    expect(point.blobs).toHaveLength(15);
    expect(point.doubles).toHaveLength(12);
    expect(point.blobs.slice(0, 6)).toEqual([
      "en",
      "/discover",
      "sg-singapore",
      "flight",
      "3-7d",
      "",
    ]);
    expect(point.doubles.slice(0, 4)).toEqual([360, 3, 12, 3]);
  });

  it("rejects partial discovery context and invalid retention counts", () => {
    expect(
      validateAnalyticsEvent({
        ...common,
        event: "destination_selected",
        route_template: "/discover",
        destination_id: "jp-tokyo",
        position: 1,
        origin_id: "sg-singapore",
      }),
    ).toMatchObject({ ok: false, error: { code: "incomplete_discovery_context" } });
    expect(
      validateAnalyticsEvent({
        ...common,
        event: "search_saved",
        route_template: "/discover",
        origin_id: "sg-singapore",
        transport_mode: "flight",
        max_travel_minutes: 360,
        days_until_departure_bucket: "3-7d",
        trip_length_days: 3,
        rain_limit_set: false,
        wind_limit_set: false,
        temperature_limit_set: false,
        shortlist_count: 4,
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_shortlist_count" } });
  });

  it("rejects itinerary text and sensitive user/session/location fields", () => {
''',
)

# ---------------------------------------------------------------------------
# Browser transport and funnel dimension helper
# ---------------------------------------------------------------------------

write(
    "apps/web/src/analytics/browser-events.ts",
    '''import {
  validateAnalyticsEvent,
  type AnalyticsEvent,
  type AnalyticsLocale,
} from "@wnr/analytics";

export const WNR_ANALYTICS_BROWSER_EVENT = "wnr:analytics";

export type BrowserAnalyticsLocale = "en" | "zh-cn" | "zh-hant";

const PRODUCT_ANALYTICS_URL = (
  process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_URL ?? ""
).trim();

export function analyticsLocale(locale: BrowserAnalyticsLocale): AnalyticsLocale {
  return locale === "zh-hant" ? "zh-tw" : locale;
}

function transmitProductEvent(event: AnalyticsEvent, endpoint: string): void {
  if (endpoint.length === 0 || typeof window === "undefined") return;
  const payload = JSON.stringify(event);
  try {
    if (typeof navigator.sendBeacon === "function") {
      const accepted = navigator.sendBeacon(
        endpoint,
        new Blob([payload], { type: "text/plain;charset=UTF-8" }),
      );
      if (accepted) return;
    }
  } catch {
    // Fall through to keepalive fetch.
  }
  try {
    void fetch(endpoint, {
      method: "POST",
      body: payload,
      headers: { "content-type": "text/plain;charset=UTF-8" },
      mode: "cors",
      credentials: "omit",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics is always best-effort.
  }
}

/**
 * Validate a bounded analytics event first, expose it as a browser event for
 * local integrations, and best-effort forward it to the dedicated product
 * analytics Worker. The product path never depends on either sink.
 */
export function emitProductAnalytics(input: {
  readonly locale: BrowserAnalyticsLocale;
  readonly routeTemplate: "/discover" | "/trips/workspace";
  readonly fields: object;
  readonly now?: Date;
  readonly endpoint?: string;
}): boolean {
  const raw = {
    ...input.fields,
    event_version: 1,
    occurred_at: (input.now ?? new Date()).toISOString(),
    route_template: input.routeTemplate,
    locale: analyticsLocale(input.locale),
  };
  const result = validateAnalyticsEvent(raw);
  if (!result.ok) return false;
  if (typeof window === "undefined") return true;
  try {
    window.dispatchEvent(
      new CustomEvent(WNR_ANALYTICS_BROWSER_EVENT, {
        detail: result.value,
      }),
    );
  } catch {
    // Local listeners must never block or alter the product path.
  }
  transmitProductEvent(result.value, input.endpoint ?? PRODUCT_ANALYTICS_URL);
  return true;
}
''',
)

write(
    "apps/web/src/analytics/browser-events.test.ts",
    '''// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { emitProductAnalytics, WNR_ANALYTICS_BROWSER_EVENT } from "./browser-events";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("browser analytics bridge", () => {
  it("dispatches only an already-validated bounded event", () => {
    const listener = vi.fn();
    window.addEventListener(WNR_ANALYTICS_BROWSER_EVENT, listener);
    const accepted = emitProductAnalytics({
      locale: "zh-hant",
      routeTemplate: "/discover",
      fields: { event: "destination_shortlisted", destination_id: "jp-tokyo" },
      now: new Date("2026-08-09T15:45:00Z"),
    });

    expect(accepted).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({
      event: "destination_shortlisted",
      event_version: 1,
      occurred_at: "2026-08-09T15:45:00.000Z",
      route_template: "/discover",
      locale: "zh-tw",
      destination_id: "jp-tokyo",
    });
    window.removeEventListener(WNR_ANALYTICS_BROWSER_EVENT, listener);
  });

  it("uses sendBeacon for a validated event when an endpoint is configured", () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });

    const accepted = emitProductAnalytics({
      locale: "en",
      routeTemplate: "/discover",
      fields: { event: "weather_discovery_view" },
      now: new Date("2026-08-09T15:45:00Z"),
      endpoint: "https://analytics.example.test/api/v1/product-events",
    });

    expect(accepted).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]?.[0]).toBe(
      "https://analytics.example.test/api/v1/product-events",
    );
    expect(sendBeacon.mock.calls[0]?.[1]).toBeInstanceOf(Blob);
  });

  it("falls back to a non-blocking keepalive request when sendBeacon declines", () => {
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => false),
    });
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);

    expect(
      emitProductAnalytics({
        locale: "en",
        routeTemplate: "/discover",
        fields: { event: "weather_discovery_view" },
        endpoint: "https://analytics.example.test/api/v1/product-events",
      }),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://analytics.example.test/api/v1/product-events",
      expect.objectContaining({ method: "POST", keepalive: true, credentials: "omit" }),
    );
  });

  it("rejects privacy-sensitive payloads before browser dispatch or transport", () => {
    const listener = vi.fn();
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });
    window.addEventListener(WNR_ANALYTICS_BROWSER_EVENT, listener);
    const accepted = emitProductAnalytics({
      locale: "en",
      routeTemplate: "/trips/workspace",
      fields: {
        event: "replan_proposed",
        change_count: 1,
        fallback_included: false,
        activity_title: "Private itinerary detail",
      },
      now: new Date("2026-08-09T15:45:00Z"),
      endpoint: "https://analytics.example.test/api/v1/product-events",
    });

    expect(accepted).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
    window.removeEventListener(WNR_ANALYTICS_BROWSER_EVENT, listener);
  });
});
''',
)

write(
    "apps/web/src/analytics/discovery-funnel.ts",
    '''import type { DiscoveryFunnelContext } from "@wnr/analytics";
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
    max_travel_minutes: reachability.maxTravelMinutes,
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
''',
)

write(
    "apps/web/src/analytics/discovery-funnel.test.ts",
    '''import { describe, expect, it } from "vitest";
import {
  buildDiscoveryFunnelContext,
  daysUntilDepartureBucket,
  discoveryTripLengthDays,
} from "./discovery-funnel";

const preferences = {
  intent: "dry" as const,
  from: "2026-08-25",
  to: "2026-08-27",
  rainProbabilityMax: 40,
  temperatureMinC: null,
  temperatureMaxC: 31,
  windSpeedMaxKph: null,
  partyProfile: null,
  theme: null,
};

const reachability = {
  originId: "sg-singapore" as const,
  mode: "flight" as const,
  maxTravelMinutes: 360 as const,
};

describe("discovery funnel dimensions", () => {
  it("builds bounded, non-identifying dimensions", () => {
    expect(
      buildDiscoveryFunnelContext({
        preferences,
        reachability,
        now: new Date("2026-08-19T18:00:00Z"),
      }),
    ).toEqual({
      origin_id: "sg-singapore",
      transport_mode: "flight",
      max_travel_minutes: 360,
      days_until_departure_bucket: "3-7d",
      trip_length_days: 3,
      rain_limit_set: true,
      wind_limit_set: false,
      temperature_limit_set: true,
    });
  });

  it("uses stable departure buckets and inclusive trip length", () => {
    const now = new Date("2026-08-19T23:59:59Z");
    expect(daysUntilDepartureBucket("2026-08-21", now)).toBe("0-2d");
    expect(daysUntilDepartureBucket("2026-08-26", now)).toBe("3-7d");
    expect(daysUntilDepartureBucket("2026-09-02", now)).toBe("8-14d");
    expect(daysUntilDepartureBucket("2026-09-03", now)).toBe("15d+");
    expect(discoveryTripLengthDays("2026-08-25", "2026-08-27")).toBe(3);
  });
});
''',
)

# ---------------------------------------------------------------------------
# Discovery and retention instrumentation
# ---------------------------------------------------------------------------

planner = "apps/web/src/components/WeatherDiscoveryPlannerV2.tsx"
replace_once(
    planner,
    '''import { emitProductAnalytics } from "../analytics/browser-events";
''',
    '''import { emitProductAnalytics } from "../analytics/browser-events";
import { buildDiscoveryFunnelContext } from "../analytics/discovery-funnel";
''',
)
replace_once(
    planner,
    '''    details: "View city weather",
''',
    '''    details: "View city weather",
    measurementNote:
      "Anonymous product metrics record only bounded actions and aggregate counts — never an account, email, saved-search URL or itinerary text.",
''',
)
replace_once(
    planner,
    '''    details: "查看城市天气",
''',
    '''    details: "查看城市天气",
    measurementNote:
      "匿名产品指标只记录有限操作和聚合数量，不记录账号、邮箱、保存链接或行程正文。",
''',
)
replace_once(
    planner,
    '''    details: "查看城市天氣",
''',
    '''    details: "查看城市天氣",
    measurementNote:
      "匿名產品指標只記錄有限操作和彙總數量，不記錄帳號、信箱、儲存連結或行程正文。",
''',
)
replace_once(
    planner,
    '''  const discoveryViewTracked = useRef(false);
''',
    '''  const discoveryViewTracked = useRef(false);
  const reportedQuerySequence = useRef(0);
  const [querySequence, setQuerySequence] = useState(0);
''',
)
replace_once(
    planner,
    '''    eligibleCities,
    locale,
  ]);
''',
    '''    eligibleCities,
    locale,
    querySequence,
  ]);
''',
)
replace_once(
    planner,
    '''  const results = useMemo(() => rankedResults.slice(0, MAX_RESULTS), [rankedResults]);
''',
    '''  const results = useMemo(() => rankedResults.slice(0, MAX_RESULTS), [rankedResults]);

  useEffect(() => {
    if (
      querySequence === 0 ||
      state === "loading" ||
      reportedQuerySequence.current === querySequence
    ) {
      return;
    }
    const context = buildDiscoveryFunnelContext({
      preferences: applied,
      reachability: appliedReachability,
    });
    if (state === "error") {
      emitProductAnalytics({
        locale,
        routeTemplate: "/discover",
        fields: {
          event: "discovery_no_results",
          ...context,
          reachable_count: eligibleCities.length,
          no_result_reason: "forecast_unavailable",
        },
      });
    } else if (eligibleCities.length === 0) {
      emitProductAnalytics({
        locale,
        routeTemplate: "/discover",
        fields: {
          event: "discovery_no_results",
          ...context,
          reachable_count: 0,
          no_result_reason: "no_reachable",
        },
      });
    } else if (results.length === 0) {
      emitProductAnalytics({
        locale,
        routeTemplate: "/discover",
        fields: {
          event: "discovery_no_results",
          ...context,
          reachable_count: eligibleCities.length,
          no_result_reason: "weather_limits",
        },
      });
    } else {
      emitProductAnalytics({
        locale,
        routeTemplate: "/discover",
        fields: {
          event: "discovery_results_returned",
          ...context,
          reachable_count: eligibleCities.length,
          result_count: results.length,
        },
      });
    }
    reportedQuerySequence.current = querySequence;
  }, [
    applied,
    appliedReachability,
    eligibleCities.length,
    locale,
    querySequence,
    results.length,
    state,
  ]);
''',
)
replace_once(
    planner,
    '''    setSelectedDestinationId(null);
    window.localStorage.removeItem(SELECTED_DESTINATION_STORAGE_KEY);
    setApplied(draft);
    setAppliedReachability(draftReachability);
    updateUrl(draft, draftReachability, shortlist);
''',
    '''    const context = buildDiscoveryFunnelContext({
      preferences: draft,
      reachability: draftReachability,
    });
    emitProductAnalytics({
      locale,
      routeTemplate: "/discover",
      fields: { event: "discovery_query_submitted", ...context },
    });
    setSelectedDestinationId(null);
    window.localStorage.removeItem(SELECTED_DESTINATION_STORAGE_KEY);
    setState("loading");
    setMessage("");
    setApplied(draft);
    setAppliedReachability(draftReachability);
    setQuerySequence((current) => current + 1);
    updateUrl(draft, draftReachability, shortlist);
''',
)
replace_once(
    planner,
    '''  }, [copy.invalidRange, draft, draftReachability, shortlist, updateUrl]);
''',
    '''  }, [copy.invalidRange, draft, draftReachability, locale, shortlist, updateUrl]);
''',
)
replace_once(
    planner,
    '''          event: "destination_selected",
          destination_id: result.city.cityId,
          position,
''',
    '''          event: "destination_selected",
          ...buildDiscoveryFunnelContext({
            preferences: applied,
            reachability: appliedReachability,
          }),
          destination_id: result.city.cityId,
          position,
''',
)
replace_once(
    planner,
    '''          <p className="text-xs leading-5 text-muted">{copy.filtersShare}</p>
        </div>
''',
    '''          <p className="text-xs leading-5 text-muted">{copy.filtersShare}</p>
        </div>
        <p className="mt-3 max-w-3xl text-[11px] leading-5 text-muted">
          {copy.measurementNote}
        </p>
''',
)

retention = "apps/web/src/components/DiscoveryRetentionCompanion.tsx"
replace_once(
    retention,
    '''"use client";

import { useCallback''',
    '''"use client";

import { emitProductAnalytics } from "../analytics/browser-events";
import { buildDiscoveryFunnelContext } from "../analytics/discovery-funnel";
import { parseDiscoveryPreferences } from "../discovery/weather-discovery";
import { parseReachabilityPreferences } from "../discovery/reachability";
import { useCallback''',
)
replace_once(
    retention,
    '''function downloadCalendar(calendar: { readonly content: string; readonly filename: string }): void {
''',
    '''function retentionEventFields(search: SavedDiscoverySearch): object {
  const url = new URL(search.url, "https://868656.xyz");
  const preferences = parseDiscoveryPreferences(url.searchParams, {
    from: search.from,
    to: search.to,
  });
  const reachability = parseReachabilityPreferences(url.searchParams);
  return {
    ...buildDiscoveryFunnelContext({ preferences, reachability }),
    shortlist_count: discoveryShortlistFromSearch(url.searchParams).length,
  };
}

function downloadCalendar(calendar: { readonly content: string; readonly filename: string }): void {
''',
)
replace_once(
    retention,
    '''    persistSavedSearches(upsertSavedDiscoverySearch(savedSearches, next));
    setCurrentSearch(next);
    setStatus(existed ? copy.alreadySaved : copy.savedSearch);
''',
    '''    persistSavedSearches(upsertSavedDiscoverySearch(savedSearches, next));
    emitProductAnalytics({
      locale,
      routeTemplate: "/discover",
      fields: { event: "search_saved", ...retentionEventFields(next) },
    });
    setCurrentSearch(next);
    setStatus(existed ? copy.alreadySaved : copy.savedSearch);
''',
)
replace_once(
    retention,
    '''    persistSavedSearches,
    savedSearches,
  ]);
''',
    '''    locale,
    persistSavedSearches,
    savedSearches,
  ]);
''',
)
replace_once(
    retention,
    '''  const removeSavedSearch = useCallback(
    (id: string): void => {
      persistSavedSearches(savedSearches.filter((item) => item.id !== id));
      setStatus("");
    },
    [persistSavedSearches, savedSearches],
  );
''',
    '''  const removeSavedSearch = useCallback(
    (id: string): void => {
      const removed = savedSearches.find((item) => item.id === id);
      persistSavedSearches(savedSearches.filter((item) => item.id !== id));
      if (removed !== undefined) {
        emitProductAnalytics({
          locale,
          routeTemplate: "/discover",
          fields: { event: "saved_search_removed", ...retentionEventFields(removed) },
        });
      }
      setStatus("");
    },
    [locale, persistSavedSearches, savedSearches],
  );

  const openSavedSearch = useCallback(
    (search: SavedDiscoverySearch): void => {
      emitProductAnalytics({
        locale,
        routeTemplate: "/discover",
        fields: { event: "saved_search_opened", ...retentionEventFields(search) },
      });
      window.location.assign(search.url);
    },
    [locale],
  );
''',
)
replace_once(
    retention,
    '''        await navigator.clipboard.writeText(absoluteUrl(search.url));
        setStatus(copy.copied);
''',
    '''        await navigator.clipboard.writeText(absoluteUrl(search.url));
        emitProductAnalytics({
          locale,
          routeTemplate: "/discover",
          fields: { event: "share_link_copied", ...retentionEventFields(search) },
        });
        setStatus(copy.copied);
''',
)
replace_once(
    retention,
    '''    [copy.copied, copy.copyFailed],
''',
    '''    [copy.copied, copy.copyFailed, locale],
''',
)
replace_once(
    retention,
    '''      downloadCalendar(calendar);
      setStatus(copy.calendarDownloaded);
''',
    '''      downloadCalendar(calendar);
      emitProductAnalytics({
        locale,
        routeTemplate: "/discover",
        fields: {
          event: "calendar_reminder_downloaded",
          ...retentionEventFields(search),
          reminder_count: calendar.reminderCount,
        },
      });
      setStatus(copy.calendarDownloaded);
''',
)
replace_once(
    retention,
    '''                        onClick={() => window.location.assign(search.url)}
''',
    '''                        onClick={() => openSavedSearch(search)}
''',
)

# ---------------------------------------------------------------------------
# Dedicated Analytics Engine Worker
# ---------------------------------------------------------------------------

write(
    "workers/product-analytics/package.json",
    json.dumps(
        {
            "name": "@wnr/product-analytics",
            "version": "0.0.0",
            "private": True,
            "type": "module",
            "main": "./dist/index.js",
            "scripts": {
                "build": "tsc -p tsconfig.json",
                "typecheck": "tsc -p tsconfig.json --noEmit",
                "lint": "eslint .",
                "test": "vitest run",
                "cf-typegen": "wrangler types --env production",
            },
            "dependencies": {"@wnr/analytics": "workspace:*"},
            "devDependencies": {
                "@cloudflare/workers-types": "^5.20260804.1",
                "@wnr/eslint-config": "workspace:*",
                "@wnr/tsconfig": "workspace:*",
                "@wnr/vitest-config": "workspace:*",
            },
            "types": "./dist/index.d.ts",
            "exports": {".": {"types": "./dist/index.d.ts", "default": "./dist/index.js"}},
            "files": ["dist"],
        },
        indent=2,
    )
    + "\n",
)
write(
    "workers/product-analytics/tsconfig.json",
    '''{
  "extends": "@wnr/tsconfig/library.json",
  "include": ["src/**/*.ts", "worker-configuration.d.ts"],
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "types": ["@cloudflare/workers-types"]
  },
  "exclude": ["src/**/*.test.ts", "src/**/*.spec.ts", "dist", "node_modules"]
}
''',
)
write(
    "workers/product-analytics/vitest.config.ts",
    '''import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "node" } });
''',
)
write(
    "workers/product-analytics/wrangler.jsonc",
    '''{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "where-not-rain-product-analytics",
  "main": "./dist/src/index.js",
  "compatibility_date": "2026-08-19",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "logs": { "head_sampling_rate": 1 },
    "traces": { "enabled": true, "head_sampling_rate": 0.01 },
  },
  "vars": { "WEB_ORIGIN": "http://localhost:3000" },
  "analytics_engine_datasets": [
    { "binding": "PRODUCT_EVENTS", "dataset": "wnr_product_events_v1" },
  ],
  "env": {
    "preview": {
      "name": "where-not-rain-product-analytics-preview",
      "workers_dev": true,
      "vars": { "WEB_ORIGIN": "https://where-not-rain.pages.dev" },
      "analytics_engine_datasets": [
        { "binding": "PRODUCT_EVENTS", "dataset": "wnr_product_events_preview_v1" },
      ],
    },
    "production": {
      "name": "where-not-rain-product-analytics-production",
      "workers_dev": true,
      "routes": [{ "pattern": "analytics.868656.xyz", "custom_domain": true }],
      "vars": { "WEB_ORIGIN": "https://868656.xyz" },
      "analytics_engine_datasets": [
        { "binding": "PRODUCT_EVENTS", "dataset": "wnr_product_events_v1" },
      ],
    },
  },
}
''',
)
write(
    "workers/product-analytics/src/index.ts",
    '''import { projectAnalyticsEvent, validateAnalyticsEvent } from "@wnr/analytics";

const MAX_BODY_BYTES = 8192;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface ProductAnalyticsDependencies {
  readonly webOrigin: string;
  readonly now: () => Date;
  readonly writeDataPoint: (point: {
    readonly indexes: ReadonlyArray<string>;
    readonly blobs: ReadonlyArray<string>;
    readonly doubles: ReadonlyArray<number>;
  }) => void;
}

function corsHeaders(origin: string | null, allowedOrigin: string): Headers {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    vary: "Origin",
  });
  if (origin === allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
    headers.set("access-control-max-age", "86400");
  }
  return headers;
}

function json(
  value: unknown,
  status: number,
  origin: string | null,
  allowedOrigin: string,
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: corsHeaders(origin, allowedOrigin),
  });
}

async function readBoundedText(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let output = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      output += decoder.decode(value, { stream: true });
    }
    output += decoder.decode();
    return output;
  } finally {
    reader.releaseLock();
  }
}

function eventTimeIsAcceptable(occurredAt: string, now: Date): boolean {
  const eventTime = Date.parse(occurredAt);
  const current = now.getTime();
  return (
    Number.isFinite(eventTime) &&
    eventTime >= current - MAX_EVENT_AGE_MS &&
    eventTime <= current + MAX_FUTURE_SKEW_MS
  );
}

export async function handleProductAnalyticsRequest(
  request: Request,
  dependencies: ProductAnalyticsDependencies,
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");

  if (request.method === "GET" && url.pathname === "/health") {
    return json(
      { ok: true, service: "product-analytics", schemaVersion: 1, binding: true },
      200,
      origin,
      dependencies.webOrigin,
    );
  }

  if (request.method === "OPTIONS" && url.pathname === "/api/v1/product-events") {
    if (origin !== dependencies.webOrigin) {
      return json({ ok: false, error: "origin_not_allowed" }, 403, origin, dependencies.webOrigin);
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin, dependencies.webOrigin) });
  }

  if (request.method !== "POST" || url.pathname !== "/api/v1/product-events") {
    return json({ ok: false, error: "not_found" }, 404, origin, dependencies.webOrigin);
  }
  if (origin !== dependencies.webOrigin) {
    return json({ ok: false, error: "origin_not_allowed" }, 403, origin, dependencies.webOrigin);
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "text/plain" && contentType !== "application/json") {
    return json({ ok: false, error: "unsupported_media_type" }, 415, origin, dependencies.webOrigin);
  }

  const body = await readBoundedText(request, MAX_BODY_BYTES);
  if (body === null) {
    return json({ ok: false, error: "payload_too_large" }, 413, origin, dependencies.webOrigin);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, origin, dependencies.webOrigin);
  }
  const validated = validateAnalyticsEvent(raw);
  if (!validated.ok) {
    return json(
      { ok: false, error: validated.error.code },
      400,
      origin,
      dependencies.webOrigin,
    );
  }
  if (!eventTimeIsAcceptable(validated.value.occurred_at, dependencies.now())) {
    return json({ ok: false, error: "event_time_out_of_range" }, 400, origin, dependencies.webOrigin);
  }

  dependencies.writeDataPoint(projectAnalyticsEvent(validated.value));
  return json({ ok: true, accepted: true }, 202, origin, dependencies.webOrigin);
}

export default {
  fetch(request, env) {
    return handleProductAnalyticsRequest(request, {
      webOrigin: env.WEB_ORIGIN,
      now: () => new Date(),
      writeDataPoint: (point) => env.PRODUCT_EVENTS.writeDataPoint(point),
    });
  },
} satisfies ExportedHandler<Env>;
''',
)
write(
    "workers/product-analytics/src/index.test.ts",
    '''import { describe, expect, it, vi } from "vitest";
import { handleProductAnalyticsRequest } from "./index";

const endpoint = "https://analytics.868656.xyz/api/v1/product-events";
const allowedOrigin = "https://868656.xyz";
const event = {
  event: "discovery_results_returned",
  event_version: 1,
  occurred_at: "2026-08-19T12:00:00.000Z",
  route_template: "/discover",
  locale: "en",
  origin_id: "sg-singapore",
  transport_mode: "flight",
  max_travel_minutes: 360,
  days_until_departure_bucket: "3-7d",
  trip_length_days: 3,
  rain_limit_set: true,
  wind_limit_set: false,
  temperature_limit_set: false,
  reachable_count: 12,
  result_count: 3,
};

function dependencies() {
  const writeDataPoint = vi.fn();
  return {
    writeDataPoint,
    dependencies: {
      webOrigin: allowedOrigin,
      now: () => new Date("2026-08-19T12:01:00.000Z"),
      writeDataPoint,
    },
  };
}

function post(value: unknown, origin = allowedOrigin): Request {
  return new Request(endpoint, {
    method: "POST",
    headers: { origin, "content-type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(value),
  });
}

describe("product analytics Worker", () => {
  it("accepts one validated event and writes a bounded data point", async () => {
    const test = dependencies();
    const response = await handleProductAnalyticsRequest(post(event), test.dependencies);
    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
    expect(test.writeDataPoint).toHaveBeenCalledTimes(1);
    expect(test.writeDataPoint.mock.calls[0]?.[0]).toMatchObject({
      indexes: ["discovery_results_returned"],
    });
  });

  it("rejects an unapproved origin before storage", async () => {
    const test = dependencies();
    const response = await handleProductAnalyticsRequest(
      post(event, "https://evil.example"),
      test.dependencies,
    );
    expect(response.status).toBe(403);
    expect(test.writeDataPoint).not.toHaveBeenCalled();
  });

  it("rejects privacy fields, stale timestamps and oversized bodies", async () => {
    const privacy = dependencies();
    expect(
      (
        await handleProductAnalyticsRequest(
          post({ ...event, email: "private@example.com" }),
          privacy.dependencies,
        )
      ).status,
    ).toBe(400);
    expect(privacy.writeDataPoint).not.toHaveBeenCalled();

    const stale = dependencies();
    expect(
      (
        await handleProductAnalyticsRequest(
          post({ ...event, occurred_at: "2026-08-17T12:00:00.000Z" }),
          stale.dependencies,
        )
      ).status,
    ).toBe(400);

    const oversized = dependencies();
    const response = await handleProductAnalyticsRequest(
      new Request(endpoint, {
        method: "POST",
        headers: {
          origin: allowedOrigin,
          "content-type": "text/plain",
          "content-length": "9000",
        },
        body: JSON.stringify(event),
      }),
      oversized.dependencies,
    );
    expect(response.status).toBe(413);
  });

  it("exposes health and restrictive preflight responses", async () => {
    const test = dependencies();
    const health = await handleProductAnalyticsRequest(
      new Request("https://analytics.868656.xyz/health"),
      test.dependencies,
    );
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, service: "product-analytics" });

    const options = await handleProductAnalyticsRequest(
      new Request(endpoint, { method: "OPTIONS", headers: { origin: allowedOrigin } }),
      test.dependencies,
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
  });
});
''',
)

# ---------------------------------------------------------------------------
# SQL cookbook, product plan and security boundary
# ---------------------------------------------------------------------------

write(
    "tooling/analytics/README.md",
    '''# OPC product funnel analytics

Dataset: `wnr_product_events_v1`

The product-analytics Worker accepts one allowlisted event per request, validates it with
`@wnr/analytics`, rejects sensitive fields and writes a fixed Analytics Engine row. No raw URL,
query string, free text, account, email, user ID, session ID, device ID, IP address or itinerary
content is stored.

## Fixed schema

| Column | Meaning |
|---|---|
| `index1` | event name / sampling index |
| `blob1` | locale |
| `blob2` | route template |
| `blob3` | origin ID |
| `blob4` | transport mode |
| `blob5` | days-until-departure bucket |
| `blob6` | no-result reason |
| `blob7` | destination or city ID |
| `blob8` | result type |
| `blob9` | creation source |
| `blob10` | affiliate category |
| `blob11` | placement |
| `blob12` | provider or network ID |
| `blob13` | destination key or country code |
| `blob14` | ranking window |
| `blob15` | ranking theme |
| `double1` | maximum one-way planning minutes |
| `double2` | trip length days |
| `double3` | reachable destination count |
| `double4` | returned result count |
| `double5` | result position or rank |
| `double6` | shortlist count |
| `double7` | calendar reminder count |
| `double8` | rain limit set (`1`/`0`, `-1` N/A) |
| `double9` | wind limit set (`1`/`0`, `-1` N/A) |
| `double10` | temperature limit set (`1`/`0`, `-1` N/A) |
| `double11` | generic bounded count |
| `double12` | fallback flag (`1`/`0`, `-1` N/A) |

Use `SUM(_sample_interval)` for event counts. The SQL files in this directory are deliberately
small and can be submitted to the Cloudflare Analytics Engine SQL API without a dashboard.
''',
)
write(
    "tooling/analytics/funnel.sql",
    '''SELECT
  index1 AS event,
  SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE timestamp >= NOW() - INTERVAL '14' DAY
  AND index1 IN (
    'weather_discovery_view',
    'discovery_query_submitted',
    'discovery_results_returned',
    'discovery_no_results',
    'search_result_clicked',
    'destination_shortlisted',
    'destination_selected',
    'search_saved',
    'saved_search_opened',
    'share_link_copied',
    'calendar_reminder_downloaded',
    'affiliate_click'
  )
GROUP BY event
ORDER BY events DESC;
''',
)
write(
    "tooling/analytics/origin-demand.sql",
    '''SELECT
  blob3 AS origin_id,
  blob4 AS transport_mode,
  double1 AS max_travel_minutes,
  SUM(_sample_interval) AS submitted_queries
FROM wnr_product_events_v1
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND index1 = 'discovery_query_submitted'
GROUP BY origin_id, transport_mode, max_travel_minutes
ORDER BY submitted_queries DESC;
''',
)
write(
    "tooling/analytics/zero-result.sql",
    '''SELECT
  blob3 AS origin_id,
  blob4 AS transport_mode,
  blob6 AS no_result_reason,
  SUM(_sample_interval) AS no_result_queries
FROM wnr_product_events_v1
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND index1 = 'discovery_no_results'
GROUP BY origin_id, transport_mode, no_result_reason
ORDER BY no_result_queries DESC;
''',
)
write(
    "tooling/analytics/retention.sql",
    '''SELECT
  index1 AS retention_event,
  blob3 AS origin_id,
  SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND index1 IN (
    'search_saved',
    'saved_search_opened',
    'saved_search_removed',
    'share_link_copied',
    'calendar_reminder_downloaded'
  )
GROUP BY retention_event, origin_id
ORDER BY events DESC;
''',
)
write(
    "tooling/analytics/commercial.sql",
    '''SELECT
  index1 AS commercial_event,
  blob10 AS category,
  blob11 AS placement,
  blob12 AS provider_id,
  SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND index1 IN ('affiliate_impression', 'affiliate_click')
GROUP BY commercial_event, category, placement, provider_id
ORDER BY events DESC;
''',
)
write(
    "docs/superpowers/plans/2026-08-19-opc-product-analytics-phase25.md",
    '''# OPC Phase 2.5 — Product funnel analytics

## Goal

Measure the current least-rain destination loop before adding more product surface:

```text
view → submit → result / no result → interact → select → save / reopen / share / recheck → commerce
```

## Scope

- dedicated `product-analytics` Cloudflare Worker;
- one allowlisted event per request;
- Workers Analytics Engine dataset `wnr_product_events_v1`;
- bounded dimensions for origin, transport, travel-time bucket, trip window, result counts and
  explicit weather-limit flags;
- saved-search, reopen, copy-link and calendar reminder events;
- versioned SQL queries for funnel, origin demand, zero-result diagnosis, retention and commerce;
- production health and deployment gates.

## Privacy boundary

The collector stores no account, email, IP, user/session/device identifier, raw URL, query string,
free text, saved-search URL, itinerary or precise location. Payloads are capped at 8 KiB, validated
by the shared analytics allowlist, accepted only from the canonical web origin and rejected when
stale or materially future-dated.

## Explicitly out of scope

- analytics dashboard;
- cross-day user identity or cohort fingerprinting;
- account or cookie-based attribution;
- email, Web Push or scheduled notification delivery;
- new destination, planning, collaboration or booking features.

## Validation gate

After release, freeze major product work until both conditions are met:

- at least 14 days of collection;
- at least 300 discovery views and 100 submitted discovery queries.

Phase 3 must be selected from measured evidence rather than implemented as a feature bundle.
''',
)

# Allow the dedicated endpoint through the specific CSP connect boundary.
replace_once(
    "apps/web/src/security/controls.ts",
    '  "connect-src \'self\'",\n',
    '  "connect-src \'self\' https://analytics.868656.xyz",\n',
)
replace_once(
    "apps/web/src/security/controls.test.ts",
    '''    expect(h["Content-Security-Policy"]).toContain("object-src 'none'");
''',
    '''    expect(h["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(h["Content-Security-Policy"]).toContain(
      "connect-src 'self' https://analytics.868656.xyz",
    );
''',
)

# Retention static contract now requires analytics ownership of all actions.
contract = "apps/web/src/components/discovery-retention-contract.test.ts"
replace_once(
    contract,
    '''  it("tracks destination detail opens through the existing allowlisted event", () => {
''',
    '''  it("tracks bounded save, reopen, share and calendar actions", () => {
    expect(companion).toContain('event: "search_saved"');
    expect(companion).toContain('event: "saved_search_opened"');
    expect(companion).toContain('event: "saved_search_removed"');
    expect(companion).toContain('event: "share_link_copied"');
    expect(companion).toContain('event: "calendar_reminder_downloaded"');
    expect(companion).toContain("retentionEventFields");
  });

  it("does not duplicate destination detail analytics", () => {
''',
)
replace_once(
    contract,
    '''    expect(companion).toContain('event: "search_result_clicked"');
    expect(companion).toContain('result_type: "city"');
    expect(companion).toContain("article.destination-card");
''',
    '''    expect(companion).not.toContain('event: "search_result_clicked"');
    expect(companion).not.toContain("article.destination-card");
''',
)

# ---------------------------------------------------------------------------
# CI/CD and production validation
# ---------------------------------------------------------------------------

for workflow in [".github/workflows/pr-ci.yml", ".github/workflows/deploy.yml"]:
    replace_once(
        workflow,
        '''          pnpm --filter @wnr/weather-read build
          pnpm --filter @wnr/trip-api build
''',
        '''          pnpm --filter @wnr/weather-read build
          pnpm --filter @wnr/trip-api build
          pnpm --filter @wnr/product-analytics build
''',
    )
    replace_once(
        workflow,
        '''apps/web/out apps/web/src workers/trip-api/src''',
        '''apps/web/out apps/web/src workers/trip-api/src workers/product-analytics/src''',
    )

replace_once(
    ".github/workflows/deploy.yml",
    '''  TRIP_PRODUCTION_URL: "https://trip.868656.xyz"
''',
    '''  TRIP_PRODUCTION_URL: "https://trip.868656.xyz"
  PRODUCT_ANALYTICS_URL: "https://analytics.868656.xyz/api/v1/product-events"
''',
)
replace_once(
    ".github/workflows/deploy.yml",
    '''          NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: ${{ secrets.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN }}
''',
    '''          NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: ${{ secrets.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN }}
          NEXT_PUBLIC_PRODUCT_ANALYTICS_URL: ${{ env.PRODUCT_ANALYTICS_URL }}
''',
)
replace_once(
    ".github/workflows/deploy.yml",
    '''      - name: Apply Trip D1 migrations
''',
    '''      - name: Deploy product-analytics Worker
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: pnpm --filter @wnr/product-analytics exec wrangler deploy --env production

      - name: Apply Trip D1 migrations
''',
)

replace_once(
    ".github/workflows/refresh-weather.yml",
    '''          NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: ${{ secrets.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN }}
''',
    '''          NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: ${{ secrets.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN }}
          NEXT_PUBLIC_PRODUCT_ANALYTICS_URL: https://analytics.868656.xyz/api/v1/product-events
''',
)

replace_once(
    ".github/workflows/production-smoke.yml",
    '''  TRIP_URL: "https://trip.868656.xyz"
''',
    '''  TRIP_URL: "https://trip.868656.xyz"
  ANALYTICS_URL: "https://analytics.868656.xyz"
''',
)
replace_once(
    ".github/workflows/production-smoke.yml",
    '''              && curl --fail --silent --show-error "${READ_URL}/health" >/tmp/read-health.json; then
''',
    '''              && curl --fail --silent --show-error "${READ_URL}/health" >/tmp/read-health.json \\
              && curl --fail --silent --show-error "${ANALYTICS_URL}/health" >/tmp/analytics-health.json; then
''',
)
replace_once(
    ".github/workflows/production-smoke.yml",
    '''          fetch_and_match "Protected sync health" "${SYNC_URL}/health" /tmp/sync-health.json \\
            '\"manualTriggerProtected\":true'
''',
    '''          fetch_and_match "Protected sync health" "${SYNC_URL}/health" /tmp/sync-health.json \\
            '\"manualTriggerProtected\":true'
          fetch_and_match "Product analytics health" "${ANALYTICS_URL}/health" /tmp/product-analytics-health.json \\
            '\"ok\":true' '\"service\":\"product-analytics\"' '\"schemaVersion\":1'
''',
)
replace_once(
    ".github/workflows/production-smoke.yml",
    '''          pnpm --filter @wnr/web exec vitest run \\
            src/analytics/browser-events.test.ts \\
            src/commercial/contextual-affiliate.test.ts \\
            src/components/phase9-commercial-surface-contract.test.ts
''',
    '''          pnpm --filter @wnr/web exec vitest run \\
            src/analytics/browser-events.test.ts \\
            src/analytics/discovery-funnel.test.ts \\
            src/commercial/contextual-affiliate.test.ts \\
            src/components/phase9-commercial-surface-contract.test.ts
          pnpm --filter @wnr/product-analytics test
''',
)

# Deployment contract requires the new Worker and the daily build-time endpoint.
replace_once(
    "tooling/deploy/pipeline-contract.test.mjs",
    '''test("artifact identity is deterministic and content-sensitive", () => {
''',
    '''test("production workflows keep product analytics deployed and embedded", () => {
  const deploy = readFileSync(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8");
  const refresh = readFileSync(
    new URL("../../.github/workflows/refresh-weather.yml", import.meta.url),
    "utf8",
  );
  const smoke = readFileSync(
    new URL("../../.github/workflows/production-smoke.yml", import.meta.url),
    "utf8",
  );
  assert.match(deploy, /Deploy product-analytics Worker/u);
  assert.match(deploy, /NEXT_PUBLIC_PRODUCT_ANALYTICS_URL/u);
  assert.match(refresh, /NEXT_PUBLIC_PRODUCT_ANALYTICS_URL/u);
  assert.match(smoke, /Product analytics health/u);
});

test("artifact identity is deterministic and content-sensitive", () => {
''',
)
replace_once(
    "tooling/deploy/pipeline-contract.test.mjs",
    '''import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
''',
    '''import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
''',
)

# README documents the measurement freeze.
replace_once(
    "README.md",
    '''## Current product direction
''',
    '''## Current product direction

Phase 2.5 adds privacy-safe aggregate funnel measurement through a dedicated Cloudflare Worker and
Workers Analytics Engine. Major product surface stays frozen until the validation sample gate is met.
''',
)

print("OPC analytics Phase 2.5 implementation applied")
