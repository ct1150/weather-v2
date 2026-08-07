import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset, projectCity } from "../../../../build/bake";
import { ChineseCityWeatherPage } from "../../../../components/ChineseCityWeatherPage";
import { toTraditionalText } from "../../../../trips/traditional";
import { buildAlternates, localeUrl, routeRobots } from "../../../seo";

export async function generateStaticParams(): Promise<
  ReadonlyArray<{ countrySlug: string; citySlug: string }>
> {
  const dataset = await getBakedDataset();
  return dataset.cities.map((item) => ({
    countrySlug: item.country.slug,
    citySlug: item.city.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}): Promise<Metadata> {
  const dataset = await getBakedDataset();
  const baked = dataset.cities.find(
    (item) => item.country.slug === params.countrySlug && item.city.slug === params.citySlug,
  );
  if (baked === undefined) return { title: "目的地旅行天氣" };
  const cityName = toTraditionalText(baked.city.name["zh-cn"]);
  const countryName = toTraditionalText(baked.country.name["zh-cn"]);
  const title = `${cityName}旅行天氣：降雨、氣溫和7天評分`;
  const description = `查看${cityName}未來7天天氣、降雨風險、氣溫和旅行評分，並與${countryName}其他目的地比較。`;
  return {
    title,
    description,
    alternates: buildAlternates(`/${params.countrySlug}/${params.citySlug}`, "zh-hant", [
      "en",
      "zh-cn",
      "zh-hant",
    ]),
    robots: routeRobots("city", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-hant", `/${params.countrySlug}/${params.citySlug}`),
      siteName: "Where Not Rain",
      title,
      description,
      locale: "zh_TW",
    },
  };
}

export default async function TraditionalChineseCityPage({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const baked = dataset.cities.find(
    (item) => item.country.slug === params.countrySlug && item.city.slug === params.citySlug,
  );
  if (baked === undefined) notFound();

  const base = projectCity(dataset, params.countrySlug, params.citySlug, "zh-cn");
  const citySlugById = new Map(
    dataset.cities.map((item) => [item.city.id, item.city.slug] as const),
  );
  const viewModel = {
    ...base,
    city: {
      ...base.city,
      cityName: toTraditionalText(base.city.cityName),
      countryName: toTraditionalText(base.city.countryName),
    },
    weather:
      base.weather === null
        ? null
        : { ...base.weather, conditionLabel: toTraditionalText(base.weather.conditionLabel) },
    forecastDays: base.forecastDays?.map((day) => ({
      ...day,
      weather: {
        ...day.weather,
        conditionLabel: toTraditionalText(day.weather.conditionLabel),
      },
    })),
    relatedLinks: base.relatedLinks.map((link) => ({
      ...link,
      cityName: toTraditionalText(link.cityName),
      countryName: toTraditionalText(link.countryName),
      path: `/zh-hant/${params.countrySlug}/${citySlugById.get(link.cityId) ?? link.cityId}`,
    })),
  };
  const pageUrl = localeUrl("zh-hant", `/${params.countrySlug}/${params.citySlug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: viewModel.city.cityName,
    description: `查看${viewModel.city.cityName}未來7天天氣、降雨風險、氣溫和旅行評分。`,
    url: pageUrl,
    inLanguage: "zh-Hant",
    containedInPlace: { "@type": "Country", name: viewModel.city.countryName },
  };

  return <ChineseCityWeatherPage viewModel={viewModel} locale="zh-hant" jsonLd={jsonLd} />;
}
