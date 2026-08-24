import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset, projectCity } from "../../../../build/bake";
import { ChineseCityWeatherPage } from "../../../../components/ChineseCityWeatherPage";
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
  if (baked === undefined) return { title: "目的地旅行天气" };
  const cityName = baked.city.name["zh-cn"];
  const countryName = baked.country.name["zh-cn"];
  const title = `${cityName}未来7天天气：哪几天基本不下雨`;
  const description = `查看${cityName}未来7天天气、每天是否下雨、预计降雨和气温，并与${countryName}其他目的地比较。`;
  return {
    title,
    description,
    alternates: buildAlternates(`/${params.countrySlug}/${params.citySlug}`, "zh-cn", [
      "en",
      "zh-cn",
      "zh-hant",
    ]),
    robots: routeRobots("city", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-cn", `/${params.countrySlug}/${params.citySlug}`),
      siteName: "Where Not Rain",
      title,
      description,
      locale: "zh_CN",
    },
  };
}

export default async function SimplifiedChineseCityPage({
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
  const viewModel = {
    ...base,
    relatedLinks: base.relatedLinks.map((link) => ({
      ...link,
      path: `/zh-cn/${params.countrySlug}/${dataset.cities.find((item) => item.city.id === link.cityId)?.city.slug ?? link.cityId}`,
    })),
  };
  const pageUrl = localeUrl("zh-cn", `/${params.countrySlug}/${params.citySlug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: viewModel.city.cityName,
    description: `查看${viewModel.city.cityName}未来7天天气、基本不下雨的日期、预计降雨和气温。`,
    url: pageUrl,
    inLanguage: "zh-CN",
    containedInPlace: { "@type": "Country", name: viewModel.city.countryName },
  };

  return <ChineseCityWeatherPage viewModel={viewModel} locale="zh-cn" jsonLd={jsonLd} />;
}
