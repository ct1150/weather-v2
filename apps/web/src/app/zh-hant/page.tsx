import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../../components/CountryMapHome";
import { JsonLd } from "../../components/JsonLd";
import { toTraditionalText } from "../../trips/traditional";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "國家旅行天氣地圖 | Where Not Rain";
  const description =
    "選擇一個國家，在地圖上直接查看熱門旅遊地未來 7 天的天氣圖示、少雨天數和氣溫。";
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("homepage", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-hant", "/"),
      siteName: "Where Not Rain",
      title,
      description,
      locale: "zh_TW",
    },
  };
}

export default async function TraditionalChineseHome(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const countries: CountryMapHomeItem[] = dataset.countries.map((country) => {
    const cities = dataset.citiesByCountry.get(country.id) ?? [];
    return {
      slug: country.slug,
      name: toTraditionalText(country.name["zh-cn"]),
      path: `/zh-hant/${country.slug}`,
      summary: toTraditionalText(country.summary?.["zh-cn"] ?? country.summary?.en ?? ""),
      cityCount: cities.length,
      cityNames: cities.slice(0, 4).map((item) => toTraditionalText(item.city.name["zh-cn"])),
    };
  });
  const pageUrl = localeUrl("zh-hant", "/");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "國家旅行天氣地圖",
    description: "選擇一個國家，一張地圖查看熱門旅遊地未來 7 天的天氣。",
    url: pageUrl,
    dateModified: dataset.dataUpdatedAt,
    inLanguage: "zh-Hant",
    hasPart: countries.map((country) => ({
      "@type": "WebPage",
      name: `${country.name}旅行天氣地圖`,
      url: localeUrl("zh-hant", `/${country.slug}`),
    })),
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <CountryMapHome countries={countries} locale="zh-hant" />
    </main>
  );
}
