import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../../components/JsonLd";
import { MyTripsDashboard } from "../../../components/MyTripsDashboard";
import { buildAlternates, localeUrl } from "../../seo";

export const metadata: Metadata = {
  title: "目的地确定后的多人天气行程规划",
  description:
    "从共同决定的目的地继续，在一个共享行程中安排活动、讨论取舍、记录决定并查看逐日天气。",
  alternates: buildAlternates("/trips", "zh-cn", ["en", "zh-hant", "zh-cn"]),
  robots: { index: true, follow: true },
};

export default function SimplifiedTripsLanding(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Where Not Rain 共同规划",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    description: "根据天气共同决定目的地后，继续进行轻量多人行程规划。",
    url: localeUrl("zh-cn", "/trips"),
    inLanguage: "zh-CN",
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">目的地决定以后</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            去哪已经确定？
            <br className="hidden sm:block" />
            接下来一起规划。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            把日期、活动想法、评论和明确决定放进同一份共享行程，并在安排过程中持续看到每天的天气。还没决定目的地时，应先从天气发现开始。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-cn/discover">
              先一起决定去哪
            </a>
            <a className="trip-secondary-button" href="/zh-cn/trips/workspace">
              打开共享工作台
            </a>
          </div>
          <a
            className="mt-4 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
            href="/zh-cn/trips/new"
          >
            高级功能：导入已有行程
          </a>
        </div>
      </section>

      <MyTripsDashboard locale="zh-cn" />

      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="共同规划流程">
        {[
          ["01", "从一个目的地开始", "把已经确定的目的地和日期带入共享行程。"],
          ["02", "建立活动候选清单", "添加想法、讨论取舍，并把明确决定从普通评论中独立记录。"],
          ["03", "按逐日天气安排", "根据每天的天气，把室内和户外活动放到更合适的日期。"],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 grid gap-5 rounded-[2rem] border border-border/80 bg-white p-6 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow">协作只服务真实决定</p>
          <h2 className="section-title mt-3">让大家始终知道已经决定了什么</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            这里不是另一个开放式AI行程生成器。共享工作台把目的地、日期、活动想法和天气上下文放在一起，帮助同行人做出、记录并重新查看具体决定。
          </p>
        </div>
        <ul className="grid gap-3 text-sm leading-6 text-body">
          <li className="trip-side-card">围绕整份行程或某一天进行讨论。</li>
          <li className="trip-side-card">把待确认和已确定事项从普通评论中分开。</li>
          <li className="trip-side-card">查看共享行程修改前后的版本差异。</li>
          <li className="trip-side-card">本机优先编辑，需要时再开启云端协作。</li>
        </ul>
      </section>

      <footer className="page-footer">
        <span>Where Not Rain · 天气驱动的共同规划</span>
        <span>先一起决定去哪 · 再一起规划怎么玩 · 高级执行能力保持可选</span>
      </footer>
    </main>
  );
}
