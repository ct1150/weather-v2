import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripImportForm } from "../../../../components/TripImportForm";
import { localeUrl } from "../../../seo";

export const metadata: Metadata = {
  title: { absolute: "导入旅行行程 - Where Not Rain" },
  description: "粘贴Markdown旅行计划并识别每日时间轴，为后续天气绑定和Plan B做准备。",
  alternates: { canonical: localeUrl("zh-cn", "/trips/new") },
  robots: { index: false, follow: true },
};

export default function NewTripPage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="面包屑"><ol><li><a href="/zh-cn/trips">我的旅行</a></li><li>导入行程</li></ol></nav>
      <section className="mt-6 max-w-3xl">
        <p className="eyebrow">行程导入器</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">从Markdown开始规划</h1>
        <p className="mt-4 text-base leading-7 text-muted">第一版先识别D1—D9和时间表；下一增量将自动解析地点、酒店、交通硬约束，并绑定逐小时天气。</p>
      </section>
      <div className="mt-8"><TripImportForm /></div>
    </main>
  );
}
