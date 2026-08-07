import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../../components/JsonLd";
import { MyTripsDashboard } from "../../../components/MyTripsDashboard";
import { buildAlternates, localeUrl } from "../../seo";

export const metadata: Metadata = {
  title: "日本、韩国和东南亚天气行程规划",
  description: "建立多城市自由行，管理云端行程，并结合每日天气判断哪些照常、提前、缩短或替换。",
  alternates: buildAlternates("/trips", "zh-cn", ["en", "zh-hant", "zh-cn"]),
  robots: { index: true, follow: true },
};

const templates = [
  {
    id: "japan-family",
    label: "7天亲子旅行",
    title: "东京 → 京都 → 大阪",
    description: "把寺院、城市散步、定时门票和乐园日，搭配可靠的室内备用方案。",
  },
  {
    id: "thailand-islands",
    label: "6天城市与海岛旅行",
    title: "曼谷 → 普吉岛",
    description: "根据降雨和风力判断保留海滩、调整出海日，或切换城市行程。",
  },
  {
    id: "korea-city",
    label: "5天城市假期",
    title: "首尔 → 釜山",
    description: "在不改动固定列车的前提下，重新安排宫殿、观景台、市场和海滩。",
  },
] as const;

export default function SimplifiedTripsLanding(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Where Not Rain 天气行程助手",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    description: "为日本、韩国和东南亚自由行提供天气驱动的每日行程决策。",
    url: localeUrl("zh-cn", "/trips"),
    inLanguage: "zh-CN",
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <MyTripsDashboard locale="zh-cn" />
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">亚洲旅行的天气行程助手</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            天气变化时，知道哪些照常、
            <br className="hidden sm:block" />
            哪些提前、缩短或替换
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            为日本、韩国和东南亚多城市自由行加入天气决策。固定列车和定时门票受到保护，可调整的户外行程则会得到具体备用方案。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-cn/trips/workspace">
              建立我的行程
            </a>
            <a className="trip-secondary-button" href="/zh-cn/trips/new">
              导入现有行程
            </a>
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-5 text-muted">
            目前涵盖日本、韩国、泰国、越南、新加坡、马来西亚、印度尼西亚、菲律宾和柬埔寨。无需注册即可开始；云端保存和“我的行程”属于可选能力。
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="产品使用流程">
        {[
          ["01", "建立或导入", "加入每天的城市、行程类型、活动和不可变更的订单约束。"],
          ["02", "更新行程天气", "查看降雨、风力、高温以及亲子或老人同行的敏感风险。"],
          ["03", "带着备选方案出发", "按需保存到云端，生成只读分享链接，同时保留本地离线副本。"],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="simplified-trip-templates">
        <p className="eyebrow">从真实亚洲行程开始</p>
        <h2 id="simplified-trip-templates" className="section-title mt-3">
          用可编辑示例展示真实天气决策
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {templates.map((template) => (
            <article key={template.id} className="trip-process-card flex flex-col">
              <span>{template.label}</span>
              <h3>{template.title}</h3>
              <p className="flex-1">{template.description}</p>
              <a
                className="mt-5 text-sm font-bold text-primary"
                href={`/zh-cn/trips/workspace?template=${template.id}`}
              >
                打开可编辑示例 →
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-5 rounded-[2rem] border border-border/80 bg-white p-6 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow">真正会改变行程的天气时刻</p>
          <h2 className="section-title mt-3">比一个下雨图标更有用</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            60%降雨对博物馆、出海、海滩和定时观景台代表完全不同的影响。系统会结合活动类型、当天是否可调整，以及是否有儿童或老人同行，给出不同判断。
          </p>
        </div>
        <ul className="grid gap-3 text-sm leading-6 text-body">
          <li className="trip-side-card">保留固定航班、列车和定时门票。</li>
          <li className="trip-side-card">把海滩、船班和观景台视为风力敏感活动。</li>
          <li className="trip-side-card">亲子或老人同行时，提高高温与低温警戒。</li>
          <li className="trip-side-card">本机优先保存，按需开启云端和只读分享。</li>
        </ul>
      </section>

      <footer className="page-footer">
        <span>Where Not Rain · 天气行程执行助手</span>
        <span>亚洲目的地 · 多语言服务 · 本机优先隐私</span>
      </footer>
    </main>
  );
}
