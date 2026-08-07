"use client";

import { useState, type ReactElement } from "react";
import { addDestinationRangeToWorkspace } from "../trips/add-destination";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  normalizeWorkspace,
  type TripWorkspace,
} from "../trips/workspace";

export type DiscoveryTripLocale = "en" | "zh-cn" | "zh-hant";

interface DiscoveryTripActionProps {
  readonly locale: DiscoveryTripLocale;
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly dates: ReadonlyArray<string>;
  readonly workspacePath: string;
  readonly variant?: "inspector" | "card";
}

const COPY = {
  en: {
    add: (days: number) => (days > 1 ? `Add ${days} days to trip` : "Add to trip"),
    added: "Added to trip",
    view: "View trip",
    title: "My weather-aware trip",
  },
  "zh-cn": {
    add: (days: number) => (days > 1 ? `加入行程（${days}天）` : "加入行程"),
    added: "已加入行程",
    view: "查看行程",
    title: "我的天气行程",
  },
  "zh-hant": {
    add: (days: number) => (days > 1 ? `加入行程（${days}天）` : "加入行程"),
    added: "已加入行程",
    view: "查看行程",
    title: "我的天氣行程",
  },
} as const;

function readWorkspace(): TripWorkspace | null {
  const stored = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (stored === null) return null;
  try {
    return normalizeWorkspace(JSON.parse(stored) as unknown);
  } catch {
    return null;
  }
}

export function DiscoveryTripAction({
  locale,
  cityId,
  cityName,
  countryName,
  dates,
  workspacePath,
  variant = "card",
}: DiscoveryTripActionProps): ReactElement {
  const copy = COPY[locale];
  const validDates = [...new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/u.test(date)))];
  const [added, setAdded] = useState(false);

  const addToTrip = (): void => {
    if (validDates.length === 0) return;
    const next = addDestinationRangeToWorkspace(
      readWorkspace(),
      { cityId, cityName, countryName },
      validDates,
      { blankTitle: copy.title },
    );
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
    setAdded(true);
  };

  const buttonClass =
    variant === "inspector"
      ? "inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-foreground transition hover:bg-white/90 focus-ring disabled:opacity-50"
      : "inline-flex min-h-11 flex-1 items-center justify-center px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surface-elevated focus-ring disabled:opacity-50";
  const viewClass =
    variant === "inspector"
      ? "inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-4 text-xs font-bold text-white transition hover:bg-white/10 focus-ring"
      : "inline-flex min-h-11 items-center justify-center border-l border-border/80 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-surface-elevated focus-ring";

  return (
    <div
      className={
        variant === "inspector"
          ? "mt-4 flex items-center gap-2 border-t border-white/10 pt-4"
          : "flex border-t border-border/80"
      }
    >
      <button
        type="button"
        className={buttonClass}
        disabled={validDates.length === 0}
        onClick={addToTrip}
        aria-label={`${copy.add(validDates.length)} · ${cityName}`}
      >
        {added ? copy.added : copy.add(validDates.length)}
      </button>
      {added ? (
        <a href={workspacePath} className={viewClass}>
          {copy.view} <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </div>
  );
}
