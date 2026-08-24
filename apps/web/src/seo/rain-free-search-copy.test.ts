import { describe, expect, it } from "vitest";
import { citySearchCopy, countrySearchCopy, countrySearchCopyZh } from "../app/seo";

describe("rain-free SEO search copy", () => {
  it("uses the product's current rain-free language on country pages", () => {
    const english = countrySearchCopy("Thailand", ["Bangkok", "Chiang Mai", "Phuket"]);
    expect(english.description).toContain("mostly rain-free days");
    expect(english.description).not.toContain("lower-rain days");

    const chinese = countrySearchCopyZh("泰国", ["曼谷", "清迈", "普吉"]);
    expect(chinese.description).toContain("基本不下雨的天数");
    expect(chinese.description).not.toContain("少雨天数");
  });

  it("answers the 7-day rain-free intent directly in city metadata", () => {
    const copy = citySearchCopy("Bangkok", "Thailand");
    expect(copy.title).toContain("7-day travel weather");
    expect(copy.title).toContain("rain-free days");
    expect(copy.description).toContain("which of the next 7 days");
    expect(copy.description).toContain("mostly rain-free");
  });
});
