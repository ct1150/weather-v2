import { validateAnalyticsEvent, type AnalyticsLocale } from "@wnr/analytics";

export const WNR_ANALYTICS_BROWSER_EVENT = "wnr:analytics";

export type BrowserAnalyticsLocale = "en" | "zh-cn" | "zh-hant";

export function analyticsLocale(locale: BrowserAnalyticsLocale): AnalyticsLocale {
  return locale === "zh-hant" ? "zh-tw" : locale;
}

/**
 * Validate a bounded analytics event first, then expose it as a best-effort browser event.
 * The core product never depends on a listener and no analytics backend is invented here.
 */
export function emitProductAnalytics(input: {
  readonly locale: BrowserAnalyticsLocale;
  readonly routeTemplate: "/discover" | "/trips/workspace";
  readonly fields: object;
  readonly now?: Date;
}): boolean {
  const raw = {
    ...input.fields,
    event_version: 1,
    occurred_at: (input.now ?? new Date()).toISOString(),
    route_template: input.routeTemplate,
    locale: analyticsLocale(input.locale),
  };
  const result = validateAnalyticsEvent(raw);
  if (!result.ok) return false;
  if (typeof window === "undefined") return true;
  try {
    window.dispatchEvent(
      new CustomEvent(WNR_ANALYTICS_BROWSER_EVENT, {
        detail: result.value,
      }),
    );
  } catch {
    // Analytics must never block or alter the product path.
  }
  return true;
}
