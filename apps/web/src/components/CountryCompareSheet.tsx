"use client";

import type { ReactElement } from "react";

export type CountryCompareLocale = "en" | "zh-cn" | "zh-hant";

export interface CountryCompareDay {
  readonly localDate: string;
  readonly conditionLabel: string;
  readonly rainProbability: number | null;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
}

export interface CountryCompareItem {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly rainHeadline: string;
  readonly totalRainMm: number | null;
  readonly maxRain: number | null;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
  readonly maxWind: number | null;
  readonly detailHref: string;
  readonly days: ReadonlyArray<CountryCompareDay>;
}

const COPY = {
  en: {
    tray: (count: number, max: number) => `${count}/${max} destinations selected`,
    compare: (count: number) => `Compare ${count} destinations`,
    comparison: "Compare destinations",
    intro: "See the same travel-weather signals side by side before choosing where to go.",
    close: "Close comparison",
    clear: "Clear",
    remove: (name: string) => `Remove ${name} from comparison`,
    rainFree: "Rain outlook",
    rain: "Expected rain",
    peakRain: "Peak rain chance",
    temperature: "Temperature",
    wind: "Maximum wind",
    daily: "Daily weather",
    details: "Full forecast",
  },
  "zh-cn": {
    tray: (count: number, max: number) => `已选 ${count}/${max} 个目的地`,
    compare: (count: number) => `对比 ${count} 个目的地`,
    comparison: "目的地横向对比",
    intro: "把相同的旅行天气指标放在一起看，再决定更适合去哪里。",
    close: "关闭对比",
    clear: "清空",
    remove: (name: string) => `从对比中移除${name}`,
    rainFree: "降雨情况",
    rain: "预计总降雨",
    peakRain: "最高降雨概率",
    temperature: "气温",
    wind: "最大风速",
    daily: "逐日天气",
    details: "完整天气",
  },
  "zh-hant": {
    tray: (count: number, max: number) => `已選 ${count}/${max} 個目的地`,
    compare: (count: number) => `比較 ${count} 個目的地`,
    comparison: "目的地橫向比較",
    intro: "把相同的旅行天氣指標放在一起看，再決定更適合去哪裡。",
    close: "關閉比較",
    clear: "清空",
    remove: (name: string) => `從比較中移除${name}`,
    rainFree: "降雨情況",
    rain: "預計總降雨",
    peakRain: "最高降雨機率",
    temperature: "氣溫",
    wind: "最大風速",
    daily: "逐日天氣",
    details: "完整天氣",
  },
} as const;

function metric(value: number | null, suffix: string): string {
  return value === null ? "—" : `${value}${suffix}`;
}

function temperature(item: CountryCompareItem): string {
  if (item.temperatureMin === null && item.temperatureMax === null) return "—";
  return `${item.temperatureMin ?? "–"}–${item.temperatureMax ?? "–"}°C`;
}

export function CountryCompareSheet({
  locale,
  items,
  maxItems,
  open,
  onOpen,
  onClose,
  onRemove,
  onClear,
}: {
  readonly locale: CountryCompareLocale;
  readonly items: ReadonlyArray<CountryCompareItem>;
  readonly maxItems: number;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onRemove: (id: string) => void;
  readonly onClear: () => void;
}): ReactElement | null {
  if (items.length === 0) return null;
  const copy = COPY[locale];
  const dates = items[0]?.days.map((day) => day.localDate) ?? [];

  return (
    <>
      <aside
        className="sticky bottom-3 z-[130] mt-5 rounded-2xl border border-border bg-white/95 p-3 shadow-2xl backdrop-blur sm:p-4"
        aria-label={copy.comparison}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted">{copy.tray(items.length, maxItems)}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {items.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-foreground"
                >
                  <span aria-hidden="true">{item.symbol}</span>
                  {item.name}
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label={copy.remove(item.name)}
                    className="ml-1 rounded-full px-1 text-muted hover:text-foreground focus-ring"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClear}
              className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted focus-ring"
            >
              {copy.clear}
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-bold text-white focus-ring"
            >
              {copy.compare(items.length)}
            </button>
          </div>
        </div>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-[180] bg-black/30 p-3 sm:p-6"
          onClick={onClose}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={copy.comparison}
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-x-3 bottom-3 max-h-[82vh] overflow-y-auto rounded-3xl border border-border bg-white p-4 shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-6 lg:left-1/2 lg:right-auto lg:w-[min(900px,calc(100vw-3rem))] lg:-translate-x-1/2"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{copy.comparison}</p>
                <h2 className="section-title mt-2">{items.map((item) => item.name).join(" · ")}</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted">{copy.intro}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={copy.close}
                className="rounded-full border border-border px-3 py-2 text-sm font-semibold focus-ring"
              >
                ×
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-border bg-white px-3 py-3 text-xs text-muted">
                      {" "}
                    </th>
                    {items.map((item) => (
                      <th key={item.id} className="border-b border-border px-3 py-3 align-top">
                        <div className="flex items-center gap-2 text-base font-bold text-foreground">
                          <span aria-hidden="true">{item.symbol}</span>
                          {item.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    [copy.rainFree, (item: CountryCompareItem) => item.rainHeadline],
                    [copy.rain, (item: CountryCompareItem) => metric(item.totalRainMm, " mm")],
                    [copy.peakRain, (item: CountryCompareItem) => metric(item.maxRain, "%")],
                    [copy.temperature, (item: CountryCompareItem) => temperature(item)],
                    [copy.wind, (item: CountryCompareItem) => metric(item.maxWind, " km/h")],
                  ].map(([label, render]) => (
                    <tr key={label as string}>
                      <th className="sticky left-0 z-10 border-b border-border bg-white px-3 py-3 text-xs font-semibold text-muted">
                        {label as string}
                      </th>
                      {items.map((item) => (
                        <td
                          key={item.id}
                          className="border-b border-border px-3 py-3 font-semibold text-foreground"
                        >
                          {(render as (item: CountryCompareItem) => string)(item)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {dates.map((date, dateIndex) => (
                    <tr key={date}>
                      <th className="sticky left-0 z-10 border-b border-border bg-white px-3 py-3 text-xs font-semibold text-muted">
                        {dateIndex === 0 ? copy.daily : date}
                      </th>
                      {items.map((item) => {
                        const day = item.days.find((candidate) => candidate.localDate === date);
                        return (
                          <td key={item.id} className="border-b border-border px-3 py-3">
                            <strong className="block text-foreground">
                              {day?.conditionLabel ?? "—"}
                            </strong>
                            <span className="mt-1 block text-xs text-muted">
                              {day?.rainProbability ?? "—"}% · {day?.temperatureMin ?? "–"}–
                              {day?.temperatureMax ?? "–"}°
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th className="sticky left-0 z-10 bg-white px-3 py-4 text-xs font-semibold text-muted">
                      {" "}
                    </th>
                    {items.map((item) => (
                      <td key={item.id} className="px-3 py-4">
                        <a
                          href={item.detailHref}
                          className="inline-flex rounded-full border border-border px-3 py-2 text-xs font-bold text-foreground focus-ring"
                        >
                          {copy.details} →
                        </a>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
