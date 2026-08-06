import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../../components/JsonLd";
import { buildAlternates, localeUrl } from "../../seo";

export const metadata: Metadata = {
  title: "日本、南韓與東南亞天氣行程規劃",
  description:
    "建立多城市自由行，結合每日天氣與固定訂單，知道哪些行程照常、提前、縮短或替換。",
  alternates: buildAlternates("/trips", "zh-hant", ["en", "zh-hant", "zh-cn"]),
  robots: { index: true, follow: true },
};

const templates = [
  {
    id: "japan-family",
    label: "7 天親子旅行",
    title: "東京 → 京都 → 大阪",
    description: "把寺院、城市散步、定時門票與樂園日，搭配可靠的室內備用方案。",
  },
  {
    id: "thailand-islands",
    label: "6 天城市與海島旅行",
    title: "曼谷 → 普吉島",
    description: "依降雨與風力判斷保留海灘、調整出海日，或切換城市行程。",
  },
  {
    id: "korea-city",
    label: "5 天城市假期",
    title: "首爾 → 釜山",
    description: "在不改動固定列車的前提下，重新安排宮殿、觀景台、市場與海灘。",
  },
] as const;

export default function TraditionalTripsLanding(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Where Not Rain 天氣行程助手",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    description: "為日本、南韓與東南亞自由行提供天氣驅動的每日行程決策。",
    url: localeUrl("zh-hant", "/trips"),
    inLanguage: "zh-Hant",
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">Weather-aware travel across Asia</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            天氣變化時，知道哪些照常、
            <br className="hidden sm:block" />
            哪些提前、縮短或替換
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            為日本、南韓與東南亞多城市自由行加入天氣決策。固定列車與定時門票受到保護，可調整的戶外行程則會得到具體備用方案。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-hant/trips/workspace">
              建立我的行程
            </a>
            <a className="trip-secondary-button" href="/zh-hant/trips/new">
              匯入 Markdown 行程
            </a>
            <a className="trip-secondary-button" href="/trips">
              English
            </a>
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-5 text-muted">
            目前涵蓋日本、南韓、泰國、越南、新加坡、馬來西亞、印尼、菲律賓與柬埔寨。不需要註冊帳號。
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="產品使用流程">
        {[
          ["01", "建立或匯入", "加入每日城市、行程類型、活動與不可變更的訂單限制。"],
          ["02", "更新行程天氣", "查看降雨、風力、高溫與親子或年長者敏感風險。"],
          ["03", "帶著備案出發", "分享、匯出並離線保留最近一次天氣結果。"],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="traditional-trip-templates">
        <p className="eyebrow">從真實亞洲行程開始</p>
        <h2 id="traditional-trip-templates" className="section-title mt-3">
          展示天氣決策，而不是通用 AI 文案的可編輯範本
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {templates.map((template) => (
            <article key={template.id} className="trip-process-card flex flex-col">
              <span>{template.label}</span>
              <h3>{template.title}</h3>
              <p className="flex-1">{template.description}</p>
              <a
                className="mt-5 text-sm font-bold text-primary"
                href={`/zh-hant/trips/workspace?template=${template.id}`}
              >
                開啟可編輯範本 →
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-5 rounded-[2rem] border border-border/80 bg-white p-6 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow">真正會改變行程的天氣時刻</p>
          <h2 className="section-title mt-3">比一個下雨圖示更有用</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            60% 降雨對博物館、出海、海灘與定時觀景台代表完全不同的影響。系統會依活動類型、行程是否可移動，以及是否有兒童或年長者同行，給出不同判斷。
          </p>
        </div>
        <ul className="grid gap-3 text-sm leading-6 text-body">
          <li className="trip-side-card">保留固定航班、列車與定時門票。</li>
          <li className="trip-side-card">把海灘、船班與觀景台視為風力敏感活動。</li>
          <li className="trip-side-card">親子與年長者同行時，提高高溫與低溫警戒。</li>
          <li className="trip-side-card">行程預設保存在本機，分享時建立可編輯副本。</li>
        </ul>
      </section>

      <footer className="page-footer">
        <span>Where Not Rain · 天氣行程執行助手</span>
        <span>英文優先全球產品 · 亞洲目的地 · 本機優先隱私</span>
      </footer>
    </main>
  );
}
