"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  buildSavedCountryMapView,
  COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY,
  parseSavedCountryMapViews,
  serializeSavedCountryMapViews,
  upsertSavedCountryMapView,
  type SavedCountryMapView,
} from "../country-map/saved-views";

export type CountrySavedViewsLocale = "en" | "zh-cn" | "zh-hant";

const COPY = {
  en: {
    save: "Save this search",
    saved: "Search saved",
    savedViews: (count: number) => `Saved searches${count > 0 ? ` (${count})` : ""}`,
    title: "Saved travel decisions",
    intro:
      "Save the country, travel window, weather limits and compared destinations. Reopen a saved search later to recalculate it with the latest forecast.",
    empty: "No saved searches yet.",
    open: "Check latest weather",
    remove: "Remove",
    close: "Close saved searches",
    storageError: "Browser storage is unavailable.",
    current: "You are viewing this saved search with the latest forecast.",
    period: "Travel window",
    filters: "Weather limits",
    candidates: "Candidate destinations",
    none: "None",
    savedAt: "Saved",
    threeDays: "Next 3 days",
    sevenDays: "Next 7 days",
    weekend: "This weekend",
    custom: "Custom date range",
    unknownPeriod: "Current/default window",
    rain: (value: number) => `Rain chance ≤ ${value}%`,
    wind: (value: number) => `Wind ≤ ${value} km/h`,
    minTemp: (value: number) => `Night low ≥ ${value}°C`,
    maxTemp: (value: number) => `Day high ≤ ${value}°C`,
    noFilters: "No weather limits",
  },
  "zh-cn": {
    save: "保存这次筛选",
    saved: "已保存这次筛选",
    savedViews: (count: number) => `已保存筛选${count > 0 ? `（${count}）` : ""}`,
    title: "已保存的旅行决策",
    intro: "保存国家、出行时间、天气限制和候选目的地。之后重新打开，会直接按最新天气重新计算。",
    empty: "还没有保存筛选。",
    open: "查看最新天气",
    remove: "删除",
    close: "关闭已保存筛选",
    storageError: "浏览器存储不可用。",
    current: "当前正在查看这次筛选，页面已按最新天气重新计算。",
    period: "出行时间",
    filters: "天气限制",
    candidates: "候选目的地",
    none: "暂无",
    savedAt: "保存时间",
    threeDays: "未来 3 天",
    sevenDays: "未来 7 天",
    weekend: "本周末",
    custom: "自定义日期范围",
    unknownPeriod: "当前/默认时间范围",
    rain: (value: number) => `最高降雨概率 ≤ ${value}%`,
    wind: (value: number) => `最大风速 ≤ ${value} km/h`,
    minTemp: (value: number) => `最低夜温 ≥ ${value}°C`,
    maxTemp: (value: number) => `最高日温 ≤ ${value}°C`,
    noFilters: "未设置天气限制",
  },
  "zh-hant": {
    save: "儲存這次篩選",
    saved: "已儲存這次篩選",
    savedViews: (count: number) => `已儲存篩選${count > 0 ? `（${count}）` : ""}`,
    title: "已儲存的旅行決策",
    intro: "儲存國家、出行時間、天氣限制和候選目的地。之後重新開啟，會直接按最新天氣重新計算。",
    empty: "還沒有儲存篩選。",
    open: "查看最新天氣",
    remove: "刪除",
    close: "關閉已儲存篩選",
    storageError: "瀏覽器儲存無法使用。",
    current: "目前正在查看這次篩選，頁面已按最新天氣重新計算。",
    period: "出行時間",
    filters: "天氣限制",
    candidates: "候選目的地",
    none: "暫無",
    savedAt: "儲存時間",
    threeDays: "未來 3 天",
    sevenDays: "未來 7 天",
    weekend: "本週末",
    custom: "自訂日期範圍",
    unknownPeriod: "目前/預設時間範圍",
    rain: (value: number) => `最高降雨機率 ≤ ${value}%`,
    wind: (value: number) => `最大風速 ≤ ${value} km/h`,
    minTemp: (value: number) => `最低夜溫 ≥ ${value}°C`,
    maxTemp: (value: number) => `最高日溫 ≤ ${value}°C`,
    noFilters: "未設定天氣限制",
  },
} as const;

function currentRelativeUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function formatSavedAt(value: string, locale: CountrySavedViewsLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const language = locale === "en" ? "en" : locale === "zh-cn" ? "zh-CN" : "zh-TW";
  return new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CountrySavedViewsControl({
  locale,
  countryName,
  comparedNames,
}: {
  readonly locale: CountrySavedViewsLocale;
  readonly countryName: string;
  readonly comparedNames: ReadonlyArray<string>;
}): ReactElement {
  const copy = COPY[locale];
  const [views, setViews] = useState<ReadonlyArray<SavedCountryMapView>>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [activeUrl, setActiveUrl] = useState("");

  useEffect(() => {
    try {
      setViews(
        parseSavedCountryMapViews(window.localStorage.getItem(COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY)),
      );
      setActiveUrl(currentRelativeUrl());
    } catch {
      setStatus(copy.storageError);
    }
  }, [copy.storageError]);

  const viewModels = useMemo(
    () =>
      views.map((view) => {
        const period =
          view.rangePreset === "3d"
            ? copy.threeDays
            : view.rangePreset === "7d"
              ? copy.sevenDays
              : view.rangePreset === "weekend"
                ? copy.weekend
                : view.rangePreset === "custom"
                  ? copy.custom
                  : copy.unknownPeriod;
        const filters = [
          view.filters.rainMax === null ? null : copy.rain(view.filters.rainMax),
          view.filters.windMax === null ? null : copy.wind(view.filters.windMax),
          view.filters.tempMin === null ? null : copy.minTemp(view.filters.tempMin),
          view.filters.tempMax === null ? null : copy.maxTemp(view.filters.tempMax),
        ].filter((item): item is string => item !== null);
        return { view, period, filters, active: view.url === activeUrl };
      }),
    [activeUrl, copy, views],
  );

  function persist(next: ReadonlyArray<SavedCountryMapView>): void {
    setViews(next);
    try {
      if (next.length === 0) window.localStorage.removeItem(COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY);
      else
        window.localStorage.setItem(
          COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY,
          serializeSavedCountryMapViews(next),
        );
    } catch {
      setStatus(copy.storageError);
    }
  }

  function saveCurrent(): void {
    const view = buildSavedCountryMapView({
      pathname: window.location.pathname,
      search: window.location.search,
      countryName,
      comparedNames,
    });
    persist(upsertSavedCountryMapView(views, view));
    setActiveUrl(view.url);
    setStatus(copy.saved);
    window.setTimeout(() => setStatus(""), 2200);
  }

  function remove(id: string): void {
    persist(views.filter((view) => view.id !== id));
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={saveCurrent} className="country-share-button focus-ring">
          {copy.save}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="country-share-button focus-ring"
        >
          {copy.savedViews(views.length)}
        </button>
      </div>
      {status ? (
        <span className="sr-only" role="status">
          {status}
        </span>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[190] bg-black/30 p-3 sm:p-6"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-x-3 bottom-3 max-h-[82vh] overflow-y-auto rounded-3xl border border-border bg-white p-4 shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-6 lg:left-1/2 lg:right-auto lg:w-[min(760px,calc(100vw-3rem))] lg:-translate-x-1/2"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{copy.title}</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{copy.intro}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.close}
                className="rounded-full border border-border px-3 py-2 text-sm font-semibold focus-ring"
              >
                ×
              </button>
            </div>

            {views.length === 0 ? (
              <p className="mt-6 text-sm text-muted">{copy.empty}</p>
            ) : (
              <ul className="mt-6 grid gap-4">
                {viewModels.map(({ view, period, filters, active }) => (
                  <li
                    key={view.id}
                    className="rounded-2xl border border-border bg-surface-elevated p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <strong className="block text-base text-foreground">{view.label}</strong>
                        <span className="mt-1 block text-xs text-muted">
                          {copy.savedAt} · {formatSavedAt(view.savedAt, locale)}
                        </span>
                        {active ? (
                          <p className="mt-3 rounded-xl bg-background px-3 py-2 text-xs font-semibold text-foreground">
                            {copy.current}
                          </p>
                        ) : null}

                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="text-xs font-semibold text-muted">{copy.period}</dt>
                            <dd className="mt-1 text-foreground">{period}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold text-muted">{copy.filters}</dt>
                            <dd className="mt-1 text-foreground">
                              {filters.length > 0 ? filters.join(" · ") : copy.noFilters}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold text-muted">{copy.candidates}</dt>
                            <dd className="mt-1 text-foreground">
                              {view.comparedNames.length > 0
                                ? view.comparedNames.join(" / ")
                                : copy.none}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.location.assign(view.url)}
                          className="rounded-full bg-foreground px-3 py-2 text-xs font-bold text-white focus-ring"
                        >
                          {copy.open}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(view.id)}
                          className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted focus-ring"
                        >
                          {copy.remove}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
