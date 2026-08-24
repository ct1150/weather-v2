"use client";

import { useEffect, type ReactElement } from "react";
import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";

export function CityAnalyticsView({
  cityId,
  countryCode,
  locale = "en",
}: {
  readonly cityId: string;
  readonly countryCode: string;
  readonly locale?: BrowserAnalyticsLocale;
}): ReactElement | null {
  useEffect(() => {
    emitProductAnalytics({
      locale,
      routeTemplate: "/[country]/[city]",
      fields: {
        event: "city_viewed",
        city_id: cityId,
        country_code: countryCode.toUpperCase(),
      },
    });
  }, [cityId, countryCode, locale]);
  return null;
}
