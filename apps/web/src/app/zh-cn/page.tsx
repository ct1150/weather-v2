import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../../components/CountryMapHome";
import { JsonLd } from "../../components/JsonLd";
import { summarizeCountryWeather } from "../../world/world-overview";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

const HOME_TITLE = "哪里不下雨？未来14天少雨旅行目的地推荐 | Where Not Rain";
const HOME_DESCRIPTION =
  "日期定了但目的地还没定？选择出发城市和旅行日期，从可达目的地中找出降雨风险更低的 Top 3，再继续查看国家和城市天气地图。";

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
      name: country.name["zh-cn"],
      path: `/zh-cn/${country.slug}`,
      summary: country.summary?.["zh-cn"] ?? country.summary?.en ?? "",
      cityCount: cities.length,
      cityNames: topCities.map((item) => item.city.name["zh-cn"]),
      weatherScore: weather.score,
      weatherStatus: weather.status,
    };
  });
  const pageUrl = localeUrl("zh-cn", "/");
  const discoverUrl = localeUrl("zh-cn", "/discover");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: "哪里不下雨？按日期找少雨旅行目的地",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-CN",
        mainEntity: { "@id": `${discoverUrl}#app` },
        hasPart: { "@id": `${pageUrl}#countries` },
      },
      {
        "@type": "WebApplication",
        "@id": `${discoverUrl}#app`,
        name: "Where Not Rain 少雨目的地工具",
        description: "选择出发城市和日期，对可达目的地按降雨风险排序并返回 Top 3。",
        url: discoverUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        inLanguage: "zh-CN",
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
