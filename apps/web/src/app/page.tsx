import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../components/CountryMapHome";
import { JsonLd } from "../components/JsonLd";
import { summarizeCountryWeather } from "../world/world-overview";
import { buildAlternates, localeUrl, routeRobots } from "./seo";

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
  const title = "World travel weather map | Where Not Rain";
  const description =
    "See supported countries on one world map, compare their overall travel-weather outlook, then open a country to compare cities.";
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
    const weather = summarizeCountryWeather(cities);
    const topIds = new Set(weather.topCityIds);
    const topCities = [
      ...cities.filter((item) => topIds.has(item.city.id)),
      ...cities.filter((item) => !topIds.has(item.city.id)),
    ].slice(0, 4);
    return {
      countryId: country.id,
      slug: country.slug,
      name: country.name.en,
      path: `/${country.slug}`,
      summary: country.summary?.en ?? "",
      cityCount: cities.length,
      cityNames: topCities.map((item) => item.city.name.en),
      weatherScore: weather.score,
      weatherStatus: weather.status,
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
        alternateName: "World travel weather map",
        description:
          "Explore supported countries visually, then compare city weather inside a country.",
        url: pageUrl,
        inLanguage: "en",
      },
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        name: "World travel weather map",
        description:
          "A visual weather-first entry point to supported country and city travel weather maps.",
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
        isPartOf: { "@id": `${pageUrl}#website` },
        mainEntity: { "@id": `${pageUrl}#countries` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#countries`,
        name: "Supported country travel weather maps",
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
