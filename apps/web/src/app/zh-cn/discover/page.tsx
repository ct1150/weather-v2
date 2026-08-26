import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const title = "高级少雨候选工具 | Where Not Rain";
const description =
  "可选的高级候选工具，包含出发地和静态可达范围规划；Where Not Rain 的主体验已改为首页按时间变化的世界少雨地图。";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildAlternates("/discover", "zh-cn", ["en", "zh-cn", "zh-hant"]),
  robots: { index: false, follow: true },
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
    name: "Where Not Rain 高级少雨候选工具",
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
