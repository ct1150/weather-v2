import {
  MAX_TRAVEL_MINUTE_OPTIONS,
  parseReachabilityPreferences,
  type ReachabilityModeFilter,
  type ReachabilityOriginId,
} from "./reachability";

export const SAVED_DISCOVERY_SEARCHES_STORAGE_KEY = "wnr:saved-discovery-searches:v1";
export const MAX_SAVED_DISCOVERY_SEARCHES = 5;

export interface SavedDiscoverySearch {
  readonly id: string;
  readonly url: string;
  readonly from: string;
  readonly to: string;
  readonly originId: ReachabilityOriginId;
  readonly mode: ReachabilityModeFilter;
  readonly maxTravelMinutes: number;
  readonly savedAt: string;
}

export interface RecheckCalendar {
  readonly content: string;
  readonly reminderCount: number;
  readonly filename: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
const ORIGIN_IDS: ReadonlyArray<ReachabilityOriginId> = [
  "sg-singapore",
  "hk-hong-kong",
  "tw-taipei",
];
const MODES: ReadonlyArray<ReachabilityModeFilter> = ["any", "flight", "rail", "drive"];
const RECHECK_OFFSETS = [7, 3, 1] as const;

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compactDate(value: string): string {
  return value.replaceAll("-", "");
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function canonicalDiscoveryUrl(url: URL): string {
  const search = new URLSearchParams(url.searchParams);
  search.sort();
  const query = search.toString();
  return query.length > 0 ? `${url.pathname}?${query}` : url.pathname;
}

function validSavedAt(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validSavedSearch(value: unknown): value is SavedDiscoverySearch {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Partial<SavedDiscoverySearch>;
  return (
    typeof item.id === "string" &&
    item.id.startsWith("search-") &&
    typeof item.url === "string" &&
    item.url.startsWith("/") &&
    !item.url.startsWith("//") &&
    isIsoDate(item.from) &&
    isIsoDate(item.to) &&
    item.to >= item.from &&
    ORIGIN_IDS.includes(item.originId as ReachabilityOriginId) &&
    MODES.includes(item.mode as ReachabilityModeFilter) &&
    typeof item.maxTravelMinutes === "number" &&
    MAX_TRAVEL_MINUTE_OPTIONS.includes(item.maxTravelMinutes) &&
    validSavedAt(item.savedAt)
  );
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function utcStamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "19700101T000000Z";
  return date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/u, "Z");
}

export function buildSavedDiscoverySearch(url: URL, savedAt: string): SavedDiscoverySearch | null {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isIsoDate(from) || !isIsoDate(to) || to < from || !validSavedAt(savedAt)) return null;

  const reachability = parseReachabilityPreferences(url.searchParams);
  const relativeUrl = canonicalDiscoveryUrl(url);
  return {
    id: `search-${stableHash(relativeUrl)}`,
    url: relativeUrl,
    from,
    to,
    originId: reachability.originId,
    mode: reachability.mode,
    maxTravelMinutes: reachability.maxTravelMinutes,
    savedAt,
  };
}

export function normalizeSavedDiscoverySearches(
  value: unknown,
  maxItems = MAX_SAVED_DISCOVERY_SEARCHES,
): ReadonlyArray<SavedDiscoverySearch> {
  if (!Array.isArray(value)) return [];
  const limit =
    Number.isInteger(maxItems) && maxItems > 0 ? maxItems : MAX_SAVED_DISCOVERY_SEARCHES;
  const seen = new Set<string>();
  const output: SavedDiscoverySearch[] = [];

  for (const item of value) {
    if (!validSavedSearch(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

export function parseStoredSavedDiscoverySearches(
  raw: string | null,
): ReadonlyArray<SavedDiscoverySearch> {
  if (raw === null) return [];
  try {
    return normalizeSavedDiscoverySearches(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function serializeSavedDiscoverySearches(
  values: ReadonlyArray<SavedDiscoverySearch>,
): string {
  return JSON.stringify(normalizeSavedDiscoverySearches(values));
}

export function upsertSavedDiscoverySearch(
  values: ReadonlyArray<SavedDiscoverySearch>,
  next: SavedDiscoverySearch,
): ReadonlyArray<SavedDiscoverySearch> {
  return normalizeSavedDiscoverySearches([next, ...values.filter((item) => item.id !== next.id)]);
}

export function buildRecheckReminderCalendar(input: {
  readonly search: SavedDiscoverySearch;
  readonly today: string;
  readonly generatedAt: string;
  readonly summary: string;
  readonly description: string;
  readonly absoluteUrl: string;
}): RecheckCalendar {
  const { search, today, generatedAt, summary, description, absoluteUrl } = input;
  if (!isIsoDate(today) || !validSavedAt(generatedAt) || search.from < today) {
    return {
      content: "",
      reminderCount: 0,
      filename: `where-not-rain-${search.from}-recheck.ics`,
    };
  }

  const candidates = RECHECK_OFFSETS.map((offset) => shiftDate(search.from, -offset)).filter(
    (date, index, values) => date >= today && date < search.from && values.indexOf(date) === index,
  );
  const reminderDates = candidates.length > 0 ? candidates : today <= search.from ? [today] : [];
  const dtstamp = utcStamp(generatedAt);
  const events = reminderDates.map((date) => {
    const end = shiftDate(date, 1);
    return [
      "BEGIN:VEVENT",
      `UID:${stableHash(`${search.url}|${date}`)}@868656.xyz`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compactDate(date)}`,
      `DTEND;VALUE=DATE:${compactDate(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(`${description}\n${absoluteUrl}`)}`,
      `URL:${escapeIcsText(absoluteUrl)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ].join("\r\n");
  });

  return {
    content: [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Where Not Rain//Weather Recheck//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...events,
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
    reminderCount: events.length,
    filename: `where-not-rain-${search.from}-recheck.ics`,
  };
}
