import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset, projectCountry } from "../../../build/bake";
import { CountryPage } from "../../[countrySlug]/page";
import { buildAlternates, countrySearchCopyZh, localeUrl, routeRobots } from "../../seo";

export async function generateStaticParams(): Promise<ReadonlyArray<{ countrySlug: string }>> {
  const dataset = await getBakedDataset();
  return dataset.countries.map((country) => ({ countrySlug: country.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string };
}): Promise<Metadata> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((item) => item.slug === params.countrySlug);
  if (country === undefined) return { title: "国家旅行天气地图" };
  const cityNames = (dataset.citiesByCountry.get(country.id) ?? []).map(
    (item) => item.city.name["zh-cn"],
  );
  const searchCopy = countrySearchCopyZh(country.name["zh-cn"], cityNames);
  return {
    title: searchCopy.title,
    description: searchCopy.description,
    alternates: buildAlternates(`/${country.slug}`, "zh-cn", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("country", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-cn", `/${country.slug}`),
      siteName: "Where Not Rain",
      title: searchCopy.title,
      description: searchCopy.description,
      locale: "zh_CN",
    },
  };
}

export default async function SimplifiedChineseCountryPage({
  params,
}: {
  params: { countrySlug: string };
}): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((item) => item.slug === params.countrySlug);
  if (country === undefined) notFound();
  const countryCities = dataset.citiesByCountry.get(country.id) ?? [];
  const citySlugById = new Map(countryCities.map((item) => [item.city.id, item.city.slug] as const));
  const localizeLink = <T extends { readonly cityId: string; readonly path: string },>(link: T): T => ({
    ...link,
    path: `/zh-cn/${country.slug}/${citySlugById.get(link.cityId) ?? link.cityId}`,
  });
  const baseViewModel = projectCountry(dataset, country.slug, "zh-cn");
  const viewModel = {
    ...baseViewModel,
    cities: baseViewModel.cities.map(localizeLink),
    rankings: baseViewModel.rankings.map((ranking) => ({
      ...ranking,
      items: ranking.items.map(localizeLink),
    })),
    relatedLinks: baseViewModel.relatedLinks.map(localizeLink),
    availableCountries: (baseViewModel.availableCountries ?? []).map((option) => ({
      ...option,
      path: `/zh-cn/${option.slug}`,
    })),
    weatherCities: (baseViewModel.weatherCities ?? []).map((city) => ({
      ...city,
      path: `/zh-cn/${country.slug}/${citySlugById.get(city.cityId) ?? city.cityId}`,
    })),
  };
  const searchCopy = countrySearchCopyZh(
    country.name["zh-cn"],
    countryCities.map((item) => item.city.name["zh-cn"]),
  );
  const pageUrl = localeUrl("zh-cn", `/${country.slug}`);
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  const destinationId = `${pageUrl}#destination`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: searchCopy.title,
        description: searchCopy.description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-CN",
        breadcrumb: { "@id": breadcrumbId },
        mainEntity: { "@id": destinationId },
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "亚洲旅行天气", item: localeUrl("zh-cn", "/") },
          { "@type": "ListItem", position: 2, name: country.name["zh-cn"], item: pageUrl },
        ],
      },
      {
        "@type": "TouristDestination",
        "@id": destinationId,
        name: country.name["zh-cn"],
        description: searchCopy.description,
        url: pageUrl,
        inLanguage: "zh-CN",
        containsPlace: countryCities.map((item) => ({
          "@type": "City",
          name: item.city.name["zh-cn"],
          url: localeUrl("zh-cn", `/${country.slug}/${item.city.slug}`),
        })),
      },
      {
        "@type": "ItemList",
        name: `${country.name["zh-cn"]}旅游城市天气比较`,
        numberOfItems: countryCities.length,
        itemListElement: countryCities.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.city.name["zh-cn"],
          url: localeUrl("zh-cn", `/${country.slug}/${item.city.slug}`),
        })),
      },
    ],
  };

  return <CountryPage viewModel={viewModel} jsonLd={jsonLd} locale="zh-cn" />;
}
