"use client";

import type { ConversionContext } from "@wnr/analytics";
import { useEffect, useState, type ReactElement } from "react";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  normalizeWorkspace,
  type TripWorkspace,
} from "../trips/workspace";
import { ContextualAffiliateSurface } from "./ContextualAffiliateSurface";

export type TripDecisionCommercialLocale = "en" | "zh-cn" | "zh-hant";

export function tripDecisionConversionContext(
  workspace: TripWorkspace | null,
): ConversionContext | null {
  if (workspace === null) return null;
  const destination = workspace.days.find((day) => day.cityId.trim().length > 0);
  if (destination === undefined) return null;
  return {
    stage: "discovery_decided",
    destinationId: destination.cityId,
    hasDestinationDecision: true,
    hasTrip: true,
    hasStructuredActivities: workspace.days.some((day) => day.activities.length > 0),
    carDependent: false,
    indoorFallbackAvailable: false,
  };
}

function readWorkspace(): TripWorkspace | null {
  const raw = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (raw === null) return null;
  try {
    return normalizeWorkspace(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function TripDecisionCommercialSurface({
  locale,
}: {
  readonly locale: TripDecisionCommercialLocale;
}): ReactElement | null {
  const [context, setContext] = useState<ConversionContext | null>(null);

  useEffect(() => {
    const refresh = (): void => setContext(tripDecisionConversionContext(readWorkspace()));
    refresh();
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (context === null) return null;
  return (
    <div className="mt-5" data-trip-decision-commerce>
      <ContextualAffiliateSurface
        context={context}
        locale={locale}
        routeTemplate="/trips/workspace"
      />
    </div>
  );
}
