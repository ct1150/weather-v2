import type { Metadata } from "next";
import type { ReactElement } from "react";
import { MyTripsDashboard } from "../../../components/MyTripsDashboard";
import { buildAlternates } from "../../seo";

export const metadata: Metadata = {
  title: "高级行程工具",
  description: "已有的本地和云端行程工作区继续作为可选高级工具保留。",
  alternates: buildAlternates("/trips", "zh-cn", ["en", "zh-hant", "zh-cn"]),
  robots: { index: false, follow: true },
};

export default function SimplifiedTripsLanding(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">高级行程工具</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            已有行程仍可继续使用。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Where Not Rain
            现在专注于选择少雨目的地。已有的行程、协作和执行功能继续在这里保留，供原有用户按需使用。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-cn/discover">
              返回少雨目的地工具
            </a>
            <a className="trip-secondary-button" href="/zh-cn/trips/workspace">
              打开已有工作台
            </a>
          </div>
          <a
            className="mt-4 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
            href="/zh-cn/trips/new"
          >
            导入已有行程
          </a>
        </div>
      </section>

      <MyTripsDashboard locale="zh-cn" />

      <footer className="page-footer">
        <span>Where Not Rain · 已有行程的高级工具</span>
        <span>不再属于目的地决策主流程</span>
      </footer>
    </main>
  );
}
