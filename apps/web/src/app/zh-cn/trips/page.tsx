import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../../components/JsonLd";
import { qingganFamilyTrip } from "../../../trips/qinggan-family-2026";
import { buildAlternates, localeUrl } from "../../seo";

export const metadata: Metadata = {
  title: { absolute: "天气旅行执行助手｜我的旅行 - Where Not Rain" },
  description: "创建多城市行程，绑定逐日天气，获得风险提示、Plan B、本地保存、分享和Markdown导出。",
  alternates: buildAlternates("/trips", "zh-cn", ["en", "zh-cn"]),
  robots: { index: true, follow: true },
};

export default function TripsPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Where Not Rain 天气旅行执行助手",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    description: "根据逐日天气、同行人群和行程类型生成旅行风险与Plan B。",
    url: localeUrl("zh-cn", "/trips"),
    inLanguage: "zh-CN",
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">Weather-aware Trip Execution</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            不只告诉你会不会下雨，
            <br className="hidden sm:block" />
            直接告诉你当天怎么走
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            为日韩和东南亚多城市行程绑定逐日天气，结合海岛、户外、室内、老人儿童同行等条件，生成适宜度、风险原因和可执行Plan
            B。无需注册，行程默认保存在当前设备。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-cn/trips/workspace">
              创建我的天气行程
            </a>
            <a className="trip-secondary-button" href="/zh-cn/trips/new">
              从 Markdown 导入
            </a>
            <a className="trip-secondary-button" href="/zh-cn/trips/qinggan-family-2026">
              查看青甘完整 Demo
            </a>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            当前天气城市覆盖日本、韩国、泰国、越南、新加坡、马来西亚、印度尼西亚、菲律宾和柬埔寨。
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="用户可完成的旅行任务">
        {[
          ["01", "建行程", "逐日选择城市、日期、活动类型和固定约束，或直接导入Markdown。"],
          ["02", "看决策", "根据降雨、风、高温、紫外线和同行人群生成每天的风险与Plan B。"],
          ["03", "带着走", "自动保存在当前设备，可复制分享链接，也可导出Markdown和打印。"],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="trip-template-heading">
        <p className="eyebrow">真实案例模板</p>
        <h2 id="trip-template-heading" className="section-title mt-3">
          先看完整决策效果
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

      <footer className="page-footer">
        <span>Where Not Rain · 天气旅行执行助手</span>
        <span>产品V1：创建、天气决策、本地保存、分享与导出</span>
      </footer>
    </main>
  );
}
