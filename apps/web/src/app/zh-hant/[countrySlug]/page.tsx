import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset, projectCountry } from "../../../build/bake";
import { JsonLd } from "../../../components/JsonLd";
import { TraditionalCountryWeatherExplorer } from "../../../components/TraditionalCountryWeatherExplorer";
import { toTraditionalText } from "../../../trips/traditional";
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
  if (country === undefined) return { title: "國家旅行天氣地圖" };
  const countryName = toTraditionalText(country.name["zh-cn"]);
  const cityNames = (dataset.citiesByCountry.get(country.id) ?? []).map((item) =>
    toTraditionalText(item.city.name["zh-cn"]),
  );
  const simplifiedCopy = countrySearchCopyZh(country.name["zh-cn"], cityNames);
  const title = toTraditionalText(simplifiedCopy.title);
  const description = toTraditionalText(simplifiedCopy.description);
  return {
    title,
    description,
    alternates: buildAlternates(`/${country.slug}`, "zh-hant", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("country", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-hant", `/${country.slug}`),
      siteName: "Where Not Rain",
      title,
      description,
      locale: "zh_TW",
    },
  };
}

export default async function TraditionalChineseCountryPage({
  params,
}: {
  params: { countrySlug: string };
}): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const sourceCountry = dataset.countries.find((item) => item.slug === params.countrySlug);
  if (sourceCountry === undefined) notFound();

  const base = projectCountry(dataset, sourceCountry.slug, "zh-cn");
  const country = {
    ...base.country,
    name: toTraditionalText(base.country.name),
    summary: base.country.summary === null ? null : toTraditionalText(base.country.summary),
  };
  const countries = (base.availableCountries ?? []).map((option) => ({
    ...option,
    name: toTraditionalText(option.name),
    path: `/zh-hant/${option.slug}`,
  }));
  const cities = (base.weatherCities ?? []).map((city) => ({
    ...city,
    cityName: toTraditionalText(city.cityName),
    countryName: toTraditionalText(city.countryName),
    path: `/zh-hant/${sourceCountry.slug}/${city.cityId}`,
    days: city.days.map((day) => ({
      ...day,
      weather: {
        ...day.weather,
        conditionLabel: toTraditionalText(day.weather.conditionLabel),
      },
    })),
  }));
  const countryCities = dataset.citiesByCountry.get(sourceCountry.id) ?? [];
  const cityPathById = new Map(countryCities.map((item) => [item.city.id, item.city.slug] as const));
  const localizedCities = cities.map((city) => ({
    ...city,
    path: `/zh-hant/${sourceCountry.slug}/${cityPathById.get(city.cityId) ?? city.cityId}`,
  }));
  const pageUrl = localeUrl("zh-hant", `/${sourceCountry.slug}`);
  const description = toTraditionalText(
    countrySearchCopyZh(
      sourceCountry.name["zh-cn"],
      countryCities.map((item) => item.city.name["zh-cn"]),
    ).description,
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: `${country.name}旅行天氣地圖`,
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-Hant",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "亞洲旅行天氣", item: localeUrl("zh-hant", "/") },
          { "@type": "ListItem", position: 2, name: country.name, item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        name: `${country.name}旅遊城市天氣比較`,
        numberOfItems: localizedCities.length,
        itemListElement: localizedCities.map((city, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: city.cityName,
          url: localeUrl("zh-hant", `/${sourceCountry.slug}/${cityPathById.get(city.cityId) ?? city.cityId}`),
        })),
      },
    ],
  };
  const updatedLabel = toTraditionalText(
    (base.dataUpdatedLabel ?? "Latest available data").replace(/^Updated /u, "更新於 "),
  );

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10 max-w-3xl">
          <nav aria-label="麵包屑" className="country-breadcrumb">
            <ol>
              <li><a href="/zh-hant" className="focus-ring">亞洲旅行天氣</a></li>
              <li aria-current="page">{country.name}</li>
            </ol>
          </nav>
          <p className="eyebrow mt-7">國家旅行天氣地圖</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
            比較{country.name}{localizedCities.length}個旅遊城市的天氣
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            {country.summary ?? `選擇旅行日期，在地圖上直接比較${country.name}全部旅遊城市的降雨、氣溫與旅行評分。`}
          </p>
        </div>
      </section>

      {localizedCities.length > 0 ? (
        <TraditionalCountryWeatherExplorer
          country={country}
          countries={countries}
          cities={localizedCities}
          updatedLabel={updatedLabel}
        />
      ) : (
        <p className="mt-10 text-body text-muted">目前沒有可比較的城市天氣資料。</p>
      )}

      <footer className="page-footer">
        <span>Where Not Rain · 用天氣決定去哪裡</span>
        <span>天氣資料：<a href="https://open-meteo.com/">Open-Meteo</a> · 衍生旅行評分</span>
      </footer>
    </main>
  );
}
