import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getBakedDataset } from "../../build/bake";
import { JsonLd } from "../../components/JsonLd";
import { buildAlternates, localeUrl, routeRobots } from "../seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "未来14天天气目的地推荐与多人旅行决策 | Where Not Rain";
  const description =
    "日期已经确定但目的地未定？比较日本、韩国和东南亚城市未来14天的降雨、气温与旅行评分，分享候选后继续共同规划。";
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
    name: "天气驱动的多人目的地决策",
    description: "日期确定、目的地未定时，比较未来14天天气并把候选分享给同行人。",
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
          <p className="eyebrow">未来14天 · 多人目的地决策</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">
            日期定了，去哪还没定？
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            根据未来14天天气比较少量候选，把同一份天气依据分享给同行人；决定目的地后，再继续共同规划每天怎么玩。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/zh-cn/discover"
              className="rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-lg shadow-foreground/15 transition hover:-translate-y-0.5 hover:bg-primary focus-ring"
            >
              开始比较目的地
            </a>
            <a
              href="/zh-cn/trips"
              className="rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary/30 hover:bg-surface-elevated focus-ring"
            >
              继续共同规划 →
            </a>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="一起决定目的地的流程">
        {[
          [
            "01",
            "确定日期与天气偏好",
            "先明确什么时候出发，以及最在意少雨、舒适、避暑或海岛天气。",
          ],
          ["02", "比较3–5个候选", "一起查看推荐理由、主要取舍和逐日天气，避免选择过载。"],
          ["03", "分享候选并共同规划", "把同一份候选发给同行人，决定后进入共享行程继续安排。"],
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
        <span>Where Not Rain · 让天气和大家一起决定去哪</span>
        <span>
          天气数据：<a href="https://open-meteo.com/">Open-Meteo</a> · 衍生旅行评分
        </span>
      </footer>
    </main>
  );
}
