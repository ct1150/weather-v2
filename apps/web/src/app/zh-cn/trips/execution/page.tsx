import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripExecutionUtilities } from "../../../../components/TripExecutionUtilities";
import { TripExecutionWorkspace } from "../../../../components/TripExecutionWorkspace";
import { localeUrl } from "../../../seo";

export const metadata: Metadata = {
  title: { absolute: "旅行执行模式 - Where Not Rain" },
  description: "把结构化行程、固定预约、酒店锚点和真实道路路线整合到一个天气旅行执行工作台。",
  alternates: { canonical: localeUrl("zh-cn", "/trips/execution") },
  robots: { index: false, follow: true },
};

export default function TripExecutionPage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="面包屑">
        <ol>
          <li>
            <a href="/zh-cn/trips">我的旅行</a>
          </li>
          <li>
            <a href="/zh-cn/trips/workspace">天气旅行工作台</a>
          </li>
          <li>执行模式</li>
        </ol>
      </nav>
      <div className="mt-6">
        <TripExecutionWorkspace locale="zh-cn" />
      </div>
      <TripExecutionUtilities locale="zh-cn" />
    </main>
  );
}
