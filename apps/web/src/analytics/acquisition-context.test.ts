import { describe, expect, it } from "vitest";
import { classifyAcquisition, normalizeAcquisitionToken } from "./acquisition-context";

describe("acquisition context", () => {
  it("normalizes bounded UTM tokens without free-form punctuation", () => {
    expect(normalizeAcquisitionToken(" Google Ads / Summer 2026 ")).toBe("google-ads-summer-2026");
  });

  it("classifies paid, organic, social, referral and direct traffic", () => {
    expect(
      classifyAcquisition({ referrerHost: "", siteHost: "868656.xyz", utmSource: "", utmMedium: "" }),
    ).toBe("direct");
    expect(
      classifyAcquisition({
        referrerHost: "www.google.com",
        siteHost: "868656.xyz",
        utmSource: "",
        utmMedium: "",
      }),
    ).toBe("organic_search");
    expect(
      classifyAcquisition({
        referrerHost: "www.reddit.com",
        siteHost: "868656.xyz",
        utmSource: "",
        utmMedium: "",
      }),
    ).toBe("social");
    expect(
      classifyAcquisition({
        referrerHost: "example.com",
        siteHost: "868656.xyz",
        utmSource: "",
        utmMedium: "",
      }),
    ).toBe("referral");
    expect(
      classifyAcquisition({
        referrerHost: "",
        siteHost: "868656.xyz",
        utmSource: "google",
        utmMedium: "cpc",
      }),
    ).toBe("paid");
  });
});
