// @wnr/seo — metadata, structured data, quality gate, sitemap, robots,
// indexability policy, editorial-content checks, and the route-rendering
// matrix (SEO-PAGE-001, SEO-STRUCTURED-001, SEO-QUALITY-001,
// SEO-SITEMAP-001, SEO-CONTENT-001, SEO-INDEXABILITY-001, ARCH-RENDER-001).
//
// Every builder consumes a route view model (or an equivalent structured
// input) and produces machine-testable output. No external service, network
// call, API key, or raw provider body is touched.

/** Core MVP locales used for hreflang alternates. */
export type SeoLocale = "en" | "ja" | "ko" | "zh-cn" | "zh-tw";

/**
 * Every public route family. The indexability policy (SEO-INDEXABILITY-001)
 * and the rendering matrix (ARCH-RENDER-001) are keyed by this union.
 */
export type RouteClass =
  | "methodology"
  | "homepage"
  | "country"
  | "city"
  | "ranking"
  | "seasonal"
  | "article"
  | "compare"
  | "explore"
  | "search"
  | "admin"
  | "api"
  | "preview";

export type Indexability = "index,follow" | "noindex,follow" | "noindex";

const NOINDEX_CLASSES: ReadonlyArray<RouteClass> = ["admin", "preview", "api"];

/**
 * Indexability outcome for a route class (SEO-INDEXABILITY-001).
 * Content classes become `index,follow` only when the quality gate passes,
 * otherwise `noindex,follow`. Search and arbitrary query/filter results
 * are always `noindex,follow`. Admin, preview, and API are `noindex`.
 */
export function indexabilityForRouteClass(
  routeClass: RouteClass,
  qualityPassed: boolean,
): Indexability {
  if (NOINDEX_CLASSES.includes(routeClass)) return "noindex";
  if (routeClass === "search") return "noindex,follow";
  return qualityPassed ? "index,follow" : "noindex,follow";
}

// ---------------------------------------------------------------------------
// Quality gate (SEO-QUALITY-001)
// ---------------------------------------------------------------------------

/** Inputs to the deterministic quality gate. */
export interface QualityGateInput {
  readonly routeClass:
    | "homepage"
    | "country"
    | "city"
    | "ranking"
    | "seasonal"
    | "article"
    | "compare"
    | "explore";
  readonly entityActive: boolean;
  readonly freshnessOk: boolean;
  readonly confidenceOk: boolean;
  readonly uniqueContent: boolean;
  readonly hasSummary: boolean;
  readonly hasExplanation: boolean;
  readonly hasValidInternalLinks: boolean;
  /** Ranking/seasonal: candidate set size. */
  readonly candidateCount?: number;
  readonly minCandidates?: number;
  readonly modelOrEvidenceOk?: boolean;
}

export interface QualityGateResult {
  readonly passed: boolean;
  /** Stable, machine-testable reason codes for every failed condition. */
  readonly reasons: ReadonlyArray<string>;
}

/**
 * Evaluate the conjoint quality gate (SEO-QUALITY-001). Every applicable
 * condition must pass; one failure fails the gate. Deterministic for the
 * same inputs. Ranking and seasonal pages additionally require a sufficient
 * candidate set and a valid implemented model or qualified evidence.
 */
export function evaluateQualityGate(input: QualityGateInput): QualityGateResult {
  const reasons: string[] = [];

  if (!input.entityActive) reasons.push("entity_inactive");
  if (!input.freshnessOk) reasons.push("stale_beyond_policy");
  if (!input.confidenceOk) reasons.push("low_confidence");
  if (!input.uniqueContent) reasons.push("duplicate_template_content");
  if (!input.hasSummary) reasons.push("no_useful_summary");
  if (!input.hasExplanation) reasons.push("missing_explanation");
  if (!input.hasValidInternalLinks) reasons.push("missing_valid_internal_links");

  if (input.routeClass === "ranking" || input.routeClass === "seasonal") {
    const min = input.minCandidates ?? 1;
    const count = input.candidateCount ?? 0;
    if (count < min) reasons.push("insufficient_candidates");
    if (input.modelOrEvidenceOk !== true) reasons.push("missing_model_or_evidence");
  }

  return { passed: reasons.length === 0, reasons: reasons };
}

// ---------------------------------------------------------------------------
// Page metadata (SEO-PAGE-001)
// ---------------------------------------------------------------------------

export interface PageMetadataInput {
  readonly canonicalUrl: string;
  readonly title: string;
  readonly description: string;
  readonly locale: SeoLocale;
  readonly documentLanguage: string;
  /** locale code -> canonical URL, including the self-referencing entry. */
  readonly alternates?: Readonly<Record<string, string>>;
  readonly xDefaultUrl?: string;
  readonly openGraph?: { readonly image?: string; readonly type?: string; readonly siteName?: string };
  readonly twitter?: {
    readonly card?: "summary" | "summary_large_image";
    readonly site?: string;
  };
  readonly breadcrumbs?: ReadonlyArray<{ readonly name: string; readonly url: string }>;
}

export interface HrefLangAlternate {
  readonly hreflang: string;
  readonly href: string;
}

export interface PageMetadata {
  readonly canonicalUrl: string;
  readonly title: string;
  readonly description: string;
  readonly documentLanguage: string;
  readonly hreflang: ReadonlyArray<HrefLangAlternate>;
  readonly openGraph: {
    readonly title: string;
    readonly description: string;
    readonly url: string;
    readonly type: string;
    readonly locale: string;
    readonly siteName: string;
    readonly image: string | null;
  };
  readonly twitter: {
    readonly card: string;
    readonly title: string;
    readonly description: string;
    readonly site: string | null;
  };
  readonly breadcrumbs: ReadonlyArray<{ readonly name: string; readonly url: string }>;
}

function assertAbsoluteHttps(url: string, what: string): void {
  if (!/^https:\/\//u.test(url)) {
    throw new Error(`${what} must be an absolute https URL: ${url}`);
  }
}

/**
 * Build unique, self-consistent page metadata (SEO-PAGE-001). The canonical
 * URL is self-referencing; hreflang alternates (including `x-default`) point
 * only to canonical localized URLs; Open Graph / Twitter values match the
 * visible page identity and never claim unavailable weather, prices, or images.
 */
export function buildPageMetadata(input: PageMetadataInput): PageMetadata {
  assertAbsoluteHttps(input.canonicalUrl, "canonicalUrl");

  const hreflang: HrefLangAlternate[] = [];
  // Self-referencing alternate is always present.
  hreflang.push({ hreflang: input.locale, href: input.canonicalUrl });
  if (input.alternates !== undefined) {
    for (const [code, url] of Object.entries(input.alternates)) {
      assertAbsoluteHttps(url, `alternate ${code}`);
      if (hreflang.some((a) => a.hreflang === code)) continue;
      hreflang.push({ hreflang: code, href: url });
    }
  }
  if (input.xDefaultUrl !== undefined) {
    assertAbsoluteHttps(input.xDefaultUrl, "xDefaultUrl");
    hreflang.push({ hreflang: "x-default", href: input.xDefaultUrl });
  }

  const ogImage = input.openGraph?.image ?? null;
  if (ogImage !== null) assertAbsoluteHttps(ogImage, "openGraph.image");

  const og = {
    title: input.title,
    description: input.description,
    url: input.canonicalUrl,
    type: input.openGraph?.type ?? "website",
    locale: input.locale,
    siteName: input.openGraph?.siteName ?? "Where Not Rain",
    image: ogImage,
  };
  const tw = {
    card: input.twitter?.card ?? "summary_large_image",
    title: input.title,
    description: input.description,
    site: input.twitter?.site ?? null,
  };

  return {
    canonicalUrl: input.canonicalUrl,
    title: input.title,
    description: input.description,
    documentLanguage: input.documentLanguage,
    hreflang,
    openGraph: og,
    twitter: tw,
    breadcrumbs: input.breadcrumbs ?? [],
  };
}

/** Render metadata as a sequence of `<link>`/`<meta>` elements (SEO-PAGE-001). */
export function renderMetaTags(meta: PageMetadata): string {
  const parts: string[] = [];
  parts.push(`<link rel="canonical" href="${meta.canonicalUrl}" />`);
  for (const alt of meta.hreflang) {
    parts.push(`<link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}" />`);
  }
  parts.push(`<meta property="og:title" content="${meta.openGraph.title}" />`);
  parts.push(`<meta property="og:description" content="${meta.openGraph.description}" />`);
  parts.push(`<meta property="og:url" content="${meta.openGraph.url}" />`);
  parts.push(`<meta property="og:type" content="${meta.openGraph.type}" />`);
  parts.push(`<meta name="twitter:card" content="${meta.twitter.card}" />`);
  parts.push(`<meta name="twitter:title" content="${meta.twitter.title}" />`);
  parts.push(`<meta name="twitter:description" content="${meta.twitter.description}" />`);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Structured data (SEO-STRUCTURED-001)
// ---------------------------------------------------------------------------

export type JsonLdNode = { readonly "@type": string; readonly "@id": string; readonly [key: string]: unknown };

export interface JsonLdInput {
  readonly canonicalUrl: string;
  readonly siteName: string;
  readonly title: string;
  readonly documentLanguage: string;
  readonly breadcrumbs?: ReadonlyArray<{ readonly name: string; readonly url: string }>;
  /** Qualified destination facts only — no rating, price, or opening state. */
  readonly place?: { readonly name: string; readonly latitude: number; readonly longitude: number };
  /** Questions/answers visibly rendered on the page only. */
  readonly faq?: ReadonlyArray<{ readonly question: string; readonly answer: string }>;
  readonly article?: {
    readonly headline: string;
    readonly author: string;
    readonly datePublished: string;
    readonly dateModified: string;
    readonly image: string | null;
  };
}

function uri(base: string, suffix: string): string {
  return `${base}#${suffix}`;
}

/**
 * Build a JSON-LD `@graph` that is a machine-readable projection of the
 * visible page (SEO-STRUCTURED-001). Each node has a stable `@id` and
 * values consistent with the canonical URL and visible title. No Review,
 * Rating, or Event schema is emitted unless the page visibly contains
 * eligible first-party data.
 */
export function buildJsonLd(input: JsonLdInput): ReadonlyArray<JsonLdNode> {
  assertAbsoluteHttps(input.canonicalUrl, "canonicalUrl");
  const nodes: JsonLdNode[] = [
    {
      "@type": "WebSite",
      "@id": uri(input.canonicalUrl, "website"),
      name: input.siteName,
      url: input.canonicalUrl,
      inLanguage: input.documentLanguage,
    },
    {
      "@type": "Organization",
      "@id": uri(input.canonicalUrl, "organization"),
      name: input.siteName,
      url: input.canonicalUrl,
    },
  ];

  if (input.breadcrumbs !== undefined && input.breadcrumbs.length > 0) {
    nodes.push({
      "@type": "BreadcrumbList",
      "@id": uri(input.canonicalUrl, "breadcrumbs"),
      itemListElement: input.breadcrumbs.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: b.name,
        item: b.url,
      })),
    });
  }

  if (input.place !== undefined) {
    nodes.push({
      "@type": "Place",
      "@id": uri(input.canonicalUrl, "place"),
      name: input.place.name,
      geo: {
        "@type": "GeoCoordinates",
        latitude: input.place.latitude,
        longitude: input.place.longitude,
      },
    });
  }

  if (input.faq !== undefined && input.faq.length > 0) {
    nodes.push({
      "@type": "FAQPage",
      "@id": uri(input.canonicalUrl, "faq"),
      mainEntity: input.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  if (input.article !== undefined) {
    const art = input.article;
    if (art.image !== null) assertAbsoluteHttps(art.image, "article.image");
    nodes.push({
      "@type": "Article",
      "@id": uri(input.canonicalUrl, "article"),
      headline: art.headline,
      author: { "@type": "Organization", name: art.author },
      datePublished: art.datePublished,
      dateModified: art.dateModified,
      image: art.image,
      url: input.canonicalUrl,
      inLanguage: input.documentLanguage,
    });
  }

  return nodes;
}

const FORBIDDEN_KEY_RE = /secret|api[_-]?key|password|internal[_-]?id|token|authorization/i;

export interface JsonLdValidation {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
}

/**
 * Validate a JSON-LD graph: every node has a `@type` and stable `@id`,
 * no node carries a secret/internal identifier key, and at least one node
 * references the canonical URL (SEO-STRUCTURED-001).
 */
export function validateJsonLd(
  graph: ReadonlyArray<JsonLdNode>,
  canonicalUrl: string,
): JsonLdValidation {
  const errors: string[] = [];
  let referencesCanonical = false;

  for (const node of graph) {
    if (typeof node["@type"] !== "string" || node["@type"].length === 0) {
      errors.push("node_missing_type");
    }
    if (typeof node["@id"] !== "string" || node["@id"].length === 0) {
      errors.push("node_missing_id");
    }
    for (const key of Object.keys(node)) {
      if (FORBIDDEN_KEY_RE.test(key)) errors.push(`forbidden_key:${key}`);
    }
    const url = node["url"];
    if (typeof url === "string" && url === canonicalUrl) referencesCanonical = true;
    const sameAs = node["sameAs"];
    if (typeof sameAs === "string" && sameAs === canonicalUrl) referencesCanonical = true;
  }

  if (!referencesCanonical) errors.push("no_canonical_reference");
  return { valid: errors.length === 0, errors };
}

/** Serialize a JSON-LD graph into a `<script type="application/ld+json">` tag. */
export function toJsonLdScript(graph: ReadonlyArray<JsonLdNode>): string {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  })}</script>`;
}

// ---------------------------------------------------------------------------
// Sitemap, sitemap index, and robots (SEO-SITEMAP-001)
// ---------------------------------------------------------------------------

export interface SitemapEntry {
  /** Absolute https canonical URL that already passes the quality gate. */
  readonly url: string;
  /** Included only when visible primary content changed meaningfully. */
  readonly lastmod?: string;
  readonly changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  readonly priority?: number;
  /** Caller ensures only canonical URLs that pass the gate are included. */
  readonly indexable: boolean;
}

const XML_ESCAPE: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
});

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (ch) => XML_ESCAPE[ch] ?? ch);
}

/**
 * Build a bounded sitemap XML (SEO-SITEMAP-001). Only `indexable` entries
 * are emitted; duplicate canonical URLs are removed; `lastmod` is included
 * only when the caller supplies it (a routine full-site timestamp refresh is
 * forbidden). Every URL must be absolute https.
 */
export function buildSitemap(entries: ReadonlyArray<SitemapEntry>): string {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const entry of entries) {
    if (!entry.indexable) continue;
    assertAbsoluteHttps(entry.url, "sitemap entry url");
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);

    const loc = `    <loc>${escapeXml(entry.url)}</loc>`;
    const lastmod = entry.lastmod !== undefined ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
    const changefreq =
      entry.changefreq !== undefined
        ? `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`
        : "";
    const priority =
      entry.priority !== undefined ? `    <priority>${entry.priority}</priority>` : "";
    urls.push(`  <url>\n${loc}\n${lastmod}${changefreq}${priority}  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls.join("\n")}\n` +
    `</urlset>`;
}

/** Build a sitemap index partitioning eligible canonical URLs by type/locale. */
export function buildSitemapIndex(partitions: ReadonlyArray<{ readonly loc: string }>): string {
  const items = partitions
    .map((p) => {
      assertAbsoluteHttps(p.loc, "sitemap index loc");
      return `  <sitemap>\n    <loc>${escapeXml(p.loc)}</loc>\n  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${items}\n` +
    `</sitemapindex>`;
}

/**
 * Robots directives: advertise the sitemap index and use crawl blocks only for
 * non-discovery surfaces (never as a substitute for required page-level
 * `noindex`). Admin, preview, and API are excluded from discovery.
 */
export function buildRobots(sitemapIndexUrl: string): string {
  assertAbsoluteHttps(sitemapIndexUrl, "sitemapIndexUrl");
  return [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /preview",
    "Disallow: /api/",
    `Sitemap: ${sitemapIndexUrl}`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Editorial content (SEO-CONTENT-001)
// ---------------------------------------------------------------------------

export interface ArticleSourceInput {
  readonly author: string;
  readonly datePublished: string;
  readonly dateModified: string;
  readonly hasQualifiedSources: boolean;
}

export interface ArticleSourceCheck {
  readonly reviewed: boolean;
  readonly reasons: ReadonlyArray<string>;
}

/**
 * Verify an article carries author/reviewer attribution, publication and
 * modification dates, and qualified sources before it may be indexed
 * (SEO-CONTENT-001).
 */
export function validateArticleSources(input: ArticleSourceInput): ArticleSourceCheck {
  const reasons: string[] = [];
  if (input.author.trim().length === 0) reasons.push("missing_author");
  if (Number.isNaN(Date.parse(input.datePublished))) reasons.push("invalid_date_published");
  if (Number.isNaN(Date.parse(input.dateModified))) reasons.push("invalid_date_modified");
  if (!input.hasQualifiedSources) reasons.push("no_qualified_sources");
  return { reviewed: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Route rendering matrix (ARCH-RENDER-001)
// ---------------------------------------------------------------------------

export type RenderMode = "SSG" | "ISR" | "SSR" | "Dynamic";

export interface RenderModeInfo {
  readonly mode: RenderMode;
  /** Seconds between revalidation; null means rebuild-on-release / no persistent prerender. */
  readonly revalidateSeconds: number | null;
  /** Whether the shared/CDN cache may store the response. */
  readonly cacheable: boolean;
}

/**
 * The single route-rendering matrix (ARCH-RENDER-001). Every row's exact
 * mode and default update/invalidation behavior lives here and nowhere else.
 */
export const ROUTE_RENDER_MATRIX: Readonly<Record<RouteClass, RenderModeInfo>> = Object.freeze({
  methodology: { mode: "SSG", revalidateSeconds: null, cacheable: true },
  homepage: { mode: "ISR", revalidateSeconds: 3600, cacheable: true },
  country: { mode: "ISR", revalidateSeconds: 3600, cacheable: true },
  city: { mode: "ISR", revalidateSeconds: 3600, cacheable: true },
  ranking: { mode: "ISR", revalidateSeconds: 3600, cacheable: true },
  seasonal: { mode: "ISR", revalidateSeconds: 3600, cacheable: true },
  article: { mode: "SSG", revalidateSeconds: null, cacheable: true },
  compare: { mode: "ISR", revalidateSeconds: 3600, cacheable: true },
  explore: { mode: "SSR", revalidateSeconds: 3600, cacheable: true },
  search: { mode: "SSR", revalidateSeconds: null, cacheable: false },
  admin: { mode: "Dynamic", revalidateSeconds: null, cacheable: false },
  api: { mode: "Dynamic", revalidateSeconds: null, cacheable: false },
  preview: { mode: "Dynamic", revalidateSeconds: null, cacheable: false },
});

/** Resolve the rendering mode + revalidation for a route class (ARCH-RENDER-001). */
export function routeRenderMode(routeClass: RouteClass): RenderModeInfo {
  return ROUTE_RENDER_MATRIX[routeClass];
}
