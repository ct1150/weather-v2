import type { Metadata } from "next";
import type { ReactElement } from "react";
import { MyTripsDashboard } from "../../../components/MyTripsDashboard";
import { buildAlternates } from "../../seo";

export const metadata: Metadata = {
  title: "進階行程工具",
  description: "既有的本機和雲端行程工作區繼續作為可選進階工具保留。",
  alternates: buildAlternates("/trips", "zh-hant", ["en", "zh-hant", "zh-cn"]),
  robots: { index: false, follow: true },
};

export default function TraditionalTripsLanding(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">進階行程工具</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            既有行程仍可繼續使用。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Where Not Rain
            現在專注於選擇少雨目的地。既有的行程、協作和執行功能繼續在這裡保留，供原有使用者按需使用。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-hant/discover">
              返回少雨目的地工具
            </a>
            <a className="trip-secondary-button" href="/zh-hant/trips/workspace">
              開啟既有工作台
            </a>
          </div>
          <a
            className="mt-4 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
            href="/zh-hant/trips/new"
          >
            匯入既有行程
          </a>
        </div>
      </section>

      <MyTripsDashboard locale="zh-hant" />

      <footer className="page-footer">
        <span>Where Not Rain · 既有行程的進階工具</span>
        <span>不再屬於目的地決策主流程</span>
      </footer>
    </main>
  );
}
