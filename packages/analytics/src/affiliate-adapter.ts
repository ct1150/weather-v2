// @wnr/analytics — provider-neutral Affiliate + zero-shift ad adapters.
//
// Authority: PRD-FR-011, GROW-AFF-001, GROW-ADS-001, ARCH-FLAG-001,
// VISION-BUSINESS-001.
//
// Design guarantees:
//  - **Provider-neutral**: user-facing callers pass a provider-neutral
//    config (allowlisted HTTPS host + approved path policy). Provider DTO
//    fields never surface in the resolved ViewModel (GROW-AFF-001).
//  - **Disclosed**: every impression/outbound action carries a proximate,
//    already-localized disclosure (PRD-FR-011 / GROW-AFF-001).
//  - **Allowlisted target only**: the candidate href is parsed and must match
//    the provider's normalized HTTPS host and approved path policy after
//    parsing. Caller-supplied arbitrary redirect targets are rejected
//    (ENG-SECURITY-001 / ARCH-FLAG-001).
//  - **Kill-switch driven**: a disabled Affiliate slot or advertising flag
//    emits no misleading block, label, control, or layout shift
//    (ARCH-FLAG-001 / GROW-ADS-001 zero-shift).
//  - **Best-effort**: the click event is a serializable allowlisted
//    descriptor; emission never blocks or delays navigation (GROW-AFF-001).
// No real network call is made here.

import { isAffiliateEnabled, type RuntimeConfig } from "@wnr/config";

/** Commercial categories (GROW-AFF-001 / GROW-ADS-001). */
export type CommercialCategory =
  "hotel" | "activities" | "flights" | "sim" | "insurance" | "car_rental";

/** The five canonical ad placements (GROW-ADS-001). */
export type Placement = "homepage" | "city_page" | "article" | "sidebar" | "between_sections";

/** Supported core locales (for disclosure language + analytics route templates). */
export type AnalyticsLocale = "en" | "ja" | "ko" | "zh-cn" | "zh-tw";

export const COMMERCIAL_CATEGORIES: ReadonlyArray<CommercialCategory> = Object.freeze([
  "hotel",
  "activities",
  "flights",
  "sim",
  "insurance",
  "car_rental",
]);

export const PLACEMENTS: ReadonlyArray<Placement> = Object.freeze([
  "homepage",
  "city_page",
  "article",
  "sidebar",
  "between_sections",
]);

/** True when `value` is a known commercial category. */
export function isCommercialCategory(value: string): value is CommercialCategory {
  return (COMMERCIAL_CATEGORIES as ReadonlyArray<string>).includes(value);
}

/** True when `value` is a known placement; rejects unknown placements. */
export function isPlacement(value: string): value is Placement {
  return (PLACEMENTS as ReadonlyArray<string>).includes(value);
}

/**
 * Provider-neutral configuration. The adapter trusts ONLY this allowlist;
 * the runtime `href` is validated against it (GROW-AFF-001).
 */
export interface AffiliateProviderConfig {
  readonly id: string;
  /** Normalized HTTPS hosts, e.g. `["booking.com"]` (www. is stripped). */
  readonly normalizedHostAllowlist: ReadonlyArray<string>;
  /** Approved path prefixes; empty means "any path on the host". */
  readonly allowedPathPrefixes: ReadonlyArray<string>;
}

/** Freshness/authorization state of the commercial data. */
export type CommercialDataState = "current" | "stale" | "empty" | "unauthorized";

export interface AffiliateLinkInput {
  readonly providerId: string;
  readonly category: CommercialCategory;
  readonly placement: Placement;
  /** Already-localized disclosure text supplied by the caller. */
  readonly disclosure: string;
  readonly locale: AnalyticsLocale;
  /** Affiliate slot key used for the kill-switch lookup (ARCH-FLAG-001). */
  readonly slot: string;
  readonly config: RuntimeConfig;
  readonly provider: AffiliateProviderConfig;
  /** Candidate outbound target; validated against the allowlist. */
  readonly href: string;
  readonly dataState: CommercialDataState;
  /** Whether the link opens a new browsing context. */
  readonly opensNewContext: boolean;
}

export interface ResolvedAffiliateLink {
  readonly shouldRender: boolean;
  readonly href: string | null;
  /** e.g. "sponsored nofollow noopener noreferrer". */
  readonly rel: string;
  readonly disclosure: string | null;
  /** Machine-testable reason for render/suppress. */
  readonly reason: string;
  readonly blockedByFlag: boolean;
}

type HrefParse =
  { readonly ok: true; readonly href: string } | { readonly ok: false; readonly reason: string };

/**
 * Validate a candidate outbound href against the provider allowlist
 * (GROW-AFF-001 / ENG-SECURITY-001). Requires an HTTPS scheme,
 * a normalized host present in the allowlist (after stripping `www.`),
 * and a path that matches an approved prefix (or host root). Caller
 * -supplied arbitrary redirect targets are rejected.
 */
export function parseAffiliateHref(href: string, provider: AffiliateProviderConfig): HrefParse {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "scheme_not_https" };
  }
  const host = url.host.toLowerCase().replace(/^www\./u, "");
  if (!(provider.normalizedHostAllowlist as ReadonlyArray<string>).includes(host)) {
    return { ok: false, reason: "host_not_allowlisted" };
  }
  const path = url.pathname;
  const prefixes = provider.allowedPathPrefixes;
  const pathOk =
    prefixes.length === 0 || path === "/" || prefixes.some((p) => path === p || path.startsWith(p));
  if (!pathOk) {
    return { ok: false, reason: "path_not_approved" };
  }
  return { ok: true, href: url.href };
}

function buildRel(opensNewContext: boolean): string {
  const parts = ["sponsored", "nofollow"];
  if (opensNewContext) parts.push("noopener", "noreferrer");
  return parts.join(" ");
}

/**
 * Resolve a provider-neutral Affiliate surface. Returns a ViewModel-ready
 * descriptor: `shouldRender: false` (with `href: null` and no
 * disclosure) when the kill-switch is off, the data is stale/empty/
 * unauthorized, or the target fails the allowlist — so no misleading
 * recommendation, dead control, or blank surface is emitted (GROW-AFF-001 /
 * GROW-ADS-001 zero-shift). A valid surface carries `rel` with
 * `sponsored` + `nofollow` (+ `noopener noreferrer` for a new
 * context) and the localized disclosure (PRD-FR-011).
 */
export function resolveAffiliateLink(input: AffiliateLinkInput): ResolvedAffiliateLink {
  if (!isAffiliateEnabled(input.config, input.slot)) {
    return {
      shouldRender: false,
      href: null,
      rel: "",
      disclosure: null,
      reason: "affiliate_slot_disabled",
      blockedByFlag: true,
    };
  }

  if (input.dataState !== "current") {
    const reason =
      input.dataState === "stale"
        ? "stale_data"
        : input.dataState === "empty"
          ? "empty_data"
          : "unauthorized_data";
    return {
      shouldRender: false,
      href: null,
      rel: "",
      disclosure: null,
      reason,
      blockedByFlag: false,
    };
  }

  const parsed = parseAffiliateHref(input.href, input.provider);
  if (!parsed.ok) {
    return {
      shouldRender: false,
      href: null,
      rel: "",
      disclosure: null,
      reason: parsed.reason,
      blockedByFlag: false,
    };
  }

  return {
    shouldRender: true,
    href: parsed.href,
    rel: buildRel(input.opensNewContext),
    disclosure: input.disclosure,
    reason: "ok",
    blockedByFlag: false,
  };
}

// ---------------------------------------------------------------------------
// Zero-shift advertising (GROW-ADS-001)
// ---------------------------------------------------------------------------

export interface AdPlacementInput {
  readonly placement: Placement;
  readonly config: RuntimeConfig;
  /** Whether a creative is available (no-fill otherwise). */
  readonly hasFill: boolean;
  readonly locale: AnalyticsLocale;
}

export interface ResolvedAd {
  readonly shouldRender: boolean;
  readonly placement: Placement;
  readonly reason: string;
  /** Always 0: disabled/blocked/no-fill contributes no CLS. */
  readonly contributesCls: 0;
}

/**
 * Resolve an advertising placement. A disabled global flag or a no-fill
 * decision yields `shouldRender: false` and `contributesCls: 0` — no
 * blank reserved block, unusable control, or layout shift (GROW-ADS-001).
 */
export function resolveAdPlacement(input: AdPlacementInput): ResolvedAd {
  if (!input.config.advertising.enabled) {
    return {
      shouldRender: false,
      placement: input.placement,
      reason: "ads_disabled",
      contributesCls: 0,
    };
  }
  if (!input.hasFill) {
    return {
      shouldRender: false,
      placement: input.placement,
      reason: "no_fill",
      contributesCls: 0,
    };
  }
  return {
    shouldRender: true,
    placement: input.placement,
    reason: "ok",
    contributesCls: 0,
  };
}

// ---------------------------------------------------------------------------
// Allowlisted analytics events (GROW-AFF-001) — serializable descriptors
// ---------------------------------------------------------------------------

export interface AffiliateImpressionEvent {
  readonly event: "affiliate_impression";
  readonly event_version: 1;
  readonly provider_id: string;
  readonly category: CommercialCategory;
  readonly placement: Placement;
  readonly destination_id: string | null;
}

export interface AffiliateClickEvent {
  readonly event: "affiliate_click";
  readonly event_version: 1;
  readonly provider_id: string;
  readonly category: CommercialCategory;
  readonly placement: Placement;
  readonly destination_id: string | null;
}

/** Build an allowlisted Affiliate impression event (never blocks navigation). */
export function buildAffiliateImpression(input: {
  readonly providerId: string;
  readonly category: CommercialCategory;
  readonly placement: Placement;
  readonly destinationId: string | null;
}): AffiliateImpressionEvent {
  return {
    event: "affiliate_impression",
    event_version: 1,
    provider_id: input.providerId,
    category: input.category,
    placement: input.placement,
    destination_id: input.destinationId,
  };
}

/**
 * Build an allowlisted Affiliate click event. The actual sink emission is
 * best-effort and owned by the analytics sink (T19); this descriptor
 * is what is forwarded and never changes the outbound destination
 * (GROW-AFF-001).
 */
export function buildAffiliateClick(input: {
  readonly providerId: string;
  readonly category: CommercialCategory;
  readonly placement: Placement;
  readonly destinationId: string | null;
}): AffiliateClickEvent {
  return {
    event: "affiliate_click",
    event_version: 1,
    provider_id: input.providerId,
    category: input.category,
    placement: input.placement,
    destination_id: input.destinationId,
  };
}
