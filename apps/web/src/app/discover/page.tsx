import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../seo";

const description =
  "Legacy least-rain shortlist kept for existing saved links. The primary product is now the country travel weather map.";

export const metadata: Metadata = {
  title: "Legacy least-rain finder",
  description,
  alternates: buildAlternates("/discover", "en", ["en", "zh-cn", "zh-hant"]),
  robots: { index: false, follow: true },
};

export default function WeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Where Not Rain legacy least-rain finder",
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
