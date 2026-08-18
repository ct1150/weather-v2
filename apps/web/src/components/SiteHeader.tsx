"use client";

import type { ChangeEvent, ReactElement } from "react";
import { usePathname } from "next/navigation";
import {
  LOCALE_STORAGE_KEY,
  htmlLanguage,
  isAutoLocalizablePath,
  localeFromPath,
  localizedPath,
  stripLocalePrefix,
  type SiteLocale,
} from "../i18n/locale-routing";

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
  const currentLocale = localeFromPath(pathname);
  const basePath = stripLocalePrefix(pathname);
  const isTraditional = currentLocale === "zh-hant";
  const isSimplified = currentLocale === "zh-cn";
  const isChinese = currentLocale !== "en";
  const isTripArea = basePath === "/trips" || basePath.startsWith("/trips/");
  const isDecisionArea = !isTripArea;

  const localePrefix = isTraditional ? "/zh-hant" : isSimplified ? "/zh-cn" : "";
  const homeHref = localePrefix || "/";
  const decisionHref = `${localePrefix}/discover`;
  const tripHref = `${localePrefix}/trips`;

  function chooseLocale(event: ChangeEvent<HTMLSelectElement>): void {
    const locale = event.target.value as SiteLocale;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = htmlLanguage(locale);

    const destination = isAutoLocalizablePath(pathname)
      ? localizedPath(pathname, locale)
      : locale === "en"
        ? "/discover"
        : `/${locale}/discover`;
    window.location.assign(`${destination}${window.location.search}${window.location.hash}`);
  }

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
              ? "Where Not Rain 一起決定旅行目的地首頁"
              : isSimplified
                ? "Where Not Rain 一起决定旅行目的地首页"
                : "Where Not Rain group destination decision home"
          }
        >
          <BrandMark />
          <span className="text-[15px] font-bold tracking-[-0.02em] text-foreground sm:text-base">
            Where Not Rain
          </span>
          <span className="hidden rounded-full border border-border bg-surface-elevated px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted md:inline">
            {isTraditional ? "一起去哪" : isSimplified ? "一起去哪" : "Decide together"}
          </span>
        </a>
        <nav
          aria-label={isChinese ? "主導覽" : "Main navigation"}
          className="flex items-center gap-1"
        >
          <a
            href={decisionHref}
            aria-current={isDecisionArea ? "page" : undefined}
            className={`nav-link focus-ring ${isDecisionArea ? "bg-foreground !text-white shadow-sm" : ""}`}
          >
            <span className="hidden sm:inline">
              {isTraditional ? "一起去哪" : isSimplified ? "一起去哪" : "Decide where"}
            </span>
            <span className="sm:hidden">
              {isTraditional ? "去哪" : isSimplified ? "去哪" : "Decide"}
            </span>
          </a>
          <a
            href={tripHref}
            aria-current={isTripArea ? "page" : undefined}
            className={`nav-link focus-ring ${isTripArea ? "bg-foreground !text-white shadow-sm" : ""}`}
          >
            <span className="hidden sm:inline">
              {isTraditional ? "共同規劃" : isSimplified ? "共同规划" : "Plan together"}
            </span>
            <span className="sm:hidden">
              {isTraditional ? "規劃" : isSimplified ? "规划" : "Plan"}
            </span>
          </a>
          <label className="nav-link focus-within:ring-2 focus-within:ring-primary/30">
            <span className="sr-only">
              {isTraditional ? "選擇語言" : isSimplified ? "选择语言" : "Choose language"}
            </span>
            <select
              value={currentLocale}
              onChange={chooseLocale}
              className="cursor-pointer bg-transparent text-xs font-bold sm:text-sm"
              aria-label={
                isTraditional ? "選擇語言" : isSimplified ? "选择语言" : "Choose language"
              }
            >
              <option value="en">English</option>
              <option value="zh-cn">简体中文</option>
              <option value="zh-hant">繁體中文</option>
            </select>
          </label>
        </nav>
      </div>
    </header>
  );
}
