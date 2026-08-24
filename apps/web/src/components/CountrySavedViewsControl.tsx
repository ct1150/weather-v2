"use client";

import { useEffect, useState, type ReactElement } from "react";
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
    save: "Save current view",
    saved: "View saved",
    savedViews: (count: number) => `Saved views${count > 0 ? ` (${count})` : ""}`,
    title: "Saved country maps",
    intro:
      "Keep up to five map states on this device, including dates, filters and compared destinations.",
    empty: "No saved map views yet.",
    open: "Open",
    remove: "Remove",
    close: "Close saved views",
    storageError: "Browser storage is unavailable.",
  },
  "zh-cn": {
    save: "保存当前地图",
    saved: "已保存",
    savedViews: (count: number) => `已保存${count > 0 ? `（${count}）` : ""}`,
    title: "已保存的地图",
    intro: "最多在当前设备保存 5 组地图状态，包括日期、筛选条件和对比中的目的地。",
    empty: "还没有保存地图。",
    open: "打开",
    remove: "删除",
    close: "关闭已保存地图",
    storageError: "浏览器存储不可用。",
  },
  "zh-hant": {
    save: "儲存目前地圖",
    saved: "已儲存",
    savedViews: (count: number) => `已儲存${count > 0 ? `（${count}）` : ""}`,
    title: "已儲存的地圖",
    intro: "最多在目前裝置儲存 5 組地圖狀態，包括日期、篩選條件和比較中的目的地。",
    empty: "還沒有儲存地圖。",
    open: "開啟",
    remove: "刪除",
    close: "關閉已儲存地圖",
    storageError: "瀏覽器儲存無法使用。",
  },
} as const;

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

  useEffect(() => {
    try {
      setViews(
        parseSavedCountryMapViews(window.localStorage.getItem(COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY)),
      );
    } catch {
      setStatus(copy.storageError);
    }
  }, [copy.storageError]);

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
            className="absolute inset-x-3 bottom-3 max-h-[76vh] overflow-y-auto rounded-3xl border border-border bg-white p-4 shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-6 lg:left-1/2 lg:right-auto lg:w-[min(680px,calc(100vw-3rem))] lg:-translate-x-1/2"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{copy.title}</p>
                <p className="mt-2 max-w-xl text-sm text-muted">{copy.intro}</p>
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
              <ul className="mt-6 grid gap-3">
                {views.map((view) => (
                  <li
                    key={view.id}
                    className="rounded-2xl border border-border bg-surface-elevated p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-foreground">
                          {view.label}
                        </strong>
                        <span className="mt-1 block truncate text-xs text-muted">{view.url}</span>
                      </div>
                      <div className="flex items-center gap-2">
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
