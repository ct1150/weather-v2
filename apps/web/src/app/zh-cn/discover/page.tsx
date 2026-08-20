import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const description = "为已有保存链接保留的旧版少雨候选工具；当前主产品已经切换为国家旅行天气地图。";

export const metadata: Metadata = {
  title: "旧版少雨候选工具",
  description,
  alternates: buildAlternates("/discover", "zh-cn", ["en", "zh-cn", "zh-hant"]),
  robots: { index: false, follow: true },
};

export default function SimplifiedWeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Where Not Rain 旧版少雨候选工具",
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
