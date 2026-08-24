import type { MetadataRoute } from "next";
import { getBakedDataset } from "../build/bake";
import { localizedSitemapEntries } from "./seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dataset = await getBakedDataset();
  const lastModified = dataset.dataUpdatedAt;
  const changeFrequency = "daily" as const;
  const entries: MetadataRoute.Sitemap = [
    ...localizedSitemapEntries("/", { lastModified, changeFrequency }, ["en", "zh-hant", "zh-cn"]),
    ...localizedSitemapEntries(
      "/best-weather-this-week",
      { lastModified, changeFrequency: "daily" },
      ["en", "zh-cn", "zh-hant"],
    ),
    ...localizedSitemapEntries("/best-weekend", { lastModified, changeFrequency: "daily" }, [
      "en",
      "zh-cn",
      "zh-hant",
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
