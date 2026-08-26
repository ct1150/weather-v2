import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../components/CountryMapHome";
import { JsonLd } from "../components/JsonLd";
import { buildCountryMapHomeItems } from "../world/home-map-model";
import { buildAlternates, localeUrl, routeRobots } from "./seo";

const HOME_TITLE = "Where Is It Least Likely to Rain? Weekend & 7-Day Map | Where Not Rain";
const HOME_DESCRIPTION =
  "Pick this weekend, the next 7 days or custom forecast dates and watch the world map update to show countries with more mostly rain-free travel days.";

export interface TravelRadarPageProps {
  readonly countryLinks: ReadonlyArray<CountryMapHomeItem>;
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

/** Historical export name retained for test and import compatibility. */
export function TravelRadarPage({ countryLinks, jsonLd }: TravelRadarPageProps): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}
      <CountryMapHome countries={countryLinks} locale="en" />
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: HOME_TITLE },
    description: HOME_DESCRIPTION,
    alternates: buildAlternates("/", "en", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("homepage", true),
    openGraph: {
      type: "website",
      url: localeUrl("en", "/"),
      siteName: "Where Not Rain",
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
    },
    twitter: { card: "summary", title: HOME_TITLE, description: HOME_DESCRIPTION },
  };
}

export default async function Page(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const countryLinks = buildCountryMapHomeItems(dataset, "en");
  const pageUrl = localeUrl("en", "/");
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${pageUrl}#website`,
        name: "Where Not Rain",
        alternateName: "Time-driven rain-free travel weather map",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        inLanguage: "en",
      },
      {
        "@type": "WebApplication",
        "@id": `${pageUrl}#app`,
        name: "Where Not Rain world weather map",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        inLanguage: "en",
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: "Where is it least likely to rain?",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
        isPartOf: { "@id": `${pageUrl}#website` },
        mainEntity: { "@id": `${pageUrl}#app` },
        hasPart: { "@id": `${pageUrl}#countries` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#countries`,
        name: "Country travel weather maps",
        numberOfItems: countryLinks.length,
        itemListElement: countryLinks.map((country, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: country.name,
          url: localeUrl("en", country.path),
        })),
      },
    ],
  };

  return <TravelRadarPage countryLinks={countryLinks} jsonLd={jsonLd} />;
}
