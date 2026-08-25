import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../../components/CountryMapHome";
import { JsonLd } from "../../components/JsonLd";
import { toTraditionalText } from "../../trips/traditional";
import { summarizeCountryWeather } from "../../world/world-overview";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

const HOME_TITLE = "哪裡不下雨？未來14天少雨旅行目的地推薦 | Where Not Rain";
const HOME_DESCRIPTION =
  "日期定了但目的地還沒定？選擇出發城市和旅行日期，從可達目的地中找出降雨風險更低的 Top 3，再繼續查看國家和城市天氣地圖。";

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
  const countries: CountryMapHomeItem[] = dataset.countries.map((country) => {
    const cities = dataset.citiesByCountry.get(country.id) ?? [];
    const weather = summarizeCountryWeather(cities);
    const topIds = new Set(weather.topCityIds);
    const topCities = [
      ...cities.filter((item) => topIds.has(item.city.id)),
      ...cities.filter((item) => !topIds.has(item.city.id)),
    ].slice(0, 4);
    return {
      countryId: country.id,
      slug: country.slug,
      name: toTraditionalText(country.name["zh-cn"]),
      path: `/zh-hant/${country.slug}`,
      summary: toTraditionalText(country.summary?.["zh-cn"] ?? country.summary?.en ?? ""),
      cityCount: cities.length,
      cityNames: topCities.map((item) => toTraditionalText(item.city.name["zh-cn"])),
      weatherScore: weather.score,
      weatherStatus: weather.status,
    };
  });
  const pageUrl = localeUrl("zh-hant", "/");
  const discoverUrl = localeUrl("zh-hant", "/discover");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: "哪裡不下雨？按日期找少雨旅行目的地",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-Hant",
        mainEntity: { "@id": `${discoverUrl}#app` },
        hasPart: { "@id": `${pageUrl}#countries` },
      },
      {
        "@type": "WebApplication",
        "@id": `${discoverUrl}#app`,
        name: "Where Not Rain 少雨目的地工具",
        description: "選擇出發城市和日期，對可達目的地按降雨風險排序並返回 Top 3。",
        url: discoverUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        inLanguage: "zh-Hant",
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
