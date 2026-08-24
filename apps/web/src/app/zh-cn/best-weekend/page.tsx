import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../../build/bake";
import { BestWeatherThisWeekPage } from "../../../components/BestWeatherThisWeekPage";
import { SocialWeatherShareCard } from "../../../components/SocialWeatherShareCard";
import { buildWeekendWeatherRanking } from "../../../seo/weekly-weather-ranking";
import { buildAlternates, localeUrl, routeRobots } from "../../seo";

const PATH = "/best-weekend";
const title = "本周末哪里天气好？基本不下雨城市排行 | Where Not Rain";
const description =
  "比较热门旅行地本周末基本不下雨的天数、预计总降雨和最高降雨概率，快速找到周末更适合出游的城市。";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildAlternates(PATH, "zh-cn", ["en", "zh-cn", "zh-hant"]),
  robots: routeRobots("ranking", true),
  openGraph: {
    type: "website",
    url: localeUrl("zh-cn", PATH),
    siteName: "Where Not Rain",
    title,
    description,
    locale: "zh_CN",
  },
};

export default async function Page(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const items = buildWeekendWeatherRanking(dataset, "zh-cn");
  const pageUrl = localeUrl("zh-cn", PATH);
  const siteBase = localeUrl("en", "/");
  const topItems = items.slice(0, 20);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: "本周末天气更好的旅行地",
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-CN",
        mainEntity: { "@id": `${pageUrl}#ranking` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#ranking`,
        name: "本周末基本不下雨旅行地排行",
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
    <>
      <BestWeatherThisWeekPage
        locale="zh-cn"
        mode="weekend"
        items={items}
        dataUpdatedAt={dataset.dataUpdatedAt}
        jsonLd={jsonLd}
      />
      <SocialWeatherShareCard locale="zh-cn" mode="weekend" pageUrl={pageUrl} items={topItems.slice(0, 3)} />
    </>
  );
}
