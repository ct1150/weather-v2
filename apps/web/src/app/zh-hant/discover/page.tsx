import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const description =
  "選擇支援的出發地、交通方式、最長單程規劃時間和日期，只比較可達範圍內整體降雨風險最低的 3 個目的地。";

export const metadata: Metadata = {
  title: "可達範圍內哪裡不下雨：Top 3",
  description,
  alternates: buildAlternates("/discover", "zh-hant", ["en", "zh-cn", "zh-hant"]),
  robots: { index: true, follow: true },
};

export default function TraditionalWeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
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
