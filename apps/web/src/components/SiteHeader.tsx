"use client";

import type { ChangeEvent, ReactElement } from "react";
import { usePathname } from "next/navigation";
import {
  LOCALE_STORAGE_KEY,
  htmlLanguage,
  isAutoLocalizablePath,
  localeFromPath,
  localizedPath,
  type SiteLocale,
} from "../i18n/locale-routing";

function BrandMark(): ReactElement {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="6.5" fill="currentColor" />
        <path
          d="M18 3.5v4M18 28.5v4M3.5 18h4M28.5 18h4M7.75 7.75l2.8 2.8M25.45 25.45l2.8 2.8M28.25 7.75l-2.8 2.8M10.55 25.45l-2.8 2.8"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function SiteHeader(): ReactElement {
  const pathname = usePathname();
  const currentLocale = localeFromPath(pathname);
  const isTraditional = currentLocale === "zh-hant";
  const isSimplified = currentLocale === "zh-cn";
  const isChinese = currentLocale !== "en";
  const localePrefix = isTraditional ? "/zh-hant" : isSimplified ? "/zh-cn" : "";
  const homeHref = localePrefix || "/";
  const discoverHref = `${localePrefix}/discover`;

  function chooseLocale(event: ChangeEvent<HTMLSelectElement>): void {
    const locale = event.target.value as SiteLocale;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = htmlLanguage(locale);
    const destination = isAutoLocalizablePath(pathname)
      ? localizedPath(pathname, locale)
      : locale === "en"
        ? "/"
        : `/${locale}`;
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
              ? "Where Not Rain 哪裡不下雨首頁"
              : isSimplified
                ? "Where Not Rain 哪里不下雨首页"
                : "Where Not Rain home"
          }
        >
          <BrandMark />
          <span className="text-[15px] font-bold tracking-[-0.02em] text-foreground sm:text-base">
            Where Not Rain
          </span>
          <span className="hidden rounded-full border border-border bg-surface-elevated px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted md:inline">
            {isTraditional ? "少雨旅行" : isSimplified ? "少雨旅行" : "Least-rain trips"}
          </span>
        </a>
        <nav
          aria-label={isChinese ? "主導覽" : "Main navigation"}
          className="flex items-center gap-1"
        >
          <a
            href={discoverHref}
            className="nav-link bg-foreground !text-white shadow-sm focus-ring"
          >
            <span className="hidden sm:inline">
              {isTraditional ? "找目的地" : isSimplified ? "找目的地" : "Find destinations"}
            </span>
            <span className="sm:hidden">{isChinese ? "找目的地" : "Find"}</span>
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
