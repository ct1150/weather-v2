"use client";

import {
  buildAffiliateClick,
  buildAffiliateImpression,
  type ConversionContext,
} from "@wnr/analytics";
import { useEffect, useRef, type ReactElement } from "react";

import {
  resolveContextualAffiliateSurface,
  type CommercialSurfaceLocale,
} from "../commercial/contextual-affiliate";
import { emitProductAnalytics } from "../analytics/browser-events";

const RAW_OFFERS = process.env.NEXT_PUBLIC_AFFILIATE_OFFERS_JSON ?? "";
const ENABLED_SLOTS = process.env.NEXT_PUBLIC_AFFILIATE_SLOTS ?? "";

type CommerceAnalyticsRoute = "/discover" | "/trips/workspace";

function analyticsRoute(surface: string): CommerceAnalyticsRoute {
  return surface === "discovery_decision" ? "/discover" : "/trips/workspace";
}

const COPY: Record<CommercialSurfaceLocale, { readonly title: string }> = {
  en: { title: "Useful next step" },
  "zh-cn": { title: "接下来可能用得上" },
  "zh-hant": { title: "接下來可能用得上" },
};

/**
 * Contextual commerce is intentionally zero-fill: if decision context, deployment offer data,
 * slot enablement or outbound allowlist validation is missing, this component returns null and
 * contributes no empty commercial shell to the page.
 */
export function ContextualAffiliateSurface({
  context,
  locale,
  routeTemplate,
}: {
  readonly context: ConversionContext;
  readonly locale: CommercialSurfaceLocale;
  readonly routeTemplate?: CommerceAnalyticsRoute;
}): ReactElement | null {
  const items = resolveContextualAffiliateSurface({
    context,
    locale,
    rawOffers: RAW_OFFERS,
    enabledSlots: ENABLED_SLOTS,
  });
  const impressed = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const item of items) {
      const key = `${item.id}:${item.href}`;
      if (impressed.current.has(key)) continue;
      impressed.current.add(key);
      emitProductAnalytics({
        locale,
        routeTemplate: routeTemplate ?? analyticsRoute(item.surface),
        fields: buildAffiliateImpression({
          providerId: item.providerId,
          category: item.category,
          placement: item.placement,
          destinationId: item.destinationId,
        }),
      });
    }
  }, [items, locale, routeTemplate]);
  if (items.length === 0) return null;

  return (
    <aside
      className="rounded-2xl border border-border/80 bg-surface-elevated p-4"
      aria-label={COPY[locale].title}
      data-contextual-commerce="phase-9"
    >
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
        {COPY[locale].title}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.href}
            rel={item.rel}
            target="_blank"
            className="rounded-xl border border-border bg-white p-3 focus-ring"
            data-commercial-category={item.category}
            data-commercial-reason={item.reasonCode}
            onClick={() => {
              emitProductAnalytics({
                locale,
                routeTemplate: routeTemplate ?? analyticsRoute(item.surface),
                fields: buildAffiliateClick({
                  providerId: item.providerId,
                  category: item.category,
                  placement: item.placement,
                  destinationId: item.destinationId,
                }),
              });
            }}
          >
            <strong className="text-sm text-foreground">{item.cta}</strong>
            <span className="mt-1 block text-[11px] leading-4 text-muted">{item.disclosure}</span>
          </a>
        ))}
      </div>
    </aside>
  );
}
