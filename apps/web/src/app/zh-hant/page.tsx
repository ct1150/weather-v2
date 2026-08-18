import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { JsonLd } from "../../components/JsonLd";
import { toTraditionalText } from "../../trips/traditional";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "未來14天天氣目的地推薦與多人旅行決策 | Where Not Rain";
  const description =
    "日期已經確定但目的地未定？比較日本、韓國和東南亞城市未來14天的降雨、氣溫與旅行評分，分享候選後繼續共同規劃。";
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
    name: "天氣驅動的多人目的地決策",
    description: "日期確定、目的地未定時，比較未來14天天氣並把候選分享給同行人。",
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
          <p className="eyebrow">未來14天 · 多人目的地決策</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
            日期定了，去哪還沒定？
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            依未來14天天氣比較少量候選，把同一份天氣依據分享給同行人；決定目的地後，再繼續共同規劃每天怎麼玩。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/zh-hant/discover"
              className="rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-lg shadow-foreground/15 transition hover:-translate-y-0.5 hover:bg-primary focus-ring"
            >
              開始比較目的地
            </a>
            <a
              href="/zh-hant/trips"
              className="rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary/30 hover:bg-surface-elevated focus-ring"
            >
              繼續共同規劃 →
            </a>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="一起決定目的地的流程">
        {[
          ["01", "確定日期與天氣偏好", "先明確何時出發，以及最在意少雨、舒適、避暑或海島天氣。"],
          ["02", "比較3–5個候選", "一起查看推薦理由、主要取捨和逐日天氣，避免選擇過多。"],
          ["03", "分享候選並共同規劃", "把同一份候選傳給同行人，決定後進入共享行程繼續安排。"],
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
        <span>Where Not Rain · 讓天氣和大家一起決定去哪</span>
        <span>
          天氣資料：<a href="https://open-meteo.com/">Open-Meteo</a> · 衍生旅行評分
        </span>
      </footer>
    </main>
  );
}
