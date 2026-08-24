import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../../../build/bake";
import { CountryWeeklyWeatherRankingPage } from "../../../../components/CountryWeeklyWeatherRankingPage";
import { buildCountryWeeklyWeatherRanking } from "../../../../seo/weekly-weather-ranking";
import { toTraditionalText } from "../../../../trips/traditional";
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
  if (country === undefined) return { title: "國家旅行天氣週榜" };
  const path = rankingPath(country.slug);
  const countryName = toTraditionalText(country.name["zh-cn"]);
  const title = `這週${countryName}哪裡天氣好？基本不下雨城市排行 | Where Not Rain`;
  const description = `比較${countryName}熱門旅行地未來 7 天基本不下雨的天數、預計總降雨和最高降雨機率，快速找到這週天氣更好的城市。`;
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates(path, "zh-hant", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("ranking", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-hant", path),
      siteName: "Where Not Rain",
      title,
      description,
      locale: "zh_TW",
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

  const countryName = toTraditionalText(country.name["zh-cn"]);
  const path = rankingPath(country.slug);
  const pageUrl = localeUrl("zh-hant", path);
  const countryUrl = localeUrl("zh-hant", `/${country.slug}`);
  const items = buildCountryWeeklyWeatherRanking(dataset, "zh-hant", country.slug);
  const topItems = items.slice(0, 20);
  const description = `比較${countryName}已收錄旅行地未來 7 天基本不下雨的天數、預計總降雨和最高降雨機率。`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: `這週${countryName}哪裡天氣更好`,
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-Hant",
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
        mainEntity: { "@id": `${pageUrl}#ranking` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "哪裡不下雨", item: localeUrl("zh-hant", "/") },
          { "@type": "ListItem", position: 2, name: countryName, item: countryUrl },
          { "@type": "ListItem", position: 3, name: "這週天氣排行", item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#ranking`,
        name: `${countryName}本週基本不下雨旅行地排行`,
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
      locale="zh-hant"
      countryName={countryName}
      countryPath={`/zh-hant/${country.slug}`}
      items={items}
      dataUpdatedAt={dataset.dataUpdatedAt}
      jsonLd={jsonLd}
    />
  );
}
