import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const title = "哪裡不下雨？按日期找少雨旅行目的地 | Where Not Rain";
const description =
  "選擇出發城市和旅行日期，對可達目的地按降雨風險排序，直接取得 Top 3 少雨旅行目的地。";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildAlternates("/discover", "zh-hant", ["en", "zh-cn", "zh-hant"]),
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: localeUrl("zh-hant", "/discover"),
    siteName: "Where Not Rain",
    title,
    description,
    locale: "zh_TW",
  },
};

export default function TraditionalWeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${localeUrl("zh-hant", "/discover")}#app`,
    name: "Where Not Rain 少雨目的地工具",
    description,
    url: localeUrl("zh-hant", "/discover"),
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    inLanguage: "zh-Hant",
  };

  return (
    <>
      <JsonLd schema={jsonLd} />
      <DiscoveryRetentionCompanion locale="zh-hant" />
      <WeatherDiscoveryPlannerV2 locale="zh-hant" />
    </>
  );
}
