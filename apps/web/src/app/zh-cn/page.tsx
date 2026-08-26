import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { CountryMapHome } from "../../components/CountryMapHome";
import { JsonLd } from "../../components/JsonLd";
import { buildCountryMapHomeItems } from "../../world/home-map-model";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

const HOME_TITLE = "哪里不下雨？本周末和未来7天少雨地图 | Where Not Rain";
const HOME_DESCRIPTION =
  "选择本周末、未来 7 天或自定义预报日期，世界地图会按同一时间段重新着色，直观看出哪些国家和城市基本不下雨。";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: HOME_TITLE },
    description: HOME_DESCRIPTION,
    alternates: buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("homepage", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-cn", "/"),
      siteName: "Where Not Rain",
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      locale: "zh_CN",
    },
  };
}

export default async function SimplifiedChineseHome(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const countries = buildCountryMapHomeItems(dataset, "zh-cn");
  const pageUrl = localeUrl("zh-cn", "/");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${pageUrl}#app`,
        name: "Where Not Rain 少雨世界地图",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        inLanguage: "zh-CN",
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: "哪里不下雨？按时间查看少雨旅行地图",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-CN",
        mainEntity: { "@id": `${pageUrl}#app` },
        hasPart: { "@id": `${pageUrl}#countries` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#countries`,
        name: "国家旅行天气地图",
        numberOfItems: countries.length,
        itemListElement: countries.map((country, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${country.name}旅行天气地图`,
          url: localeUrl("zh-cn", `/${country.slug}`),
        })),
      },
    ],
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <CountryMapHome countries={countries} locale="zh-cn" />
    </main>
  );
}
