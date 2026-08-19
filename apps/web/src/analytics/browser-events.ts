import { validateAnalyticsEvent, type AnalyticsEvent, type AnalyticsLocale } from "@wnr/analytics";

export const WNR_ANALYTICS_BROWSER_EVENT = "wnr:analytics";

export type BrowserAnalyticsLocale = "en" | "zh-cn" | "zh-hant";

const PRODUCT_ANALYTICS_URL = (process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_URL ?? "").trim();

export function analyticsLocale(locale: BrowserAnalyticsLocale): AnalyticsLocale {
  return locale === "zh-hant" ? "zh-tw" : locale;
}

function transmitProductEvent(event: AnalyticsEvent, endpoint: string): void {
  if (endpoint.length === 0 || typeof window === "undefined") return;
  const payload = JSON.stringify(event);
  try {
    if (typeof navigator.sendBeacon === "function") {
      const accepted = navigator.sendBeacon(
        endpoint,
        new Blob([payload], { type: "text/plain;charset=UTF-8" }),
      );
      if (accepted) return;
    }
  } catch {
    // Fall through to keepalive fetch.
  }
  try {
    void fetch(endpoint, {
      method: "POST",
      body: payload,
      headers: { "content-type": "text/plain;charset=UTF-8" },
      mode: "cors",
      credentials: "omit",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics is always best-effort.
  }
}

/**
 * Validate a bounded analytics event first, expose it as a browser event for
 * local integrations, and best-effort forward it to the dedicated product
 * analytics Worker. The product path never depends on either sink.
 */
export function emitProductAnalytics(input: {
  readonly locale: BrowserAnalyticsLocale;
  readonly routeTemplate: "/discover" | "/trips/workspace";
  readonly fields: object;
  readonly now?: Date;
  readonly endpoint?: string;
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
    // Local listeners must never block or alter the product path.
  }
  transmitProductEvent(result.value, input.endpoint ?? PRODUCT_ANALYTICS_URL);
  return true;
}
