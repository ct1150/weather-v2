import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const description = "選擇出行日期和最在意的天氣條件，比較少雨、氣溫、風力及親子或長輩舒適度。";

export const metadata: Metadata = {
  title: "按天氣尋找旅行目的地",
  description,
  alternates: buildAlternates("/discover", "zh-hant", ["en", "zh-cn", "zh-hant"]),
  robots: { index: true, follow: true },
};

export default function TraditionalWeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Where Not Rain 天氣目的地推薦",
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
