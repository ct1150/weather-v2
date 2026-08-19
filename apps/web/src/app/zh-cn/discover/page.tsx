import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const description =
  "选择支持的出发地、交通方式、最长单程规划时间和日期，只比较可达范围内整体降雨风险最低的 3 个目的地。";

export const metadata: Metadata = {
  title: "可达范围内哪里不下雨：Top 3",
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
