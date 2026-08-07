export type SiteLocale = "en" | "zh-cn" | "zh-hant";

export const LOCALE_STORAGE_KEY = "wnr:locale:v1";

const TRADITIONAL_TIMEZONES = new Set(["Asia/Taipei", "Asia/Hong_Kong", "Asia/Macau"]);
const SIMPLIFIED_TIMEZONES = new Set([
  "Asia/Shanghai",
  "Asia/Chongqing",
  "Asia/Harbin",
  "Asia/Urumqi",
]);
const WEATHER_COUNTRY_SLUGS = new Set([
  "jp",
  "kr",
  "th",
  "vn",
  "sg",
  "my",
  "id",
  "ph",
  "kh",
  "japan",
  "south-korea",
  "thailand",
  "vietnam",
  "singapore",
  "malaysia",
  "indonesia",
  "philippines",
  "cambodia",
]);

export function localeFromPath(pathname: string): SiteLocale {
  if (pathname === "/zh-hant" || pathname.startsWith("/zh-hant/")) return "zh-hant";
  if (pathname === "/zh-cn" || pathname.startsWith("/zh-cn/")) return "zh-cn";
  return "en";
}

export function stripLocalePrefix(pathname: string): string {
  if (pathname === "/zh-hant" || pathname === "/zh-cn") return "/";
  if (pathname.startsWith("/zh-hant/")) return pathname.slice("/zh-hant".length);
  if (pathname.startsWith("/zh-cn/")) return pathname.slice("/zh-cn".length);
  return pathname;
}

export function localizedPath(pathname: string, locale: SiteLocale): string {
  const base = stripLocalePrefix(pathname);
  if (locale === "en") return base;
  return base === "/" ? `/${locale}` : `/${locale}${base}`;
}

export function isAutoLocalizablePath(pathname: string): boolean {
  const base = stripLocalePrefix(pathname);
  if (base === "/") return true;
  if (base === "/trips" || base === "/trips/new" || base === "/trips/workspace") return true;
  if (base.startsWith("/trips/")) return false;

  const segments = base.split("/").filter(Boolean);
  if (segments.length < 1 || segments.length > 2) return false;
  return WEATHER_COUNTRY_SLUGS.has(segments[0] ?? "");
}

export function detectPreferredLocale(
  languages: ReadonlyArray<string>,
  timeZone: string | undefined,
): SiteLocale {
  for (const rawLanguage of languages) {
    const language = rawLanguage.toLowerCase();
    if (language.startsWith("zh-hant") || /^zh-(tw|hk|mo)(-|$)/u.test(language)) {
      return "zh-hant";
    }
    if (language.startsWith("zh-hans") || /^zh-(cn|sg)(-|$)/u.test(language)) {
      return "zh-cn";
    }
    if (language === "zh" || language.startsWith("zh-")) {
      if (timeZone !== undefined && SIMPLIFIED_TIMEZONES.has(timeZone)) return "zh-cn";
      return "zh-hant";
    }
    if (language === "en" || language.startsWith("en-")) return "en";
  }

  if (timeZone !== undefined && TRADITIONAL_TIMEZONES.has(timeZone)) return "zh-hant";
  if (timeZone !== undefined && SIMPLIFIED_TIMEZONES.has(timeZone)) return "zh-cn";
  return "en";
}

export function htmlLanguage(locale: SiteLocale): string {
  if (locale === "zh-hant") return "zh-Hant";
  if (locale === "zh-cn") return "zh-CN";
  return "en";
}
