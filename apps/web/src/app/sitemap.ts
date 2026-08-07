// apps/web/src/app/sitemap.ts
//
// Static-export sitemap. Only routes that exist in the static export are emitted.

import type { MetadataRoute } from "next";
import { getBakedDataset } from "../build/bake";
import { localizedSitemapEntries } from "./seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dataset = await getBakedDataset();
  const lastModified = dataset.dataUpdatedAt;
  const changeFrequency = "weekly" as const;

  const entries: MetadataRoute.Sitemap = [
    ...localizedSitemapEntries("/", { lastModified, changeFrequency }, ["en", "zh-hant", "zh-cn"]),
    ...localizedSitemapEntries("/explore", { lastModified, changeFrequency }),
    ...localizedSitemapEntries("/trips", { lastModified, changeFrequency }, [
      "en",
      "zh-hant",
      "zh-cn",
    ]),
    ...localizedSitemapEntries("/trips/qinggan-family-2026", { lastModified, changeFrequency }, [
      "en",
      "zh-cn",
    ]),
  ];

  for (const country of dataset.countries) {
    const countryPath = `/${country.slug}`;
    entries.push(
      ...localizedSitemapEntries(countryPath, { lastModified, changeFrequency }, [
        "en",
        "zh-cn",
        "zh-hant",
      ]),
    );
    const cities = dataset.citiesByCountry.get(country.id) ?? [];
    for (const city of cities) {
      const cityPath = `/${country.slug}/${city.city.slug}`;
      entries.push(
        ...localizedSitemapEntries(cityPath, { lastModified, changeFrequency }, [
          "en",
          "zh-cn",
          "zh-hant",
        ]),
      );
    }
  }

  return entries;
}
