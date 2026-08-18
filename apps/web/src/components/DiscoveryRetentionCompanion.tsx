"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import { emitProductAnalytics } from "../analytics/browser-events";
import {
  DISCOVERY_SHORTLIST_STORAGE_KEY,
  MAX_DISCOVERY_SHORTLIST,
  discoveryShortlistFromSearch,
  normalizeDiscoveryShortlist,
  parseStoredDiscoveryShortlist,
  serializeDiscoveryShortlist,
  withDiscoveryShortlist,
} from "../discovery/discovery-retention";
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
    title: "Saved destinations",
    intro: "Your shortlist stays on this device and remains shareable through the page URL.",
    empty: "Use “Save & compare” on a result to keep up to four destinations.",
    clear: "Clear saved",
    remove: "Remove",
    guide: "How to read the results",
    why: "Why it fits",
    whyText: "Positive signals explain where a destination matches your dates and priorities.",
    risk: "Watch-outs",
    riskText: "Rain, heat, wind, UV and limited data are trade-offs to review before booking.",
    close: "Close saved destinations",
  },
  "zh-cn": {
    control: "已保存",
    title: "已保存的目的地",
    intro: "短名单会保存在当前设备中，也能通过页面链接分享。",
    empty: "在结果中点击“保存并对比”，最多可保留 4 个目的地。",
    clear: "清空已保存",
    remove: "移除",
    guide: "如何阅读推荐结果",
    why: "推荐理由",
    whyText: "正向信号说明目的地在哪些方面符合你的日期和出行偏好。",
    risk: "需要注意",
    riskText: "降雨、高温、风力、紫外线和数据有限等因素，需要在预订前确认。",
    close: "关闭已保存目的地",
  },
  "zh-hant": {
    control: "已儲存",
    title: "已儲存的目的地",
    intro: "短名單會保存在目前裝置中，也能透過頁面連結分享。",
    empty: "在結果中點擊「儲存並比較」，最多可保留 4 個目的地。",
    clear: "清空已儲存",
    remove: "移除",
    guide: "如何閱讀推薦結果",
    why: "推薦理由",
    whyText: "正向訊號說明目的地在哪些方面符合你的日期和出行偏好。",
    risk: "需要注意",
    riskText: "降雨、高溫、風力、紫外線和資料有限等因素，需要在預訂前確認。",
    close: "關閉已儲存目的地",
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

export function DiscoveryRetentionCompanion({
  locale,
}: {
  readonly locale: WeatherDiscoveryLocale;
}): ReactElement {
  const copy = COPY[locale];
  const apiLocale = locale === "en" ? "en" : "zh-cn";
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<ReadonlyArray<string>>([]);
  const [cities, setCities] = useState<ReadonlyArray<TripCityOption>>([]);

  const syncFromUrl = useCallback((): void => {
    const search = new URLSearchParams(window.location.search);
    const fromUrl = discoveryShortlistFromSearch(search);
    if (fromUrl.length > 0) {
      try {
        window.localStorage.setItem(
          DISCOVERY_SHORTLIST_STORAGE_KEY,
          serializeDiscoveryShortlist(fromUrl),
        );
      } catch {
        // Retention is optional and must never block discovery.
      }
      setSaved(fromUrl);
      return;
    }

    let stored: ReadonlyArray<string> = [];
    try {
      stored = parseStoredDiscoveryShortlist(
        window.localStorage.getItem(DISCOVERY_SHORTLIST_STORAGE_KEY),
      );
    } catch {
      stored = [];
    }
    setSaved(stored);
    if (stored.length > 0) {
      window.history.replaceState({}, "", discoveryUrl(stored));
    }
  }, []);

  useLayoutEffect(() => {
    syncFromUrl();
    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.replaceState = (...args: Parameters<History["replaceState"]>): void => {
      originalReplaceState(...args);
      queueMicrotask(syncFromUrl);
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, [syncFromUrl]);

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
        // Saved IDs remain usable when the optional label lookup fails.
      });
    return () => {
      active = false;
    };
  }, [apiLocale, locale]);

  useEffect(() => {
    const trackResultOpen = (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const card = anchor.closest("article.destination-card");
      if (card === null) return;

      const cards = Array.from(document.querySelectorAll("article.destination-card"));
      const position = cards.indexOf(card) + 1;
      if (position <= 0) return;

      const pathname = new URL(anchor.href, window.location.origin).pathname;
      const parts = pathname.split("/").filter(Boolean);
      const citySlug = parts[parts.length - 1] ?? "unknown";
      const countrySlug = parts[parts.length - 2] ?? "unknown";
      const city = cities.find(
        (candidate) => candidate.citySlug === citySlug && candidate.countrySlug === countrySlug,
      );

      emitProductAnalytics({
        locale,
        routeTemplate: "/discover",
        fields: {
          event: "search_result_clicked",
          destination_id: city?.cityId ?? `${countrySlug}-${citySlug}`,
          result_type: "city",
          position,
        },
      });
    };

    document.addEventListener("click", trackResultOpen);
    return () => document.removeEventListener("click", trackResultOpen);
  }, [cities, locale]);

  const savedDestinations = useMemo(
    () =>
      saved.map((id) => ({
        id,
        label: cities.find((city) => city.cityId === id)?.cityName ?? fallbackLabel(id),
      })),
    [cities, saved],
  );

  const updateSaved = useCallback((values: ReadonlyArray<string>): void => {
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
      // Navigation still applies the requested URL state.
    }
    window.location.assign(discoveryUrl(normalized));
  }, []);

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))]">
      {open ? (
        <div
          className="mb-3 rounded-[1.5rem] border border-border bg-white p-4 shadow-xl"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{copy.guide}</p>
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

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-elevated p-3">
              <p className="text-xs font-bold text-foreground">✓ {copy.why}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{copy.whyText}</p>
            </div>
            <div className="rounded-2xl border border-border p-3">
              <p className="text-xs font-bold text-foreground">• {copy.risk}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{copy.riskText}</p>
            </div>
          </div>

          {savedDestinations.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-surface-elevated p-3 text-xs leading-5 text-muted">
              {copy.empty}
            </p>
          ) : (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {savedDestinations.map((destination) => (
                  <button
                    key={destination.id}
                    type="button"
                    className="min-h-10 rounded-full border border-border bg-white px-3 text-sm font-semibold text-foreground focus-ring"
                    onClick={() => updateSaved(saved.filter((id) => id !== destination.id))}
                    aria-label={`${copy.remove} ${destination.label}`}
                  >
                    {destination.label} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 text-xs font-bold text-primary focus-ring"
                onClick={() => updateSaved([])}
              >
                {copy.clear}
              </button>
            </div>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="ml-auto flex min-h-12 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-bold text-white shadow-xl focus-ring"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span aria-hidden="true">☆</span>
        {copy.control} {saved.length}/{MAX_DISCOVERY_SHORTLIST}
      </button>
    </aside>
  );
}
