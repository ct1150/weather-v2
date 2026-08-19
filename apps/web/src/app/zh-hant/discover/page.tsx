import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const description = "選擇出行日期和可選天氣限制，只比較整體降雨風險最低的 3 個旅行目的地。";

export const metadata: Metadata = {
  title: "哪裡不下雨：少雨目的地 Top 3",
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
