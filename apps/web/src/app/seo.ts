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
import type { Locale } from "../api/v1/schemas";
import { buildConfig } from "../build/bake";

/** MVP locales (en unprefixed; the rest carry a route prefix). */
export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "ja", "ko", "zh-cn", "zh-tw"];

const LOCALE_PREFIX: Readonly<Record<Locale, string>> = {
  en: "",
  ja: "/ja",
  ko: "/ko",
  "zh-cn": "/zh-cn",
  "zh-tw": "/zh-tw",
};

/** Absolute canonical URL for a locale + in-site `path` (path begins with "/"). */
export function localeUrl(locale: Locale, path: string): string {
  const base = buildConfig().appBaseUrl;
  return `${base}${LOCALE_PREFIX[locale]}${path}`;
}

/**
 * Build the Next `alternates` block: a self-referencing canonical (en) plus one
 * hreflang alternate per supported locale. Used by every page's `generateMetadata`.
 */
export function buildAlternates(path: string): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = localeUrl(locale, path);
  }
  return { canonical: localeUrl("en", path), languages };
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

/** Convenience for `sitemap.ts`: one `MetadataRoute.Sitemap` entry per locale. */
export function localizedSitemapEntries(
  path: string,
  options: {
    readonly lastModified: string;
    readonly changeFrequency:
      "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  },
): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = localeUrl(locale, path);
  }
  return SUPPORTED_LOCALES.map((locale) => ({
    url: localeUrl(locale, path),
    lastModified: options.lastModified,
    changeFrequency: options.changeFrequency,
    alternates: { languages },
  }));
}
