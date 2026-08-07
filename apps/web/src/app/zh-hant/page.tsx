import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { JsonLd } from "../../components/JsonLd";
import { toTraditionalText } from "../../trips/traditional";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "亞洲旅行天氣地圖：比較日本、韓國和東南亞城市 | Where Not Rain";
  const description =
    "選擇國家和旅行日期，在一張地圖上比較日本、韓國、泰國、越南及東南亞旅遊城市的降雨、氣溫和旅行評分。";
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates("/", "zh-hant", ["en", "zh-cn", "zh-hant"]),
    robots: routeRobots("homepage", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-hant", "/"),
      siteName: "Where Not Rain",
      title,
      description,
      locale: "zh_TW",
    },
  };
}

export default async function TraditionalChineseHome(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const countries = dataset.countries.map((country) => {
    const cities = dataset.citiesByCountry.get(country.id) ?? [];
    return {
      slug: country.slug,
      name: toTraditionalText(country.name["zh-cn"]),
      summary: toTraditionalText(country.summary?.["zh-cn"] ?? country.summary?.en ?? ""),
      cityCount: cities.length,
      cityNames: cities.slice(0, 3).map((item) => toTraditionalText(item.city.name["zh-cn"])),
    };
  });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "亞洲旅行天氣地圖",
    description: "按旅行日期比較日本、韓國和東南亞旅遊城市天氣。",
    url: localeUrl("zh-hant", "/"),
    inLanguage: "zh-Hant",
    hasPart: countries.map((country) => ({
      "@type": "WebPage",
      name: `${country.name}旅行天氣地圖`,
      url: localeUrl("zh-cn", `/${country.slug}`),
    })),
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">亞洲旅行天氣雷達</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
            先看天氣，再決定去哪個城市
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            選擇一個國家和旅行日期，在地圖上直接比較全部旅遊城市的預計降雨、氣溫和旅行評分，不用逐個打開詳情頁。
          </p>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="country-weather-heading">
        <p className="eyebrow">選擇國家</p>
        <h2 id="country-weather-heading" className="section-title mt-3">
          查看各國城市天氣地圖
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((country) => (
            <li key={country.slug}>
              <a href={`/zh-cn/${country.slug}`} className="destination-card block focus-ring">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  {country.cityCount} 個旅遊城市
                </p>
                <h3 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-foreground">
                  {country.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{country.summary}</p>
                <p className="mt-5 text-xs font-semibold text-primary">
                  {country.cityNames.join(" · ")}
                </p>
                <span className="trip-action" aria-hidden="true">
                  比較城市天氣 <span>→</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="page-footer">
        <span>Where Not Rain · 用天氣決定去哪裡</span>
        <span>
          天氣資料：<a href="https://open-meteo.com/">Open-Meteo</a> · 衍生旅行評分
        </span>
      </footer>
    </main>
  );
}
