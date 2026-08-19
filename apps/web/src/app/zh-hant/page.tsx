import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { JsonLd } from "../../components/JsonLd";
import { toTraditionalText } from "../../trips/traditional";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "未來14天少雨目的地 Top 3 | Where Not Rain";
  const description =
    "日期已經確定？選擇出行日期和可選天氣限制，比較日本、韓國和東南亞城市中降雨風險最低的 3 個目的地。";
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
    name: "未來14天少雨目的地 Top 3",
    description: "選擇出行日期和可選天氣限制，只比較降雨風險最低的 3 個目的地。",
    url: localeUrl("zh-hant", "/"),
    inLanguage: "zh-Hant",
    hasPart: countries.map((country) => ({
      "@type": "WebPage",
      name: `${country.name}旅行天氣地圖`,
      url: localeUrl("zh-hant", `/${country.slug}`),
    })),
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">未來14天 · 少雨目的地決策</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
            日期定了，去哪裡更不容易下雨？
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            從新加坡、香港或台北出發，設定最長單程時間和出行日期，再在可達範圍內只看整體降雨風險最低的
            3 個結果。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/zh-hant/discover"
              className="rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-lg shadow-foreground/15 transition hover:-translate-y-0.5 hover:bg-primary focus-ring"
            >
              找 3 個少雨目的地
            </a>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="少雨目的地決策流程">
        {[
          ["01", "選擇出發地和日期", "從首批支援樞紐出發，並確定未來14天內的旅行窗口。"],
          ["02", "設定可選限制", "需要時排除太熱、太冷、風太大或某天降雨機率太高的城市。"],
          ["03", "比較並選擇 Top 3", "查看統一天氣依據，選擇一個目的地或把候選分享給同行人。"],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="country-weather-heading">
        <p className="eyebrow">按地區繼續探索</p>
        <h2 id="country-weather-heading" className="section-title mt-3">
          查看各國城市天氣地圖
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          還沒有具體候選時，可以先從一個國家開始，再用準確日期比較全部已收錄城市。
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((country) => (
            <li key={country.slug}>
              <a href={`/zh-hant/${country.slug}`} className="destination-card block focus-ring">
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
        <span>Where Not Rain · 日期定了，去哪裡更少雨</span>
        <span>
          天氣資料：<a href="https://open-meteo.com/">Open-Meteo</a> · 衍生少雨指數
        </span>
      </footer>
    </main>
  );
}
