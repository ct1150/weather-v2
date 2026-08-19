import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { JsonLd } from "../../components/JsonLd";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "未来14天少雨目的地 Top 3 | Where Not Rain";
  const description =
    "日期已经确定？选择出行日期和可选天气限制，比较日本、韩国和东南亚城市中降雨风险最低的 3 个目的地。";
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates("/", "zh-cn", ["en", "zh-cn", "zh-hant"]),
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
    name: "未来14天少雨目的地 Top 3",
    description: "选择出行日期和可选天气限制，只比较降雨风险最低的 3 个目的地。",
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
          <p className="eyebrow">未来14天 · 少雨目的地决策</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
            日期定了，去哪里更不容易下雨？
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            选择出行日期，按整体降雨风险筛选目的地；也可以设置温度、风速和最高降雨概率限制，只看最值得比较的
            3 个结果。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/zh-cn/discover"
              className="rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-lg shadow-foreground/15 transition hover:-translate-y-0.5 hover:bg-primary focus-ring"
            >
              找 3 个少雨目的地
            </a>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="少雨目的地决策流程">
        {[
          ["01", "选择准确日期", "在未来14天预报窗口内确定开始和结束日期。"],
          ["02", "设置可选限制", "需要时排除太热、太冷、风太大或某天降雨概率太高的城市。"],
          ["03", "比较并选择 Top 3", "查看统一天气依据，选择一个目的地或把候选分享给同行人。"],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="country-weather-heading">
        <p className="eyebrow">按地区继续探索</p>
        <h2 id="country-weather-heading" className="section-title mt-3">
          查看各国城市天气地图
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          还没有具体候选时，可以先从一个国家开始，再用准确日期比较全部已收录城市。
        </p>
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
        <span>Where Not Rain · 日期定了，去哪里更少雨</span>
        <span>
          天气数据：<a href="https://open-meteo.com/">Open-Meteo</a> · 衍生少雨指数
        </span>
      </footer>
    </main>
  );
}
