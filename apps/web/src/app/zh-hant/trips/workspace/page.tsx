import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TraditionalTripWorkspace } from "../../../../components/TraditionalTripWorkspace";
import { buildAlternates } from "../../../seo";

export const metadata: Metadata = {
  title: "天氣行程工作台",
  description: "建立日本、南韓或東南亞行程，更新每日天氣並取得可執行的備用方案。",
  alternates: buildAlternates("/trips/workspace", "zh-hant", ["en", "zh-hant", "zh-cn"]),
  robots: { index: false, follow: true },
};

export default function TraditionalTripWorkspacePage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="麵包屑">
        <ol>
          <li>
            <a href="/zh-hant/trips">行程助手</a>
          </li>
          <li>工作台</li>
        </ol>
      </nav>
      <div className="mt-5 flex justify-end">
        <a className="trip-primary-button" href="/zh-hant/trips/execution">
          進入路線執行模式 →
        </a>
      </div>
      <div className="mt-6">
        <TraditionalTripWorkspace />
      </div>
    </main>
  );
}
