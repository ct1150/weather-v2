import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SmartTripImportForm } from "../../../../components/SmartTripImportForm";
import { buildAlternates } from "../../../seo";

export const metadata: Metadata = {
  title: "匯入現有旅行行程",
  description: "貼上 Markdown、ChatGPT 或已整理好的行程，建立可編輯並能連結天氣決策的旅行工作台。",
  alternates: buildAlternates("/trips/new", "zh-hant", ["en", "zh-hant", "zh-cn"]),
  robots: { index: false, follow: true },
};

export default function TraditionalTripImportPage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="麵包屑">
        <ol>
          <li>
            <a href="/zh-hant/trips">行程助手</a>
          </li>
          <li>匯入行程</li>
        </ol>
      </nav>
      <section className="mt-6 max-w-3xl">
        <p className="eyebrow">行程匯入器</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">
          把你現有的計畫直接變成天氣行程工作台
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          貼上已經整理好的旅行行程。系統會辨識 D1、Day1、支援城市與行程類型，只把有歧義的日期留給你確認。
        </p>
      </section>
      <div className="mt-8">
        <SmartTripImportForm locale="zh-hant" />
      </div>
    </main>
  );
}
