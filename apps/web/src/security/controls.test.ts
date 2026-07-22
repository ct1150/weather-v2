// apps/web/src/security/controls.test.ts
//
// Covers ENG-SECURITY-001 (security headers, SSRF, open-redirect),
// ENG-BOT-001 (four-level rate enforcement + crawler trust), and the
// API-VALIDATION-001-adjacent transport guards. Boundary fixtures cover the
// last allowed and first rejected request for L1's minute + burst windows and
// for every L2/L3/L4 minute window, plus window reset, cooldown, and the
// 3x-within-5-minutes Managed-Challenge candidacy.
import { describe, it, expect } from "vitest";
import {
  BOT_LEVELS,
  RateLimiter,
  evaluateCrawler,
  checkOutboundSsrf,
  checkRedirectSafety,
  buildSecurityHeaders,
  type BotLevel,
} from "./controls";

describe("BOT_LEVELS table (ENG-BOT-001)", () => {
  it("declares the four levels with their documented limits", () => {
    expect(BOT_LEVELS.L1.perMinute).toBe(120);
    expect(BOT_LEVELS.L1.burstLimit).toBe(30);
    expect(BOT_LEVELS.L1.burstWindowMs).toBe(10_000);
    expect(BOT_LEVELS.L2.perMinute).toBe(60);
    expect(BOT_LEVELS.L3.perMinute).toBe(30);
    expect(BOT_LEVELS.L4.perMinute).toBe(10);
  });
});

describe("RateLimiter — L1 (cacheable public HTML)", () => {
  it("allows the 120th request/minute and rejects the 121st", () => {
    // Pace four 30-request bursts across the 60s minute window so the
    // 10s burst window keeps resetting; the 120/minute cap is then the
    // binding constraint (not the burst). Exactly 120 requests total.
    const r = new RateLimiter();
    const key = "ip-l1";
    const times = [0, 10_000, 20_000, 30_000];
    let last = r.tryAcquire("L1", key, times[0] as number); // 1st (burst 1)
    for (let b = 0; b < times.length; b++) {
      const t = times[b] as number;
      const count = b === 0 ? 29 : 30; // burst 1 already has 1
      for (let i = 0; i < count; i++) last = r.tryAcquire("L1", key, t);
    }
    expect(last.allowed).toBe(true); // 120th
    expect(last.remaining).toBe(0);
    const over = r.tryAcquire("L1", key, 30_000); // still within the minute
    expect(over.allowed).toBe(false);
    expect(over.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(over.remaining).toBe(0);
  });

  it("honors the 30/10s burst window before the minute cap", () => {
    const r = new RateLimiter();
    const key = "ip-burst";
    let last = r.tryAcquire("L1", key, 0);
    for (let i = 0; i < 29; i++) last = r.tryAcquire("L1", key, 0);
    expect(last.allowed).toBe(true);
    // 31st attempt, still inside the 10s burst window: rejected by burst.
    const burstOver = r.tryAcquire("L1", key, 5_000);
    expect(burstOver.allowed).toBe(false);
    // Burst window elapsed (>=10s): allowed again (minute not yet exhausted).
    const afterBurst = r.tryAcquire("L1", key, 10_001);
    expect(afterBurst.allowed).toBe(true);
  });

  it("resets the minute window after 60s and restores capacity", () => {
    const r = new RateLimiter();
    const key = "ip-reset";
    for (let i = 0; i < 120; i++) r.tryAcquire("L1", key, 0);
    const over = r.tryAcquire("L1", key, 0);
    expect(over.allowed).toBe(false);
    const reset = r.tryAcquire("L1", key, 60_001);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(119);
  });
});

describe("RateLimiter — L2/L3/L4 minute windows", () => {
  const cases: ReadonlyArray<readonly [BotLevel, number]> = [
    ["L2", 60],
    ["L3", 30],
    ["L4", 10],
  ];
  for (const [level, limit] of cases) {
    it(`${level}: allows the ${limit}th and rejects the ${limit + 1}th`, () => {
      const r = new RateLimiter();
      const key = `ip-${level}`;
      let last = r.tryAcquire(level, key, 0);
      for (let i = 0; i < limit - 1; i++) last = r.tryAcquire(level, key, 0);
      expect(last.allowed).toBe(true);
      expect(last.remaining).toBe(0);
      const over = r.tryAcquire(level, key, 0);
      expect(over.allowed).toBe(false);
      expect(over.cooldownUntilMs).not.toBeNull();
    });
  }
});

describe("RateLimiter — 3x challenge candidacy (ENG-BOT-001)", () => {
  it("flags challenge candidate exactly at 3x the threshold within 5 minutes", () => {
    const r = new RateLimiter();
    const key = "hammer";
    let last = r.tryAcquire("L3", key, 0);
    for (let i = 0; i < 29; i++) last = r.tryAcquire("L3", key, 0); // 30 in minute 0
    for (let i = 0; i < 30; i++) last = r.tryAcquire("L3", key, 60_000); // 30 in minute 1
    for (let i = 0; i < 29; i++) last = r.tryAcquire("L3", key, 120_000); // 29 in minute 2 => 89
    expect(last.challengeCandidate).toBe(false);
    last = r.tryAcquire("L3", key, 120_000); // 90th attempt (3x * 30)
    expect(last.challengeCandidate).toBe(true);
  });

  it("does not flag below the 3x threshold", () => {
    const r = new RateLimiter();
    const key = "calm";
    let last = r.tryAcquire("L3", key, 0);
    for (let i = 0; i < 29; i++) last = r.tryAcquire("L3", key, 0);
    expect(last.challengeCandidate).toBe(false);
  });

  it("resets the challenge heuristic after the window lapses", () => {
    const r = new RateLimiter();
    const key = "lapsed";
    // 90 attempts all at t=0 (within the 5-min window).
    let last = r.tryAcquire("L3", key, 0);
    for (let i = 0; i < 89; i++) last = r.tryAcquire("L3", key, 0);
    expect(last.challengeCandidate).toBe(true);
    // Advance well past the 5-min challenge window: old attempts expire.
    last = r.tryAcquire("L3", key, 5 * 60_000 + 1);
    expect(last.challengeCandidate).toBe(false);
  });
});

describe("evaluateCrawler (ENG-BOT-001)", () => {
  it("rejects a User-Agent alone (never sufficient)", () => {
    const v = evaluateCrawler({
      userAgent: "Googlebot/2.1",
      cloudflareVerifiedBot: false,
      reverseDnsVerified: false,
    });
    expect(v.trusted).toBe(false);
    expect(v.exemptFromChallenge).toBe(false);
    expect(v.subjectToSafetyCeiling).toBe(true);
  });

  it("trusts a Cloudflare Verified Bot", () => {
    const v = evaluateCrawler({
      userAgent: "Googlebot/2.1",
      cloudflareVerifiedBot: true,
      reverseDnsVerified: false,
    });
    expect(v.trusted).toBe(true);
    expect(v.exemptFromChallenge).toBe(true);
    expect(v.subjectToSafetyCeiling).toBe(true);
  });

  it("trusts a reverse-DNS + forward-DNS verified crawler", () => {
    const v = evaluateCrawler({
      userAgent: "Bingbot/2.0",
      cloudflareVerifiedBot: false,
      reverseDnsVerified: true,
    });
    expect(v.trusted).toBe(true);
    expect(v.exemptFromChallenge).toBe(true);
  });
});

describe("checkOutboundSsrf (ENG-SECURITY-001)", () => {
  const allowlist = Object.freeze([
    { scheme: "https" as const, host: "api.provider.com", ports: [443], pathPrefix: "/v1" },
  ]);

  it("allows an approved https target", () => {
    const r = checkOutboundSsrf("https://api.provider.com/v1/weather", allowlist, {
      callerSupplied: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.target.host).toBe("api.provider.com");
      expect(r.target.port).toBeNull();
      expect(r.target.path).toBe("/v1/weather");
    }
  });

  it("rejects a caller-supplied target before any sensitive request", () => {
    const r = checkOutboundSsrf("https://api.provider.com/v1/weather", allowlist, {
      callerSupplied: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("caller_supplied_target_rejected");
  });

  it("rejects a non-https scheme", () => {
    const r = checkOutboundSsrf("http://api.provider.com/v1/weather", allowlist, {
      callerSupplied: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("host_not_allowlisted");
  });

  it("rejects an unapproved host", () => {
    const r = checkOutboundSsrf("https://evil.example/v1/weather", allowlist, {
      callerSupplied: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("host_not_allowlisted");
  });

  it("rejects a disallowed port", () => {
    const r = checkOutboundSsrf("https://api.provider.com:8080/v1/weather", allowlist, {
      callerSupplied: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("port_not_allowed");
  });

  it("rejects a path outside the approved prefix", () => {
    const r = checkOutboundSsrf("https://api.provider.com/internal", allowlist, {
      callerSupplied: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("path_not_approved");
  });

  it("rejects a malformed URL", () => {
    const r = checkOutboundSsrf("not a url", allowlist, { callerSupplied: false });
    expect(r.ok).toBe(false);
  });
});

describe("checkRedirectSafety (open-redirect guard)", () => {
  const opts = {
    sameOriginHost: "wherenotrain.example",
    allowedHosts: ["partner.example"] as ReadonlyArray<string>,
  };

  it("allows a same-origin relative redirect", () => {
    const r = checkRedirectSafety("/dashboard", opts);
    expect(r.ok).toBe(true);
  });

  it("allows an allowlisted absolute host", () => {
    const r = checkRedirectSafety("https://partner.example/x", opts);
    expect(r.ok).toBe(true);
  });

  it("blocks an open redirect to an external host", () => {
    const r = checkRedirectSafety("https://evil.example/x", opts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("open_redirect_blocked");
  });

  it("blocks a scheme-relative //evil.example", () => {
    const r = checkRedirectSafety("//evil.example/x", opts);
    expect(r.ok).toBe(false);
  });

  it("blocks javascript: and other unsafe schemes", () => {
    const r = checkRedirectSafety("javascript:alert(1)", opts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unsafe_scheme");
  });

  it("blocks an empty redirect", () => {
    const r = checkRedirectSafety("", opts);
    expect(r.ok).toBe(false);
  });
});

describe("buildSecurityHeaders (ENG-SECURITY-001)", () => {
  it("emits the required least-privilege headers", () => {
    const h = buildSecurityHeaders();
    expect(h["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(h["Content-Security-Policy"]).not.toContain("'unsafe-inline'");
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
    expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
  });

  it("omits HSTS preload unless requested", () => {
    expect(buildSecurityHeaders()["Strict-Transport-Security"]).not.toContain("preload");
    expect(
      buildSecurityHeaders({ hsts: { preload: true } })["Strict-Transport-Security"],
    ).toContain("preload");
  });

  it("can emit CSP as Report-Only", () => {
    const h = buildSecurityHeaders({ cspReportOnly: true });
    expect(h["Content-Security-Policy-Report-Only"]).toBeDefined();
    expect(h["Content-Security-Policy"]).toBeUndefined();
  });
});
