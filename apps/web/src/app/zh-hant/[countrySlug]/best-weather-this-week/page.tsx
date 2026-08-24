import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../../../build/bake";
import { CountryBestWeatherThisWeekPage } from "../../../../components/CountryBestWeatherThisWeekPage";
import { buildCountryWeeklyWeatherRanking } from "../../../../seo/country-weekly-weather-ranking";
import { toTraditionalText } from "../../../../trips/traditional";
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
  if (country === undefined) return { title: "國家本週旅行天氣" };
  const name = toTraditionalText(country.name["zh-cn"]);
  const path = `/${country.slug}/best-weather-this-week`;
  const title = `${name}這週哪裡天氣好？未來7天基本不下雨城市排行 | Where Not Rain`;
  const description = `比較${name}熱門旅行地未來7天基本不下雨的天數、預計總降雨和最高降雨機率，快速找到這週更適合去的城市。`;
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
  const cities = dataset.citiesByCountry.get(country.id) ?? [];
  if (cities.length < MIN_DESTINATIONS) notFound();

  const name = toTraditionalText(country.name["zh-cn"]);
  const items = buildCountryWeeklyWeatherRanking(dataset, country.slug, "zh-hant");
  const path = `/${country.slug}/best-weather-this-week`;
  const pageUrl = localeUrl("zh-hant", path);
  const siteBase = localeUrl("en", "/");
  const topItems = items.slice(0, 20);
  const description = `比較${name}熱門旅行地未來7天基本不下雨的天數、預計總降雨和最高降雨機率，快速找到這週更適合去的城市。`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: `${name}未來7天天氣更好的旅行地`,
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-Hant",
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
      locale="zh-hant"
      countryName={name}
      items={items}
      dataUpdatedAt={dataset.dataUpdatedAt}
      jsonLd={jsonLd}
    />
  );
}
