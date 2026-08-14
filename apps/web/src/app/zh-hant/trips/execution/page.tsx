import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripExecutionUtilities } from "../../../../components/TripExecutionUtilities";
import { TripExecutionWorkspace } from "../../../../components/TripExecutionWorkspace";
import { localeUrl } from "../../../seo";

export const metadata: Metadata = {
  title: { absolute: "旅行執行模式 - Where Not Rain" },
  description:
    "把結構化行程、固定預約、住宿錨點和真實道路路線整合到一個天氣旅行執行工作台。",
  alternates: { canonical: localeUrl("zh-hant", "/trips/execution") },
  robots: { index: false, follow: true },
};

export default function TripExecutionPage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="麵包屑">
        <ol>
          <li>
            <a href="/zh-hant/trips">我的旅行</a>
          </li>
          <li>
            <a href="/zh-hant/trips/workspace">天氣旅行工作台</a>
          </li>
          <li>執行模式</li>
        </ol>
      </nav>
      <div className="mt-6">
        <TripExecutionWorkspace locale="zh-hant" />
      </div>
      <TripExecutionUtilities locale="zh-hant" />
    </main>
  );
}
