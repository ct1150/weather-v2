import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../seo";

const description =
  "Choose travel dates and priorities, then compare destinations by rain, temperature, wind and trip comfort.";

export const metadata: Metadata = {
  title: "Find a travel destination by weather",
  description,
  alternates: buildAlternates("/discover", "en", ["en", "zh-cn", "zh-hant"]),
  robots: { index: true, follow: true },
};

export default function WeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Where Not Rain destination finder",
    description,
    url: localeUrl("en", "/discover"),
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    inLanguage: "en",
  };

  return (
    <>
      <JsonLd schema={jsonLd} />
      <DiscoveryRetentionCompanion locale="en" />
      <WeatherDiscoveryPlannerV2 locale="en" />
    </>
  );
}
