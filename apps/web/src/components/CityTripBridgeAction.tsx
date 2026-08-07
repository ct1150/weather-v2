"use client";

import { useEffect, useState, type ReactElement } from "react";
import { addDestinationToWorkspace } from "../trips/add-destination";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  normalizeWorkspace,
  type TripWorkspace,
} from "../trips/workspace";

interface CityTripBridgeActionProps {
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly defaultDate: string;
  readonly workspacePath: string;
  readonly buttonLabel: string;
  readonly blankTitle: string;
  readonly rangePrefix: string;
}

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

export function CityTripBridgeAction({
  cityId,
  cityName,
  countryName,
  defaultDate,
  workspacePath,
  buttonLabel,
  blankTitle,
  rangePrefix,
}: CityTripBridgeActionProps): ReactElement {
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
      { blankTitle },
    );
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
    window.location.assign(workspacePath);
  };

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
      {range !== null ? (
        <p className="text-xs font-semibold text-muted">
          {rangePrefix}: {range.start}
          {range.end === range.start ? "" : ` – ${range.end}`}
        </p>
      ) : null}
      <button type="button" className="trip-primary-button" onClick={addToTrip}>
        {buttonLabel}
      </button>
    </div>
  );
}
