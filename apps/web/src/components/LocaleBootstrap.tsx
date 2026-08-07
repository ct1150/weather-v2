"use client";

import { useEffect, type ReactElement } from "react";
import {
  LOCALE_STORAGE_KEY,
  detectPreferredLocale,
  htmlLanguage,
  isAutoLocalizablePath,
  localeFromPath,
  localizedPath,
  type SiteLocale,
} from "../i18n/locale-routing";

function storedLocale(): SiteLocale | null {
  const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return value === "en" || value === "zh-cn" || value === "zh-hant" ? value : null;
}

export function LocaleBootstrap(): ReactElement | null {
  useEffect(() => {
    const pathname = window.location.pathname;
    const currentLocale = localeFromPath(pathname);

    // A localized URL is an explicit choice. Keep it stable and remember it.
    if (currentLocale !== "en") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, currentLocale);
      document.documentElement.lang = htmlLanguage(currentLocale);
      return;
    }

    const saved = storedLocale();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const detected = detectPreferredLocale(navigator.languages ?? [navigator.language], timeZone);
    const preferred = saved ?? detected;

    document.documentElement.lang = htmlLanguage(preferred);
    if (preferred === "en" || !isAutoLocalizablePath(pathname)) return;

    const destination = localizedPath(pathname, preferred);
    if (destination === pathname) return;
    window.location.replace(`${destination}${window.location.search}${window.location.hash}`);
  }, []);

  return null;
}
