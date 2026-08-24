import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../../components/CountryMapHome";
import { JsonLd } from "../../components/JsonLd";
import { toTraditionalText } from "../../trips/traditional";
import { summarizeCountryWeather } from "../../world/world-overview";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "全球旅行天氣地圖 | 哪裡不下雨";
  const description = "在一張世界地圖上查看已支援國家的整體天氣表現，點擊國家後直接比較城市天氣。";
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
    const weather = summarizeCountryWeather(cities);
    const topIds = new Set(weather.topCityIds);
    const topCities = [
      ...cities.filter((item) => topIds.has(item.city.id)),
      ...cities.filter((item) => !topIds.has(item.city.id)),
    ].slice(0, 4);
    return {
      countryId: country.id,
      slug: country.slug,
      name: toTraditionalText(country.name["zh-cn"]),
      path: `/zh-hant/${country.slug}`,
      summary: toTraditionalText(country.summary?.["zh-cn"] ?? country.summary?.en ?? ""),
      cityCount: cities.length,
      cityNames: topCities.map((item) => toTraditionalText(item.city.name["zh-cn"])),
      weatherScore: weather.score,
      weatherStatus: weather.status,
    };
  });
  const pageUrl = localeUrl("zh-hant", "/");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "全球旅行天氣地圖",
    description: "先看世界地圖上的國家天氣，再進入國家地圖比較熱門城市。",
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
