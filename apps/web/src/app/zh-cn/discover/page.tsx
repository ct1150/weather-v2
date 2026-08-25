import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const title = "哪里不下雨？按日期找少雨旅行目的地 | Where Not Rain";
const description =
  "选择出发城市和旅行日期，对可达目的地按降雨风险排序，直接获得 Top 3 少雨旅行目的地。";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildAlternates("/discover", "zh-cn", ["en", "zh-cn", "zh-hant"]),
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: localeUrl("zh-cn", "/discover"),
    siteName: "Where Not Rain",
    title,
    description,
    locale: "zh_CN",
  },
};

export default function SimplifiedWeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${localeUrl("zh-cn", "/discover")}#app`,
    name: "Where Not Rain 少雨目的地工具",
    description,
    url: localeUrl("zh-cn", "/discover"),
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    inLanguage: "zh-CN",
  };

  return (
    <>
      <JsonLd schema={jsonLd} />
      <DiscoveryRetentionCompanion locale="zh-cn" />
      <WeatherDiscoveryPlannerV2 locale="zh-cn" />
    </>
  );
}
