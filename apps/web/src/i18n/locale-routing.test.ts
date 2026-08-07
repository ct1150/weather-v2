import { describe, expect, it } from "vitest";

import {
  detectPreferredLocale,
  isAutoLocalizablePath,
  localeFromPath,
  localizedPath,
  stripLocalePrefix,
} from "./locale-routing";

describe("locale routing", () => {
  it("recognizes explicit locale prefixes", () => {
    expect(localeFromPath("/zh-hant/jp/tokyo")).toBe("zh-hant");
    expect(localeFromPath("/zh-cn/jp/tokyo")).toBe("zh-cn");
    expect(localeFromPath("/jp/tokyo")).toBe("en");
  });

  it("preserves the same product route when switching languages", () => {
    expect(stripLocalePrefix("/zh-hant/jp/tokyo")).toBe("/jp/tokyo");
    expect(localizedPath("/zh-hant/jp/tokyo", "zh-cn")).toBe("/zh-cn/jp/tokyo");
    expect(localizedPath("/zh-cn/jp/tokyo", "en")).toBe("/jp/tokyo");
    expect(localizedPath("/", "zh-hant")).toBe("/zh-hant");
    expect(localizedPath("/trips/invite", "zh-hant")).toBe("/zh-hant/trips/invite");
  });

  it("only auto-localizes published weather and core trip routes", () => {
    expect(isAutoLocalizablePath("/")).toBe(true);
    expect(isAutoLocalizablePath("/jp")).toBe(true);
    expect(isAutoLocalizablePath("/jp/tokyo")).toBe(true);
    expect(isAutoLocalizablePath("/zh-hant/jp/tokyo")).toBe(true);
    expect(isAutoLocalizablePath("/zh-cn/kr/seoul")).toBe(true);
    expect(isAutoLocalizablePath("/trips")).toBe(true);
    expect(isAutoLocalizablePath("/trips/new")).toBe(true);
    expect(isAutoLocalizablePath("/trips/workspace")).toBe(true);
    expect(isAutoLocalizablePath("/trips/invite")).toBe(true);
    expect(isAutoLocalizablePath("/zh-cn/trips/invite")).toBe(true);
    expect(isAutoLocalizablePath("/explore")).toBe(false);
    expect(isAutoLocalizablePath("/trips/qinggan-family-2026")).toBe(false);
  });
});

describe("locale detection", () => {
  it("lets an explicitly supported browser language win over timezone", () => {
    expect(detectPreferredLocale(["zh-TW"], "Asia/Shanghai")).toBe("zh-hant");
    expect(detectPreferredLocale(["zh-HK"], "Asia/Hong_Kong")).toBe("zh-hant");
    expect(detectPreferredLocale(["zh-CN"], "Asia/Taipei")).toBe("zh-cn");
    expect(detectPreferredLocale(["en-US"], "Asia/Taipei")).toBe("en");
  });

  it("uses timezone only when browser languages are unsupported", () => {
    expect(detectPreferredLocale(["ja-JP"], "Asia/Taipei")).toBe("zh-hant");
    expect(detectPreferredLocale(["fr-FR"], "Asia/Shanghai")).toBe("zh-cn");
    expect(detectPreferredLocale(["ja-JP"], "Asia/Tokyo")).toBe("en");
  });

  it("uses Traditional Chinese for generic Chinese unless a mainland timezone is explicit", () => {
    expect(detectPreferredLocale(["zh"], "Asia/Hong_Kong")).toBe("zh-hant");
    expect(detectPreferredLocale(["zh"], "Asia/Shanghai")).toBe("zh-cn");
  });
});
