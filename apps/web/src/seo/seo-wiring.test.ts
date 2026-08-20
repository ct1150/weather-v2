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

describe("sitemap.ts — country-map acquisition sitemap", () => {
  it("enumerates every published country and city weather route once", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);

    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(`${BASE}/`);
    expect(urls).toContain(`${BASE}/zh-cn`);
    expect(urls).toContain(`${BASE}/zh-hant`);
    expect(urls).toContain(`${BASE}/jp`);
    expect(urls).toContain(`${BASE}/zh-cn/jp`);
    expect(urls).toContain(`${BASE}/zh-hant/jp`);
    expect(urls).toContain(`${BASE}/jp/tokyo`);
    expect(urls).toContain(`${BASE}/zh-cn/jp/tokyo`);
    expect(urls).toContain(`${BASE}/zh-hant/jp/tokyo`);

    // Legacy discovery and advanced itinerary surfaces remain reachable for
    // existing links, but no longer participate in primary acquisition.
    expect(urls).not.toContain(`${BASE}/explore`);
    expect(urls).not.toContain(`${BASE}/discover`);
    expect(urls).not.toContain(`${BASE}/zh-cn/discover`);
    expect(urls).not.toContain(`${BASE}/zh-hant/discover`);
    expect(urls).not.toContain(`${BASE}/trips`);
    expect(urls).not.toContain(`${BASE}/zh-hant/trips`);
    expect(urls).not.toContain(`${BASE}/zh-cn/trips`);
    expect(urls).not.toContain(`${BASE}/trips/qinggan-family-2026`);
    expect(urls).not.toContain(`${BASE}/zh-cn/trips/qinggan-family-2026`);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("contains only final canonical URL shapes", async () => {
    const entries = await sitemap();
    expect(entries.some((entry) => entry.url.endsWith("/zh-cn/"))).toBe(false);
    expect(entries.some((entry) => entry.url.endsWith("/zh-hant/"))).toBe(false);

    const japan = entries.find((entry) => entry.url === `${BASE}/jp`);
    expect(japan?.alternates?.languages?.["zh-Hant"]).toBe(`${BASE}/zh-hant/jp`);
    expect(japan?.alternates?.languages?.["zh-CN"]).toBe(`${BASE}/zh-cn/jp`);
  });

  it("advertises three-language hreflang for published country and city maps", async () => {
    const entries = await sitemap();
    const japan = entries.find((entry) => entry.url === `${BASE}/jp`);
    const tokyo = entries.find((entry) => entry.url === `${BASE}/jp/tokyo`);
    for (const entry of [japan, tokyo]) {
      expect(entry?.alternates?.languages?.en).toBeDefined();
      expect(entry?.alternates?.languages?.["zh-CN"]).toBeDefined();
      expect(entry?.alternates?.languages?.["zh-Hant"]).toBeDefined();
      expect(entry?.alternates?.languages?.["x-default"]).toBeDefined();
    }
    expect(japan?.alternates?.languages?.["zh-CN"]).toBe(`${BASE}/zh-cn/jp`);
    expect(japan?.alternates?.languages?.["zh-Hant"]).toBe(`${BASE}/zh-hant/jp`);
    expect(tokyo?.alternates?.languages?.["zh-CN"]).toBe(`${BASE}/zh-cn/jp/tokyo`);
    expect(tokyo?.alternates?.languages?.["zh-Hant"]).toBe(`${BASE}/zh-hant/jp/tokyo`);
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
      description: "Country-first travel weather maps.",
      url: `${BASE}/`,
    };
    const html = renderToStaticMarkup(createElement(JsonLd, { schema }));
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"TouristDestination"');
    expect(html).toContain('"name":"Where Not Rain"');
  });
});

describe("seo.ts helpers — canonical, country-map copy and robots", () => {
  it("resolves localized advanced and weather alternates", () => {
    const alt = buildAlternates("/jp/tokyo");
    expect(alt.canonical).toBe(`${BASE}/jp/tokyo`);
    expect(alt.languages).toBeUndefined();

    // The helper remains valid for noindex advanced pages even though they are
    // intentionally absent from the public sitemap.
    const tripAlt = buildAlternates("/trips", "zh-hant", ["en", "zh-hant", "zh-cn"]);
    expect(tripAlt.canonical).toBe(`${BASE}/zh-hant/trips`);
    expect(tripAlt.languages?.en).toBe(`${BASE}/trips`);
    expect(tripAlt.languages?.["zh-Hant"]).toBe(`${BASE}/zh-hant/trips`);
    expect(tripAlt.languages?.["zh-CN"]).toBe(`${BASE}/zh-cn/trips`);

    const zhCountry = buildAlternates("/jp", "zh-cn", ["en", "zh-cn", "zh-hant"]);
    expect(zhCountry.canonical).toBe(`${BASE}/zh-cn/jp`);
    expect(zhCountry.languages?.en).toBe(`${BASE}/jp`);
    expect(zhCountry.languages?.["zh-CN"]).toBe(`${BASE}/zh-cn/jp`);
    expect(zhCountry.languages?.["zh-Hant"]).toBe(`${BASE}/zh-hant/jp`);
    expect(zhCountry.languages?.["x-default"]).toBe(`${BASE}/jp`);
  });

  it("generates unique, map-led country and city search copy", () => {
    expect(countrySearchCopy("Japan", ["Tokyo", "Osaka", "Sapporo", "Kyoto"])).toEqual({
      title: "Japan travel weather map: 4 popular destinations",
      description:
        "See weather icons, lower-rain days and temperatures for Tokyo, Osaka, Sapporo and 1 more on one Japan map, then open the daily forecast for any place.",
    });
    expect(citySearchCopy("Tokyo", "Japan").title).toContain("Tokyo travel weather");
    expect(countrySearchCopyZh("日本", ["东京", "大阪", "札幌", "京都"])).toEqual({
      title: "日本旅行天气地图：4个热门目的地",
      description:
        "一张地图查看东京、大阪、札幌等4个目的地的天气图标、少雨天数和气温，点击任意地点再查看逐日预报。",
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
