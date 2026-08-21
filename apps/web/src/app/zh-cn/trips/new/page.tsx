import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SmartTripImportForm } from "../../../../components/SmartTripImportForm";
import { buildAlternates } from "../../../seo";

export const metadata: Metadata = {
  title: { absolute: "导入现有旅行行程 - Where Not Rain" },
  description: "粘贴现有旅行计划，先整理好日期和城市，再到天气行程工作台继续确认和调整。",
  alternates: buildAlternates("/trips/new", "zh-cn", ["en", "zh-hant", "zh-cn"]),
  robots: { index: false, follow: true },
};

export default function NewTripPage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="面包屑">
        <ol>
          <li>
            <a href="/zh-cn/trips">行程助手</a>
          </li>
          <li>导入行程</li>
        </ol>
      </nav>
      <section className="mt-6 max-w-3xl">
        <p className="eyebrow">行程导入器</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">
          把现有行程带进天气工作台
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          粘贴已经整理好的旅行行程。日期和能确定的城市会先填好，不确定的地方留给你确认。
        </p>
      </section>
      <div className="mt-8">
        <SmartTripImportForm locale="zh-cn" />
      </div>
    </main>
  );
}
