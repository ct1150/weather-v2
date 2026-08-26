import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscoveryRetentionCompanion } from "../../components/DiscoveryRetentionCompanion";
import { JsonLd } from "../../components/JsonLd";
import { WeatherDiscoveryPlannerV2 } from "../../components/WeatherDiscoveryPlannerV2";
import { buildAlternates, localeUrl } from "../seo";

const title = "Least-rain travel destinations for your dates | Where Not Rain";
const description =
  "Choose your starting city and travel dates to compare reachable destinations and get a Top 3 shortlist ranked by rain risk.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildAlternates("/discover", "en", ["en", "zh-cn", "zh-hant"]),
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: localeUrl("en", "/discover"),
    siteName: "Where Not Rain",
    title,
    description,
  },
};

export default function WeatherDiscoveryPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${localeUrl("en", "/discover")}#app`,
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
