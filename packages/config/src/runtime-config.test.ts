import { describe, it, expect } from "vitest";
import {
  parseRuntimeConfig,
  DEFAULT_RUNTIME_CONFIG,
  ConfigParseError,
  getAffiliate,
  isAffiliateEnabled,
  type RuntimeConfig,
} from "./runtime-config.js";

/** Build a fully-enabled config, used to prove switches are orthogonal. */
function allEnabled(): RuntimeConfig {
  return parseRuntimeConfig({
    map: true,
    advertising: { enabled: true, reason: "launch" },
    weatherProvider: true,
    affiliates: { booking: true, gear: { enabled: true } },
  });
}

describe("parseRuntimeConfig — safe defaults", () => {
  it("treats null/undefined as the disabled default", () => {
    expect(parseRuntimeConfig(undefined)).toEqual(DEFAULT_RUNTIME_CONFIG);
    expect(parseRuntimeConfig(null)).toEqual(DEFAULT_RUNTIME_CONFIG);
  });

  it("disables every optional capability and keeps core reads on by default", () => {
    const cfg = parseRuntimeConfig({});
    expect(cfg.map.enabled).toBe(false);
    expect(cfg.advertising.enabled).toBe(false);
    expect(cfg.weatherProvider.enabled).toBe(false);
    expect(cfg.affiliates.size).toBe(0);
    expect(cfg.coreReadsEnabled).toBe(true);
  });

  it("never gates core cached destination reads, even with everything killed", () => {
    const cfg = parseRuntimeConfig({
      map: false,
      advertising: false,
      weatherProvider: false,
    });
    expect(cfg.coreReadsEnabled).toBe(true);
  });
});

describe("parseRuntimeConfig — typed parsing", () => {
  it("accepts a bare boolean shorthand for a capability", () => {
    const cfg = parseRuntimeConfig({ map: true });
    expect(cfg.map).toEqual({ enabled: true });
  });

  it("accepts the structured { enabled, reason } form", () => {
    const cfg = parseRuntimeConfig({ advertising: { enabled: true, reason: "promo" } });
    expect(cfg.advertising).toEqual({ enabled: true, reason: "promo" });
  });

  it("treats an absent capability as disabled (not enabled)", () => {
    const cfg = parseRuntimeConfig({ map: true });
    expect(cfg.advertising.enabled).toBe(false);
    expect(cfg.weatherProvider.enabled).toBe(false);
  });

  it("ignores unknown top-level keys rather than enabling them", () => {
    const cfg = parseRuntimeConfig({ map: true, unknownFutureFlag: true } as Record<string, unknown>);
    expect(cfg.map.enabled).toBe(true);
    // No crash, and the unknown key has no effect on the typed result.
    expect(cfg.coreReadsEnabled).toBe(true);
  });

  it("rejects a non-object root", () => {
    expect(() => parseRuntimeConfig("nope")).toThrow(ConfigParseError);
    expect(() => parseRuntimeConfig(42)).toThrow(ConfigParseError);
  });

  it("rejects an invalid capability value (not boolean, not {enabled})", () => {
    expect(() => parseRuntimeConfig({ map: "on" })).toThrow(ConfigParseError);
    expect(() => parseRuntimeConfig({ map: { enabled: "yes" } })).toThrow(ConfigParseError);
  });

  it("rejects an invalid reason type", () => {
    expect(() => parseRuntimeConfig({ advertising: { enabled: true, reason: 5 } })).toThrow(
      ConfigParseError,
    );
  });

  it("rejects an invalid affiliates container", () => {
    expect(() => parseRuntimeConfig({ affiliates: [true] })).toThrow(ConfigParseError);
    expect(() => parseRuntimeConfig({ affiliates: { booking: "yes" } })).toThrow(ConfigParseError);
  });
});

describe("parseRuntimeConfig — independent emergency kill switches", () => {
  it("disables each capability independently without affecting the others", () => {
    const capabilities: Array<keyof RuntimeConfig> = ["map", "advertising", "weatherProvider"];
    for (const key of capabilities) {
      const cfg = allEnabled();
      // Flip only this one off.
      const updated = parseRuntimeConfig({
        ...rawOf(cfg),
        [key]: false,
      });
      expect((updated[key] as { enabled: boolean }).enabled).toBe(false);
      // The other optional capabilities stay enabled...
      for (const other of capabilities) {
        if (other !== key) {
          expect((updated[other] as { enabled: boolean }).enabled).toBe(true);
        }
      }
      // ...and core reads are never touched.
      expect(updated.coreReadsEnabled).toBe(true);
    }
  });

  it("disables all provider ingestion without disabling map/ads/core reads", () => {
    const cfg = parseRuntimeConfig({
      map: true,
      advertising: true,
      weatherProvider: false,
    });
    expect(cfg.weatherProvider.enabled).toBe(false);
    expect(cfg.map.enabled).toBe(true);
    expect(cfg.advertising.enabled).toBe(true);
    expect(cfg.coreReadsEnabled).toBe(true);
  });

  it("toggles each Affiliate slot independently", () => {
    const cfg = parseRuntimeConfig({
      affiliates: { booking: true, gear: true, transit: false },
    });
    expect(isAffiliateEnabled(cfg, "booking")).toBe(true);
    expect(isAffiliateEnabled(cfg, "gear")).toBe(true);
    expect(isAffiliateEnabled(cfg, "transit")).toBe(false);
    expect(isAffiliateEnabled(cfg, "missing")).toBe(false);
  });
});

describe("affiliate helpers", () => {
  it("getAffiliate returns the disabled default for an unknown slot", () => {
    const cfg = allEnabled();
    expect(getAffiliate(cfg, "nope")).toEqual({ enabled: false });
  });

  it("getAffiliate returns the configured flag for a known slot", () => {
    const cfg = parseRuntimeConfig({ affiliates: { booking: { enabled: true, reason: "partner" } } });
    expect(getAffiliate(cfg, "booking")).toEqual({ enabled: true, reason: "partner" });
  });
});

/** Project a parsed config back into raw form for re-parsing in the orthogonality test. */
function rawOf(cfg: RuntimeConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (cfg.map.enabled) out.map = true;
  if (cfg.advertising.enabled) out.advertising = true;
  if (cfg.weatherProvider.enabled) out.weatherProvider = true;
  if (cfg.affiliates.size > 0) {
    const rec: Record<string, unknown> = {};
    for (const [slot, flag] of cfg.affiliates) rec[slot] = flag.enabled;
    out.affiliates = rec;
  }
  return out;
}
