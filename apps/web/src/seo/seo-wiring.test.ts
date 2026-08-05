// apps/web/src/seo/seo-wiring.test.ts
//
// Wiring of `@wnr/seo` into the static site (SEO-SITEMAP-001,
// SEO-INDEXABILITY-001, SEO-STRUCTURED-001, SEO-PAGE-001).
//
// This is the test that proves the previously-orphaned `@wnr/seo` package is
// actually consumed: sitemap/robots are emitted from the baked dataset, the
// JSON-LD component server-renders structured data, and the page metadata
// helpers resolve canonical + robots via `indexabilityForRouteClass`.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import sitemap from "../app/sitemap";
import robots from "../app/robots";
import { JsonLd } from "../components/JsonLd";
import { buildAlternates, citySearchCopy, countrySearchCopy, routeRobots } from "../app/seo";
import { indexabilityForRouteClass } from "@wnr/seo";

const BASE = "https://868656.xyz";

describe("sitemap.ts — static export sitemap (SEO-SITEMAP-001)", () => {
  it("enumerates every real canonical route once", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);

    const urls = entries.map((e) => e.url);
    // Home + explorer.
    expect(urls).toContain(`${BASE}/`);
    expect(urls).toContain(`${BASE}/explore`);
    // At least one city URL (en canonical).
    expect(urls.some((u) => u.endsWith("/jp/tokyo"))).toBe(true);
    expect(urls.some((u) => u.includes("/ja/"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("does not advertise locale routes that are not published", async () => {
    const entries = await sitemap();
    expect(entries.every((entry) => entry.alternates === undefined)).toBe(true);
  });

  it("every entry carries a lastModified or changeFrequency", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.lastModified !== undefined || entry.changeFrequency !== undefined).toBe(true);
    }
  });
});

describe("robots.ts — static export robots (SEO-INDEXABILITY-001)", () => {
  it("advertises the sitemap and host", () => {
    const r = robots();
    expect(r.rules.userAgent).toBe("*");
    expect(r.rules.allow).toBe("/");
    expect(r.sitemap).toBe(`${BASE}/sitemap.xml`);
    expect(r.host).toBe(BASE);
  });
});

describe("JsonLd.tsx — server-rendered structured data (SEO-STRUCTURED-001)", () => {
  it("renders a JSON-LD <script> with the expected @type", () => {
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

describe("seo.ts helpers — canonical + search copy + robots", () => {
  it("resolves a self-referencing production canonical only", () => {
    const alt = buildAlternates("/jp/tokyo");
    expect(alt.canonical).toBe(`${BASE}/jp/tokyo`);
    expect(alt.languages).toBeUndefined();
  });

  it("generates unique, intent-led country and city search copy", () => {
    expect(countrySearchCopy("Japan", ["Tokyo", "Osaka", "Sapporo", "Kyoto"])).toEqual({
      title: "Japan travel weather map: compare 4 cities",
      description:
        "Choose your travel dates and compare rain, temperature and Travel Scores for Tokyo, Osaka, Sapporo and 1 more on one Japan weather map.",
    });
    expect(citySearchCopy("Tokyo", "Japan").title).toContain("Tokyo travel weather");
  });

  it("consumes @wnr/seo indexabilityForRouteClass for robots flags", () => {
    // Proof the SEO package is no longer orphaned.
    expect(indexabilityForRouteClass("homepage", true)).toBe("index,follow");

    const indexed = routeRobots("homepage", true);
    expect(indexed.index).toBe(true);
    expect(indexed.follow).toBe(true);

    const thin = routeRobots("homepage", false);
    expect(thin.index).toBe(false);
    expect(thin.follow).toBe(true);
  });
});
