import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../../build/bake";
import { BestWeatherThisWeekPage } from "../../../components/BestWeatherThisWeekPage";
import { buildWeeklyWeatherRanking } from "../../../seo/weekly-weather-ranking";
import { buildAlternates, localeUrl, routeRobots } from "../../seo";

const PATH = "/best-weather-this-week";
const title = "這週哪裡天氣好？未來7天基本不下雨城市排行 | Where Not Rain";
const description =
  "比較熱門旅行地未來7天基本不下雨的天數、預計總降雨和最高降雨機率，快速找到這週更適合出遊的城市。";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildAlternates(PATH, "zh-hant", ["en", "zh-cn", "zh-hant"]),
  robots: routeRobots("ranking", true),
  openGraph: {
    type: "website",
    url: localeUrl("zh-hant", PATH),
    siteName: "Where Not Rain",
    title,
    description,
    locale: "zh_TW",
  },
};

export default async function Page(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const items = buildWeeklyWeatherRanking(dataset, "zh-hant");
  const pageUrl = localeUrl("zh-hant", PATH);
  const siteBase = localeUrl("en", "/");
  const topItems = items.slice(0, 20);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: "未來7天天氣更好的旅行地",
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-Hant",
        mainEntity: { "@id": `${pageUrl}#ranking` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#ranking`,
        name: "基本不下雨旅行地排行",
        numberOfItems: topItems.length,
        itemListElement: topItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${item.cityName} · ${item.countryName}`,
          url: new URL(item.path, siteBase).toString(),
        })),
      },
    ],
  };

  return (
    <BestWeatherThisWeekPage
      locale="zh-hant"
      items={items}
      dataUpdatedAt={dataset.dataUpdatedAt}
      jsonLd={jsonLd}
    />
  );
}
