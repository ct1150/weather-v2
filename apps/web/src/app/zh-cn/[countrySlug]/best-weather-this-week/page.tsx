import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../../../build/bake";
import { CountryBestWeatherThisWeekPage } from "../../../../components/CountryBestWeatherThisWeekPage";
import { buildCountryWeeklyWeatherRanking } from "../../../../seo/country-weekly-weather-ranking";
import { buildAlternates, localeUrl, routeRobots } from "../../../seo";

const MIN_DESTINATIONS = 3;

export async function generateStaticParams(): Promise<ReadonlyArray<{ countrySlug: string }>> {
  const dataset = await getBakedDataset();
  return dataset.countries
    .filter((country) => (dataset.citiesByCountry.get(country.id) ?? []).length >= MIN_DESTINATIONS)
    .map((country) => ({ countrySlug: country.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string };
}): Promise<Metadata> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((item) => item.slug === params.countrySlug);
  if (country === undefined) return { title: "国家本周旅行天气" };
  const name = country.name["zh-cn"];
  const path = `/${country.slug}/best-weather-this-week`;
  const title = `${name}这周哪里天气好？未来7天基本不下雨城市排行 | Where Not Rain`;
  const description = `比较${name}热门旅行地未来7天基本不下雨的天数、预计总降雨和最高降雨概率，快速找到这周更适合去的城市。`;
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
  const cities = dataset.citiesByCountry.get(country.id) ?? [];
  if (cities.length < MIN_DESTINATIONS) notFound();

  const name = country.name["zh-cn"];
  const items = buildCountryWeeklyWeatherRanking(dataset, country.slug, "zh-cn");
  const path = `/${country.slug}/best-weather-this-week`;
  const pageUrl = localeUrl("zh-cn", path);
  const siteBase = localeUrl("en", "/");
  const topItems = items.slice(0, 20);
  const description = `比较${name}热门旅行地未来7天基本不下雨的天数、预计总降雨和最高降雨概率，快速找到这周更适合去的城市。`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: `${name}未来7天天气更好的旅行地`,
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-CN",
        mainEntity: { "@id": `${pageUrl}#ranking` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#ranking`,
        name: `${name}基本不下雨旅行地排行`,
        numberOfItems: topItems.length,
        itemListElement: topItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.cityName,
          url: new URL(item.path, siteBase).toString(),
        })),
      },
    ],
  };

  return (
    <CountryBestWeatherThisWeekPage
      locale="zh-cn"
      countryName={name}
      items={items}
      dataUpdatedAt={dataset.dataUpdatedAt}
      jsonLd={jsonLd}
    />
  );
}
