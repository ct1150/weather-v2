// @wnr/analytics — versioned allowlisted analytics events, privacy-safe
// validation, a non-blocking sink, and structured observability logs.
//
// Authority: GROW-ANALYTICS-001, ENG-PRIVACY-001, ENG-OBSERVABILITY-001.
//
// Design guarantees:
//  - **Allowlisted**: only event_version 1 with the exact common +
//    per-event fields is accepted. Unknown event names, non-1 versions,
//    missing/wrong-typed/outsider-enum fields are rejected. Unknown extra
//    fields are DISCARDED before storage/forwarding.
//  - **Privacy-safe**: IP, precise location, email, full User-Agent,
//    cookie, credential, and reversible identifiers are rejected. Raw
//    search terms are never uploaded — an unmatched destination key
//    collapses to "other" at the search layer and free text is rejected.
//  - **Non-blocking**: emission never throws to the caller and never
//    blocks navigation / core use.
//  - **Observability**: structured logs use the bounded common fields
//    (timestamp UTC, level, service, requestId/runId, event,
//    durationMs, status, errorCode) and bounded event dimensions only.
// No real network call is made here.

// Reuse the canonical commercial + locale vocabulary from the affiliate
// adapter so the package has a single source of truth (no duplicate
// `AnalyticsLocale` / `AffiliateImpressionEvent` exports at the index).
import type {
  CommercialCategory,
  Placement,
  AnalyticsLocale,
  AffiliateImpressionEvent as AffiliateImpressionTelemetry,
  AffiliateClickEvent as AffiliateClickedTelemetry,
} from "./affiliate-adapter";

/** The analytics-envelope fields added on top of a commercial descriptor. */
type AffiliateTelemetryCommon = {
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
};

export type AnalyticsTheme =
  | "general"
  | "outdoor"
  | "beach"
  | "walking"
  | "hiking"
  | "camping"
  | "family"
  | "photography"
  | "night_view"
  | "food_trip"
  | "shopping"
  | "theme_park"
  | "mountain";

export type AnalyticsWindow = "today" | "tomorrow" | "weekend" | "next_week";

export type SearchResultType = "city" | "country" | "article";

export interface SearchSubmittedEvent {
  readonly event: "search_submitted";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly destination_key: string;
  readonly result_count: number;
}

export interface SearchResultClickedEvent {
  readonly event: "search_result_clicked";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly destination_id: string;
  readonly result_type: SearchResultType;
  readonly position: number;
}

export interface CityViewedEvent {
  readonly event: "city_viewed";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly city_id: string;
  readonly country_code: string;
}

export interface CountryViewedEvent {
  readonly event: "country_viewed";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly country_code: string;
}

export interface RankingViewedEvent {
  readonly event: "ranking_viewed";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly theme: AnalyticsTheme;
  readonly window: AnalyticsWindow;
}

export interface RankingCityClickedEvent {
  readonly event: "ranking_city_clicked";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly theme: AnalyticsTheme;
  readonly window: AnalyticsWindow;
  readonly city_id: string;
  readonly rank: number;
}

// The commercial descriptor shapes `AffiliateImpressionEvent` /
// `AffiliateClickEvent` (and `AnalyticsLocale`) are owned by the affiliate
// adapter; the telemetry union composes them with the analytics envelope
// fields above. They are intentionally NOT re-exported here to avoid a
// duplicate-name collision at the package barrel.

export interface AdImpressionEvent {
  readonly event: "ad_impression";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly network_id: string;
  readonly placement: Placement;
}

export type AnalyticsEvent =
  | SearchSubmittedEvent
  | SearchResultClickedEvent
  | CityViewedEvent
  | CountryViewedEvent
  | RankingViewedEvent
  | RankingCityClickedEvent
  | (AffiliateImpressionTelemetry & AffiliateTelemetryCommon)
  | (AffiliateClickedTelemetry & AffiliateTelemetryCommon)
  | AdImpressionEvent;

// ---------------------------------------------------------------------------
// Allowlists
// ---------------------------------------------------------------------------

export const ANALYTICS_LOCALES: ReadonlyArray<AnalyticsLocale> = Object.freeze([
  "en",
  "ja",
  "ko",
  "zh-cn",
  "zh-tw",
]);

export const ANALYTICS_THEMES: ReadonlyArray<AnalyticsTheme> = Object.freeze([
  "general",
  "outdoor",
  "beach",
  "walking",
  "hiking",
  "camping",
  "family",
  "photography",
  "night_view",
  "food_trip",
  "shopping",
  "theme_park",
  "mountain",
]);

export const ANALYTICS_WINDOWS: ReadonlyArray<AnalyticsWindow> = Object.freeze([
  "today",
  "tomorrow",
  "weekend",
  "next_week",
]);

export const SEARCH_RESULT_TYPES: ReadonlyArray<SearchResultType> = Object.freeze([
  "city",
  "country",
  "article",
]);

/** Bounded, known route templates (never raw URLs or query strings). */
export const KNOWN_ROUTE_TEMPLATES: ReadonlyArray<string> = Object.freeze([
  "/",
  "/explore",
  "/search",
  "/best-weather",
  "/best-weekend",
  "/best-beach",
  "/best-hiking",
  "/best-family",
  "/best-photo",
  "/[country]",
  "/[country]/[city]",
  "/compare/[cityA]-vs-[cityB]",
  "/[country]/[city]/forecast",
  "/article/[slug]",
]);

const EVENT_NAMES: ReadonlyArray<AnalyticsEvent["event"]> = Object.freeze([
  "search_submitted",
  "search_result_clicked",
  "city_viewed",
  "country_viewed",
  "ranking_viewed",
  "ranking_city_clicked",
  "affiliate_impression",
  "affiliate_click",
  "ad_impression",
]);

const UTC_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u;

const DESTINATION_KEY_RE = /^[a-z0-9][a-z0-9_-]*$/u;

/** Forbidden privacy fields: IP, location, email, UA, cookie, credential, id. */
const PRIVACY_RE =
  /(^|_)(ip|ip_address|location|lat|lng|latitude|longitude|email|user_agent|cookie|authorization|api_key|secret|password|credential|user_id|session_id|device_id|phone|name|address)(_|$)/iu;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  readonly code: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ValidationError };

function okV<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function failV(code: string): ValidationResult<never> {
  return { ok: false, error: { code } };
}

function asString(v: unknown): v is string {
  return typeof v === "string";
}

function asNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function asPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function asUppercaseIso2(v: unknown): v is string {
  return typeof v === "string" && /^[A-Z]{2}$/u.test(v);
}

function isLocale(v: unknown): v is AnalyticsLocale {
  return (ANALYTICS_LOCALES as ReadonlyArray<string>).includes(v as string);
}

function isTheme(v: unknown): v is AnalyticsTheme {
  return (ANALYTICS_THEMES as ReadonlyArray<string>).includes(v as string);
}

function isWindow(v: unknown): v is AnalyticsWindow {
  return (ANALYTICS_WINDOWS as ReadonlyArray<string>).includes(v as string);
}

function isResultType(v: unknown): v is SearchResultType {
  return (SEARCH_RESULT_TYPES as ReadonlyArray<string>).includes(v as string);
}

function isCategory(v: unknown): v is CommercialCategory {
  return (
    ["hotel", "activities", "flights", "sim", "insurance", "car_rental"] as ReadonlyArray<string>
  ).includes(v as string);
}

function isPlacement(v: unknown): v is Placement {
  return (
    ["homepage", "city_page", "article", "sidebar", "between_sections"] as ReadonlyArray<string>
  ).includes(v as string);
}

function isDestinationId(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

/**
 * Validate and normalize a raw analytics event into the allowlisted
 * {@link AnalyticsEvent}. Rejects unknown events, non-1 versions,
 * malformed common fields, wrong-typed/outsider per-event fields, and any
 * privacy-forbidden key. Unknown extra fields are silently discarded
 * (the returned object carries only the known bounded fields).
 */
export function validateAnalyticsEvent(raw: unknown): ValidationResult<AnalyticsEvent> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return failV("invalid_shape");
  }
  const obj = raw as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (PRIVACY_RE.test(key)) return failV("privacy_field_present");
  }

  const event = obj.event;
  if (!asString(event) || !(EVENT_NAMES as ReadonlyArray<string>).includes(event)) {
    return failV("unknown_event");
  }

  const version = obj.event_version;
  if (typeof version !== "number" || !Number.isInteger(version) || version !== 1) {
    return failV("unsupported_version");
  }

  const occurred = obj.occurred_at;
  if (!asString(occurred) || !UTC_ISO_RE.test(occurred)) {
    return failV("invalid_occurred_at");
  }

  const routeTemplate = obj.route_template;
  if (
    !asString(routeTemplate) ||
    !(KNOWN_ROUTE_TEMPLATES as ReadonlyArray<string>).includes(routeTemplate)
  ) {
    return failV("invalid_route_template");
  }

  const locale = obj.locale;
  if (!isLocale(locale)) return failV("invalid_locale");

  return buildPayload(event as AnalyticsEvent["event"], obj, occurred, routeTemplate, locale);
}

function buildPayload(
  event: AnalyticsEvent["event"],
  obj: Record<string, unknown>,
  occurredAt: string,
  routeTemplate: string,
  locale: AnalyticsLocale,
): ValidationResult<AnalyticsEvent> {
  const common = {
    event_version: 1 as const,
    occurred_at: occurredAt,
    route_template: routeTemplate,
    locale,
  };

  switch (event) {
    case "search_submitted": {
      const key = obj.destination_key;
      // Raw unmatched free text is rejected; only a dictionary key or "other" passes.
      if (!asString(key) || (key !== "other" && !DESTINATION_KEY_RE.test(key))) {
        return failV("raw_search_term_rejected");
      }
      const count = obj.result_count;
      if (!asNonNegativeInt(count)) return failV("invalid_result_count");
      return okV<AnalyticsEvent>({
        ...common,
        event: "search_submitted",
        destination_key: key,
        result_count: count,
      });
    }

    case "search_result_clicked": {
      const id = obj.destination_id;
      if (!asString(id)) return failV("invalid_destination_id");
      const type = obj.result_type;
      if (!isResultType(type)) return failV("invalid_result_type");
      const pos = obj.position;
      if (!asPositiveInt(pos)) return failV("invalid_position");
      return okV<AnalyticsEvent>({
        ...common,
        event: "search_result_clicked",
        destination_id: id,
        result_type: type,
        position: pos,
      });
    }

    case "city_viewed": {
      const id = obj.city_id;
      if (!asString(id)) return failV("invalid_city_id");
      const cc = obj.country_code;
      if (!asUppercaseIso2(cc)) return failV("invalid_country_code");
      return okV<AnalyticsEvent>({
        ...common,
        event: "city_viewed",
        city_id: id,
        country_code: cc,
      });
    }

    case "country_viewed": {
      const cc = obj.country_code;
      if (!asUppercaseIso2(cc)) return failV("invalid_country_code");
      return okV<AnalyticsEvent>({
        ...common,
        event: "country_viewed",
        country_code: cc,
      });
    }

    case "ranking_viewed": {
      const theme = obj.theme;
      if (!isTheme(theme)) return failV("invalid_theme");
      const win = obj.window;
      if (!isWindow(win)) return failV("invalid_window");
      return okV<AnalyticsEvent>({
        ...common,
        event: "ranking_viewed",
        theme,
        window: win,
      });
    }

    case "ranking_city_clicked": {
      const theme = obj.theme;
      if (!isTheme(theme)) return failV("invalid_theme");
      const win = obj.window;
      if (!isWindow(win)) return failV("invalid_window");
      const id = obj.city_id;
      if (!asString(id)) return failV("invalid_city_id");
      const rank = obj.rank;
      if (!asPositiveInt(rank)) return failV("invalid_rank");
      return okV<AnalyticsEvent>({
        ...common,
        event: "ranking_city_clicked",
        theme,
        window: win,
        city_id: id,
        rank,
      });
    }

    case "affiliate_impression":
    case "affiliate_click": {
      const pid = obj.provider_id;
      if (!asString(pid)) return failV("invalid_provider_id");
      const cat = obj.category;
      if (!isCategory(cat)) return failV("invalid_category");
      const pl = obj.placement;
      if (!isPlacement(pl)) return failV("invalid_placement");
      const did = obj.destination_id;
      if (!isDestinationId(did)) return failV("invalid_destination_id");
      const base = {
        ...common,
        provider_id: pid,
        category: cat,
        placement: pl,
        destination_id: did,
      };
      return okV<AnalyticsEvent>(
        event === "affiliate_impression"
          ? { ...base, event: "affiliate_impression" }
          : { ...base, event: "affiliate_click" },
      );
    }

    case "ad_impression": {
      const nid = obj.network_id;
      if (!asString(nid)) return failV("invalid_network_id");
      const pl = obj.placement;
      if (!isPlacement(pl)) return failV("invalid_placement");
      return okV<AnalyticsEvent>({
        ...common,
        event: "ad_impression",
        network_id: nid,
        placement: pl,
      });
    }

    default:
      return failV("unknown_event");
  }
}

// ---------------------------------------------------------------------------
// Non-blocking sink + structured observability (ENG-OBSERVABILITY-001)
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface StructuredLog {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly requestId?: string;
  readonly runId?: string;
  readonly event: string;
  readonly durationMs?: number;
  readonly status: string;
  readonly errorCode: string | null;
  readonly [key: string]: unknown;
}

export interface StructuredLogInput {
  readonly level: LogLevel;
  readonly service: string;
  readonly requestId?: string;
  readonly runId?: string;
  readonly event: string;
  readonly durationMs?: number;
  readonly status: string;
  readonly errorCode: string | null;
  readonly extra?: Readonly<Record<string, unknown>>;
}

/**
 * Build a structured log with the common bounded fields (ENG-OBSERVABILITY-001).
 * Timestamp is UTC; values are bounded; no raw URL/query/PII is allowed.
 */
export function makeStructuredLog(input: StructuredLogInput): StructuredLog {
  // Build via a mutable bag, then cast: the index signature on
  // `StructuredLog` is readonly, so we must not assign through it.
  const log: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: input.level,
    service: input.service,
    event: input.event,
    status: input.status,
    errorCode: input.errorCode,
  };
  if (input.requestId !== undefined) log.requestId = input.requestId;
  if (input.runId !== undefined) log.runId = input.runId;
  if (input.durationMs !== undefined) log.durationMs = input.durationMs;
  if (input.extra !== undefined) {
    for (const [k, v] of Object.entries(input.extra)) {
      log[k] = v;
    }
  }
  return log as StructuredLog;
}

function boundedFields(e: AnalyticsEvent): Record<string, unknown> {
  switch (e.event) {
    case "search_submitted":
      return { destination_key: e.destination_key, result_count: e.result_count };
    case "search_result_clicked":
      return { destination_id: e.destination_id, result_type: e.result_type, position: e.position };
    case "city_viewed":
      return { city_id: e.city_id, country_code: e.country_code };
    case "country_viewed":
      return { country_code: e.country_code };
    case "ranking_viewed":
      return { theme: e.theme, window: e.window };
    case "ranking_city_clicked":
      return { theme: e.theme, window: e.window, city_id: e.city_id, rank: e.rank };
    case "affiliate_impression":
    case "affiliate_click":
      return {
        provider_id: e.provider_id,
        category: e.category,
        placement: e.placement,
        destination_id: e.destination_id,
      };
    case "ad_impression":
      return { network_id: e.network_id, placement: e.placement };
    default:
      return {};
  }
}

/** Project an event into a bounded, PII-free observability log. */
export function toStructuredLog(event: AnalyticsEvent, requestId?: string): StructuredLog {
  const input: StructuredLogInput = {
    level: "info",
    service: "analytics",
    event: event.event,
    status: "emitted",
    errorCode: null,
    extra: boundedFields(event),
    // exactOptionalPropertyTypes: omit the key entirely when absent.
    ...(requestId !== undefined ? { requestId } : {}),
  };
  return makeStructuredLog(input);
}

/** A sink receives already-validated events. */
export interface AnalyticsSink {
  emit(event: AnalyticsEvent): void | Promise<void>;
}

export interface DispatchOptions {
  readonly sink: AnalyticsSink;
  readonly requestId?: string;
  readonly onRejected?: (log: StructuredLog) => void;
}

/**
 * Validate and best-effort emit an event. Invalid events are rejected (a
 * structured log is surfaced via `onRejected`) and never forwarded. Emission
 * failures are swallowed so analytics can NEVER block navigation or core
 * use (GROW-ANALYTICS-001 / ENG-PRIVACY-001). Returns whether the
 * event was accepted.
 */
export function dispatchEvent(raw: unknown, opts: DispatchOptions): boolean {
  const result = validateAnalyticsEvent(raw);
  if (!result.ok) {
    const rejectedInput: StructuredLogInput = {
      level: "warn",
      service: "analytics",
      event: "analytics_rejected",
      status: "rejected",
      errorCode: result.error.code,
      ...(opts.requestId !== undefined ? { requestId: opts.requestId } : {}),
    };
    opts.onRejected?.(makeStructuredLog(rejectedInput));
    return false;
  }
  try {
    void opts.sink.emit(result.value);
  } catch {
    // Best-effort: swallow emission failures.
  }
  return true;
}
