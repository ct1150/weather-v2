import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../seo";

const description =
  "Choose a supported starting hub, travel dates, transport mode and maximum one-way planning time, then compare the three reachable destinations with the lowest rain risk.";

export const metadata: Metadata = {
  title: "Find reachable least-rain destinations",
  description,
  alternates: buildAlternates("/discover", "en", ["en", "zh-cn", "zh-hant"]),
  robots: { index: true, follow: true },
};

export default function WeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Where Not Rain least-rain destination finder",
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
