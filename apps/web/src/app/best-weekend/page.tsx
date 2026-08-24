import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { BestWeatherThisWeekPage } from "../../components/BestWeatherThisWeekPage";
import { buildWeekendWeatherRanking } from "../../seo/weekly-weather-ranking";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

const PATH = "/best-weekend";
const title = "Best weekend weather: mostly rain-free cities | Where Not Rain";
const description =
  "See which supported travel destinations have the best mostly rain-free weather this weekend, ranked by expected precipitation and peak rain chance.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildAlternates(PATH, "en", ["en", "zh-cn", "zh-hant"]),
  robots: routeRobots("ranking", true),
  openGraph: {
    type: "website",
    url: localeUrl("en", PATH),
    siteName: "Where Not Rain",
    title,
    description,
  },
};

export default async function Page(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const items = buildWeekendWeatherRanking(dataset, "en");
  const pageUrl = localeUrl("en", PATH);
  const topItems = items.slice(0, 20);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: "Best travel weather this weekend",
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
        mainEntity: { "@id": `${pageUrl}#ranking` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#ranking`,
        name: "Mostly rain-free weekend travel destinations",
        numberOfItems: topItems.length,
        itemListElement: topItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${item.cityName}, ${item.countryName}`,
          url: localeUrl("en", item.path),
        })),
      },
    ],
  };

  return (
    <BestWeatherThisWeekPage
      locale="en"
      mode="weekend"
      items={items}
      dataUpdatedAt={dataset.dataUpdatedAt}
      jsonLd={jsonLd}
    />
  );
}
