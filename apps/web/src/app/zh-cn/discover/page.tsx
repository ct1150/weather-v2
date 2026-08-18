import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../../seo";

const description = "选择出行日期和最在意的天气条件，对比少雨、气温、风力及亲子或长辈舒适度。";

export const metadata: Metadata = {
  title: "按天气寻找旅行目的地",
  description,
  alternates: buildAlternates("/discover", "zh-cn", ["en", "zh-cn", "zh-hant"]),
  robots: { index: true, follow: true },
};

export default function SimplifiedWeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Where Not Rain 天气目的地推荐",
    description,
    url: localeUrl("zh-cn", "/discover"),
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    inLanguage: "zh-CN",
  };

  return (
    <>
      <JsonLd schema={jsonLd} />
      <WeatherDiscoveryPlannerV2 locale="zh-cn" />
    </>
  );
}
