// packages/i18n/src/dictionaries.test.ts
//
// Locale dictionaries, English fallback + missing-key reporting (UX-I18N-001),
// and locale-aware formatting in the destination's local time zone (DATA-GEOGRAPHY-001).

import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  DICTIONARIES,
  findMissingKeys,
  formatLocalDate,
  formatLocalDateTime,
  formatNumber,
  formatTemperature,
  isStableAsciiSlug,
  translate,
  type Locale,
  type UiStringKey,
} from "./dictionaries";

describe("i18n — dictionary-backed strings (UX-I18N-001)", () => {
  it("resolves a localized value rather than a hard-coded one", () => {
    const en = translate("app_tagline", "en");
    const ja = translate("app_tagline", "ja");
    expect(ja).not.toBe(en);
    expect(ja).toBe(DICTIONARIES.ja.app_tagline);
    expect(en).toBe(DICTIONARIES.en.app_tagline);
  });

  it("falls back to English for a missing key, never a blank label", () => {
    // `affiliate_disclosure` exists in English but not in Japanese.
    const ja = translate("affiliate_disclosure", "ja");
    expect(ja).toBe(DICTIONARIES.en.affiliate_disclosure);
    expect(ja.length).toBeGreaterThan(0);
  });

  it("reports the exact missing keys for a locale", () => {
    const missing = findMissingKeys("ja") as UiStringKey[];
    expect(missing).toContain("affiliate_disclosure");
    expect(missing).toContain("data_unavailable");
    expect(missing).toContain("stale_prefix");
    expect(missing.length).toBe(3);
    // The completeness reference itself reports nothing missing.
    expect(findMissingKeys(DEFAULT_LOCALE)).toEqual([]);
  });
});

describe("i18n — locale-aware formatting in destination-local time (DATA-GEOGRAPHY-001)", () => {
  it("formats a date in the destination time zone, not server UTC", () => {
    const instant = "2026-07-20T15:00:00Z";
    const tokyo = formatLocalDate(instant, "en", "Asia/Tokyo");
    const utc = formatLocalDate(instant, "en", "UTC");
    // Tokyo is UTC+9, so the local calendar day is the 21st.
    expect(tokyo).toContain("July 21");
    expect(utc).toContain("July 20");
    expect(tokyo).not.toBe(utc);
  });

  it("formats a date-time with the same time-zone discipline", () => {
    const tokyo = formatLocalDateTime("2026-07-20T15:00:00Z", "en", "Asia/Tokyo");
    expect(tokyo).toContain("July 21");
  });

  it("formats temperature with locale-aware metric/imperial units", () => {
    const metric = formatTemperature(18, "en", "metric");
    const imperial = formatTemperature(18, "en", "imperial");
    expect(metric).toContain("18");
    expect(metric).toContain("C");
    // 18°C == 64.4°F -> rounded to 64°F.
    expect(imperial).toContain("64");
    expect(imperial).toContain("F");
  });

  it("formats integers with locale grouping", () => {
    expect(formatNumber(1234567, "en")).toContain("1,234,567");
  });
});

describe("i18n — stable ASCII slugs (DATA-GEOGRAPHY-001)", () => {
  it("accepts lowercase ASCII slug spelling", () => {
    expect(isStableAsciiSlug("tokyo")).toBe(true);
    expect(isStableAsciiSlug("new-york")).toBe(true);
    expect(isStableAsciiSlug("san-jose")).toBe(true);
  });

  it("rejects uppercase, spaces, unicode, and empty slugs", () => {
    expect(isStableAsciiSlug("Tokyo")).toBe(false);
    expect(isStableAsciiSlug("tokyo city")).toBe(false);
    expect(isStableAsciiSlug("東京")).toBe(false);
    expect(isStableAsciiSlug("")).toBe(false);
  });

  it("exposes the supported locale set", () => {
    const locales: Locale[] = ["en", "ja", "ko", "zh-cn", "zh-tw"];
    expect(locales.every((l) => typeof translate("retry", l) === "string")).toBe(true);
  });
});
