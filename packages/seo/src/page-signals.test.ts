// packages/seo/src/page-signals.test.ts
//
// SEO builders, indexability policy, quality gate, structured data,
// sitemap/robots, editorial checks, and the route-rendering matrix
// (SEO-PAGE-001, SEO-STRUCTURED-001, SEO-QUALITY-001, SEO-SITEMAP-001,
// SEO-CONTENT-001, SEO-INDEXABILITY-001, ARCH-RENDER-001).

import { describe, expect, it } from "vitest";

import {
  buildJsonLd,
  buildPageMetadata,
  buildRobots,
  buildSitemap,
  buildSitemapIndex,
  evaluateQualityGate,
  indexabilityForRouteClass,
  renderMetaTags,
  routeRenderMode,
  ROUTE_RENDER_MATRIX,
  toJsonLdScript,
  validateArticleSources,
  validateJsonLd,
  type JsonLdNode,
  type QualityGateInput,
  type RouteClass,
  type SitemapEntry,
} from "./page-signals";

const CANONICAL = "https://wnr.example/jp/tokyo";

describe("SEO — indexability policy (SEO-INDEXABILITY-001)", () => {
  it("indexes content classes only after the quality gate passes", () => {
    expect(indexabilityForRouteClass("homepage", true)).toBe("index,follow");
    expect(indexabilityForRouteClass("homepage", false)).toBe("noindex,follow");
    expect(indexabilityForRouteClass("ranking", true)).toBe("index,follow");
    expect(indexabilityForRouteClass("seasonal", false)).toBe("noindex,follow");
    expect(indexabilityForRouteClass("article", true)).toBe("index,follow");
    expect(indexabilityForRouteClass("compare", true)).toBe("index,follow");
    expect(indexabilityForRouteClass("explore", true)).toBe("index,follow");
  });

  it("keeps search/query results noindex,follow and admin/api/preview noindex", () => {
    expect(indexabilityForRouteClass("search", true)).toBe("noindex,follow");
    expect(indexabilityForRouteClass("search", false)).toBe("noindex,follow");
    expect(indexabilityForRouteClass("admin", true)).toBe("noindex");
    expect(indexabilityForRouteClass("preview", true)).toBe("noindex");
    expect(indexabilityForRouteClass("api", true)).toBe("noindex");
  });
});

describe("SEO — quality gate (SEO-QUALITY-001)", () => {
  const baseCity: QualityGateInput = {
    routeClass: "city",
    entityActive: true,
    freshnessOk: true,
    confidenceOk: true,
    uniqueContent: true,
    hasSummary: true,
    hasExplanation: true,
    hasValidInternalLinks: true,
  };

  it("passes when every applicable condition holds", () => {
    const r = evaluateQualityGate(baseCity);
    expect(r.passed).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it("fails and reports a stable reason for each failed condition", () => {
    expect(evaluateQualityGate({ ...baseCity, entityActive: false }).reasons).toContain(
      "entity_inactive",
    );
    expect(evaluateQualityGate({ ...baseCity, freshnessOk: false }).reasons).toContain(
      "stale_beyond_policy",
    );
    expect(evaluateQualityGate({ ...baseCity, confidenceOk: false }).reasons).toContain(
      "low_confidence",
    );
    expect(evaluateQualityGate({ ...baseCity, uniqueContent: false }).reasons).toContain(
      "duplicate_template_content",
    );
  });

  it("requires a sufficient candidate set and a model/evidence for ranking", () => {
    const good = evaluateQualityGate({
      ...baseCity,
      routeClass: "ranking",
      candidateCount: 5,
      minCandidates: 3,
      modelOrEvidenceOk: true,
    });
    expect(good.passed).toBe(true);

    const thin = evaluateQualityGate({
      ...baseCity,
      routeClass: "ranking",
      candidateCount: 1,
      minCandidates: 3,
      modelOrEvidenceOk: true,
    });
    expect(thin.passed).toBe(false);
    expect(thin.reasons).toContain("insufficient_candidates");

    const noModel = evaluateQualityGate({
      ...baseCity,
      routeClass: "seasonal",
      candidateCount: 8,
      minCandidates: 3,
      modelOrEvidenceOk: false,
    });
    expect(noModel.reasons).toContain("missing_model_or_evidence");
  });

  it("is deterministic for identical inputs", () => {
    const a = evaluateQualityGate(baseCity);
    const b = evaluateQualityGate(baseCity);
    expect(a).toEqual(b);
  });
});

describe("SEO — page metadata (SEO-PAGE-001)", () => {
  const meta = buildPageMetadata({
    canonicalUrl: CANONICAL,
    title: "Tokyo, Japan — Where is NOT raining?",
    description: "Tokyo travel-weather decision guide.",
    locale: "en",
    documentLanguage: "en",
    alternates: {
      ja: "https://wnr.example/ja/jp/tokyo",
      ko: "https://wnr.example/ko/jp/tokyo",
    },
    xDefaultUrl: CANONICAL,
    openGraph: { image: "https://cdn.example/tokyo.jpg", siteName: "Where Not Rain" },
    breadcrumbs: [
      { name: "Japan", url: "https://wnr.example/jp" },
      { name: "Tokyo", url: CANONICAL },
    ],
  });

  it("emits a self-consistent canonical URL", () => {
    expect(meta.canonicalUrl).toBe(CANONICAL);
    const html = renderMetaTags(meta);
    expect(html).toContain(`<link rel="canonical" href="${CANONICAL}" />`);
  });

  it("emits bidirectional hreflang alternates including self and x-default", () => {
    const html = renderMetaTags(meta);
    expect(html).toContain('hreflang="ja"');
    expect(html).toContain('hreflang="ko"');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="x-default"');
  });

  it("keeps Open Graph / visible identity consistent", () => {
    expect(meta.openGraph.url).toBe(CANONICAL);
    expect(meta.openGraph.title).toBe("Tokyo, Japan — Where is NOT raining?");
    expect(meta.breadcrumbs.length).toBe(2);
    expect(meta.breadcrumbs[1]?.name).toBe("Tokyo");
  });
});

describe("SEO — structured data (SEO-STRUCTURED-001)", () => {
  const graph = buildJsonLd({
    canonicalUrl: CANONICAL,
    siteName: "Where Not Rain",
    title: "Tokyo",
    documentLanguage: "en",
    breadcrumbs: [
      { name: "Japan", url: "https://wnr.example/jp" },
      { name: "Tokyo", url: CANONICAL },
    ],
    place: { name: "Tokyo", latitude: 35.68, longitude: 139.69 },
    faq: [{ question: "Is Tokyo rainy?", answer: "Tokyo is often dry in winter." }],
  });

  it("builds WebSite, Organization, BreadcrumbList, Place, and FAQPage only", () => {
    const types = graph.map((n) => n["@type"]);
    expect(types).toContain("WebSite");
    expect(types).toContain("Organization");
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("Place");
    expect(types).toContain("FAQPage");
    // No Review / Rating / Event schema is emitted without eligible data.
    expect(types).not.toContain("Review");
    expect(types).not.toContain("Rating");
    expect(types).not.toContain("Event");
  });

  it("validates against the canonical URL and rejects forbidden keys", () => {
    const ok = validateJsonLd(graph, CANONICAL);
    expect(ok.valid).toBe(true);
    expect(ok.errors).toEqual([]);

    const bad: JsonLdNode[] = [{ "@type": "Place", "@id": "x", apiKey: "secret-value" }];
    const result = validateJsonLd(bad, CANONICAL);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("forbidden_key"))).toBe(true);
  });

  it("serializes to valid JSON-LD", () => {
    const script = toJsonLdScript(graph);
    expect(script).toContain('<script type="application/ld+json">');
    const json = JSON.parse(script.replace(/^<script[^>]*>/u, "").replace(/<\/script>$/u, ""));
    expect(json["@graph"].length).toBe(graph.length);
  });
});

describe("SEO — sitemap, index, and robots (SEO-SITEMAP-001)", () => {
  const entries: SitemapEntry[] = [
    { url: CANONICAL, indexable: true, lastmod: "2026-07-20T00:00:00Z" },
    { url: CANONICAL, indexable: true }, // duplicate, must be removed
    { url: "https://wnr.example/ko/jp/tokyo", indexable: true },
    { url: "https://wnr.example/search?q=tokyo", indexable: false }, // excluded
  ];

  it("includes only indexable, deduplicated canonical URLs", () => {
    const xml = buildSitemap(entries);
    expect(xml).toContain("<urlset");
    expect(xml).toContain(`<loc>${CANONICAL}</loc>`);
    expect(xml).toContain("<loc>https://wnr.example/ko/jp/tokyo</loc>");
    // Duplicate canonical appears once.
    expect(xml.match(new RegExp(`<loc>${CANONICAL}</loc>`, "gu"))?.length).toBe(1);
    // Non-indexable search URL is excluded.
    expect(xml).not.toContain("/search?q=");
  });

  it("emits lastmod only when meaningfully supplied", () => {
    const xml = buildSitemap(entries);
    expect(xml).toContain("<lastmod>2026-07-20T00:00:00Z</lastmod>");
    const noMod = buildSitemap([{ url: CANONICAL, indexable: true }]);
    expect(noMod).not.toContain("<lastmod>");
  });

  it("partitions the sitemap index and advertises it in robots", () => {
    const index = buildSitemapIndex([
      { loc: "https://wnr.example/sitemap-home.xml" },
      { loc: "https://wnr.example/sitemap-city.xml" },
    ]);
    expect(index).toContain("<sitemapindex");
    expect(index).toContain("https://wnr.example/sitemap-home.xml");

    const robots = buildRobots("https://wnr.example/sitemap-index.xml");
    expect(robots).toContain("Sitemap: https://wnr.example/sitemap-index.xml");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Disallow: /preview");
  });
});

describe("SEO — editorial content (SEO-CONTENT-001)", () => {
  it("passes a reviewd article with attribution and qualified sources", () => {
    const r = validateArticleSources({
      author: "Editorial Team",
      datePublished: "2026-01-01T00:00:00Z",
      dateModified: "2026-07-01T00:00:00Z",
      hasQualifiedSources: true,
    });
    expect(r.reviewed).toBe(true);
  });

  it("fails when attribution or qualified sources are missing", () => {
    expect(
      validateArticleSources({
        author: "",
        datePublished: "2026-01-01T00:00:00Z",
        dateModified: "2026-07-01T00:00:00Z",
        hasQualifiedSources: true,
      }).reasons,
    ).toContain("missing_author");
    expect(
      validateArticleSources({
        author: "Editorial Team",
        datePublished: "2026-01-01T00:00:00Z",
        dateModified: "2026-07-01T00:00:00Z",
        hasQualifiedSources: false,
      }).reasons,
    ).toContain("no_qualified_sources");
  });
});

describe("SEO — route rendering matrix (ARCH-RENDER-001)", () => {
  const classes: RouteClass[] = [
    "methodology",
    "homepage",
    "country",
    "city",
    "ranking",
    "seasonal",
    "article",
    "compare",
    "explore",
    "search",
    "admin",
    "api",
    "preview",
  ];

  it("covers every matrix row with its exact mode and revalidation", () => {
    expect(Object.keys(ROUTE_RENDER_MATRIX).sort()).toEqual([...classes].sort());
    expect(routeRenderMode("homepage")).toEqual({
      mode: "ISR",
      revalidateSeconds: 3600,
      cacheable: true,
    });
    expect(routeRenderMode("article")).toEqual({
      mode: "SSG",
      revalidateSeconds: null,
      cacheable: true,
    });
    const explore = routeRenderMode("explore");
    expect(explore.mode).toBe("SSR");
    expect(explore.revalidateSeconds).toBe(3600);
    expect(explore.cacheable).toBe(true);
    expect(routeRenderMode("search").cacheable).toBe(false);
    expect(routeRenderMode("admin")).toEqual({
      mode: "Dynamic",
      revalidateSeconds: null,
      cacheable: false,
    });
    expect(routeRenderMode("api").mode).toBe("Dynamic");
  });
});
