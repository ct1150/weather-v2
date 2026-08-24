import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../../build/bake";
import { CountryBestWeatherThisWeekPage } from "../../../components/CountryBestWeatherThisWeekPage";
import { buildCountryWeeklyWeatherRanking } from "../../../seo/country-weekly-weather-ranking";
import { buildAlternates, localeUrl, routeRobots } from "../../seo";

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
  if (country === undefined) return { title: "Country weather this week" };
  const path = `/${country.slug}/best-weather-this-week`;
  const title = `${country.name.en} weather this week: best mostly rain-free cities | Where Not Rain`;
  const description = `Compare ${country.name.en} destinations for the next 7 days by mostly rain-free days, expected precipitation and peak rain chance.`;
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates(path, "en", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("ranking", true),
    openGraph: {
      type: "website",
      url: localeUrl("en", path),
      siteName: "Where Not Rain",
      title,
      description,
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

  const items = buildCountryWeeklyWeatherRanking(dataset, country.slug, "en");
  const path = `/${country.slug}/best-weather-this-week`;
  const pageUrl = localeUrl("en", path);
  const topItems = items.slice(0, 20);
  const description = `Compare ${country.name.en} destinations for the next 7 days by mostly rain-free days, expected precipitation and peak rain chance.`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: `Best weather in ${country.name.en} this week`,
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
        mainEntity: { "@id": `${pageUrl}#ranking` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#ranking`,
        name: `${country.name.en} mostly rain-free destination ranking`,
        numberOfItems: topItems.length,
        itemListElement: topItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.cityName,
          url: localeUrl("en", item.path),
        })),
      },
    ],
  };

  return (
    <CountryBestWeatherThisWeekPage
      locale="en"
      countryName={country.name.en}
      items={items}
      dataUpdatedAt={dataset.dataUpdatedAt}
      jsonLd={jsonLd}
    />
  );
}
