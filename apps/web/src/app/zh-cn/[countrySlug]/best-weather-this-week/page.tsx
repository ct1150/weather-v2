import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../../../build/bake";
import { CountryWeeklyWeatherRankingPage } from "../../../../components/CountryWeeklyWeatherRankingPage";
import { buildCountryWeeklyWeatherRanking } from "../../../../seo/weekly-weather-ranking";
import { buildAlternates, localeUrl, routeRobots } from "../../../seo";

function rankingPath(countrySlug: string): string {
  return `/${countrySlug}/best-weather-this-week`;
}

export async function generateStaticParams(): Promise<ReadonlyArray<{ countrySlug: string }>> {
  const dataset = await getBakedDataset();
  return dataset.countries.map((country) => ({ countrySlug: country.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string };
}): Promise<Metadata> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((item) => item.slug === params.countrySlug);
  if (country === undefined) return { title: "国家旅行天气周榜" };
  const path = rankingPath(country.slug);
  const countryName = country.name["zh-cn"];
  const title = `这周${countryName}哪里天气好？基本不下雨城市排行 | Where Not Rain`;
  const description = `比较${countryName}热门旅行地未来 7 天基本不下雨的天数、预计总降雨和最高降雨概率，快速找到这周天气更好的城市。`;
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates(path, "zh-cn", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("ranking", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-cn", path),
      siteName: "Where Not Rain",
      title,
      description,
      locale: "zh_CN",
    },
  };
}

export default async function Page({
  params,
}: {
  params: { countrySlug: string };
}): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((item) => item.slug === params.countrySlug);
  if (country === undefined) notFound();

  const countryName = country.name["zh-cn"];
  const path = rankingPath(country.slug);
  const pageUrl = localeUrl("zh-cn", path);
  const countryUrl = localeUrl("zh-cn", `/${country.slug}`);
  const items = buildCountryWeeklyWeatherRanking(dataset, "zh-cn", country.slug);
  const topItems = items.slice(0, 20);
  const description = `比较${countryName}已收录旅行地未来 7 天基本不下雨的天数、预计总降雨和最高降雨概率。`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: `这周${countryName}哪里天气更好`,
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-CN",
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
        mainEntity: { "@id": `${pageUrl}#ranking` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "哪里不下雨", item: localeUrl("zh-cn", "/") },
          { "@type": "ListItem", position: 2, name: countryName, item: countryUrl },
          { "@type": "ListItem", position: 3, name: "这周天气排行", item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#ranking`,
        name: `${countryName}本周基本不下雨旅行地排行`,
        numberOfItems: topItems.length,
        itemListElement: topItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.cityName,
          url: new URL(item.path, localeUrl("en", "/")).toString(),
        })),
      },
    ],
  };

  return (
    <CountryWeeklyWeatherRankingPage
      locale="zh-cn"
      countryName={countryName}
      countryPath={`/zh-cn/${country.slug}`}
      items={items}
      dataUpdatedAt={dataset.dataUpdatedAt}
      jsonLd={jsonLd}
    />
  );
}
