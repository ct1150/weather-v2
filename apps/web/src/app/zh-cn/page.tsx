import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../../components/CountryMapHome";
import { JsonLd } from "../../components/JsonLd";
import { summarizeCountryWeather } from "../../world/world-overview";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "全球旅行天气地图 | 哪里不下雨";
  const description = "在一张世界地图上查看已支持国家的整体天气表现，点击国家后直接比较城市天气。";
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("homepage", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-cn", "/"),
      siteName: "Where Not Rain",
      title,
      description,
      locale: "zh_CN",
    },
  };
}

export default async function SimplifiedChineseHome(): Promise<ReactElement> {
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
      name: country.name["zh-cn"],
      path: `/zh-cn/${country.slug}`,
      summary: country.summary?.["zh-cn"] ?? country.summary?.en ?? "",
      cityCount: cities.length,
      cityNames: topCities.map((item) => item.city.name["zh-cn"]),
      weatherScore: weather.score,
      weatherStatus: weather.status,
    };
  });
  const pageUrl = localeUrl("zh-cn", "/");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "全球旅行天气地图",
    description: "先看世界地图上的国家天气，再进入国家地图比较热门城市。",
    url: pageUrl,
    dateModified: dataset.dataUpdatedAt,
    inLanguage: "zh-CN",
    hasPart: countries.map((country) => ({
      "@type": "WebPage",
      name: `${country.name}旅行天气地图`,
      url: localeUrl("zh-cn", `/${country.slug}`),
    })),
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <CountryMapHome countries={countries} locale="zh-cn" />
    </main>
  );
}
