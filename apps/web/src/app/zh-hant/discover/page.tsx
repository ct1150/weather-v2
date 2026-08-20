import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const description = "為既有儲存連結保留的舊版少雨候選工具；目前主產品已切換為國家旅行天氣地圖。";

export const metadata: Metadata = {
  title: "舊版少雨候選工具",
  description,
  alternates: buildAlternates("/discover", "zh-hant", ["en", "zh-cn", "zh-hant"]),
  robots: { index: false, follow: true },
};

export default function TraditionalWeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Where Not Rain 舊版少雨候選工具",
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
