"use client";

import type { ReactElement } from "react";
import { usePathname } from "next/navigation";

function BrandMark(): ReactElement {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none">
        <path
          d="M9 22.5h16.2a5.3 5.3 0 0 0 .2-10.6 8.1 8.1 0 0 0-15.2 2.7A4 4 0 0 0 9 22.5Z"
          fill="currentColor"
        />
        <path
          d="m11.5 27.2-1.7 2.5m7.8-2.5-1.7 2.5m7.8-2.5L22 29.7"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function SiteHeader(): ReactElement {
  const pathname = usePathname();
  const isTraditional = pathname === "/zh-hant" || pathname.startsWith("/zh-hant/");
  const isSimplified = pathname === "/zh-cn" || pathname.startsWith("/zh-cn/");
  const isChinese = isTraditional || isSimplified;

  const homeHref = isTraditional ? "/zh-hant/trips" : isSimplified ? "/zh-cn/trips" : "/trips";
  const weatherHref = isSimplified ? "/zh-cn" : "/";
  const languageHref = isTraditional ? "/trips" : "/zh-hant/trips";

  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">
        {isTraditional ? "跳至主要內容" : isSimplified ? "跳到主要内容" : "Skip to content"}
      </a>
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <a
          href={homeHref}
          className="group flex items-center gap-2.5 rounded-lg focus-ring"
          aria-label={
            isTraditional
              ? "Where Not Rain 繁體中文行程助手"
              : isSimplified
                ? "Where Not Rain 中文旅行助手"
                : "Where Not Rain trip planner"
          }
        >
          <BrandMark />
          <span className="text-[15px] font-bold tracking-[-0.02em] text-foreground sm:text-base">
            Where Not Rain
          </span>
          <span className="hidden rounded-full border border-border bg-surface-elevated px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted md:inline">
            {isTraditional ? "天氣行程" : isSimplified ? "天气行程" : "Trip planner"}
          </span>
        </a>
        <nav
          aria-label={isChinese ? "主導覽" : "Main navigation"}
          className="flex items-center gap-1"
        >
          <a href={homeHref} className="nav-link focus-ring">
            <span className="hidden sm:inline">
              {isTraditional ? "行程助手" : isSimplified ? "行程助手" : "Trip planner"}
            </span>
            <span className="sm:hidden">
              {isTraditional ? "行程" : isSimplified ? "行程" : "Trips"}
            </span>
          </a>
          <a href={weatherHref} className="nav-link focus-ring">
            <span className="hidden sm:inline">
              {isTraditional ? "天氣雷達" : isSimplified ? "目的地天气" : "Weather radar"}
            </span>
            <span className="sm:hidden">
              {isTraditional ? "天氣" : isSimplified ? "天气" : "Radar"}
            </span>
          </a>
          <a
            href={languageHref}
            className="nav-link focus-ring"
            hrefLang={isTraditional ? "en" : "zh-Hant"}
          >
            <span className="hidden sm:inline">{isTraditional ? "English" : "繁體中文"}</span>
            <span className="sm:hidden">{isTraditional ? "EN" : "繁中"}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
