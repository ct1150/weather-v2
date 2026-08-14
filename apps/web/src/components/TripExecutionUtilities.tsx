"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { normalizeActivityItems } from "../trips/activity-intelligence";
import {
  loadMostRecentOfflineTrip,
  saveOfflineRoute,
  saveOfflineTripBundle,
  type OfflineTripBundle,
  type OfflineWeatherBundle,
} from "../trips/offline-store";
import { estimateRoutePlan } from "../trips/route-intelligence";
import { projectExecution } from "../trips/trip-execution";
import {
  buildWeatherPackingList,
  workspaceToIcs,
  workspaceToPrintableHtml,
} from "../trips/trip-exports";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  normalizeWorkspace,
  type TripForecastDay,
  type TripWorkspace,
  type TripWorkspaceDay,
} from "../trips/workspace";
import type { TripExecutionLocale } from "./TripExecutionReplanPanel";

const WEATHER_STORAGE_PREFIX = "wnr:trip-weather:v1:";
const OFFLINE_RUNTIME_CACHE = "wnr-runtime-v1";

interface StoredWeather {
  readonly dataUpdatedAt: string;
  readonly stale: boolean;
  readonly items: ReadonlyArray<TripForecastDay>;
}

interface TripExecutionUtilitiesProps {
  readonly locale: TripExecutionLocale;
}

const COPY = {
  en: {
    title: "Offline & travel utilities",
    intro:
      "Save the active trip for offline execution, review day weather, export calendar events and build a weather-driven packing list.",
    noTrip: "No local or offline trip is available yet.",
    offline: "Download trip for offline use",
    offlineDone:
      "Trip, weather, route estimates and the execution shell are saved for offline use.",
    offlinePartial:
      "Trip data was saved, but part of the offline shell or route cache could not be prepared. The saved itinerary remains usable.",
    offlineFailed: "Offline storage is unavailable on this browser.",
    ics: "Export ICS",
    print: "Print / Save PDF",
    packing: "Packing list",
    weather: "Weather execution overview",
    noWeather: "No saved weather yet. Refresh weather in the trip workspace before departure.",
    rain: "Rain",
    wind: "Wind",
    uv: "UV",
    sun: "Sunrise / sunset",
    stale: "Saved weather may be stale",
    fresh: "Saved weather",
    restore: "Restore offline copy to editor",
    restored: "Offline trip restored to the local workspace.",
  },
  "zh-cn": {
    title: "离线与旅行工具",
    intro:
      "把当前行程下载到本机离线执行，并集中查看逐日天气、导出日历、生成天气行李清单和打印/PDF。",
    noTrip: "当前没有本地或离线保存的行程。",
    offline: "下载此行程离线使用",
    offlineDone: "已保存行程、天气、每天估算路线和执行页面，可用于离线执行。",
    offlinePartial:
      "行程数据已保存，但部分执行页面或路线缓存未能完成；已保存的行程仍可离线查看。",
    offlineFailed: "当前浏览器无法使用离线存储。",
    ics: "导出 ICS 日历",
    print: "打印 / 保存 PDF",
    packing: "天气行李清单",
    weather: "天气执行总览",
    noWeather: "还没有已保存天气；出发前请在旅行工作台刷新天气。",
    rain: "降雨",
    wind: "风速",
    uv: "UV",
    sun: "日出 / 日落",
    stale: "已保存天气可能过期",
    fresh: "已保存天气",
    restore: "把离线副本恢复到编辑器",
    restored: "已把离线行程恢复到本地工作台。",
  },
  "zh-hant": {
    title: "離線與旅行工具",
    intro:
      "把目前行程下載到本機離線執行，並集中查看逐日天氣、匯出行事曆、產生天氣行李清單和列印／PDF。",
    noTrip: "目前沒有本機或離線儲存的行程。",
    offline: "下載此行程離線使用",
    offlineDone: "已儲存行程、天氣、每天估算路線和執行頁面，可用於離線執行。",
    offlinePartial:
      "行程資料已儲存，但部分執行頁面或路線快取未能完成；已儲存的行程仍可離線查看。",
    offlineFailed: "目前瀏覽器無法使用離線儲存。",
    ics: "匯出 ICS 行事曆",
    print: "列印 / 儲存 PDF",
    packing: "天氣行李清單",
    weather: "天氣執行總覽",
    noWeather: "還沒有已儲存天氣；出發前請在旅行工作台更新天氣。",
    rain: "降雨",
    wind: "風速",
    uv: "UV",
    sun: "日出 / 日落",
    stale: "已儲存天氣可能過期",
    fresh: "已儲存天氣",
    restore: "把離線副本還原到編輯器",
    restored: "已把離線行程還原到本機工作台。",
  },
} as const;

function parseWeather(raw: string | null): OfflineWeatherBundle | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredWeather>;
    if (!Array.isArray(value.items) || typeof value.dataUpdatedAt !== "string") return null;
    return {
      dataUpdatedAt: value.dataUpdatedAt,
      stale: value.stale === true,
      items: value.items,
    };
  } catch {
    return null;
  }
}

function loadLocalWorkspace(): TripWorkspace | null {
  const raw = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (raw === null) return null;
  try {
    return normalizeWorkspace(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function loadWorkspaceWeather(workspaceId: string): OfflineWeatherBundle | null {
  return parseWeather(window.localStorage.getItem(`${WEATHER_STORAGE_PREFIX}${workspaceId}`));
}

function dayActivities(day: TripWorkspaceDay) {
  return normalizeActivityItems(day.activityItems, day.activities, {
    dayId: day.id,
    cityId: day.cityId,
    dayTheme: day.theme,
    dayFlexible: day.flexible,
    dayNotes: day.notes,
  });
}

function downloadText(content: string, fileName: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeName(value: string): string {
  return value.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/gu, "") || "trip";
}

function localePrefix(locale: TripExecutionLocale): string {
  return locale === "en" ? "" : `/${locale}`;
}

function localeCode(locale: TripExecutionLocale): string {
  if (locale === "en") return "en-US";
  return locale === "zh-hant" ? "zh-TW" : "zh-CN";
}

async function cacheOfflineShell(locale: TripExecutionLocale): Promise<boolean> {
  if (!("caches" in window)) return false;
  try {
    const prefix = localePrefix(locale);
    const paths = [
      `${prefix}/trips`,
      `${prefix}/trips/workspace`,
      `${prefix}/trips/execution`,
      "/manifest.webmanifest",
      "/favicon.svg",
    ];
    const cache = await caches.open(OFFLINE_RUNTIME_CACHE);
    const results = await Promise.allSettled(
      paths.map(async (path) => {
        const response = await fetch(path, { cache: "reload" });
        if (!response.ok) throw new Error(`OFFLINE_SHELL_${response.status}`);
        await cache.put(path, response.clone());
      }),
    );
    return results.every((result) => result.status === "fulfilled");
  } catch {
    return false;
  }
}

export function TripExecutionUtilities({ locale }: TripExecutionUtilitiesProps): ReactElement {
  const copy = COPY[locale];
  const [workspace, setWorkspace] = useState<TripWorkspace | null>(null);
  const [weather, setWeather] = useState<OfflineWeatherBundle | null>(null);
  const [offlineBundle, setOfflineBundle] = useState<OfflineTripBundle | null>(null);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [packingOpen, setPackingOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const local = loadLocalWorkspace();
    if (local !== null) {
      setWorkspace(local);
      setWeather(loadWorkspaceWeather(local.id));
    }
    void loadMostRecentOfflineTrip().then((bundle) => {
      setOfflineBundle(bundle);
      if (local === null && bundle !== null) {
        setWorkspace(bundle.workspace);
        setWeather(bundle.weather);
        setOfflineOnly(true);
      }
    });
  }, []);

  const forecasts = weather?.items ?? [];
  const packing = useMemo(
    () =>
      workspace === null
        ? []
        : buildWeatherPackingList(forecasts, workspace.partyProfile, locale),
    [forecasts, locale, workspace],
  );

  const currentWorkspace = (): TripWorkspace | null => loadLocalWorkspace() ?? workspace;

  const saveOffline = async (): Promise<void> => {
    const current = currentWorkspace();
    if (current === null) return;
    const currentWeather = loadWorkspaceWeather(current.id) ?? weather;
    const bundleSaved = await saveOfflineTripBundle(current, currentWeather);
    const [shellSaved, routeResults] = await Promise.all([
      cacheOfflineShell(locale),
      Promise.all(
        current.days.map(async (day) => {
          const projection = projectExecution(dayActivities(day));
          const plan = estimateRoutePlan(projection.routeWaypoints, "driving", {
            start: projection.startAnchor,
            end: projection.endAnchor,
          });
          return saveOfflineRoute(current.id, day.id, plan);
        }),
      ),
    ]);
    setWorkspace(current);
    setWeather(currentWeather);
    setOfflineBundle({
      workspaceId: current.id,
      workspace: current,
      weather: currentWeather,
      savedAt: new Date().toISOString(),
    });
    setOfflineOnly(false);
    if (!bundleSaved) {
      setMessage(copy.offlineFailed);
      return;
    }
    setMessage(
      shellSaved && routeResults.every(Boolean) ? copy.offlineDone : copy.offlinePartial,
    );
  };

  const restoreOffline = (): void => {
    if (offlineBundle === null) return;
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(offlineBundle.workspace));
    if (offlineBundle.weather !== null) {
      window.localStorage.setItem(
        `${WEATHER_STORAGE_PREFIX}${offlineBundle.workspace.id}`,
        JSON.stringify(offlineBundle.weather),
      );
    }
    setWorkspace(offlineBundle.workspace);
    setWeather(offlineBundle.weather);
    setOfflineOnly(false);
    setMessage(copy.restored);
  };

  const exportIcs = (): void => {
    const current = currentWorkspace();
    if (current === null) return;
    downloadText(
      workspaceToIcs(current),
      `${safeName(current.title)}.ics`,
      "text/calendar;charset=utf-8",
    );
  };

  const printTrip = (): void => {
    const current = currentWorkspace();
    if (current === null) return;
    const currentForecasts = loadWorkspaceWeather(current.id)?.items ?? forecasts;
    const printable = window.open("", "_blank");
    if (printable === null) {
      downloadText(
        workspaceToPrintableHtml(current, currentForecasts),
        `${safeName(current.title)}.html`,
        "text/html;charset=utf-8",
      );
      return;
    }
    printable.opener = null;
    printable.document.open();
    printable.document.write(workspaceToPrintableHtml(current, currentForecasts));
    printable.document.close();
    printable.focus();
    printable.print();
  };

  if (workspace === null) {
    return <section className="info-panel mt-5">{copy.noTrip}</section>;
  }

  return (
    <section
      className="mt-5 rounded-2xl border border-border bg-white p-4 sm:p-5"
      data-trip-offline-tools="v1"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">PWA / Offline / Export</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-muted">{copy.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="trip-primary-button" onClick={() => void saveOffline()}>
            {copy.offline}
          </button>
          <button type="button" className="trip-secondary-button" onClick={exportIcs}>
            {copy.ics}
          </button>
          <button type="button" className="trip-secondary-button" onClick={printTrip}>
            {copy.print}
          </button>
          <button
            type="button"
            className="trip-secondary-button"
            onClick={() => setPackingOpen((value) => !value)}
          >
            {copy.packing}
          </button>
          {offlineOnly && offlineBundle !== null ? (
            <button type="button" className="trip-secondary-button" onClick={restoreOffline}>
              {copy.restore}
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className="trip-workspace-message mt-4" role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">{copy.weather}</h3>
          {weather !== null ? (
            <span className="text-[11px] text-muted">
              {weather.stale ? copy.stale : copy.fresh} ·{" "}
              {new Date(weather.dataUpdatedAt).toLocaleString(localeCode(locale))}
            </span>
          ) : null}
        </div>
        {forecasts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{copy.noWeather}</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workspace.days.map((day) => {
              const forecast = forecasts.find(
                (item) => item.cityId === day.cityId && item.date === day.date,
              );
              if (forecast === undefined) return null;
              return (
                <article
                  key={day.id}
                  className="rounded-xl border border-border bg-surface-elevated p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-muted">
                        D{day.dayNumber} · {day.date}
                      </p>
                      <strong className="mt-1 block text-sm text-foreground">
                        {day.cityName} · {forecast.condition}
                      </strong>
                    </div>
                    <strong className="text-sm">
                      {forecast.temperatureMinC ?? "—"}°–{forecast.temperatureMaxC ?? "—"}°
                    </strong>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                    <span>
                      {copy.rain} {forecast.rainProbability ?? "—"}%
                    </span>
                    <span>
                      {copy.wind} {forecast.windSpeedKph ?? "—"} km/h
                    </span>
                    <span>
                      {copy.uv} {forecast.uvIndex ?? "—"}
                    </span>
                    <span>
                      {copy.sun} {forecast.sunrise ?? "—"} / {forecast.sunset ?? "—"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {packingOpen ? (
        <div className="mt-5 rounded-xl border border-border p-4" data-weather-packing="visible">
          <h3 className="text-sm font-bold text-foreground">{copy.packing}</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {packing.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 rounded-lg bg-surface-elevated p-3 text-xs"
              >
                <input type="checkbox" className="mt-0.5" />
                <span>
                  <strong className="block text-foreground">{item.label}</strong>
                  <span className="mt-1 block text-muted">{item.reason}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
