import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { CountryMapHome } from "../../components/CountryMapHome";
import { JsonLd } from "../../components/JsonLd";
import { buildCountryMapHomeItems } from "../../world/home-map-model";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

const HOME_TITLE = "哪裡不下雨？本週末和未來7天少雨地圖 | Where Not Rain";
const HOME_DESCRIPTION =
  "選擇本週末、未來 7 天或自訂預報日期，世界地圖會按同一時間段重新著色，直觀看出哪些國家和城市基本不下雨。";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: HOME_TITLE },
    description: HOME_DESCRIPTION,
    alternates: buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("homepage", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-hant", "/"),
      siteName: "Where Not Rain",
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      locale: "zh_TW",
    },
  };
}

export default async function TraditionalChineseHome(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const countries = buildCountryMapHomeItems(dataset, "zh-hant");
  const pageUrl = localeUrl("zh-hant", "/");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${pageUrl}#app`,
        name: "Where Not Rain 少雨世界地圖",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        inLanguage: "zh-Hant",
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: "哪裡不下雨？按時間查看少雨旅行地圖",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-Hant",
        mainEntity: { "@id": `${pageUrl}#app` },
        hasPart: { "@id": `${pageUrl}#countries` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#countries`,
        name: "國家旅行天氣地圖",
        numberOfItems: countries.length,
        itemListElement: countries.map((country, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${country.name}旅行天氣地圖`,
          url: localeUrl("zh-hant", `/${country.slug}`),
        })),
      },
    ],
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <CountryMapHome countries={countries} locale="zh-hant" />
    </main>
  );
}
