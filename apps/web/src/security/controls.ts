// apps/web/src/security/controls.ts
//
// Layered application + edge security controls (ENG-SECURITY-001) and the
// four-level bot-protection / rate-enforcement surface (ENG-BOT-001).
//
// Bounded input validation lives in ../api/v1/schemas.ts
// (API-VALIDATION-001); this module owns:
//   - least-privilege security headers (CSP, HSTS, Referrer-Policy,
//     Permissions-Policy, X-Content-Type-Options),
//   - an SSRF guard that restricts outbound server requests to approved
//     schemes/hosts/ports/paths and never accepts a caller-supplied
//     target,
//   - an open-redirect guard,
//   - four-level per-IP rate enforcement with 429 + Retry-After, cooldown,
//     and Managed-Challenge candidacy,
//   - crawler trust evaluation (Cloudflare Verified Bots or rDNS+fDNS;
//     User-Agent alone is never sufficient).
//
// The module is framework-free and deterministic: the clock is injectable so
// the rate decisions are fully testable without wall-clock flakiness.

// ---------------------------------------------------------------------------
// Four-level bot protection + rate enforcement (ENG-BOT-001)
// ---------------------------------------------------------------------------

export type BotLevel = "L1" | "L2" | "L3" | "L4";

export type OverLimitAction =
  | "429_retry_after"
  | "429_cooldown"
  | "challenge_candidate"
  | "reject_audit";

export interface LevelPolicy {
  readonly level: BotLevel;
  readonly scope: string;
  /** Per-IP limit for the rolling 60s window. */
  readonly perMinute: number;
  /** Separate short burst cap (0 disables the burst window). */
  readonly burstLimit: number;
  /** Burst window length in milliseconds. */
  readonly burstWindowMs: number;
  readonly overLimitAction: OverLimitAction;
}

/** The four-level policy table (ENG-BOT-001). Safe, explicit limits. */
export const BOT_LEVELS: Readonly<Record<BotLevel, LevelPolicy>> = Object.freeze({
  L1: {
    level: "L1",
    scope: "Cacheable public HTML",
    perMinute: 120,
    burstLimit: 30,
    burstWindowMs: 10_000,
    overLimitAction: "429_retry_after",
  },
  L2: {
    level: "L2",
    scope: "Public read API and map data",
    perMinute: 60,
    burstLimit: 0,
    burstWindowMs: 0,
    overLimitAction: "429_cooldown",
  },
  L3: {
    level: "L3",
    scope: "Search, Compare, and other high-cardinality endpoints",
    perMinute: 30,
    burstLimit: 0,
    burstWindowMs: 0,
    overLimitAction: "challenge_candidate",
  },
  L4: {
    level: "L4",
    scope: "Internal sync, maintenance, and Admin",
    perMinute: 10,
    burstLimit: 0,
    burstWindowMs: 0,
    overLimitAction: "reject_audit",
  },
});

const MINUTE_MS = 60_000;

export interface RateDecision {
  readonly allowed: boolean;
  readonly level: BotLevel;
  /** Remaining requests in the current minute window. */
  readonly remaining: number;
  /** HTTP Retry-After value in seconds, or null when allowed. */
  readonly retryAfterSec: number | null;
  /** Cooldown / window-reset boundary in epoch ms, or null when allowed. */
  readonly cooldownUntilMs: number | null;
  /**
   * True when the source reached 3x the per-minute threshold within the
   * challenge window (ENG-BOT-001): Managed Challenge candidacy, or an
   * extended application cooldown when the plan lacks Managed Challenge.
   */
  readonly challengeCandidate: boolean;
}

interface WindowCounter {
  startMs: number;
  count: number;
}

interface SourceState {
  minute: WindowCounter;
  burst: WindowCounter;
  /** Rolling attempt timestamps (epoch ms) for the challenge window. */
  attempts: number[];
}

export interface RateLimiterOptions {
  /** Injectable clock (epoch ms). Defaults to Date.now. */
  readonly clock?: () => number;
  /** Challenge trigger multiplier (default 3 => 3x per-minute in window). */
  readonly challengeMultiplier?: number;
  /** Challenge rolling window (default 5 minutes). */
  readonly challengeWindowMs?: number;
}

/**
 * In-memory, per-IP, four-level rate limiter. Deterministic and testable
 * via the injectable clock. A source is keyed by `${level}:${key}` so the
 * four levels are tracked independently.
 */
export class RateLimiter {
  private readonly clock: () => number;
  private readonly challengeMultiplier: number;
  private readonly challengeWindowMs: number;
  private readonly store = new Map<string, SourceState>();

  constructor(opts: RateLimiterOptions = {}) {
    this.clock = opts.clock ?? Date.now;
    this.challengeMultiplier = opts.challengeMultiplier ?? 3;
    this.challengeWindowMs = opts.challengeWindowMs ?? 5 * 60_000;
  }

  /** Clear a source's counters (used by tests and cooldown admin). */
  reset(key: string): void {
    for (const level of Object.keys(BOT_LEVELS) as ReadonlyArray<BotLevel>) {
      this.store.delete(`${level}:${key}`);
    }
  }

  /**
   * Attempt to acquire one request slot for `level`/`key` at time `now`.
   * Returns a decision: allowed + remaining, or rejected with the correct
   * 429 / cooldown / challenge signal per ENG-BOT-001.
   */
  tryAcquire(level: BotLevel, key: string, now: number = this.clock()): RateDecision {
    const policy = BOT_LEVELS[level];
    const state = this.getState(level, key, now, policy);

    const minuteOk = state.minute.count < policy.perMinute;
    const burstOk = policy.burstLimit === 0 || state.burst.count < policy.burstLimit;

    // Every attempt counts toward the 3x challenge heuristic.
    state.attempts.push(now);
    state.attempts = state.attempts.filter((t) => now - t < this.challengeWindowMs);
    const challengeCandidate =
      state.attempts.length >= this.challengeMultiplier * policy.perMinute;

    if (minuteOk && burstOk) {
      state.minute.count += 1;
      if (policy.burstLimit !== 0) state.burst.count += 1;
      return {
        allowed: true,
        level,
        remaining: policy.perMinute - state.minute.count,
        retryAfterSec: null,
        cooldownUntilMs: null,
        challengeCandidate,
      };
    }

    const retryAfterSec = Math.max(
      1,
      Math.ceil((state.minute.startMs + MINUTE_MS - now) / 1000),
    );
    return {
      allowed: false,
      level,
      remaining: 0,
      retryAfterSec,
      cooldownUntilMs: state.minute.startMs + MINUTE_MS,
      challengeCandidate,
    };
  }

  private getState(
    level: BotLevel,
    key: string,
    now: number,
    policy: LevelPolicy,
  ): SourceState {
    const id = `${level}:${key}`;
    let state = this.store.get(id);
    if (!state) {
      state = {
        minute: { startMs: now, count: 0 },
        burst: { startMs: now, count: 0 },
        attempts: [],
      };
      this.store.set(id, state);
      return state;
    }
    if (now - state.minute.startMs >= MINUTE_MS) {
      state.minute = { startMs: now, count: 0 };
    }
    if (policy.burstLimit !== 0 && now - state.burst.startMs >= policy.burstWindowMs) {
      state.burst = { startMs: now, count: 0 };
    }
    return state;
  }
}

// ---------------------------------------------------------------------------
// Crawler trust (ENG-BOT-001)
// ---------------------------------------------------------------------------

export interface CrawlerEvidence {
  /** Raw User-Agent string (never trusted on its own). */
  readonly userAgent: string;
  /** Cloudflare Verified Bot signal (cf-verified-bot / JA3). */
  readonly cloudflareVerifiedBot: boolean;
  /** Reverse-DNS resolved, then forward-DNS confirmed. */
  readonly reverseDnsVerified: boolean;
}

export interface CrawlerVerdict {
  readonly trusted: boolean;
  readonly exemptFromChallenge: boolean;
  /** Verified crawlers stay under an abnormal-traffic safety ceiling. */
  readonly subjectToSafetyCeiling: boolean;
}

/**
 * Evaluate crawler trust. A crawler is trusted ONLY through a Cloudflare
 * Verified Bot signal or reverse-DNS followed by forward-DNS verification;
 * the User-Agent alone is never sufficient. A trusted mainstream crawler is
 * exempt from an interactive challenge but remains subject to the
 * abnormal-traffic safety ceiling.
 */
export function evaluateCrawler(ev: CrawlerEvidence): CrawlerVerdict {
  const trusted = ev.cloudflareVerifiedBot || ev.reverseDnsVerified;
  return {
    trusted,
    exemptFromChallenge: trusted,
    subjectToSafetyCeiling: true,
  };
}

// ---------------------------------------------------------------------------
// SSRF guard (ENG-SECURITY-001)
// ---------------------------------------------------------------------------

export interface OutboundAllowEntry {
  readonly scheme: "https" | "http";
  /** Exact, lower-cased host (www. is NOT auto-stripped here). */
  readonly host: string;
  readonly ports: ReadonlyArray<number>;
  /** Approved path prefix; "" means host root ("/") only. */
  readonly pathPrefix: string;
}

export interface OutboundTarget {
  readonly scheme: string;
  readonly host: string;
  readonly port: number | null;
  readonly path: string;
}

export type SsrfCheck =
  | { readonly ok: true; readonly target: OutboundTarget }
  | { readonly ok: false; readonly reason: string };

export interface SsrfOptions {
  /** Caller-supplied targets are always rejected (never trust user input). */
  readonly callerSupplied: boolean;
}

/**
 * Restrict an outbound server request to an approved scheme, exact host,
 * allowed port, and approved path prefix (ENG-SECURITY-001 SSRF). A
 * caller-supplied target is rejected before any sensitive request occurs.
 * Redirects to a different approved host are not auto-followed by this
 * guard (the caller must re-validate each hop).
 */
export function checkOutboundSsrf(
  raw: string,
  allowlist: ReadonlyArray<OutboundAllowEntry>,
  opts: SsrfOptions,
): SsrfCheck {
  if (opts.callerSupplied) {
    return { ok: false, reason: "caller_supplied_target_rejected" };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  const scheme = url.protocol.replace(/:$/u, "").toLowerCase();
  const host = url.hostname.toLowerCase();
  const port = url.port === "" ? null : Number(url.port);

  const entry = (allowlist as ReadonlyArray<OutboundAllowEntry>).find(
    (e) => e.host === host && e.scheme === scheme,
  );
  if (!entry) return { ok: false, reason: "host_not_allowlisted" };

  if (port !== null && !(entry.ports as ReadonlyArray<number>).includes(port)) {
    return { ok: false, reason: "port_not_allowed" };
  }

  const path = url.pathname;
  const pathOk =
    entry.pathPrefix === ""
      ? path === "/"
      : path === entry.pathPrefix || path.startsWith(entry.pathPrefix);
  if (!pathOk) return { ok: false, reason: "path_not_approved" };

  return { ok: true, target: { scheme, host, port, path } };
}

// ---------------------------------------------------------------------------
// Open-redirect guard (ENG-SECURITY-001)
// ---------------------------------------------------------------------------

export type RedirectCheck =
  | { readonly ok: true; readonly target: string }
  | { readonly ok: false; readonly reason: string };

export interface RedirectSafetyOptions {
  /** The application's own canonical host (always allowed). */
  readonly sameOriginHost: string;
  /** Additional approved absolute hosts (e.g. provider-owned). */
  readonly allowedHosts: ReadonlyArray<string>;
}

/**
 * Validate a redirect target against open-redirect abuse. Relative
 * (path- or host-relative) targets are treated as same-origin and allowed.
 * Absolute targets must use http(s) and resolve to the same origin or an
 * allowlisted host; scheme-relative (`//evil.com`), `javascript:`, and other
 * non-http(s) schemes are rejected.
 */
export function checkRedirectSafety(
  location: string,
  opts: RedirectSafetyOptions,
): RedirectCheck {
  if (location.length === 0) return { ok: false, reason: "empty_redirect" };

  // Any explicit scheme (e.g. "https:", "javascript:", "data:") or a
  // scheme-relative "//host" is an absolute target and must be validated.
  const schemeMatch = /^[a-z][a-z0-9+.-]*:/iu.exec(location);
  const isSchemeRelative = location.startsWith("//");
  if (schemeMatch !== null || isSchemeRelative) {
    let url: URL;
    try {
      url = new URL(location, "https://internal.invalid");
    } catch {
      return { ok: false, reason: "invalid_redirect" };
    }
    const proto = url.protocol.toLowerCase();
    if (proto !== "http:" && proto !== "https:") {
      return { ok: false, reason: "unsafe_scheme" };
    }
    const host = url.hostname.toLowerCase();
    const allowed = [opts.sameOriginHost, ...opts.allowedHosts].map((h) => h.toLowerCase());
    if (!(allowed as ReadonlyArray<string>).includes(host)) {
      return { ok: false, reason: "open_redirect_blocked" };
    }
    return { ok: true, target: url.href };
  }

  // No scheme and not scheme-relative => same-origin relative path. Safe.
  return { ok: true, target: location };
}

// ---------------------------------------------------------------------------
// Least-privilege security headers (ENG-SECURITY-001)
// ---------------------------------------------------------------------------

export interface HstsOptions {
  readonly maxAgeSec?: number;
  readonly includeSubDomains?: boolean;
  readonly preload?: boolean;
}

export interface SecurityHeaderOptions {
  readonly hsts?: HstsOptions;
  /** Emit CSP as `Content-Security-Policy-Report-Only` instead of enforcing. */
  readonly cspReportOnly?: boolean;
}

// Least-privilege CSP: no inline scripts/styles, no framing, no plugins,
// no third-party origins. External images are proxied (data: allowed only
// for inline SVGs); everything else is strictly 'self'.
const DEFAULT_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
].join("; ");

/**
 * Build the deployment security header set (ENG-SECURITY-001): a
 * least-privilege Content-Security-Policy, HSTS (with subDomains/preload),
 * Referrer-Policy, Permissions-Policy, and X-Content-Type-Options. Returns a
 * plain header-name -> value map ready for the edge/runtime to apply.
 */
export function buildSecurityHeaders(opts: SecurityHeaderOptions = {}): Record<string, string> {
  const hsts = opts.hsts ?? {};
  const maxAge = hsts.maxAgeSec ?? 63_072_000;
  const hstsParts = [`max-age=${maxAge}`];
  if (hsts.includeSubDomains ?? true) hstsParts.push("includeSubDomains");
  if (hsts.preload ?? false) hstsParts.push("preload");

  const cspHeader = opts.cspReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  return {
    [cspHeader]: DEFAULT_CSP,
    "Strict-Transport-Security": hstsParts.join("; "),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}
