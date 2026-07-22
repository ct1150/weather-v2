// apps/web/src/api/v1/api-contract.test.ts
//
// Contract tests for the v1 public-read API: enum canonicalization, bounded
// input validation, envelope shapes, request-ID handling, the stable
// error-to-status table, freshness, and the weak ETag hash
// (API-READ-001, API-ENVELOPE-001, API-VALIDATION-001, API-CACHE-001).

import { describe, expect, it } from "vitest";

import {
  API_ERROR_STATUS,
  buildETag,
  canonicalizeBounds,
  canonicalJson,
  computeCoreHash,
  computeMapTiles,
  computeStale,
  generateRequestId,
  isErrorEnvelope,
  isSuccessEnvelope,
  makeErrorEnvelope,
  makeSuccessEnvelope,
  parseBoundsDecimal,
  parseCityId,
  parseCursor,
  parseInteger,
  parseLocale,
  parseRegion,
  parseRequestId,
  parseSearchQuery,
  parseSlug,
  parseTheme,
  parseUnit,
  parseWindow,
  validateQueryParameters,
  type ApiErrorCode,
} from "./schemas";

describe("enum canonicalization", () => {
  it("parses known locales case-insensitively after trimming", () => {
    expect(parseLocale("EN")).toEqual({ ok: true, value: "en" });
    expect(parseLocale("  zh-CN ")).toEqual({ ok: true, value: "zh-cn" });
    expect(parseLocale("ko")).toEqual({ ok: true, value: "ko" });
  });

  it("rejects unknown or empty locales", () => {
    expect(parseLocale("fr").ok).toBe(false);
    expect(parseLocale("").ok).toBe(false);
    expect(parseLocale(undefined).ok).toBe(false);
  });

  it("canonicalizes unit/window/theme/region enums", () => {
    expect(parseUnit("METRIC")).toEqual({ ok: true, value: "metric" });
    expect(parseWindow("Next_Week")).toEqual({ ok: true, value: "next_week" });
    expect(parseTheme("BEACH")).toEqual({ ok: true, value: "beach" });
    expect(parseRegion("north_america")).toEqual({ ok: true, value: "north_america" });
    expect(parseTheme("moon").ok).toBe(false);
    expect(parseRegion("mars").ok).toBe(false);
  });
});

describe("slug and cityId grammar", () => {
  it("accepts valid slugs and rejects bad ones", () => {
    expect(parseSlug("tokyo")).toEqual({ ok: true, value: "tokyo" });
    expect(parseSlug("new-york")).toEqual({ ok: true, value: "new-york" });
    expect(parseSlug("A").ok).toBe(false); // must be lowercase
    expect(parseSlug("has_underscore").ok).toBe(false);
    expect(parseSlug("a".repeat(81)).ok).toBe(false); // >80
    expect(parseSlug("").ok).toBe(false);
  });

  it("accepts valid cityIds within 1..64 and rejects out-of-range", () => {
    expect(parseCityId("TYO-001")).toEqual({ ok: true, value: "TYO-001" });
    expect(parseCityId("a".repeat(64)).ok).toBe(true);
    expect(parseCityId("a".repeat(65)).ok).toBe(false);
    expect(parseCityId("bad id").ok).toBe(false); // space
  });
});

describe("integer parsing and bounds", () => {
  it("enforces min/max and rejects non-decimal input", () => {
    expect(parseInteger("7", 1, 100, 20)).toEqual({ ok: true, value: 7 });
    expect(parseInteger("", 1, 100, 20)).toEqual({ ok: true, value: 20 }); // default
    expect(parseInteger("0", 1, 100).ok).toBe(false);
    expect(parseInteger("101", 1, 100).ok).toBe(false);
    expect(parseInteger("-3", 1, 100).ok).toBe(false);
    expect(parseInteger("1.5", 1, 100).ok).toBe(false); // fractions
    expect(parseInteger(" 5", 1, 100).ok).toBe(false); // whitespace
  });
});

describe("query-parameter validation", () => {
  const allowed = ["theme", "window", "region", "limit", "locale"] as const;

  it("accepts a valid parameter set", () => {
    const res = validateQueryParameters(allowed, [
      ["theme", "beach"],
      ["window", "today"],
    ]);
    expect(res).toEqual({ ok: true, value: [["theme", "beach"], ["window", "today"]] });
  });

  it("rejects unknown, duplicate, empty, bracket, and >20 inputs", () => {
    expect(validateQueryParameters(allowed, [["tracking", "x"]]).ok).toBe(false);
    expect(validateQueryParameters(allowed, [["theme", "a"], ["theme", "b"]]).ok).toBe(false);
    expect(validateQueryParameters(allowed, [["theme", ""]]).ok).toBe(false);
    expect(validateQueryParameters(allowed, [["theme[]", "a"]]).ok).toBe(false);
    const tooMany = Array.from({ length: 21 }, (_, i) => [`k${i}`, "v"] as const);
    expect(validateQueryParameters(allowed, tooMany).ok).toBe(false);
  });
});

describe("search query bounds", () => {
  it("requires 2..80 Unicode scalars and trims", () => {
    expect(parseSearchQuery("a").ok).toBe(false);
    expect(parseSearchQuery("  to  ").ok).toBe(true);
    const eighty = "a".repeat(80);
    expect(parseSearchQuery(eighty).ok).toBe(true);
    expect(parseSearchQuery("a".repeat(81)).ok).toBe(false);
    expect(parseSearchQuery(undefined).ok).toBe(false);
  });

  it("counts Unicode scalar values, not UTF-16 code units", () => {
    // "日本語" is three scalar values; it must pass the 2..80 bound.
    expect(parseSearchQuery("日本語").ok).toBe(true);
  });
});

describe("map bounds canonicalization", () => {
  it("rejects out-of-range coordinates and ordering", () => {
    expect(canonicalizeBounds(-200, 0, 10, 10).ok).toBe(false);
    expect(canonicalizeBounds(-10, -90, 10, 10).ok).toBe(false);
    expect(canonicalizeBounds(10, 0, 5, 10).ok).toBe(false); // west >= east
    expect(canonicalizeBounds(-10, 10, 10, 5).ok).toBe(false); // south >= north
  });

  it("produces one canonical identity for equivalent decimal spellings", () => {
    const a = canonicalizeBounds(1.5, 2.5, 3.5, 4.5);
    const b = canonicalizeBounds(1.5, 2.5, 3.5, 4.5);
    const c = canonicalizeBounds(1.500, 2.5000, 3.50, 4.500);
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (a.ok && b.ok && c.ok) {
      expect(a.value.canonicalString).toBe("1.500000,2.500000,3.500000,4.500000");
      expect(a.value.canonicalString).toBe(b.value.canonicalString);
      expect(a.value.hash).toBe(c.value.hash);
    }
  });

  it("normalizes negative zero to zero", () => {
    const res = canonicalizeBounds(-0, -0, 1, 1);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.canonicalString).toBe("0.000000,0.000000,1.000000,1.000000");
  });

  it("parses the boundsDecimal grammar strictly", () => {
    expect(parseBoundsDecimal("12.3456")).toBe(12.3456);
    expect(parseBoundsDecimal("-0.000001")).toBe(-0.000001);
    expect(parseBoundsDecimal("1.2345678")).toBe(null); // >6 decimals
    expect(parseBoundsDecimal("1e3")).toBe(null); // exponent
    expect(parseBoundsDecimal("abc")).toBe(null);
  });
});

describe("map tile identity", () => {
  it("computes at most 64 unique ascending tiles and a stable region key", () => {
    const bounds = canonicalizeBounds(-180, -85, 180, 85);
    expect(bounds.ok).toBe(true);
    if (!bounds.ok) return;
    const tiles = computeMapTiles(bounds.value, 2);
    expect(tiles.ok).toBe(true);
    if (!tiles.ok) return;
    expect(tiles.value.tileIds.length).toBeLessThanOrEqual(64);
    expect(tiles.value.tileIds.length).toBeGreaterThan(0);
    // ascending + unique
    const sorted = [...tiles.value.tileIds].sort((x, y) => x - y);
    expect(tiles.value.tileIds).toEqual(sorted);
    expect(new Set(tiles.value.tileIds).size).toBe(tiles.value.tileIds.length);
    expect(tiles.value.mapRegionKey.startsWith("wm:2:")).toBe(true);
    // deterministic
    const again = computeMapTiles(bounds.value, 2);
    expect(again.ok && again.value.tileIds).toEqual(tiles.value.tileIds);
  });

  it("rejects zoom outside 2..12", () => {
    const bounds = canonicalizeBounds(0, 0, 1, 1);
    expect(bounds.ok).toBe(true);
    if (!bounds.ok) return;
    expect(computeMapTiles(bounds.value, 1).ok).toBe(false);
    expect(computeMapTiles(bounds.value, 13).ok).toBe(false);
  });
});

describe("request ID selection", () => {
  it("propagates a valid inbound value byte-for-byte", () => {
    const valid = "abcDEF123_-4567";
    expect(parseRequestId(valid)).toBe(valid);
  });

  it("replaces invalid/missing values with a UUIDv4", () => {
    const generated = parseRequestId("short"); // too short
    expect(generated).not.toBe("short");
    expect(generated).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    // UUIDv4 shape
    expect(generated).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("generates a UUIDv4", () => {
    expect(generateRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("error-to-status mapping", () => {
  const expected: Record<ApiErrorCode, number> = {
    INVALID_PARAMETER: 400,
    COMPARE_SAME_CITY: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    CITY_NOT_FOUND: 404,
    RESOURCE_NOT_FOUND: 404,
    NOT_INDEXABLE: 404,
    ENDPOINT_NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    DATA_UNAVAILABLE: 503,
  };

  it("maps every stable code to its exact status", () => {
    for (const [code, status] of Object.entries(expected)) {
      expect(API_ERROR_STATUS[code as ApiErrorCode]).toBe(status);
    }
  });
});

describe("envelope shapes", () => {
  const meta = {
    requestId: "req-1",
    generatedAt: "2026-07-20T00:00:00Z",
    dataUpdatedAt: "2026-07-20T00:00:00Z",
    stale: false,
    snapshotId: "s1",
    rankingVersion: null,
    modelVersion: "m1",
  };

  it("builds a success envelope with data + meta only", () => {
    const env = makeSuccessEnvelope({ hello: "world" }, meta);
    expect(env).toEqual({ data: { hello: "world" }, meta });
    expect(isSuccessEnvelope(env)).toBe(true);
    expect(isErrorEnvelope(env)).toBe(false);
  });

  it("builds an error envelope with code/message/requestId only", () => {
    const env = makeErrorEnvelope("CITY_NOT_FOUND", "City not found", "req-1");
    expect(env).toEqual({ error: { code: "CITY_NOT_FOUND", message: "City not found", requestId: "req-1" } });
    expect(isErrorEnvelope(env)).toBe(true);
    expect(isSuccessEnvelope(env)).toBe(false);
    expect(Object.keys(env.error).sort()).toEqual(["code", "message", "requestId"]);
  });

  it("rejects a body that carries both data and error", () => {
    const both = { data: {}, error: { code: "INTERNAL_ERROR", message: "x", requestId: "r" } };
    expect(isSuccessEnvelope(both)).toBe(false);
    expect(isErrorEnvelope(both)).toBe(false);
  });

  it("never leaks injected SQL/stack as separate envelope fields", () => {
    const malicious = "ERROR: relation does not exist\nstack: at foo()";
    const env = makeErrorEnvelope("INTERNAL_ERROR", malicious, "req-9");
    expect(Object.keys(env.error)).toEqual(["code", "message", "requestId"]);
    expect((env.error as Record<string, unknown>).detail).toBeUndefined();
    expect((env.error as Record<string, unknown>).stack).toBeUndefined();
  });
});

describe("freshness equation", () => {
  const updated = "2026-07-20T00:00:00Z";
  const maxAge = 60;

  it("treats equality as fresh", () => {
    expect(computeStale(updated, updated, maxAge)).toBe(false);
    const boundary = new Date(Date.parse(updated) + maxAge * 60 * 1000).toISOString();
    expect(computeStale(updated, boundary, maxAge)).toBe(false);
  });

  it("treats one millisecond past the threshold as stale", () => {
    const over = new Date(Date.parse(updated) + maxAge * 60 * 1000 + 1).toISOString();
    expect(computeStale(updated, over, maxAge)).toBe(true);
  });

  it("never treats an invalid timestamp as fresh", () => {
    expect(computeStale("not-a-date", updated, maxAge)).toBe(true);
  });
});

describe("weak ETag hash", () => {
  const identity = { snapshotId: "s1", rankingVersion: null, modelVersion: "m1" };
  const coreData = { items: [{ rank: 1 }] };

  it("is identical for the same identity + coreData", () => {
    const h1 = computeCoreHash(identity, coreData);
    const h2 = computeCoreHash(identity, coreData);
    expect(h1).toBe(h2);
    expect(buildETag(h1)).toBe(`W/"v1.${h1}"`);
  });

  it("ignores request-scoped fields (requestId, generatedAt, stale)", () => {
    const base = computeCoreHash(identity, coreData);
    // These request-scoped values are not part of (identity, coreData).
    const withRequestMeta = computeCoreHash(identity, coreData);
    expect(base).toBe(withRequestMeta);
  });

  it("changes when coreData or identity changes", () => {
    const h1 = computeCoreHash(identity, coreData);
    const h2 = computeCoreHash(identity, { items: [{ rank: 2 }] });
    const h3 = computeCoreHash({ snapshotId: "s2", rankingVersion: null, modelVersion: "m1" }, coreData);
    expect(h1).not.toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it("canonicalizes object key order", () => {
    const a = computeCoreHash(identity, { b: 1, a: 2 });
    const b = computeCoreHash(identity, { a: 2, b: 1 });
    expect(a).toBe(b);
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
});

describe("cursor validation", () => {
  it("accepts a valid token, defaults empty, rejects bad tokens", () => {
    expect(parseCursor("abcDEF123_-").ok).toBe(true);
    expect(parseCursor("").ok).toBe(true); // -> null
    expect(parseCursor("a".repeat(257)).ok).toBe(false);
  });
});
