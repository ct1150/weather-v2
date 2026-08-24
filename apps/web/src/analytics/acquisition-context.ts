export type AcquisitionChannel =
  "direct" | "organic_search" | "referral" | "social" | "paid" | "email" | "other";

export interface AcquisitionContext {
  readonly acquisition_channel: AcquisitionChannel;
  readonly referrer_host: string;
  readonly landing_route_template: string;
  readonly utm_source: string;
  readonly utm_medium: string;
  readonly utm_campaign: string;
}

const STORAGE_KEY = "wnr:acquisition:v1";
const TOKEN_RE = /[^a-z0-9._-]+/gu;
const SEARCH_HOSTS = ["google.", "bing.com", "yahoo.", "duckduckgo.com", "baidu.com", "yandex."];
const SOCIAL_HOSTS = [
  "reddit.com",
  "facebook.com",
  "instagram.com",
  "t.co",
  "x.com",
  "twitter.com",
  "youtube.com",
  "tiktok.com",
  "linkedin.com",
];

export function normalizeAcquisitionToken(value: string | null, maxLength = 64): string {
  if (value === null) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(TOKEN_RE, "")
    .replace(/-+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, maxLength);
}

export function classifyAcquisition(input: {
  readonly referrerHost: string;
  readonly siteHost: string;
  readonly utmSource: string;
  readonly utmMedium: string;
}): AcquisitionChannel {
  const medium = input.utmMedium;
  if (/^(cpc|ppc|paid|paidsearch|display|affiliate)$/u.test(medium)) return "paid";
  if (/^(email|newsletter)$/u.test(medium)) return "email";
  if (/^(social|social-network|social-media)$/u.test(medium)) return "social";
  if (input.utmSource.length > 0 && medium.length > 0) return "other";

  const host = input.referrerHost;
  if (host.length === 0 || host === input.siteHost || host.endsWith(`.${input.siteHost}`))
    return "direct";
  if (SEARCH_HOSTS.some((candidate) => host.includes(candidate))) return "organic_search";
  if (SOCIAL_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`)))
    return "social";
  return "referral";
}

function safeReferrerHost(referrer: string): string {
  if (referrer.length === 0) return "";
  try {
    return normalizeAcquisitionToken(new URL(referrer).hostname, 96);
  } catch {
    return "";
  }
}

function readStored(): AcquisitionContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const value = JSON.parse(raw) as Partial<AcquisitionContext>;
    if (
      typeof value.acquisition_channel !== "string" ||
      typeof value.referrer_host !== "string" ||
      typeof value.landing_route_template !== "string" ||
      typeof value.utm_source !== "string" ||
      typeof value.utm_medium !== "string" ||
      typeof value.utm_campaign !== "string"
    ) {
      return null;
    }
    return value as AcquisitionContext;
  } catch {
    return null;
  }
}

export function browserAcquisitionContext(landingRouteTemplate: string): AcquisitionContext | null {
  if (typeof window === "undefined") return null;
  const existing = readStored();
  if (existing !== null) return existing;

  const params = new URLSearchParams(window.location.search);
  const utmSource = normalizeAcquisitionToken(params.get("utm_source"));
  const utmMedium = normalizeAcquisitionToken(params.get("utm_medium"));
  const utmCampaign = normalizeAcquisitionToken(params.get("utm_campaign"));
  const referrerHost = safeReferrerHost(document.referrer);
  const siteHost = normalizeAcquisitionToken(window.location.hostname, 96);
  const value: AcquisitionContext = {
    acquisition_channel: classifyAcquisition({
      referrerHost,
      siteHost,
      utmSource,
      utmMedium,
    }),
    referrer_host: referrerHost,
    landing_route_template: landingRouteTemplate,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Acquisition context is best-effort and never blocks product use.
  }
  return value;
}