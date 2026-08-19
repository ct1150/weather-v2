import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const description = "选择出行日期和可选天气限制，只比较整体降雨风险最低的 3 个旅行目的地。";

export const metadata: Metadata = {
  title: "哪里不下雨：少雨目的地 Top 3",
  description,
  alternates: buildAlternates("/discover", "zh-cn", ["en", "zh-cn", "zh-hant"]),
  robots: { index: true, follow: true },
};

export default function SimplifiedWeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
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
