import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../components/CountryMapHome";
import { JsonLd } from "../components/JsonLd";
import { buildAlternates, localeUrl, routeRobots } from "./seo";

export interface TravelRadarPageProps {
  readonly countryLinks: ReadonlyArray<CountryMapHomeItem>;
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

/**
 * Historical export name retained for test and import compatibility. The active
 * product surface is now the country-first travel-weather map.
 */
export function TravelRadarPage({ countryLinks, jsonLd }: TravelRadarPageProps): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}
      <CountryMapHome countries={countryLinks} locale="en" />
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const title = "Country travel weather maps | Where Not Rain";
  const description =
    "Choose a country and compare the next seven days across popular travel destinations on one weather map.";
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates("/", "en", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("homepage", true),
    openGraph: {
      type: "website",
      url: localeUrl("en", "/"),
      siteName: "Where Not Rain",
      title,
      description,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const countryLinks: CountryMapHomeItem[] = dataset.countries.map((country) => {
    const cities = dataset.citiesByCountry.get(country.id) ?? [];
    return {
      slug: country.slug,
      name: country.name.en,
      path: `/${country.slug}`,
      summary: country.summary?.en ?? "",
      cityCount: cities.length,
      cityNames: cities.slice(0, 4).map((item) => item.city.name.en),
    };
  });
  const pageUrl = localeUrl("en", "/");
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${pageUrl}#website`,
        name: "Where Not Rain",
        alternateName: "Country travel weather maps",
        description:
          "Choose a country and read popular destinations' weather at a glance on one map.",
        url: pageUrl,
        inLanguage: "en",
      },
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: "Country travel weather maps",
        description:
          "Weather icons, lower-rain days and temperatures for popular destinations in each country.",
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
        isPartOf: { "@id": `${pageUrl}#website` },
        mainEntity: { "@id": `${pageUrl}#countries` },
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
