"use client";

import type { ReactElement } from "react";
import { addDestinationRangeToWorkspace } from "../trips/add-destination";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  normalizeWorkspace,
  type TripWorkspace,
} from "../trips/workspace";

export type CountryCompareTripLocale = "en" | "zh-cn" | "zh-hant";

const COPY = {
  en: { button: "Choose & plan", title: "My weather-aware trip" },
  "zh-cn": { button: "选这里并规划", title: "我的天气行程" },
  "zh-hant": { button: "選這裡並規劃", title: "我的天氣行程" },
} as const;

function readStoredWorkspace(): TripWorkspace | null {
  const stored = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (stored === null) return null;
  try {
    return normalizeWorkspace(JSON.parse(stored) as unknown);
  } catch {
    return null;
  }
}

function workspacePath(locale: CountryCompareTripLocale): string {
  if (locale === "zh-cn") return "/zh-cn/trips/workspace";
  if (locale === "zh-hant") return "/zh-hant/trips/workspace";
  return "/trips/workspace";
}

export function CountryCompareTripAction({
  locale,
  cityId,
  cityName,
  countryName,
  dates,
}: {
  readonly locale: CountryCompareTripLocale;
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly dates: ReadonlyArray<string>;
}): ReactElement {
  const copy = COPY[locale];

  function chooseAndPlan(): void {
    const next = addDestinationRangeToWorkspace(
      readStoredWorkspace(),
      { cityId, cityName, countryName },
      dates,
      { blankTitle: copy.title },
    );
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
    window.location.assign(workspacePath(locale));
  }

  return (
    <button
      type="button"
      onClick={chooseAndPlan}
      className="trip-primary-button mt-2 !px-3 !py-2 text-xs"
    >
      {copy.button}
    </button>
  );
}
