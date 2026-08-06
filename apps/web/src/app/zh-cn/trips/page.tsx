import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../../components/JsonLd";
import { qingganFamilyTrip } from "../../../trips/qinggan-family-2026";
import { buildAlternates, localeUrl } from "../../seo";

export const metadata: Metadata = {
  title: { absolute: "天气驱动的旅行规划｜我的旅行 - Where Not Rain" },
  description: "把天气、固定车票、老人儿童体力、餐厅、酒店和Plan B整合成可执行的旅行计划。",
  alternates: buildAlternates("/trips", "zh-cn", ["en", "zh-cn"]),
  robots: { index: true, follow: true },
};

export default function TripsPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "天气驱动的旅行规划",
    description: "根据逐小时天气和固定约束优化旅行行程。",
    url: localeUrl("zh-cn", "/trips"),
    inLanguage: "zh-CN",
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">Weather-aware Trip Planner</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            天气不只是预报，
            <br className="hidden sm:block" />
            而是行程决策引擎
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            将固定机票、高铁、酒店、老人儿童体力和逐景点天气放进同一条时间轴，系统给出最晚离场时间、风险提示和可执行Plan
            B。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-cn/trips/qinggan-family-2026">
              查看青甘完整Demo
            </a>
            <a className="trip-secondary-button" href="/zh-cn/trips/new">
              导入我的Markdown行程
            </a>
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="trip-list-heading">
        <p className="eyebrow">我的旅行</p>
        <h2 id="trip-list-heading" className="section-title mt-3">
          已生成的天气行程
        </h2>
        <article className="trip-list-card mt-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="trip-risk-badge trip-risk-medium">天气动态优化</span>
              <span className="trip-constraint-badge">9天8晚</span>
              <span className="trip-constraint-badge">家庭旅行</span>
            </div>
            <h3 className="mt-4 text-2xl font-bold tracking-[-0.035em] text-foreground">
              {qingganFamilyTrip.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">{qingganFamilyTrip.subtitle}</p>
            <div className="trip-list-route mt-5">
              {qingganFamilyTrip.days.map((day) => (
                <span key={day.dayNumber}>
                  D{day.dayNumber} {day.route.at(-1)}
                </span>
              ))}
            </div>
          </div>
          <div className="trip-list-actions">
            <strong>8/8—8/16</strong>
            <span>{qingganFamilyTrip.transportSummary}</span>
            <a href="/zh-cn/trips/qinggan-family-2026">打开天气决策看板 →</a>
          </div>
        </article>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="旅行规划流程">
        {[
          ["01", "导入", "粘贴Markdown或录入机票、酒店与必去景点。"],
          ["02", "优化", "逐活动匹配风速、降雨、光线与固定约束。"],
          ["03", "执行", "旅途中显示今日模式、最晚离场和Plan B。"],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <footer className="page-footer">
        <span>Where Not Rain · 天气驱动旅行规划</span>
        <span>第一阶段MVP：青甘家庭环线＋Markdown导入</span>
      </footer>
    </main>
  );
}
