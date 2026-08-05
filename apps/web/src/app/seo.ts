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

/** Absolute URL for the only currently published locale. */
export function localeUrl(_locale: "en", path: string): string {
  const base = buildConfig().appBaseUrl.replace(/\/+$/, "");
  return `${base}${path}`;
}

/**
 * Build one self-referencing canonical. Locale routes must not be advertised
 * until those pages are actually published.
 */
export function buildAlternates(path: string): NonNullable<Metadata["alternates"]> {
  return { canonical: localeUrl("en", path) };
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
): MetadataRoute.Sitemap {
  return [
    {
      url: localeUrl("en", path),
      lastModified: options.lastModified,
      changeFrequency: options.changeFrequency,
    },
  ];
}
