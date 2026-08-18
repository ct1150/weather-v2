import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../../components/JsonLd";
import { MyTripsDashboard } from "../../../components/MyTripsDashboard";
import { buildAlternates, localeUrl } from "../../seo";

export const metadata: Metadata = {
  title: "目的地確定後的多人天氣行程規劃",
  description:
    "從共同決定的目的地繼續，在一個共享行程中安排活動、討論取捨、記錄決定並查看逐日天氣。",
  alternates: buildAlternates("/trips", "zh-hant", ["en", "zh-hant", "zh-cn"]),
  robots: { index: true, follow: true },
};

export default function TraditionalTripsLanding(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Where Not Rain 共同規劃",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    description: "依天氣共同決定目的地後，繼續進行輕量多人行程規劃。",
    url: localeUrl("zh-hant", "/trips"),
    inLanguage: "zh-Hant",
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">目的地決定以後</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            去哪已經確定？
            <br className="hidden sm:block" />
            接下來一起規劃。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            把日期、活動想法、評論與明確決定放進同一份共享行程，並在安排過程中持續看到每日天氣。還沒決定目的地時，應先從天氣探索開始。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-hant/discover">
              先一起決定去哪
            </a>
            <a className="trip-secondary-button" href="/zh-hant/trips/workspace">
              開啟共享工作台
            </a>
          </div>
          <a
            className="mt-4 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
            href="/zh-hant/trips/new"
          >
            進階功能：匯入既有行程
          </a>
        </div>
      </section>

      <MyTripsDashboard locale="zh-hant" />

      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="共同規劃流程">
        {[
          ["01", "從一個目的地開始", "把已經確定的目的地與日期帶入共享行程。"],
          ["02", "建立活動候選清單", "加入想法、討論取捨，並把明確決定從一般評論中獨立記錄。"],
          ["03", "按逐日天氣安排", "依每日天氣，把室內與戶外活動放到更合適的日期。"],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 grid gap-5 rounded-[2rem] border border-border/80 bg-white p-6 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow">協作只服務真實決定</p>
          <h2 className="section-title mt-3">讓大家始終知道已經決定了什麼</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            這裡不是另一個開放式AI行程產生器。共享工作台把目的地、日期、活動想法與天氣脈絡放在一起，幫助同行人做出、記錄並重新查看具體決定。
          </p>
        </div>
        <ul className="grid gap-3 text-sm leading-6 text-body">
          <li className="trip-side-card">圍繞整份行程或某一天進行討論。</li>
          <li className="trip-side-card">把待確認與已確定事項從一般評論中分開。</li>
          <li className="trip-side-card">查看共享行程修改前後的版本差異。</li>
          <li className="trip-side-card">本機優先編輯，需要時再開啟雲端協作。</li>
        </ul>
      </section>

      <footer className="page-footer">
        <span>Where Not Rain · 天氣驅動的共同規劃</span>
        <span>先一起決定去哪 · 再一起規劃怎麼玩 · 進階執行能力保持可選</span>
      </footer>
    </main>
  );
}
