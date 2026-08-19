"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  DISCOVERY_SHORTLIST_STORAGE_KEY,
  MAX_DISCOVERY_SHORTLIST,
  discoveryShortlistFromSearch,
  normalizeDiscoveryShortlist,
  parseStoredDiscoveryShortlist,
  serializeDiscoveryShortlist,
  withDiscoveryShortlist,
} from "../discovery/discovery-retention";
import {
  formatTravelMinutes,
  reachabilityModeLabel,
  reachabilityOriginLabel,
} from "../discovery/reachability";
import {
  MAX_SAVED_DISCOVERY_SEARCHES,
  SAVED_DISCOVERY_SEARCHES_STORAGE_KEY,
  buildRecheckReminderCalendar,
  buildSavedDiscoverySearch,
  parseStoredSavedDiscoverySearches,
  serializeSavedDiscoverySearches,
  upsertSavedDiscoverySearch,
  type SavedDiscoverySearch,
} from "../discovery/saved-search";
import { toTraditionalCity } from "../trips/traditional";
import type { TripCityOption } from "../trips/workspace";
import type { WeatherDiscoveryLocale } from "./WeatherDiscoveryPlannerV2";

interface TripCitiesResponse {
  readonly data?: { readonly items?: ReadonlyArray<TripCityOption> };
}

const API_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");

const COPY = {
  en: {
    control: "Saved",
    title: "Saved searches",
    intro:
      "Keep up to five complete searches on this device. No account, email address or notification backend is required.",
    current: "Current search",
    currentUnavailable: "Run a search first so dates and reachability are present in the URL.",
    saveSearch: "Save current search",
    savedSearch: "Search saved.",
    alreadySaved: "Saved search updated.",
    open: "Open",
    remove: "Remove",
    copy: "Copy link",
    copied: "Link copied.",
    copyFailed: "Copy is unavailable in this browser.",
    calendar: "Calendar reminders",
    calendarHelp:
      "Download D-7, D-3 and D-1 all-day reminders that reopen this exact search. Nothing is sent to our servers.",
    calendarDownloaded: "Calendar reminders downloaded.",
    calendarUnavailable: "The trip start date has passed, so no reminder was created.",
    savedEmpty: "No complete searches saved yet.",
    shortlist: "Compared destinations",
    shortlistIntro: "The current comparison list remains in the shareable URL and on this device.",
    shortlistEmpty: "Use “Add to comparison” on a result to keep up to three destinations.",
    clearShortlist: "Clear comparison",
    close: "Close saved searches",
    modeTime: "one way",
    storageError: "Browser storage is unavailable. The shareable URL still works.",
    reminderSummary: "Recheck trip weather",
    reminderDescription: "Open this saved Where Not Rain search and review the latest forecast.",
  },
  "zh-cn": {
    control: "已保存",
    title: "已保存的查询",
    intro: "最多在当前设备保存 5 组完整查询，不需要账号、邮箱或通知后台。",
    current: "当前查询",
    currentUnavailable: "请先执行一次查询，让日期和可达范围写入 URL。",
    saveSearch: "保存当前查询",
    savedSearch: "查询已保存。",
    alreadySaved: "已更新保存的查询。",
    open: "打开",
    remove: "删除",
    copy: "复制链接",
    copied: "链接已复制。",
    copyFailed: "当前浏览器无法复制链接。",
    calendar: "下载日历复查提醒",
    calendarHelp: "生成出发前 7 天、3 天、1 天的全天提醒，点击后重新打开同一查询；不会上传邮箱。",
    calendarDownloaded: "日历提醒已下载。",
    calendarUnavailable: "出发日期已经过去，没有生成提醒。",
    savedEmpty: "还没有保存完整查询。",
    shortlist: "对比中的目的地",
    shortlistIntro: "当前对比列表仍会保存在可分享 URL 和本机中。",
    shortlistEmpty: "在结果中点击“加入对比”，最多保留 3 个目的地。",
    clearShortlist: "清空对比",
    close: "关闭已保存查询",
    modeTime: "单程",
    storageError: "浏览器存储不可用，但可分享 URL 仍然有效。",
    reminderSummary: "重新检查旅行天气",
    reminderDescription: "打开已保存的 Where Not Rain 查询，查看最新天气预报。",
  },
  "zh-hant": {
    control: "已儲存",
    title: "已儲存的查詢",
    intro: "最多在目前裝置儲存 5 組完整查詢，不需要帳號、信箱或通知後台。",
    current: "目前查詢",
    currentUnavailable: "請先執行一次查詢，讓日期和可達範圍寫入 URL。",
    saveSearch: "儲存目前查詢",
    savedSearch: "查詢已儲存。",
    alreadySaved: "已更新儲存的查詢。",
    open: "開啟",
    remove: "刪除",
    copy: "複製連結",
    copied: "連結已複製。",
    copyFailed: "目前瀏覽器無法複製連結。",
    calendar: "下載日曆複查提醒",
    calendarHelp: "產生出發前 7 天、3 天、1 天的全天提醒，點擊後重新開啟同一查詢；不會上傳信箱。",
    calendarDownloaded: "日曆提醒已下載。",
    calendarUnavailable: "出發日期已經過去，沒有產生提醒。",
    savedEmpty: "還沒有儲存完整查詢。",
    shortlist: "比較中的目的地",
    shortlistIntro: "目前比較清單仍會儲存在可分享 URL 和本機中。",
    shortlistEmpty: "在結果中點擊「加入比較」，最多保留 3 個目的地。",
    clearShortlist: "清空比較",
    close: "關閉已儲存查詢",
    modeTime: "單程",
    storageError: "瀏覽器儲存無法使用，但可分享 URL 仍然有效。",
    reminderSummary: "重新檢查旅行天氣",
    reminderDescription: "開啟已儲存的 Where Not Rain 查詢，查看最新天氣預報。",
  },
} as const;

function fallbackLabel(id: string): string {
  return id.replace(/[-_]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function discoveryUrl(values: ReadonlyArray<string>): string {
  const next = withDiscoveryShortlist(new URLSearchParams(window.location.search), values);
  const query = next.toString();
  return query.length > 0 ? `${window.location.pathname}?${query}` : window.location.pathname;
}

function absoluteUrl(relative: string): string {
  return new URL(relative, window.location.origin).href;
}

function downloadCalendar(calendar: { readonly content: string; readonly filename: string }): void {
  const blob = new Blob([calendar.content], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = calendar.filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export function DiscoveryRetentionCompanion({
  locale,
}: {
  readonly locale: WeatherDiscoveryLocale;
}): ReactElement {
  const copy = COPY[locale];
  const apiLocale = locale === "en" ? "en" : "zh-cn";
  const [open, setOpen] = useState(false);
  const [shortlist, setShortlist] = useState<ReadonlyArray<string>>([]);
  const [cities, setCities] = useState<ReadonlyArray<TripCityOption>>([]);
  const [savedSearches, setSavedSearches] = useState<ReadonlyArray<SavedDiscoverySearch>>([]);
  const [currentSearch, setCurrentSearch] = useState<SavedDiscoverySearch | null>(null);
  const [status, setStatus] = useState("");
  const shortlistInitializedRef = useRef(false);

  const syncFromUrl = useCallback((): void => {
    const search = new URLSearchParams(window.location.search);
    const fromUrl = discoveryShortlistFromSearch(search);
    setCurrentSearch(
      buildSavedDiscoverySearch(new URL(window.location.href), new Date().toISOString()),
    );

    if (fromUrl.length > 0) {
      try {
        window.localStorage.setItem(
          DISCOVERY_SHORTLIST_STORAGE_KEY,
          serializeDiscoveryShortlist(fromUrl),
        );
      } catch {
        setStatus(copy.storageError);
      }
      setShortlist(fromUrl);
      shortlistInitializedRef.current = true;
      return;
    }

    if (shortlistInitializedRef.current) {
      try {
        window.localStorage.removeItem(DISCOVERY_SHORTLIST_STORAGE_KEY);
      } catch {
        setStatus(copy.storageError);
      }
      setShortlist([]);
      return;
    }

    let stored: ReadonlyArray<string> = [];
    try {
      stored = parseStoredDiscoveryShortlist(
        window.localStorage.getItem(DISCOVERY_SHORTLIST_STORAGE_KEY),
      );
    } catch {
      setStatus(copy.storageError);
    }
    shortlistInitializedRef.current = true;
    setShortlist(stored);
    if (stored.length > 0) {
      window.history.replaceState({}, "", discoveryUrl(stored));
    }
  }, [copy.storageError]);

  useEffect(() => {
    try {
      setSavedSearches(
        parseStoredSavedDiscoverySearches(
          window.localStorage.getItem(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY),
        ),
      );
    } catch {
      setStatus(copy.storageError);
    }

    syncFromUrl();
    const originalReplaceState = window.history.replaceState.bind(window.history);
    const originalPushState = window.history.pushState.bind(window.history);
    window.history.replaceState = (...args: Parameters<History["replaceState"]>): void => {
      originalReplaceState(...args);
      queueMicrotask(syncFromUrl);
    };
    window.history.pushState = (...args: Parameters<History["pushState"]>): void => {
      originalPushState(...args);
      queueMicrotask(syncFromUrl);
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.history.replaceState = originalReplaceState;
      window.history.pushState = originalPushState;
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, [copy.storageError, syncFromUrl]);

  useEffect(() => {
    if (API_BASE.length === 0) return;
    let active = true;
    void fetch(`${API_BASE}/api/v1/trip-cities?locale=${apiLocale}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`CITY_API_${response.status}`);
        return (await response.json()) as TripCitiesResponse;
      })
      .then((payload) => {
        if (!active) return;
        const raw = payload.data?.items ?? [];
        setCities(locale === "zh-hant" ? raw.map(toTraditionalCity) : raw);
      })
      .catch(() => {
        // IDs remain usable when optional labels are unavailable.
      });
    return () => {
      active = false;
    };
  }, [apiLocale, locale]);

  const savedDestinations = useMemo(
    () =>
      shortlist.map((id) => ({
        id,
        label: cities.find((city) => city.cityId === id)?.cityName ?? fallbackLabel(id),
      })),
    [cities, shortlist],
  );

  const persistSavedSearches = useCallback(
    (values: ReadonlyArray<SavedDiscoverySearch>): void => {
      setSavedSearches(values);
      try {
        if (values.length === 0) {
          window.localStorage.removeItem(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY);
        } else {
          window.localStorage.setItem(
            SAVED_DISCOVERY_SEARCHES_STORAGE_KEY,
            serializeSavedDiscoverySearches(values),
          );
        }
      } catch {
        setStatus(copy.storageError);
      }
    },
    [copy.storageError],
  );

  const saveCurrentSearch = useCallback((): void => {
    const next = buildSavedDiscoverySearch(new URL(window.location.href), new Date().toISOString());
    if (next === null) {
      setStatus(copy.currentUnavailable);
      return;
    }
    const existed = savedSearches.some((item) => item.id === next.id);
    persistSavedSearches(upsertSavedDiscoverySearch(savedSearches, next));
    setCurrentSearch(next);
    setStatus(existed ? copy.alreadySaved : copy.savedSearch);
  }, [
    copy.alreadySaved,
    copy.currentUnavailable,
    copy.savedSearch,
    persistSavedSearches,
    savedSearches,
  ]);

  const removeSavedSearch = useCallback(
    (id: string): void => {
      persistSavedSearches(savedSearches.filter((item) => item.id !== id));
      setStatus("");
    },
    [persistSavedSearches, savedSearches],
  );

  const copySavedSearch = useCallback(
    async (search: SavedDiscoverySearch): Promise<void> => {
      try {
        if (navigator.clipboard === undefined) throw new Error("CLIPBOARD_UNAVAILABLE");
        await navigator.clipboard.writeText(absoluteUrl(search.url));
        setStatus(copy.copied);
      } catch {
        setStatus(copy.copyFailed);
      }
    },
    [copy.copied, copy.copyFailed],
  );

  const createCalendar = useCallback(
    (search: SavedDiscoverySearch): void => {
      const origin = reachabilityOriginLabel(search.originId, locale);
      const calendar = buildRecheckReminderCalendar({
        search,
        today: new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        summary: `${copy.reminderSummary} · ${origin}`,
        description: copy.reminderDescription,
        absoluteUrl: absoluteUrl(search.url),
      });
      if (calendar.reminderCount === 0) {
        setStatus(copy.calendarUnavailable);
        return;
      }
      downloadCalendar(calendar);
      setStatus(copy.calendarDownloaded);
    },
    [
      copy.calendarDownloaded,
      copy.calendarUnavailable,
      copy.reminderDescription,
      copy.reminderSummary,
      locale,
    ],
  );

  const updateShortlist = useCallback(
    (values: ReadonlyArray<string>): void => {
      const normalized = normalizeDiscoveryShortlist(values);
      try {
        if (normalized.length === 0) {
          window.localStorage.removeItem(DISCOVERY_SHORTLIST_STORAGE_KEY);
        } else {
          window.localStorage.setItem(
            DISCOVERY_SHORTLIST_STORAGE_KEY,
            serializeDiscoveryShortlist(normalized),
          );
        }
      } catch {
        setStatus(copy.storageError);
      }
      window.location.assign(discoveryUrl(normalized));
    },
    [copy.storageError],
  );

  const searchLabel = (search: SavedDiscoverySearch): string => {
    const origin = reachabilityOriginLabel(search.originId, locale);
    return `${origin} · ${search.from} → ${search.to}`;
  };

  const searchMeta = (search: SavedDiscoverySearch): string =>
    `${reachabilityModeLabel(search.mode, locale)} · ${copy.modeTime} ${formatTravelMinutes(
      search.maxTravelMinutes,
      locale,
    )}`;

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(28rem,calc(100vw-2rem))]">
      {open ? (
        <div
          className="mb-3 max-h-[min(75vh,46rem)] overflow-y-auto rounded-[1.5rem] border border-border bg-white p-4 shadow-xl"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{copy.control}</p>
              <h2 className="mt-2 text-lg font-bold text-foreground">{copy.title}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">{copy.intro}</p>
            </div>
            <button
              type="button"
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted focus-ring"
              onClick={() => setOpen(false)}
              aria-label={copy.close}
            >
              ×
            </button>
          </div>

          <section className="mt-4 rounded-2xl bg-surface-elevated p-3">
            <p className="text-xs font-bold text-foreground">{copy.current}</p>
            {currentSearch === null ? (
              <p className="mt-1 text-xs leading-5 text-muted">{copy.currentUnavailable}</p>
            ) : (
              <>
                <p className="mt-2 text-sm font-bold text-foreground">
                  {searchLabel(currentSearch)}
                </p>
                <p className="mt-1 text-xs text-muted">{searchMeta(currentSearch)}</p>
              </>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-10 rounded-xl bg-foreground px-3 text-xs font-bold text-white focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                onClick={saveCurrentSearch}
                disabled={currentSearch === null}
              >
                {copy.saveSearch}
              </button>
              <button
                type="button"
                className="min-h-10 rounded-xl border border-border bg-white px-3 text-xs font-bold text-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => currentSearch !== null && createCalendar(currentSearch)}
                disabled={currentSearch === null}
              >
                {copy.calendar}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted">{copy.calendarHelp}</p>
          </section>

          <section className="mt-4">
            {savedSearches.length === 0 ? (
              <p className="rounded-2xl border border-border p-3 text-xs leading-5 text-muted">
                {copy.savedEmpty}
              </p>
            ) : (
              <div className="grid gap-3">
                {savedSearches.map((search) => (
                  <article key={search.id} className="rounded-2xl border border-border p-3">
                    <p className="text-sm font-bold text-foreground">{searchLabel(search)}</p>
                    <p className="mt-1 text-xs text-muted">{searchMeta(search)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-9 rounded-full bg-primary px-3 text-xs font-bold text-white focus-ring"
                        onClick={() => window.location.assign(search.url)}
                      >
                        {copy.open}
                      </button>
                      <button
                        type="button"
                        className="min-h-9 rounded-full border border-border px-3 text-xs font-bold text-foreground focus-ring"
                        onClick={() => createCalendar(search)}
                      >
                        {copy.calendar}
                      </button>
                      <button
                        type="button"
                        className="min-h-9 rounded-full border border-border px-3 text-xs font-bold text-foreground focus-ring"
                        onClick={() => void copySavedSearch(search)}
                      >
                        {copy.copy}
                      </button>
                      <button
                        type="button"
                        className="min-h-9 rounded-full px-3 text-xs font-bold text-danger focus-ring"
                        onClick={() => removeSavedSearch(search.id)}
                      >
                        {copy.remove}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-bold text-foreground">{copy.shortlist}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{copy.shortlistIntro}</p>
            {savedDestinations.length === 0 ? (
              <p className="mt-3 rounded-2xl bg-surface-elevated p-3 text-xs leading-5 text-muted">
                {copy.shortlistEmpty}
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {savedDestinations.map((destination) => (
                    <button
                      key={destination.id}
                      type="button"
                      className="min-h-10 rounded-full border border-border bg-white px-3 text-sm font-semibold text-foreground focus-ring"
                      onClick={() =>
                        updateShortlist(shortlist.filter((id) => id !== destination.id))
                      }
                      aria-label={`${copy.remove} ${destination.label}`}
                    >
                      {destination.label} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 text-xs font-bold text-primary focus-ring"
                  onClick={() => updateShortlist([])}
                >
                  {copy.clearShortlist}
                </button>
              </>
            )}
          </section>

          {status.length > 0 ? (
            <p className="mt-4 rounded-xl bg-surface-elevated p-3 text-xs font-semibold text-muted">
              {status}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className="ml-auto flex min-h-12 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-bold text-white shadow-xl focus-ring"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span aria-hidden="true">☆</span>
        {copy.control} {savedSearches.length}/{MAX_SAVED_DISCOVERY_SEARCHES}
        {shortlist.length > 0 ? ` · ${shortlist.length}/${MAX_DISCOVERY_SHORTLIST}` : ""}
      </button>
    </aside>
  );
}
