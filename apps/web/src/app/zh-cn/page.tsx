import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../../components/CountryMapHome";
import { JsonLd } from "../../components/JsonLd";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "国家旅行天气地图 | Where Not Rain";
  const description =
    "选择一个国家，在地图上直接查看热门旅游地未来 7 天的天气图标、少雨天数和气温。";
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
    return {
      slug: country.slug,
      name: country.name["zh-cn"],
      path: `/zh-cn/${country.slug}`,
      summary: country.summary?.["zh-cn"] ?? country.summary?.en ?? "",
      cityCount: cities.length,
      cityNames: cities.slice(0, 4).map((item) => item.city.name["zh-cn"]),
    };
  });
  const pageUrl = localeUrl("zh-cn", "/");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "国家旅行天气地图",
    description: "选择一个国家，一张地图查看热门旅游地未来 7 天的天气。",
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
