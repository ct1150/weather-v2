import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../../build/bake";
import { CountryWeeklyWeatherRankingPage } from "../../../components/CountryWeeklyWeatherRankingPage";
import { buildCountryWeeklyWeatherRanking } from "../../../seo/weekly-weather-ranking";
import { buildAlternates, localeUrl, routeRobots } from "../../seo";

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
  if (country === undefined) return { title: "Country weekly weather ranking" };
  const path = rankingPath(country.slug);
  const title = `${country.name.en}: best weather this week | Where Not Rain`;
  const description = `See which supported destinations in ${country.name.en} have the most mostly rain-free forecast days this week, ranked by expected precipitation and peak rain chance.`;
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

  const path = rankingPath(country.slug);
  const pageUrl = localeUrl("en", path);
  const countryUrl = localeUrl("en", `/${country.slug}`);
  const items = buildCountryWeeklyWeatherRanking(dataset, "en", country.slug);
  const topItems = items.slice(0, 20);
  const description = `Compare ${country.name.en} destinations by mostly rain-free forecast days, expected precipitation and peak rain chance for the next seven days.`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: `${country.name.en} best weather this week`,
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
        mainEntity: { "@id": `${pageUrl}#ranking` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Country weather maps", item: localeUrl("en", "/") },
          { "@type": "ListItem", position: 2, name: country.name.en, item: countryUrl },
          { "@type": "ListItem", position: 3, name: "Best weather this week", item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#ranking`,
        name: `${country.name.en} mostly rain-free destinations this week`,
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
    <CountryWeeklyWeatherRankingPage
      locale="en"
      countryName={country.name.en}
      countryPath={`/${country.slug}`}
      items={items}
      dataUpdatedAt={dataset.dataUpdatedAt}
      jsonLd={jsonLd}
    />
  );
}
