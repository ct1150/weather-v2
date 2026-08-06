import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripWorkspace } from "../../../../components/TripWorkspace";
import { localeUrl } from "../../../seo";

export const metadata: Metadata = {
  title: { absolute: "天气旅行工作台 - Where Not Rain" },
  description:
    "创建多城市旅行计划，绑定逐日天气，获得适宜度、风险提示、Plan B、分享链接和Markdown导出。",
  alternates: { canonical: localeUrl("zh-cn", "/trips/workspace") },
  robots: { index: false, follow: true },
};

export default function TripWorkspacePage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="面包屑">
        <ol>
          <li>
            <a href="/zh-cn/trips">我的旅行</a>
          </li>
          <li>天气旅行工作台</li>
        </ol>
      </nav>
      <div className="mt-6">
        <TripWorkspace />
      </div>
    </main>
  );
}
