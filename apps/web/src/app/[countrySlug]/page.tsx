// apps/web/src/app/[countrySlug]/page.tsx
//
// Country destination page (PRD-FR-003, UX-STATE-001). App Router page (T03):
// bakes the dataset, resolves the country from the route `params`, and projects
// the `CountryPageViewModel` for the pure presentational component. Statically
// exported via `generateStaticParams`.

import type { ReactElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CountryPageViewModel, DestinationLinkViewModel } from "../view-models";
import { getBakedDataset, buildConfig, projectCountry } from "../../build/bake";
import { JsonLd } from "../../components/JsonLd";
import { CountryWeatherExplorer } from "../../components/CountryWeatherExplorer";
import { buildAlternates, routeRobots, localeUrl, countrySearchCopy } from "../seo";

export interface CountryPageProps {
  readonly viewModel: CountryPageViewModel;
  readonly locale?: "en" | "zh-cn";
  /** Server-rendered JSON-LD schema.org node. */
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

function CityList({
  items,
  emptyLabel,
  ranked = false,
}: {
  items: ReadonlyArray<DestinationLinkViewModel>;
  emptyLabel: string;
  ranked?: boolean;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-body text-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((dest, index) => (
        <li key={dest.cityId}>
          <a href={dest.path} className="destination-link focus-ring">
            <span>
              {ranked ? (
                <span className="mr-3 text-xs font-bold text-muted">#{index + 1}</span>
              ) : null}
              <span className="font-bold text-foreground">{dest.cityName}</span>
              <span className="ml-2 text-xs text-muted">{dest.countryName}</span>
            </span>
            <span aria-hidden="true" className="text-lg text-primary">
              →
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function CountryPage({ viewModel, jsonLd, locale = "en" }: CountryPageProps) {
  const {
    country,
    cities,
    rankings,
    relatedLinks,
    weatherCities,
    availableCountries,
    dataUpdatedLabel,
    state,
  } = viewModel;
  const isReady = state === "ready" || state === "stale";
  const hasWeatherConsole =
    isReady &&
    weatherCities !== undefined &&
    weatherCities.length > 0 &&
    availableCountries !== undefined;
  const isChinese = locale === "zh-cn";

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {jsonLd !== undefined ? <JsonLd schema={jsonLd} /> : null}

      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10 max-w-3xl">
          <a
            href={isChinese ? "/zh-cn" : "/"}
            className="text-xs font-bold text-primary hover:underline focus-ring"
          >
            {isChinese ? "← 返回亚洲旅行天气" : "← Back to Travel Radar"}
          </a>
          <p className="eyebrow mt-7">{isChinese ? "国家旅行天气地图" : "Country weather map"}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
            {isChinese
              ? `比较${country.name}${cities.length}个旅游城市的天气`
              : `Compare travel weather across ${cities.length} cities in ${country.name}`}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            {country.summary ??
              `Choose your travel dates, then compare all ${cities.length} listed cities directly on the map—no page hopping required.`}
          </p>
        </div>
      </section>

      {state === "loading" ? (
        <p role="status" className="mt-8 text-body text-muted">
          {isChinese ? "正在加载国家天气…" : "Loading country…"}
        </p>
      ) : null}

      {state === "error" ? (
        <p role="alert" className="mt-8 text-body text-danger">
          {isChinese
            ? "暂时无法加载该国家的天气，请稍后重试。"
            : "We couldn’t load this country right now. Please try again."}
        </p>
      ) : null}

      {hasWeatherConsole ? (
        <CountryWeatherExplorer
          country={country}
          countries={availableCountries}
          cities={weatherCities}
          updatedLabel={
            isChinese
              ? (dataUpdatedLabel ?? "Latest available data").replace(/^Updated /, "更新于 ")
              : (dataUpdatedLabel ?? "Latest available data")
          }
          locale={locale}
        />
      ) : isReady ? (
        <>
          <section aria-label="Cities" className="mt-12">
            <p className="eyebrow">{isChinese ? "浏览目的地" : "Browse the country"}</p>
            <h2 className="section-title mt-3">{isChinese ? "城市" : "Cities"}</h2>
            <CityList
              items={cities}
              emptyLabel={isChinese ? "暂时没有城市。" : "No cities listed yet."}
            />
          </section>

          {rankings.map((ranking) => (
            <section key={ranking.theme} aria-label={ranking.title} className="mt-12">
              <p className="eyebrow">{isChinese ? "精选推荐" : "Curated picks"}</p>
              <h2 className="section-title mt-3">{ranking.title}</h2>
              <CityList
                items={ranking.items}
                emptyLabel={
                  isChinese ? "该排名暂时没有目的地。" : "No destinations in this ranking yet."
                }
                ranked
              />
            </section>
          ))}

          {relatedLinks.length > 0 ? (
            <section aria-label="Related destinations" className="mt-12">
              <p className="eyebrow">{isChinese ? "继续探索" : "Keep exploring"}</p>
              <h2 className="section-title mt-3">
                {isChinese ? "相关目的地" : "Related destinations"}
              </h2>
              <CityList
                items={relatedLinks}
                emptyLabel={isChinese ? "暂时没有相关目的地。" : "No related destinations yet."}
              />
            </section>
          ) : null}
        </>
      ) : null}

      <footer className="page-footer">
        <span>
          {isChinese
            ? "Where Not Rain · 用天气决定去哪里"
            : "Where Not Rain · Weather-led travel inspiration"}
        </span>
        <span>
          {isChinese ? "天气数据：" : "Forecast data by "}
          <a href="https://open-meteo.com/">Open-Meteo</a>
          {isChinese ? " · 衍生旅行评分" : " · Derived Travel Score"}
        </span>
      </footer>
    </main>
  );
}

export async function generateStaticParams(): Promise<ReadonlyArray<{ countrySlug: string }>> {
  const dataset = await getBakedDataset();
  return dataset.countries.map((c) => ({ countrySlug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string };
}): Promise<Metadata> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((c) => c.slug === params.countrySlug);
  const cityNames = country
    ? (dataset.citiesByCountry.get(country.id) ?? []).map((item) => item.city.name.en)
    : [];
  const searchCopy = country ? countrySearchCopy(country.name.en, cityNames) : null;
  return {
    title: searchCopy?.title ?? "Country travel weather guide",
    description:
      searchCopy?.description ??
      "Compare rain, temperature and Travel Scores across destinations on one country weather map.",
    alternates: buildAlternates(`/${params.countrySlug}`, "en", ["en", "zh-cn"]),
    robots: routeRobots("country", true),
  };
}

export default async function Page({
  params,
}: {
  params: { countrySlug: string };
}): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const country = dataset.countries.find((c) => c.slug === params.countrySlug);
  if (country === undefined) notFound();
  const config = buildConfig();
  const viewModel = projectCountry(dataset, params.countrySlug, config.defaultLocale);

  const countryCities = dataset.citiesByCountry.get(country.id) ?? [];
  const searchCopy = countrySearchCopy(
    country.name.en,
    countryCities.map((item) => item.city.name.en),
  );
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: country.name.en,
    description: searchCopy.description,
    url: localeUrl("en", `/${country.slug}`),
    containsPlace: countryCities.map((item) => ({
      "@type": "City",
      name: item.city.name.en,
      url: localeUrl("en", `/${country.slug}/${item.city.slug}`),
    })),
  };

  return <CountryPage viewModel={viewModel} jsonLd={jsonLd} />;
}
