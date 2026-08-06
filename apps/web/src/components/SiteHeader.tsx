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
  const isChinese = pathname === "/zh-cn" || pathname.startsWith("/zh-cn/");
  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">
        {isChinese ? "跳到主要内容" : "Skip to content"}
      </a>
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <a
          href={isChinese ? "/zh-cn" : "/"}
          className="group flex items-center gap-2.5 rounded-lg focus-ring"
          aria-label={isChinese ? "Where Not Rain 中文首页" : "Where Not Rain home"}
        >
          <BrandMark />
          <span className="text-[15px] font-bold tracking-[-0.02em] text-foreground sm:text-base">
            Where Not Rain
          </span>
          <span className="hidden rounded-full border border-border bg-surface-elevated px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted md:inline">
            {isChinese ? "旅行天气" : "Travel weather"}
          </span>
        </a>
        <nav
          aria-label={isChinese ? "主导航" : "Main navigation"}
          className="flex items-center gap-1"
        >
          <a href={isChinese ? "/zh-cn" : "/"} className="nav-link focus-ring">
            <span className="hidden sm:inline">{isChinese ? "国家天气" : "Forecast radar"}</span>
            <span className="sm:hidden">{isChinese ? "天气" : "Radar"}</span>
          </a>
          <a href={isChinese ? "/zh-cn/trips" : "/trips"} className="nav-link focus-ring">
            <span className="hidden sm:inline">{isChinese ? "我的旅行" : "My trips"}</span>
            <span className="sm:hidden">{isChinese ? "行程" : "Trips"}</span>
          </a>
          <a href={isChinese ? "/" : "/explore"} className="nav-link focus-ring">
            <span className="hidden sm:inline">{isChinese ? "English" : "Explore map"}</span>
            <span className="sm:hidden">{isChinese ? "EN" : "Explore"}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
