import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const title = "進階少雨候選工具 | Where Not Rain";
const description =
  "可選的進階候選工具，包含出發地和靜態可達範圍規劃；Where Not Rain 的主體驗已改為首頁按時間變化的世界少雨地圖。";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildAlternates("/discover", "zh-hant", ["en", "zh-cn", "zh-hant"]),
  robots: { index: false, follow: true },
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
    name: "Where Not Rain 進階少雨候選工具",
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
