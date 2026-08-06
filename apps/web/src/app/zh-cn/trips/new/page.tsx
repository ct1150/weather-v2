import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripImportForm } from "../../../../components/TripImportForm";
import { localeUrl } from "../../../seo";

export const metadata: Metadata = {
  title: { absolute: "导入旅行行程 - Where Not Rain" },
  description: "粘贴Markdown旅行计划，识别每日时间轴，并创建可保存、分享和绑定天气的旅行工作台。",
  alternates: { canonical: localeUrl("zh-cn", "/trips/new") },
  robots: { index: false, follow: true },
};

export default function NewTripPage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="面包屑">
        <ol>
          <li>
            <a href="/zh-cn/trips">我的旅行</a>
          </li>
          <li>导入行程</li>
        </ol>
      </nav>
      <section className="mt-6 max-w-3xl">
        <p className="eyebrow">行程导入器</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">
          把现有攻略直接变成天气行程
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          识别D1、Day1和Markdown时间表后，系统会创建一份可继续编辑的旅行工作台。你只需要为每天选择天气城市和行程类型，就能获得风险提示与Plan
          B。
        </p>
      </section>
      <div className="mt-8">
        <TripImportForm />
      </div>
    </main>
  );
}
