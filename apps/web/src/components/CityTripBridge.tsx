"use client";

import { useEffect, useState, type ReactElement } from "react";
import { addDestinationToWorkspace } from "../trips/add-destination";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  normalizeWorkspace,
  type TripWorkspace,
} from "../trips/workspace";

export type CityTripBridgeLocale = "en" | "zh-cn" | "zh-hant";

interface CityTripBridgeProps {
  readonly locale: CityTripBridgeLocale;
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly defaultDate: string;
  readonly workspacePath: string;
}

const COPY = {
  en: {
    eyebrow: "Use this weather in your itinerary",
    generic: "Add this destination to your trip and keep weather decisions attached to the day.",
    range: (start: string, end: string) =>
      `Selected travel dates: ${start}${start === end ? "" : ` – ${end}`}`,
    add: "Add to my trip",
    title: "My weather-aware trip",
  },
  "zh-cn": {
    eyebrow: "把天气结论带进行程",
    generic: "把这个目的地加入行程，让当天的天气风险和 Plan B 一起进入工作台。",
    range: (start: string, end: string) =>
      `已选择旅行日期：${start}${start === end ? "" : ` – ${end}`}`,
    add: "加入我的行程",
    title: "我的天气行程",
  },
  "zh-hant": {
    eyebrow: "把天氣結論帶進行程",
    generic: "把這個目的地加入行程，讓當天的天氣風險和備用方案一起進入工作台。",
    range: (start: string, end: string) =>
      `已選擇旅行日期：${start}${start === end ? "" : ` – ${end}`}`,
    add: "加入我的行程",
    title: "我的天氣行程",
  },
} as const;

function validDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function readStoredWorkspace(): TripWorkspace | null {
  const stored = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (stored === null) return null;
  try {
    return normalizeWorkspace(JSON.parse(stored) as unknown);
  } catch {
    return null;
  }
}

export function CityTripBridge({
  locale,
  cityId,
  cityName,
  countryName,
  defaultDate,
  workspacePath,
}: CityTripBridgeProps): ReactElement {
  const copy = COPY[locale];
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const start = params.get("start");
    const end = params.get("end");
    if (validDate(start)) setRange({ start, end: validDate(end) ? end : start });
  }, []);

  const addToTrip = (): void => {
    const existing = readStoredWorkspace();
    const date = range?.start ?? defaultDate;
    const next = addDestinationToWorkspace(
      existing,
      { cityId, cityName, countryName, date },
      { blankTitle: copy.title },
    );
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
    window.location.assign(workspacePath);
  };

  return (
    <section className="info-panel mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {range === null ? copy.generic : copy.range(range.start, range.end)}
        </p>
      </div>
      <button type="button" className="trip-primary-button shrink-0" onClick={addToTrip}>
        {copy.add}
      </button>
    </section>
  );
}
