// @wnr/i18n — locale dictionaries, fallback resolver, and locale-aware
// formatters (UX-I18N-001, DATA-GEOGRAPHY-001).
//
// UI strings are dictionary-backed (never hard-coded into components or domain
// records). English is the unprefixed default; every other locale falls back to
// English for a missing key and REPORTS the gap rather than emitting a blank
// label (UX-I18N-001). Slugs stay stable English ASCII identifiers and
// weather dates/times use the destination's local time zone, not the server's
// (DATA-GEOGRAPHY-001).

/** The five core MVP locales. English is the unprefixed default. */
export type Locale = "en" | "ja" | "ko" | "zh-cn" | "zh-tw";

/** English is the fallback locale for every missing key. */
export const DEFAULT_LOCALE: Locale = "en";

/** All supported core locales. */
export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "ja", "ko", "zh-cn", "zh-tw"];

/** Dictionary-backed UI string keys (no hard-coded copy in components). */
export type UiStringKey =
  | "app_tagline"
  | "loading"
  | "no_results"
  | "data_unavailable"
  | "retry"
  | "stale_prefix"
  | "offline"
  | "affiliate_disclosure"
  | "search_placeholder"
  | "nav_home"
  | "nav_explore"
  | "nav_search"
  | "language";

type Dictionary = Record<UiStringKey, string>;

/**
 * Locale dictionaries. `en` is complete; the localized tables are intentionally
 * partial so the fallback + missing-key reporting is exercised (UX-I18N-001).
 */
export const DICTIONARIES: Readonly<Record<Locale, Partial<Dictionary>>> = Object.freeze({
  en: Object.freeze({
    app_tagline: "Where is NOT raining?",
    loading: "Loading…",
    no_results: "No matching results.",
    data_unavailable: "This data is currently unavailable.",
    retry: "Retry",
    stale_prefix: "Updated",
    offline: "You are offline.",
    affiliate_disclosure: "Some links are sponsored. We may earn a commission.",
    search_placeholder: "Search destinations",
    nav_home: "Home",
    nav_explore: "Explore",
    nav_search: "Search",
    language: "Language",
  }),
  ja: Object.freeze({
    app_tagline: "雨が降っていない場所は？",
    loading: "読み込み中…",
    no_results: "一致する結果がありません。",
    retry: "再試行",
    offline: "オフラインです。",
    search_placeholder: "目的地を検索",
    nav_home: "ホーム",
    nav_explore: "探索",
    nav_search: "検索",
    language: "言語",
  }),
  ko: Object.freeze({
    app_tagline: "비가 오지 않는 곳은?",
    loading: "불러오는 중…",
    no_results: "일치하는 결과가 없습니다.",
    retry: "다시 시도",
    stale_prefix: "업데이트됨",
    search_placeholder: "여행지 검색",
    nav_home: "홈",
    nav_explore: "탐색",
    nav_search: "검색",
    language: "언어",
  }),
  "zh-cn": Object.freeze({
    app_tagline: "哪里不下雨？",
    loading: "加载中…",
    no_results: "没有匹配的结果。",
    retry: "重试",
    stale_prefix: "更新于",
    offline: "您已离线。",
    search_placeholder: "搜索目的地",
    nav_home: "首页",
    nav_explore: "探索",
    nav_search: "搜索",
    language: "语言",
  }),
  "zh-tw": Object.freeze({
    app_tagline: "哪裡沒下雨？",
    loading: "載入中…",
    no_results: "沒有符合的結果。",
    retry: "重試",
    stale_prefix: "更新於",
    offline: "您已離線。",
    search_placeholder: "搜尋目的地",
    nav_home: "首頁",
    nav_explore: "探索",
    nav_search: "搜尋",
    language: "語言",
  }),
});

/** Map an internal locale to a BCP-47 tag for Intl. */
function localeTag(locale: Locale): string {
  const tags: Record<Locale, string> = {
    en: "en",
    ja: "ja",
    ko: "ko",
    "zh-cn": "zh-CN",
    "zh-tw": "zh-TW",
  };
  return tags[locale];
}

/**
 * Translate a UI string key for a locale. Resolves the localized value, then
 * falls back to English, then to the key itself — never a blank label
 * (UX-I18N-001).
 */
export function translate(key: UiStringKey, locale: Locale): string {
  const localized = DICTIONARIES[locale][key];
  if (localized !== undefined) return localized;
  const english = DICTIONARIES[DEFAULT_LOCALE][key];
  return english !== undefined ? english : key;
}

/**
 * Keys present in English but missing from `locale`. The English table is the
 * completeness reference; the returned list is what a developer/validation run
 * should report (UX-I18N-001).
 */
export function findMissingKeys(locale: Locale): ReadonlyArray<UiStringKey> {
  if (locale === DEFAULT_LOCALE) return [];
  const english = DICTIONARIES[DEFAULT_LOCALE];
  const target = DICTIONARIES[locale];
  const missing: UiStringKey[] = [];
  for (const key of Object.keys(english) as UiStringKey[]) {
    if (target[key] === undefined) missing.push(key);
  }
  return missing;
}

/**
 * Format a date in the destination's local time zone (not the server zone),
 * per DATA-GEOGRAPHY-001. Accepts an ISO instant or a Date.
 */
export function formatLocalDate(date: string | Date, locale: Locale, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone,
    calendar: "gregory",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** Format a date-time in the destination's local time zone. */
export function formatLocalDateTime(
  date: string | Date,
  locale: Locale,
  timeZone: string,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone,
    calendar: "gregory",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/**
 * Format a temperature with locale-aware units. `metric` → Celsius, `imperial`
 * → Fahrenheit (converted). Grouping/decimal follow the locale (DATA-GEOGRAPHY-001).
 */
export function formatTemperature(
  celsius: number,
  locale: Locale,
  unit: "metric" | "imperial",
): string {
  const useFahrenheit = unit === "imperial";
  const value = useFahrenheit ? (celsius * 9) / 5 + 32 : celsius;
  return new Intl.NumberFormat(localeTag(locale), {
    style: "unit",
    unit: useFahrenheit ? "fahrenheit" : "celsius",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Locale-aware integer formatting (grouping follows the locale). */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 0 }).format(value);
}

const STABLE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * True when `value` is a stable English ASCII slug: 1..80 lowercase
 * `[a-z0-9]+(?:-[a-z0-9]+)*`. Uppercase, spaces, and Unicode are
 * rejected so canonical destination identity stays stable (DATA-GEOGRAPHY-001).
 */
export function isStableAsciiSlug(value: string): boolean {
  return value.length >= 1 && value.length <= 80 && STABLE_SLUG_RE.test(value);
}
