"use client";

import type { ConversionContext } from "@wnr/analytics";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  WNR_ANALYTICS_BROWSER_EVENT,
  type BrowserAnalyticsRouteTemplate,
} from "../analytics/browser-events";
import type { CommercialSurfaceLocale } from "../commercial/contextual-affiliate";
import { ContextualAffiliateSurface } from "./ContextualAffiliateSurface";

type DecisionRoute = Extract<
  BrowserAnalyticsRouteTemplate,
  "/[country]" | "/[country]/[city]"
>;

function validDestinationId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{1,95}$/u.test(value);
}

function readDestinationFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const city = new URLSearchParams(window.location.search).get("city");
  return validDestinationId(city) ? city : null;
}

export function DestinationDecisionCommercialSurface({
  locale,
  routeTemplate,
  initialDestinationId = null,
}: {
  readonly locale: CommercialSurfaceLocale;
  readonly routeTemplate: DecisionRoute;
  readonly initialDestinationId?: string | null;
}): ReactElement | null {
  const [destinationId, setDestinationId] = useState<string | null>(() =>
    validDestinationId(initialDestinationId) ? initialDestinationId : null,
  );

  useEffect(() => {
    if (destinationId === null) setDestinationId(readDestinationFromUrl());

    const onAnalytics = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as { event?: unknown; city_id?: unknown } | null;
      if (detail?.event !== "city_viewed" || !validDestinationId(detail.city_id)) return;
      setDestinationId(detail.city_id);
    };

    window.addEventListener(WNR_ANALYTICS_BROWSER_EVENT, onAnalytics);
    return () => window.removeEventListener(WNR_ANALYTICS_BROWSER_EVENT, onAnalytics);
  }, [destinationId]);

  const context = useMemo<ConversionContext | null>(() => {
    if (destinationId === null) return null;
    return {
      stage: "discovery_decided",
      destinationId,
      hasDestinationDecision: true,
      hasTrip: false,
      hasStructuredActivities: false,
      carDependent: false,
      indoorFallbackAvailable: false,
    };
  }, [destinationId]);

  if (context === null) return null;

  return (
    <div className="mt-5" data-destination-decision-commerce>
      <ContextualAffiliateSurface
        context={context}
        locale={locale}
        routeTemplate={routeTemplate}
      />
    </div>
  );
}
