import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getBakedDataset, projectCountry } from "../../../build/bake";
import { CountryWeatherExplorer } from "../../../components/CountryWeatherExplorer";
import { JsonLd } from "../../../components/JsonLd";
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
  const cityNames = (dataset.citiesByCountry.get(country.id) ?? []).map((item) =>
    toTraditionalText(item.city.name["zh-cn"]),
  );
  const simplified = countrySearchCopyZh(country.name["zh-cn"], cityNames);
  const title = toTraditionalText(simplified.title);
  const description = toTraditionalText(simplified.description);
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
  const countryCities = dataset.citiesByCountry.get(sourceCountry.id) ?? [];
  const slugById = new Map(countryCities.map((item) => [item.city.id, item.city.slug] as const));
  const country = {
    ...base.country,
    slug: `zh-hant/${base.country.slug}`,
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
    path: `/zh-hant/${sourceCountry.slug}/${slugById.get(city.cityId) ?? city.cityId}`,
    days: city.days.map((day) => ({
      ...day,
      weather: {
        ...day.weather,
        conditionLabel: toTraditionalText(day.weather.conditionLabel),
      },
    })),
  }));
  const pageUrl = localeUrl("zh-hant", `/${sourceCountry.slug}`);
  const description = toTraditionalText(
    countrySearchCopyZh(
      sourceCountry.name["zh-cn"],
      countryCities.map((item) => item.city.name["zh-cn"]),
    ).description,
  );
  const updatedLabel = toTraditionalText(
    (base.dataUpdatedLabel ?? "Latest available data").replace(/^Updated /u, "更新於 "),
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: `${country.name}旅行天氣地圖`,
        description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "zh-Hant",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "國家天氣地圖",
            item: localeUrl("zh-hant", "/"),
          },
          { "@type": "ListItem", position: 2, name: country.name, item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        name: `${country.name}熱門旅遊地天氣`,
        numberOfItems: cities.length,
        itemListElement: cities.map((city, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: city.cityName,
          url: localeUrl(
            "zh-hant",
            `/${sourceCountry.slug}/${slugById.get(city.cityId) ?? city.cityId}`,
          ),
        })),
      },
    ],
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="country-map-page-intro">
        <nav aria-label="麵包屑" className="country-breadcrumb">
          <ol>
            <li>
              <a href="/zh-hant" className="focus-ring">
                國家天氣地圖
              </a>
            </li>
            <li aria-current="page">{country.name}</li>
          </ol>
        </nav>
        <p className="eyebrow">未來 7 天旅行天氣</p>
        <h1>一張圖看懂{country.name}哪裡天氣更好</h1>
        <p>
          地圖直接顯示 {cities.length}{" "}
          個熱門旅遊地的天氣圖示、少雨天數和氣溫。點擊任意地點，再查看逐日預報。
        </p>
      </section>

      {cities.length > 0 ? (
        <CountryWeatherExplorer
          country={country}
          countries={countries}
          cities={cities}
          updatedLabel={updatedLabel}
          locale="zh-hant"
        />
      ) : (
        <p className="mt-10 text-body text-muted">目前沒有可比較的城市天氣資料。</p>
      )}

      <footer className="page-footer">
        <span>Where Not Rain · 一張地圖看懂熱門旅遊地天氣</span>
        <span>
          天氣資料：<a href="https://open-meteo.com/">Open-Meteo</a>
        </span>
      </footer>
    </main>
  );
}
