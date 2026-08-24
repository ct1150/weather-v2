import type { Metadata, MetadataRoute } from "next";
import type { RouteClass } from "@wnr/seo";
import { indexabilityForRouteClass } from "@wnr/seo";
import { buildConfig } from "../build/bake";

export const PRIMARY_SITE_URL = "https://868656.xyz";
export const SITE_NAME = "Where Not Rain";
export type PublishedLocale = "en" | "zh-cn" | "zh-hant";

const HREFLANG: Readonly<Record<PublishedLocale, string>> = {
  en: "en",
  "zh-cn": "zh-CN",
  "zh-hant": "zh-Hant",
};

export function localeUrl(locale: PublishedLocale, path: string): string {
  const base = buildConfig().appBaseUrl.replace(/\/+$/u, "");
  if (locale === "zh-cn") return `${base}/zh-cn${path === "/" ? "" : path}`;
  if (locale === "zh-hant") return `${base}/zh-hant${path === "/" ? "" : path}`;
  return `${base}${path}`;
}

export function buildAlternates(
  path: string,
  currentLocale: PublishedLocale = "en",
  translatedLocales: ReadonlyArray<PublishedLocale> = ["en"],
): NonNullable<Metadata["alternates"]> {
  const canonical = localeUrl(currentLocale, path);
  if (translatedLocales.length <= 1) return { canonical };
  const languages: Record<string, string> = { "x-default": localeUrl("en", path) };
  for (const locale of translatedLocales) languages[HREFLANG[locale]] = localeUrl(locale, path);
  return { canonical, languages };
}

export function countrySearchCopy(
  countryName: string,
  cityNames: ReadonlyArray<string>,
): { readonly title: string; readonly description: string } {
  const cityCount = cityNames.length;
  const examples = cityNames.slice(0, 3).join(", ");
  const remainder = Math.max(0, cityCount - 3);
  const preview = remainder > 0 ? `${examples} and ${remainder} more` : examples;
  return {
    title: `${countryName} travel weather map: ${cityCount} popular destinations`,
    description: `Compare weather icons, mostly rain-free days and temperatures for ${preview} on one ${countryName} map, then open the daily forecast for any place.`,
  };
}

export function citySearchCopy(
  cityName: string,
  countryName: string,
): { readonly title: string; readonly description: string } {
  return {
    title: `${cityName} 7-day travel weather: rain-free days & temperature`,
    description: `See which of the next 7 days in ${cityName} should be mostly rain-free, expected rain and temperatures, then compare other ${countryName} destinations.`,
  };
}

export function countrySearchCopyZh(
  countryName: string,
  cityNames: ReadonlyArray<string>,
): { readonly title: string; readonly description: string } {
  const cityCount = cityNames.length;
  const examples = cityNames.slice(0, 3).join("、");
  const remainder = Math.max(0, cityCount - 3);
  const preview = remainder > 0 ? `${examples}等${cityCount}个目的地` : examples;
  return {
    title: `${countryName}旅行天气地图：${cityCount}个热门目的地`,
    description: `一张地图比较${preview}的天气、基本不下雨的天数和气温，点击任意地点再查看逐日预报。`,
  };
}

export function routeRobots(
  routeClass: RouteClass,
  qualityPassed: boolean,
): NonNullable<Metadata["robots"]> {
  const value = indexabilityForRouteClass(routeClass, qualityPassed);
  const [indexPart, followPart] = value.split(",");
  return {
    index: indexPart === "index",
    follow: followPart === "follow",
  };
}

export function localizedSitemapEntries(
  path: string,
  options: {
    readonly lastModified: string;
    readonly changeFrequency:
      "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  },
  locales: ReadonlyArray<PublishedLocale> = ["en"],
): MetadataRoute.Sitemap {
  const languages: Record<string, string> | undefined =
    locales.length > 1
      ? Object.fromEntries([
          ["x-default", localeUrl("en", path)],
          ...locales.map((locale) => [HREFLANG[locale], localeUrl(locale, path)] as const),
        ])
      : undefined;
  return locales.map((locale) => ({
    url: localeUrl(locale, path),
    lastModified: options.lastModified,
    changeFrequency: options.changeFrequency,
    ...(languages === undefined ? {} : { alternates: { languages } }),
  }));
}
