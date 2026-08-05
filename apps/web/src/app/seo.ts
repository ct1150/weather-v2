// apps/web/src/app/seo.ts
//
// Small server-side SEO helpers that bridge the baked view models to `@wnr/seo`
// (SEO-PAGE-001, SEO-INDEXABILITY-001, SEO-STRUCTURED-001). This is where
// the previously-orphaned `@wnr/seo` package is actually consumed: every public
// route class resolves its hreflang alternates and its robots `index`/`follow`
// outcome through `@wnr/seo`'s `indexabilityForRouteClass`.
//
// Static-export compatible: only `buildConfig().appBaseUrl` (frozen at build
// time) and the route path are used — no request-time data path.

import type { Metadata, MetadataRoute } from "next";
import type { RouteClass } from "@wnr/seo";
import { indexabilityForRouteClass } from "@wnr/seo";
import { buildConfig } from "../build/bake";

export const PRIMARY_SITE_URL = "https://868656.xyz";
export const SITE_NAME = "Where Not Rain";
export type PublishedLocale = "en" | "zh-cn";

/** Absolute URL for a published locale. */
export function localeUrl(locale: PublishedLocale, path: string): string {
  const base = buildConfig().appBaseUrl.replace(/\/+$/, "");
  return `${base}${locale === "zh-cn" ? "/zh-cn" : ""}${path}`;
}

/**
 * Build one self-referencing canonical. Locale routes must not be advertised
 * until those pages are actually published.
 */
export function buildAlternates(
  path: string,
  currentLocale: PublishedLocale = "en",
  translatedLocales: ReadonlyArray<PublishedLocale> = ["en"],
): NonNullable<Metadata["alternates"]> {
  const canonical = localeUrl(currentLocale, path);
  if (translatedLocales.length <= 1) return { canonical };
  const languages: Record<string, string> = { "x-default": localeUrl("en", path) };
  for (const locale of translatedLocales) {
    languages[locale === "zh-cn" ? "zh-CN" : locale] = localeUrl(locale, path);
  }
  return { canonical, languages };
}

export function countrySearchCopy(
  countryName: string,
  cityNames: ReadonlyArray<string>,
): { readonly title: string; readonly description: string } {
  const cityCount = cityNames.length;
  const examples = cityNames.slice(0, 3).join(", ");
  const remainder = Math.max(0, cityCount - 3);
  const cityPreview = remainder > 0 ? `${examples} and ${remainder} more` : examples;
  return {
    title: `${countryName} travel weather map: compare ${cityCount} cities`,
    description: `Choose your travel dates and compare rain, temperature and Travel Scores for ${cityPreview} on one ${countryName} weather map.`,
  };
}

export function citySearchCopy(
  cityName: string,
  countryName: string,
): { readonly title: string; readonly description: string } {
  return {
    title: `${cityName} travel weather: rain, temperature & score`,
    description: `See the 7-day ${cityName} forecast, rain risk, temperature and Travel Score, then compare other ${countryName} destinations before you book.`,
  };
}

export function countrySearchCopyZh(
  countryName: string,
  cityNames: ReadonlyArray<string>,
): { readonly title: string; readonly description: string } {
  const cityCount = cityNames.length;
  const examples = cityNames.slice(0, 3).join("、");
  const remainder = Math.max(0, cityCount - 3);
  const cityPreview = remainder > 0 ? `${examples}等${cityCount}个目的地` : examples;
  return {
    title: `${countryName}旅行天气地图：比较${cityCount}个城市`,
    description: `选择旅行日期，一张地图比较${cityPreview}的预计降雨、最高降雨概率、气温和旅行评分。`,
  };
}

/**
 * Resolve the robots `index`/`follow` flags from the route class via the
 * `@wnr/seo` indexability policy (SEO-INDEXABILITY-001). `qualityPassed`
 * gates content classes: a failing quality gate downgrades to `noindex,follow`.
 */
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

/** Convenience for `sitemap.ts`: one entry per real, canonical route. */
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
      ? {
          en: localeUrl("en", path),
          "zh-CN": localeUrl("zh-cn", path),
          "x-default": localeUrl("en", path),
        }
      : undefined;
  return locales.map((locale) => ({
    url: localeUrl(locale, path),
    lastModified: options.lastModified,
    changeFrequency: options.changeFrequency,
    ...(languages === undefined ? {} : { alternates: { languages } }),
  }));
}
