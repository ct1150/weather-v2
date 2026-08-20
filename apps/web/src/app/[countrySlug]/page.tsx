import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import type { CountryPageViewModel } from "../view-models";
import { getBakedDataset, projectCountry } from "../../build/bake";
import {
  CountryWeatherExplorer,
  type CountryWeatherDataset,
} from "../../components/CountryWeatherExplorer";
import { JsonLd } from "../../components/JsonLd";
import { buildAlternates, countrySearchCopy, localeUrl, routeRobots } from "../seo";

export interface CountryPageProps {
  readonly viewModel: CountryPageViewModel;
  readonly locale?: "en" | "zh-cn";
  readonly jsonLd?: Readonly<Record<string, unknown>>;
  readonly countryDatasets?: ReadonlyArray<CountryWeatherDataset>;
}

export function CountryPage({
  viewModel,
  jsonLd,
  locale = "en",
  countryDatasets,
}: CountryPageProps): ReactElement {
  const { country, cities, weatherCities, availableCountries, dataUpdatedLabel, state } = viewModel;
  const isChinese = locale === "zh-cn";
  const isReady = state === "ready" || state === "stale";
  const hasWeatherMap =
    isReady &&
    weatherCities !== undefined &&
    weatherCities.length > 0 &&
    availableCountries !== undefined;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}

      <section className="country-map-page-intro">
        <nav aria-label={isChinese ? "面包屑" : "Breadcrumb"} className="country-breadcrumb">
          <ol>
            <li>
              <a href={isChinese ? "/zh-cn" : "/"} className="focus-ring">
                {isChinese ? "哪里不下雨" : "Country weather maps"}
              </a>
            </li>
            <li aria-current="page">{country.name}</li>
          </ol>
        </nav>
        <p className="eyebrow">
          {isChinese ? "未来 7 天旅行天气" : "Next 7 days of travel weather"}
        </p>
        <h1>
          {isChinese
            ? `一张图看懂${country.name}哪里天气更好`
            : `${country.name} travel weather at a glance`}
        </h1>
        <p>
          {isChinese
            ? `地图立即显示当前目录全部 ${cities.length} 个旅行地的天气图标、少雨天数和气温。点击任意地点，再查看逐日预报。`
            : `See all ${cities.length} supported travel destinations immediately, with weather icons, lower-rain days and temperatures. Tap any place only when you want the daily detail.`}
        </p>
      </section>

      {state === "loading" ? (
        <p role="status" className="mt-8 text-body text-muted">
          {isChinese ? "正在加载哪里不下雨…" : "Loading the country weather map…"}
        </p>
      ) : null}
      {state === "error" ? (
        <p role="alert" className="mt-8 text-body text-danger">
          {isChinese
            ? "暂时无法加载天气地图，请稍后重试。"
            : "The weather map is unavailable right now. Please try again."}
        </p>
      ) : null}

      {hasWeatherMap ? (
        <CountryWeatherExplorer
          country={country}
          countries={availableCountries}
          cities={weatherCities}
          updatedLabel={
            isChinese
              ? (dataUpdatedLabel ?? "Latest available data").replace(/^Updated /u, "更新于 ")
              : (dataUpdatedLabel ?? "Latest available data")
          }
          locale={locale}
          countryDatasets={countryDatasets}
        />
      ) : isReady ? (
        <section className="mt-10 rounded-2xl border border-border bg-white p-6">
          <h2 className="section-title">{isChinese ? "热门旅游地" : "Popular destinations"}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <li key={city.cityId}>
                <a href={city.path} className="destination-link focus-ring">
                  <strong>{city.cityName}</strong>
                  <span aria-hidden="true">→</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="page-footer">
        <span>
          {isChinese
            ? "Where Not Rain · 一张地图看懂热门旅游地天气"
            : "Where Not Rain · Popular travel weather on one map"}
        </span>
        <span>
          {isChinese ? "天气数据：" : "Forecast data by "}
          <a href="https://open-meteo.com/">Open-Meteo</a>
        </span>
      </footer>
    </main>
  );
}

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
  const cityNames = country
    ? (dataset.citiesByCountry.get(country.id) ?? []).map((item) => item.city.name.en)
    : [];
  const copy = country ? countrySearchCopy(country.name.en, cityNames) : null;
  return {
    title: copy?.title ?? "Country travel weather map",
    description:
      copy?.description ??
      "See weather icons, lower-rain days and temperatures across popular travel destinations on one map.",
    alternates: buildAlternates(`/${params.countrySlug}`, "en", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("country", true),
  };
}

export default async function Page({
  params,
}: {
  params: { countrySlug: string };
}): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((item) => item.slug === params.countrySlug);
  if (country === undefined) notFound();
  const viewModel = projectCountry(dataset, params.countrySlug, "en");
  const countryCities = dataset.citiesByCountry.get(country.id) ?? [];
  const countryDatasets: ReadonlyArray<CountryWeatherDataset> = dataset.countries.map((item) => {
    const projected = projectCountry(dataset, item.slug, "en");
    return {
      path: `/${item.slug}`,
      country: projected.country,
      cities: projected.weatherCities ?? [],
      updatedLabel: projected.dataUpdatedLabel ?? "Latest available data",
    };
  });
  const copy = countrySearchCopy(
    country.name.en,
    countryCities.map((item) => item.city.name.en),
  );
  const pageUrl = localeUrl("en", `/${country.slug}`);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: copy.title,
        description: copy.description,
        url: pageUrl,
        dateModified: dataset.dataUpdatedAt,
        inLanguage: "en",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Country weather maps",
            item: localeUrl("en", "/"),
          },
          { "@type": "ListItem", position: 2, name: country.name.en, item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        name: `${country.name.en} travel weather map destinations`,
        numberOfItems: countryCities.length,
        itemListElement: countryCities.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.city.name.en,
          url: localeUrl("en", `/${country.slug}/${item.city.slug}`),
        })),
      },
    ],
  };

  return (
    <CountryPage viewModel={viewModel} jsonLd={jsonLd} countryDatasets={countryDatasets} />
  );
}
