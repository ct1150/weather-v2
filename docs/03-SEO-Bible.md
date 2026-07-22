---
title: SEO Bible
authority: SEO
status: Active
last_updated: 2026-07-17
---

# SEO Bible

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Page signals

<!-- requirement
id: SEO-PAGE-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-SEO_PAGE_001
owner: SEO
verification: pnpm docs:check
-->

<a id="SEO-PAGE-001"></a>

### SEO-PAGE-001 — Unique page metadata and canonical signals

Every public index candidate provides a unique title and description, canonical URL, Open Graph metadata, Twitter Card metadata, document language, applicable locale alternates, breadcrumb context, visible update or publication time, qualified data-source context, crawlable primary content, and meaningful internal links.

English is the unprefixed locale. Localized alternates use their approved locale prefixes, preserve stable ASCII destination slugs, include a self-referencing alternate, and include `x-default` where the locale set has a default destination.

Roadmap: [REL-MVP-SEO_PAGE_001](11-Roadmap.md#REL-MVP-SEO_PAGE_001).

#### Acceptance Criteria

- Titles and descriptions identify the page's actual destination, theme, time context, or editorial subject and are not duplicates produced by swapping a city name into otherwise identical text.
- Every index candidate emits one absolute self-consistent canonical URL; alternate host, locale, parameter, and reverse-comparison forms do not compete with it.
- `hreflang` links are bidirectional across available translations, use valid locale codes, point to canonical localized URLs, and omit nonexistent translations.
- Open Graph and Twitter values match visible page identity and do not claim unavailable weather, prices, reviews, or images.
- Primary decision content, update context, and source context are available to a crawler without requiring a map interaction.
- Breadcrumbs and internal links reflect valid information-architecture parents and do not link to inactive or fabricated destinations.

<!-- requirement
id: SEO-STRUCTURED-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-SEO_STRUCTURED_001
owner: SEO
verification: pnpm docs:check
-->

<a id="SEO-STRUCTURED-001"></a>

### SEO-STRUCTURED-001 — Visible-content structured data

Structured data uses only schema types that match the page and its visible content. Applicable types are `WebSite`, `Organization`, `BreadcrumbList`, `Place`, `FAQPage`, and `Article`. Structured data is a machine-readable projection of the page, not a place to add invisible claims.

Roadmap: [REL-MVP-SEO_STRUCTURED_001](11-Roadmap.md#REL-MVP-SEO_STRUCTURED_001).

#### Acceptance Criteria

- Every JSON-LD entity has a stable identity and values consistent with the canonical URL, document language, visible title, and visible content.
- `BreadcrumbList` contains the same valid hierarchy and labels available to users.
- `Place` facts come from the page's qualified destination data and do not include invented ratings, prices, opening states, or attractions.
- `FAQPage` includes only questions and answers visibly rendered on that page and excludes generic city-name-swapped FAQ text.
- `Article` uses the visible headline, author or reviewer attribution, publication and modification dates, image where available, and canonical article URL.
- Review, rating, and Event schema are absent unless the page visibly contains eligible first-party data that satisfies the applicable schema policy.
- Generated JSON-LD is syntactically valid, contains no secrets or internal identifiers, and is tested against representative page data and missing optional fields.

## Programmatic quality

<!-- requirement
id: SEO-QUALITY-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-SEO_QUALITY_001
owner: SEO
verification: pnpm docs:check
-->

<a id="SEO-QUALITY-001"></a>

### SEO-QUALITY-001 — Programmatic page quality gate

A programmatic country, city, ranking, seasonal, comparison, or intent page becomes an index candidate only when all applicable quality conditions pass. The gate requires an active underlying entity, acceptable freshness and confidence, unique visible primary content, at least one useful weather or destination summary, an explanation of the score or page purpose, and meaningful valid internal links.

Comparison pages additionally require a precomputed approved pair. Theme and seasonal pages additionally require a sufficient candidate set, a valid implemented model or qualified seasonal evidence, and a unique explanation. City weather or travel intent variants must add independently useful content rather than duplicate the canonical city page.

Roadmap: [REL-MVP-SEO_QUALITY_001](11-Roadmap.md#REL-MVP-SEO_QUALITY_001).

#### Acceptance Criteria

- Indexability is the conjunction of every applicable condition; one failed required condition fails the gate.
- Missing, stale beyond policy, low-confidence, inactive, or unsupported entities do not pass by substituting placeholder or generated prose.
- A page fails when its body is materially a duplicate template with only a destination or theme token changed.
- Rankings and theme pages fail when candidate coverage is too small or their explanation cannot state a real method, time, and coverage context.
- Failed pages use the indexability outcome defined by SEO-INDEXABILITY-001 and are excluded from sitemap inclusion.
- Gate decisions are deterministic for the same qualified inputs, expose a machine-testable reason, and are covered by positive and negative test fixtures.

## Discovery feeds

<!-- requirement
id: SEO-SITEMAP-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-SEO_SITEMAP_001
owner: SEO
verification: pnpm docs:check
-->

<a id="SEO-SITEMAP-001"></a>

### SEO-SITEMAP-001 — Sitemap and crawler discovery

A sitemap index partitions eligible canonical URLs by page type and locale so individual sitemap files remain bounded and operable. Sitemap generation consumes the canonical page registry and the SEO quality and indexability outcomes rather than enumerating every route permutation.

Roadmap: [REL-MVP-SEO_SITEMAP_001](11-Roadmap.md#REL-MVP-SEO_SITEMAP_001).

#### Acceptance Criteria

- Only canonical URLs that currently pass the applicable quality gate and permit indexing are included.
- Search results, arbitrary filter or query combinations, Admin, API, preview, draft, unreviewed article, and failed-quality URLs are excluded.
- `lastmod` changes only when visible primary weather context, ranking output, destination content, or editorial content changes meaningfully; a routine full-site timestamp refresh is forbidden.
- Removed, redirected, inactive, or newly noindexed URLs leave the next generated sitemap set.
- Every sitemap and the sitemap index contain valid absolute URLs, correct locale partitioning, valid XML, and no duplicate canonical URL.
- Robots directives advertise the sitemap index and do not use crawling blocks as a substitute for required page-level `noindex` handling.

## Editorial quality

<!-- requirement
id: SEO-CONTENT-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-SEO_CONTENT_001
owner: SEO
verification: pnpm docs:check
-->

<a id="SEO-CONTENT-001"></a>

### SEO-CONTENT-001 — Reviewed, sourced, and safe content

Editorial and programmatic prose must provide useful travel-decision value and retain evidence for factual weather, seasonal, destination, price, availability, and safety claims. AI or automation may assist drafting and linking but cannot publish factual travel or safety content without human or explicitly approved editorial review.

Weather-led editorial types may include Best Weather This Week, Weekend Destinations, Cherry Blossom Weather, Autumn Foliage, Beach Guides, Travel by Month, and Rainy Season Guides. Editors may override automatically suggested city links.

Roadmap: [REL-MVP-SEO_CONTENT_001](11-Roadmap.md#REL-MVP-SEO_CONTENT_001).

#### Acceptance Criteria

- A public article identifies its author or reviewer, publication or modification date, and qualified sources for weather, seasonal, event, price, availability, and safety facts.
- Weather and seasonal assertions display an update time and do not extend beyond the capability or confidence of their source.
- Typhoon, disaster, closure, extreme-weather, and other high-risk content prioritizes official government, meteorological, destination, or emergency sources and includes a clear non-emergency-service statement.
- Assisted drafts receive review for factual support, misleading certainty, duplication, harmful travel advice, and source validity before publication.
- Materially changed or expired evidence triggers review, correction, noindex, or withdrawal rather than preserving a stale claim for traffic.
- Automatically proposed city and article links are relevant, valid, deduplicated, and editable by a reviewer.
- Unreviewed drafts, mass city-name substitutions, unsupported safety conclusions, and fabricated prices, reviews, events, or destination facts are never published.

## Indexability policy

The table below owns only indexability and quality. It contains no rendering mode, revalidation, invalidation, fallback, TTL, or cache-header fields; those remain solely in [ARCH-RENDER-001](05-System-Architecture.md#ARCH-RENDER-001).

| Route class                                       | Indexability                                 | Required quality outcome                                                                                   |
| ------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Methodology, legal, and stable marketing pages    | `index,follow` after gate                    | Unique complete purpose, current policy content, metadata, and valid links                                 |
| Homepage, country, city, and weather-led rankings | `index,follow` after gate                    | Active qualified data, unique decision content, update/source context, and valid internal links            |
| Seasonal and other theme landings                 | `index,follow` after gate                    | Qualified evidence or implemented model, sufficient candidates, and unique explanation                     |
| Published articles                                | `index,follow` after gate                    | Human-reviewed canonical article with qualified sources and complete editorial metadata                    |
| Approved city comparisons                         | `index,follow` after gate                    | Precomputed allowlisted pair, substantive comparison, canonical ordering, and valid data                   |
| Weather Explorer stable page                      | Stable page may be `index,follow` after gate | Crawlable explanatory content and destination links; filter states do not become separate index candidates |
| Search results and arbitrary query/filter states  | `noindex,follow`                             | Canonicalize to the stable page where appropriate; never treat free-text results as landing pages          |
| Admin and preview pages                           | `noindex`                                    | No public discovery or sitemap inclusion; access controls remain separately required                       |
| API and other non-HTML resources                  | Not an HTML index candidate                  | No sitemap inclusion and no claim of page quality                                                          |

<!-- requirement
id: SEO-INDEXABILITY-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-SEO_INDEXABILITY_001
owner: SEO
verification: pnpm docs:check
-->

<a id="SEO-INDEXABILITY-001"></a>

### SEO-INDEXABILITY-001 — Bounded canonical index surface

The index surface is an explicit set of stable, canonical, quality-approved pages. Search results, arbitrary filters, tracking parameters, preview and draft states, operational surfaces, APIs, reverse comparison forms, and unsupported destination-theme combinations do not create independent index candidates.

Roadmap: [REL-MVP-SEO_INDEXABILITY_001](11-Roadmap.md#REL-MVP-SEO_INDEXABILITY_001).

#### Acceptance Criteria

- A page is `index,follow` only when its route class permits indexing and SEO-QUALITY-001 passes; otherwise it is `noindex,follow`, `noindex`, redirected, or not generated as specified by the route class.
- Search and arbitrary query results are `noindex,follow`; stable filter parameters canonicalize to the appropriate stable landing page, and tracking parameters never alter canonical identity.
- Admin and preview HTML use `noindex`; API resources are excluded from HTML indexing and all sitemap sets.
- A reverse valid comparison permanently resolves to the one canonical pair order, while non-allowlisted or same-city comparisons are not index candidates.
- Locale alternates are indexable only when their localized visible content passes the same quality gate; unavailable translations are omitted rather than mapped to unrelated content.
- Noindex, canonical, hreflang, internal-link, and sitemap outcomes remain mutually consistent for each registered URL.
- Indexability tests cover every table row and both passing and failing quality outcomes without asserting or duplicating rendering or cache behavior.
