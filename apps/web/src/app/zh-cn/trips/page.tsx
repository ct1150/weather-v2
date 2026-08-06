import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../../components/JsonLd";
import { qingganFamilyTrip } from "../../../trips/qinggan-family-2026";
import { buildAlternates, localeUrl } from "../../seo";

export const metadata: Metadata = {
  title: { absolute: "日韩东南亚天气行程助手 - Where Not Rain" },
  description:
    "面向港澳台、新加坡、马来西亚及海外中文用户，为日韩东南亚行程生成逐日天气风险、Plan B、分享和导出。",
  alternates: buildAlternates("/trips", "zh-cn", ["en", "zh-cn"]),
  robots: { index: true, follow: true },
};

export default function TripsPage(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Where Not Rain 日韩东南亚天气行程助手",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    description: "面向海外中文旅行者，根据逐日天气、同行人群和行程类型生成风险与Plan B。",
    url: localeUrl("zh-cn", "/trips"),
    inLanguage: "zh-CN",
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">面向海外中文用户的 Weather-aware Trip Planner</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            天气变化时，
            <br className="hidden sm:block" />
            告诉你哪些照常、提前或替换
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            为前往日本、韩国和东南亚的多城市自由行绑定逐日天气，结合海岛、户外、室内、老人儿童同行等条件，生成适宜度、风险原因和可执行Plan
            B。适合港澳台、新加坡、马来西亚及其他地区的海外中文用户。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-cn/trips/workspace">
              创建中文天气行程
            </a>
            <a className="trip-secondary-button" href="/zh-cn/trips/new">
              从 Markdown 导入
            </a>
            <a className="trip-secondary-button" href="/trips">
              English product
            </a>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            当前天气城市覆盖日本、韩国、泰国、越南、新加坡、马来西亚、印度尼西亚、菲律宾和柬埔寨。无需注册，行程默认保存在当前设备。
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

      <section className="mt-12 grid gap-5 rounded-[2rem] border border-border/80 bg-white p-6 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow">目标市场</p>
          <h2 className="section-title mt-3">全球基础设施，亚洲目的地，多语言服务</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            产品以英文作为默认主语言，简体中文作为重要本地化版本。中国大陆市场不作为当前直接C端获客重点，后续优先通过具备本地资质的旅行社、定制游机构或OTA合作进入。
          </p>
        </div>
        <ul className="grid gap-3 text-sm leading-6 text-body">
          <li className="trip-side-card">日韩东南亚家庭、多城市、海岛和户外自由行。</li>
          <li className="trip-side-card">港澳台、新马及欧美澳洲的海外中文旅行者。</li>
          <li className="trip-side-card">海外旅行顾问、小型旅行社和地接机构。</li>
          <li className="trip-side-card">中国大陆通过B2B2C与白标合作进入。</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="trip-template-heading">
        <p className="eyebrow">复杂天气决策能力展示</p>
        <h2 id="trip-template-heading" className="section-title mt-3">
          青甘家庭环线保留为高复杂度案例
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          该案例同时包含高温、盐湖风力、沙漠、山区、长途驾驶、老人儿童和固定高铁约束，用于展示决策引擎能力；它不再代表产品首要目标市场。
        </p>
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
        <span>Where Not Rain · 日韩东南亚天气行程助手</span>
        <span>Global infrastructure · Asian destinations · multilingual localization</span>
      </footer>
    </main>
  );
}
