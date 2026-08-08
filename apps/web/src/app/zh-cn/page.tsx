import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { JsonLd } from "../../components/JsonLd";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "亚洲旅行天气地图：比较日本、韩国和东南亚城市 | Where Not Rain";
  const description =
    "选择国家和旅行日期，在一张地图上比较日本、韩国、泰国、越南及东南亚旅游城市的降雨、气温和旅行评分。";
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates("/", "zh-cn", ["en", "zh-cn"]),
    robots: routeRobots("homepage", true),
    openGraph: {
      type: "website",
      url: localeUrl("zh-cn", "/"),
      siteName: "Where Not Rain",
      title,
      description,
      locale: "zh_CN",
    },
  };
}

export default async function SimplifiedChineseHome(): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const countries = dataset.countries.map((country) => {
    const cities = dataset.citiesByCountry.get(country.id) ?? [];
    return {
      slug: country.slug,
      name: country.name["zh-cn"],
      summary: country.summary?.["zh-cn"] ?? country.summary?.en ?? "",
      cityCount: cities.length,
      cityNames: cities.slice(0, 3).map((item) => item.city.name["zh-cn"]),
    };
  });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "亚洲旅行天气地图",
    description: "按旅行日期比较日本、韩国和东南亚旅游城市天气。",
    url: localeUrl("zh-cn", "/"),
    inLanguage: "zh-CN",
    hasPart: countries.map((country) => ({
      "@type": "WebPage",
      name: `${country.name}旅行天气地图`,
      url: localeUrl("zh-cn", `/${country.slug}`),
    })),
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="hero-panel !p-6 sm:!p-10">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">亚洲旅行天气雷达</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
            先看天气，再决定去哪个城市
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            选择一个国家和旅行日期，在地图上直接比较全部旅游城市的预计降雨、气温和旅行评分，不用逐个打开详情页。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/zh-cn/discover"
              className="rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-lg shadow-foreground/15 transition hover:-translate-y-0.5 hover:bg-primary focus-ring"
            >
              按天气条件选城市 →
            </a>
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="country-weather-heading">
        <p className="eyebrow">选择国家</p>
        <h2 id="country-weather-heading" className="section-title mt-3">
          查看各国城市天气地图
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((country) => (
            <li key={country.slug}>
              <a href={`/zh-cn/${country.slug}`} className="destination-card block focus-ring">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  {country.cityCount} 个旅游城市
                </p>
                <h3 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-foreground">
                  {country.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{country.summary}</p>
                <p className="mt-5 text-xs font-semibold text-primary">
                  {country.cityNames.join(" · ")}
                </p>
                <span className="trip-action" aria-hidden="true">
                  比较城市天气 <span>→</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="page-footer">
        <span>Where Not Rain · 用天气决定去哪里</span>
        <span>
          天气数据：<a href="https://open-meteo.com/">Open-Meteo</a> · 衍生旅行评分
        </span>
      </footer>
    </main>
  );
}
