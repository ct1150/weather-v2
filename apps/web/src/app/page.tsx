import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../build/bake";
import { CountryMapHome, type CountryMapHomeItem } from "../components/CountryMapHome";
import { JsonLd } from "../components/JsonLd";
import { summarizeCountryWeather } from "../world/world-overview";
import { buildAlternates, localeUrl, routeRobots } from "./seo";

const HOME_TITLE = "Least-rain travel destinations for your dates | Where Not Rain";
const HOME_DESCRIPTION =
  "Dates fixed but destination open? Choose a starting city and travel dates to find reachable destinations with the lowest rain risk, then explore country weather maps.";

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
  const discoverUrl = localeUrl("en", "/discover");
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${pageUrl}#website`,
        name: "Where Not Rain",
        alternateName: "Least-rain travel destination finder",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        inLanguage: "en",
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: "Find least-rain travel destinations",
        description: HOME_DESCRIPTION,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
        isPartOf: { "@id": `${pageUrl}#website` },
        mainEntity: { "@id": `${discoverUrl}#app` },
        hasPart: { "@id": `${pageUrl}#countries` },
      },
      {
        "@type": "WebApplication",
        "@id": `${discoverUrl}#app`,
        name: "Where Not Rain least-rain destination finder",
        description:
          "Choose a starting city and dates, then compare reachable destinations ranked by rain risk.",
        url: discoverUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        inLanguage: "en",
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
