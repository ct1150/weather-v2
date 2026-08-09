import {
  isCommercialCategory,
  resolveAffiliateLink,
  resolveContextualCommercialOpportunities,
  type AffiliateProviderConfig,
  type AnalyticsLocale,
  type CommercialCategory,
  type CommercialDataState,
  type ConversionContext,
  type ConversionReasonCode,
  type ConversionSurface,
  type Placement,
} from "@wnr/analytics";
import { parseRuntimeConfig } from "@wnr/config";

export type CommercialSurfaceLocale = "en" | "zh-cn" | "zh-hant";

interface RawCommercialOffer {
  readonly id: string;
  readonly providerId: string;
  readonly category: CommercialCategory;
  readonly slot: string;
  readonly destinationId: string;
  readonly href: string;
  readonly dataState: CommercialDataState;
  readonly normalizedHostAllowlist: ReadonlyArray<string>;
  readonly allowedPathPrefixes: ReadonlyArray<string>;
}

export interface ContextualAffiliateViewModel {
  readonly id: string;
  readonly providerId: string;
  readonly category: CommercialCategory;
  readonly surface: ConversionSurface;
  readonly destinationId: string;
  readonly reasonCode: ConversionReasonCode;
  readonly href: string;
  readonly rel: string;
  readonly disclosure: string;
  readonly cta: string;
}

const ID_RE = /^[a-z0-9][a-z0-9._:-]{1,127}$/u;
const DESTINATION_RE = /^[a-z0-9][a-z0-9_-]{1,95}$/u;
const SLOT_RE = /^[a-z0-9][a-z0-9._:-]{1,95}$/u;
const HOST_RE = /^[a-z0-9.-]+$/u;
const MAX_OFFERS = 50;

const DISCLOSURE: Record<CommercialSurfaceLocale, string> = {
  en: "Affiliate link · we may earn a commission",
  "zh-cn": "推广链接 · 通过此链接预订我们可能获得佣金",
  "zh-hant": "推廣連結 · 透過此連結預訂我們可能獲得佣金",
};

const CTA: Record<CommercialSurfaceLocale, Record<CommercialCategory, string>> = {
  en: {
    hotel: "Check hotels",
    activities: "Check activity tickets",
    flights: "Compare flights",
    sim: "Check SIM / eSIM options",
    insurance: "Review travel insurance",
    car_rental: "Check car rental",
  },
  "zh-cn": {
    hotel: "查看酒店",
    activities: "查看活动门票",
    flights: "比较机票",
    sim: "查看 SIM / eSIM",
    insurance: "查看旅行保险",
    car_rental: "查看租车",
  },
  "zh-hant": {
    hotel: "查看飯店",
    activities: "查看活動門票",
    flights: "比較機票",
    sim: "查看 SIM / eSIM",
    insurance: "查看旅遊保險",
    car_rental: "查看租車",
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedString(value: unknown, re: RegExp, max: number): string | null {
  if (typeof value !== "string" || value.length > max || !re.test(value)) return null;
  return value;
}

function stringArray(value: unknown, maxItems: number, maxLength: number): ReadonlyArray<string> | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const output: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0 || item.length > maxLength) return null;
    output.push(item);
  }
  return output;
}

function dataState(value: unknown): CommercialDataState | null {
  return value === "current" || value === "stale" || value === "empty" || value === "unauthorized"
    ? value
    : null;
}

/**
 * Parse deployment-supplied commercial candidates. Malformed rows are discarded rather than
 * partially rendered. This parser does not make an outbound URL trusted; the Affiliate adapter
 * performs the authoritative HTTPS host/path validation later.
 */
export function parseCommercialOffers(raw: string): ReadonlyArray<RawCommercialOffer> {
  if (raw.trim().length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const offers: RawCommercialOffer[] = [];
  for (const value of parsed.slice(0, MAX_OFFERS)) {
    const row = asRecord(value);
    if (row === null) continue;
    const id = boundedString(row.id, ID_RE, 128);
    const providerId = boundedString(row.providerId, ID_RE, 128);
    const slot = boundedString(row.slot, SLOT_RE, 96);
    const destinationId = boundedString(row.destinationId, DESTINATION_RE, 96);
    const category = typeof row.category === "string" && isCommercialCategory(row.category)
      ? row.category
      : null;
    const state = dataState(row.dataState);
    const hosts = stringArray(row.normalizedHostAllowlist, 8, 120);
    const paths = stringArray(row.allowedPathPrefixes, 16, 160);
    if (
      id === null ||
      providerId === null ||
      slot === null ||
      destinationId === null ||
      category === null ||
      state === null ||
      typeof row.href !== "string" ||
      row.href.length > 2048 ||
      hosts === null ||
      hosts.length === 0 ||
      hosts.some((host) => !HOST_RE.test(host)) ||
      paths === null ||
      paths.some((path) => !path.startsWith("/"))
    ) {
      continue;
    }
    offers.push(
      Object.freeze({
        id,
        providerId,
        category,
        slot,
        destinationId,
        href: row.href,
        dataState: state,
        normalizedHostAllowlist: hosts,
        allowedPathPrefixes: paths,
      }),
    );
  }
  return Object.freeze(offers);
}

function analyticsLocale(locale: CommercialSurfaceLocale): AnalyticsLocale {
  return locale === "zh-hant" ? "zh-tw" : locale;
}

function placement(surface: ConversionSurface): Placement {
  return surface === "trip_preparation" ? "sidebar" : "between_sections";
}

function enabledSlotConfig(raw: string) {
  const slots = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => SLOT_RE.test(item))
    .slice(0, 32);
  return parseRuntimeConfig({
    affiliates: Object.fromEntries(slots.map((slot) => [slot, true])),
  });
}

export function resolveContextualAffiliateSurface(input: {
  readonly context: ConversionContext;
  readonly locale: CommercialSurfaceLocale;
  readonly rawOffers: string;
  readonly enabledSlots: string;
}): ReadonlyArray<ContextualAffiliateViewModel> {
  const opportunities = resolveContextualCommercialOpportunities(input.context);
  if (opportunities.length === 0) return [];
  const offers = parseCommercialOffers(input.rawOffers);
  if (offers.length === 0) return [];
  const config = enabledSlotConfig(input.enabledSlots);
  const output: ContextualAffiliateViewModel[] = [];

  for (const opportunity of opportunities) {
    const offer = offers.find(
      (candidate) =>
        candidate.category === opportunity.category &&
        candidate.slot === opportunity.slot &&
        candidate.destinationId === opportunity.destinationId,
    );
    if (offer === undefined) continue;
    const provider: AffiliateProviderConfig = {
      id: offer.providerId,
      normalizedHostAllowlist: offer.normalizedHostAllowlist,
      allowedPathPrefixes: offer.allowedPathPrefixes,
    };
    const resolved = resolveAffiliateLink({
      providerId: offer.providerId,
      category: offer.category,
      placement: placement(opportunity.surface),
      disclosure: DISCLOSURE[input.locale],
      locale: analyticsLocale(input.locale),
      slot: offer.slot,
      config,
      provider,
      href: offer.href,
      dataState: offer.dataState,
      opensNewContext: true,
    });
    if (!resolved.shouldRender || resolved.href === null || resolved.disclosure === null) continue;
    output.push(
      Object.freeze({
        id: offer.id,
        providerId: offer.providerId,
        category: offer.category,
        surface: opportunity.surface,
        destinationId: opportunity.destinationId,
        reasonCode: opportunity.reasonCode,
        href: resolved.href,
        rel: resolved.rel,
        disclosure: resolved.disclosure,
        cta: CTA[input.locale][offer.category],
      }),
    );
  }

  return Object.freeze(output.slice(0, 2));
}
