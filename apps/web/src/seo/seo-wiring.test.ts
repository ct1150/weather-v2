// apps/web/src/seo/seo-wiring.test.ts

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import sitemap from "../app/sitemap";
import robots from "../app/robots";
import { JsonLd } from "../components/JsonLd";
import {
  buildAlternates,
  citySearchCopy,
  countrySearchCopy,
  countrySearchCopyZh,
  routeRobots,
} from "../app/seo";
import { indexabilityForRouteClass } from "@wnr/seo";

const BASE = "https://868656.xyz";

describe("sitemap.ts — static export sitemap", () => {
  it("enumerates every real English route and launched Chinese route once", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);

    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(`${BASE}/`);
    expect(urls).toContain(`${BASE}/explore`);
    expect(urls).toContain(`${BASE}/trips`);
    expect(urls).toContain(`${BASE}/zh-hant/trips`);
    expect(urls).toContain(`${BASE}/zh-cn/trips`);
    expect(urls).toContain(`${BASE}/trips/qinggan-family-2026`);
    expect(urls).toContain(`${BASE}/zh-cn/trips/qinggan-family-2026`);
    expect(urls.some((url) => url.endsWith("/jp/tokyo"))).toBe(true);
    expect(urls).toContain(`${BASE}/zh-cn`);
    expect(urls).toContain(`${BASE}/zh-cn/jp`);
    expect(urls.some((url) => url.includes("/zh-hant/jp/"))).toBe(false);
    expect(urls.some((url) => url.includes("/zh-cn/jp/tokyo"))).toBe(false);
    expect(urls).toHaveLength(60);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("contains only final, non-redirecting canonical URL shapes", async () => {
    const entries = await sitemap();
    expect(entries.some((entry) => entry.url.endsWith("/zh-cn/"))).toBe(false);
    expect(entries.some((entry) => entry.url.endsWith("/zh-hant/"))).toBe(false);

    const trips = entries.find((entry) => entry.url === `${BASE}/trips`);
    expect(trips?.alternates?.languages?.["zh-Hant"]).toBe(`${BASE}/zh-hant/trips`);
  });

  it("advertises hreflang only where translated pages are published", async () => {
    const entries = await sitemap();
    const japan = entries.find((entry) => entry.url === `${BASE}/jp`);
    const tokyo = entries.find((entry) => entry.url === `${BASE}/jp/tokyo`);
    expect(japan?.alternates?.languages?.["zh-CN"]).toBe(`${BASE}/zh-cn/jp`);
    expect(japan?.alternates?.languages?.en).toBe(`${BASE}/jp`);
    expect(japan?.alternates?.languages?.["zh-Hant"]).toBeUndefined();
    expect(tokyo?.alternates).toBeUndefined();
  });

  it("every entry carries a lastModified or changeFrequency", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.lastModified !== undefined || entry.changeFrequency !== undefined).toBe(true);
    }
  });
});

describe("robots.ts — static export robots", () => {
  it("advertises the sitemap and host", () => {
    const result = robots();
    expect(result.rules.userAgent).toBe("*");
    expect(result.rules.allow).toBe("/");
    expect(result.sitemap).toBe(`${BASE}/sitemap.xml`);
    expect(result.host).toBe(BASE);
  });
});

describe("JsonLd.tsx — server-rendered structured data", () => {
  it("renders a JSON-LD script with the expected type", () => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "TouristDestination",
      name: "Where Not Rain",
      description: "Deterministic destination recommendations.",
      url: `${BASE}/`,
    };
    const html = renderToStaticMarkup(createElement(JsonLd, { schema }));
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"TouristDestination"');
    expect(html).toContain('"name":"Where Not Rain"');
  });
});

describe("seo.ts helpers — canonical, copy and robots", () => {
  it("resolves bilingual trip alternates and translated country alternates", () => {
    const alt = buildAlternates("/jp/tokyo");
    expect(alt.canonical).toBe(`${BASE}/jp/tokyo`);
    expect(alt.languages).toBeUndefined();

    const tripAlt = buildAlternates("/trips", "zh-hant", ["en", "zh-hant", "zh-cn"]);
    expect(tripAlt.canonical).toBe(`${BASE}/zh-hant/trips`);
    expect(tripAlt.languages?.en).toBe(`${BASE}/trips`);
    expect(tripAlt.languages?.["zh-Hant"]).toBe(`${BASE}/zh-hant/trips`);
    expect(tripAlt.languages?.["zh-CN"]).toBe(`${BASE}/zh-cn/trips`);

    const zhCountry = buildAlternates("/jp", "zh-cn", ["en", "zh-cn"]);
    expect(zhCountry.canonical).toBe(`${BASE}/zh-cn/jp`);
    expect(zhCountry.languages?.en).toBe(`${BASE}/jp`);
    expect(zhCountry.languages?.["zh-CN"]).toBe(`${BASE}/zh-cn/jp`);
    expect(zhCountry.languages?.["x-default"]).toBe(`${BASE}/jp`);
  });

  it("generates unique, intent-led country and city search copy", () => {
    expect(countrySearchCopy("Japan", ["Tokyo", "Osaka", "Sapporo", "Kyoto"])).toEqual({
      title: "Japan travel weather map: compare 4 cities",
      description:
        "Choose your travel dates and compare rain, temperature and Travel Scores for Tokyo, Osaka, Sapporo and 1 more on one Japan weather map.",
    });
    expect(citySearchCopy("Tokyo", "Japan").title).toContain("Tokyo travel weather");
    expect(countrySearchCopyZh("日本", ["东京", "大阪", "札幌", "京都"])).toEqual({
      title: "日本旅行天气地图：比较4个城市",
      description:
        "选择旅行日期，一张地图比较东京、大阪、札幌等4个目的地的预计降雨、最高降雨概率、气温和旅行评分。",
    });
  });

  it("consumes the shared SEO indexability policy", () => {
    expect(indexabilityForRouteClass("homepage", true)).toBe("index,follow");

    const indexed = routeRobots("homepage", true);
    expect(indexed.index).toBe(true);
    expect(indexed.follow).toBe(true);

    const thin = routeRobots("homepage", false);
    expect(thin.index).toBe(false);
    expect(thin.follow).toBe(true);
  });
});
