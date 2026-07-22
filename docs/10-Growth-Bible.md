---
title: Growth Bible
authority: Growth
status: Active
last_updated: 2026-07-17
---

# Growth Bible

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Analytics events

<!-- requirement
id: GROW-ANALYTICS-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-GROW_ANALYTICS_001
owner: Growth
verification: pnpm docs:check
-->

<a id="GROW-ANALYTICS-001"></a>

### GROW-ANALYTICS-001 — Versioned allowlisted analytics events

Cloudflare Web Analytics is the default aggregate analytics capability. GA4 and Plausible are removable, disabled-by-default adapters and are not both enabled by default. Documentation of an adapter does not activate it.

Every custom event version `1` contains exactly these common required fields:

| Field            | Type and allowlist                                             |
| ---------------- | -------------------------------------------------------------- |
| `event_version`  | integer; exactly `1`                                           |
| `occurred_at`    | ISO-8601 UTC string ending in `Z`                              |
| `route_template` | bounded route-template string; never a raw URL or query string |
| `locale`         | `en` \| `ja` \| `ko` \| `zh-cn` \| `zh-tw`                     |

The exact event and additional-field allowlist is:

| Event name              | Additional required fields                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `search_submitted`      | `destination_key: string \| "other"`; `result_count: nonnegative integer`                                       |
| `search_result_clicked` | `destination_id: string`; `result_type: "city" \| "country" \| "article"`; `position: positive integer`         |
| `city_viewed`           | `city_id: string`; `country_code: ISO-3166-1 alpha-2 uppercase string`                                          |
| `country_viewed`        | `country_code: ISO-3166-1 alpha-2 uppercase string`                                                             |
| `ranking_viewed`        | `theme: Theme`; `window: Window`                                                                                |
| `ranking_city_clicked`  | `theme: Theme`; `window: Window`; `city_id: string`; `rank: positive integer`                                   |
| `affiliate_impression`  | `provider_id: string`; `category: CommercialCategory`; `placement: Placement`; `destination_id: string \| null` |
| `affiliate_clicked`     | `provider_id: string`; `category: CommercialCategory`; `placement: Placement`; `destination_id: string \| null` |
| `ad_impression`         | `network_id: string`; `placement: Placement`                                                                    |

`Theme` is exactly `general | outdoor | beach | walking | hiking | camping | family | photography | night_view | food_trip | shopping | theme_park | mountain`. `Window` is exactly `today | tomorrow | weekend | next_week`. `CommercialCategory` is exactly `hotel | activities | flights | sim | insurance | car_rental`. `Placement` is exactly `homepage | city_page | article | sidebar | between_sections`.

`destination_key` is emitted only after matching the approved city, country, or alias dictionary; unmatched user text becomes `other`. Raw search terms are never uploaded or persisted. Event schemas discard unknown fields, reject unknown event names, and reject unsupported event versions rather than accepting a best-effort shape. They also reject IP address, precise location, email, full User-Agent, cookie, credentials, and reversible user identifiers. Collection must not block navigation or core destination use.

Roadmap: [REL-MVP-GROW_ANALYTICS_001](11-Roadmap.md#REL-MVP-GROW_ANALYTICS_001).

#### Acceptance Criteria

- Schema fixtures accept each exact event with all common and event-specific fields and reject every missing field, wrong scalar type, enum outsider, negative count, and nonpositive position or rank.
- Events with a name outside the table, `event_version` other than integer `1`, or an unsupported future version are rejected; extra fields are discarded before storage or forwarding.
- Search fixtures emit a known dictionary key or `other` and prove raw unmatched search text never reaches an analytics payload, log, aggregate row, or adapter.
- Privacy fixtures reject IP, precise location, email, full User-Agent, cookie, credential, and reversible identifier fields.
- Navigation and core-use tests succeed when analytics is slow, disabled, unavailable, or rejects an event, with no duplicate default-adapter emission.

## Aggregate reporting

<!-- requirement
id: GROW-REPORT-001
status: Active
kind: Hard
roadmap_ref: REL-Beta-GROW_REPORT_001
owner: Growth
verification: pnpm docs:check
-->

<a id="GROW-REPORT-001"></a>

### GROW-REPORT-001 — Privacy-bounded Beta growth reports

Beta provides exactly two aggregate report contracts. Both aggregate by UTC calendar day, accept only fixed trailing windows of **7**, **28**, or **90** complete UTC days, use nonnegative integer metrics, and return no raw event or user-level row.

`top_pages` uses these dimensions and metric:

| Field            | Type and behavior                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `event_date`     | UTC calendar date in `YYYY-MM-DD`                                                                            |
| `route_template` | bounded known route-template string; unknown templates aggregate to `other`; raw query strings are forbidden |
| `page_type`      | `homepage \| country \| city \| ranking \| search \| explore \| compare \| article \| other`                 |
| `locale`         | `en \| ja \| ko \| zh-cn \| zh-tw \| th \| vi`                                                               |
| `page_views`     | nonnegative integer                                                                                          |

`acquisition_country` uses these dimensions and metrics:

| Field          | Type and behavior                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `event_date`   | UTC calendar date in `YYYY-MM-DD`                                                                          |
| `country_code` | ISO-3166-1 alpha-2 uppercase code, `ZZ` for unknown/unavailable country, or `other` for the privacy bucket |
| `visits`       | nonnegative integer                                                                                        |
| `page_views`   | nonnegative integer                                                                                        |

Country comes only from Cloudflare's anonymous country-level dimension; the report stores no IP, precise location, cookie, or reversible identifier. Invalid country values normalize to `ZZ`, not a guessed country. Before output or persistence of a reportable aggregate, any country grouping with count below the privacy minimum of **10** is merged into `other`; a country represented by the report uses `ZZ` for unknown source country and `other` only for privacy aggregation, so these meanings remain distinct. No API permits arbitrary date range, arbitrary dimension, or raw query grouping.

Roadmap: [REL-Beta-GROW_REPORT_001](11-Roadmap.md#REL-Beta-GROW_REPORT_001).

#### Acceptance Criteria

- UTC-boundary fixtures assign events immediately before and after midnight to the correct `event_date` without applying a viewer or destination time zone.
- Query validation accepts only 7, 28, and 90 complete UTC-day windows and rejects arbitrary ranges, dimensions, raw rows, and raw query-string grouping.
- `top_pages` contains only route template, page type, locale, and nonnegative `page_views`; unknown routes become `other` and no raw URL/query is retained.
- `acquisition_country` contains only valid uppercase ISO alpha-2, `ZZ`, or privacy bucket `other`, nonnegative `visits`, and nonnegative `page_views`; malformed or unavailable country input becomes `ZZ`.
- Privacy fixtures merge every applicable country grouping with a count below 10 into `other`, preserve a count of exactly 10, and prove that no IP, precise location, cookie, or reversible identifier is stored.

## Affiliate and advertising

<!-- requirement
id: GROW-AFF-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-GROW_AFF_001
owner: Growth
verification: pnpm docs:check
-->

<a id="GROW-AFF-001"></a>

### GROW-AFF-001 — Provider-neutral, disclosed Affiliate actions

Affiliate surfaces use a provider-neutral adapter and ViewModel; user-facing components do not depend on provider DTO fields. Categories are Hotel, Activities, Flights, SIM, Insurance, and Car Rental. A surface renders only from authorized, current, configured data and never invents price, availability, rating, discount, review, or recommendation evidence.

Every commercial recommendation and outbound action carries clear proximate disclosure in the active locale. Paid outbound links include `rel="sponsored"`; they also include `nofollow` where policy requires it and `noopener noreferrer` when a new browsing context is used. A click event is dispatched best-effort without blocking or delaying navigation and cannot change the destination.

Every adapter has an exact normalized HTTPS host allowlist. Stored and runtime targets must match the selected provider's allowed host and approved path policy after parsing and redirect resolution; caller-provided arbitrary redirect targets are rejected. The typed static configuration and emergency kill-switch behavior are owned by [ARCH-FLAG-001](05-System-Architecture.md#ARCH-FLAG-001). Affiliate remains optional: disabled, unavailable, invalid, or empty data removes the entire surface without reducing core weather content.

Roadmap: [REL-MVP-GROW_AFF_001](11-Roadmap.md#REL-MVP-GROW_AFF_001).

#### Acceptance Criteria

- Adapter contract tests swap two provider fixtures without changing the component or exposing provider-specific fields in its ViewModel.
- Locale and accessibility tests find a proximate understandable disclosure for every impression and outbound action.
- Link tests require `sponsored`, apply `nofollow` by policy, apply `noopener noreferrer` to a new context, and permit only normalized approved HTTPS hosts and paths.
- Slow, failed, rejected, or disabled analytics never blocks navigation, changes the destination, or emits duplicate click events.
- Disabled, unconfigured, invalid, unauthorized, stale, or empty Affiliate data renders no misleading recommendation, false commercial claim, dead control, or blank surface.

<!-- requirement
id: GROW-ADS-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-GROW_ADS_001
owner: Growth
verification: pnpm docs:check
-->

<a id="GROW-ADS-001"></a>

### GROW-ADS-001 — Bounded advertising placements with zero layout shift

Reusable advertising may appear only in the five canonical placements **Homepage**, **City Page**, **Article**, **Sidebar**, and **Between Sections**, represented by `homepage`, `city_page`, `article`, `sidebar`, and `between_sections` in configuration and analytics. No other placement name is accepted without changing this owning requirement.

Advertising is optional and subordinate to complete core content. The MVP control is typed static configuration with a global and supported placement kill switch under [ARCH-FLAG-001](05-System-Architecture.md#ARCH-FLAG-001), not dynamic segmentation or experimentation. Disabled, blocked, invalid, or no-fill state produces no blank block, label, control, or movement of already rendered content. An enabled creative uses a size-constrained responsive container and cannot overlay core controls or introduce CLS; a no-fill decision is resolved without resizing the laid-out page.

Roadmap: [REL-MVP-GROW_ADS_001](11-Roadmap.md#REL-MVP-GROW_ADS_001).

#### Acceptance Criteria

- Schema tests accept exactly Homepage, City Page, Article, Sidebar, and Between Sections canonical placements and reject an unknown placement.
- Global and per-placement static controls default safe, are evaluated server-side, and omit disabled ad code and markup rather than visually hiding an active integration.
- Disabled, blocked, invalid, and no-fill fixtures leave no blank reserved content block or unusable control and contribute exactly zero CLS.
- Filled responsive creatives stay within their placement, do not overlay or reorder core content, and contribute exactly zero CLS in representative viewport tests.
- Core discovery, weather, navigation, and accessibility journeys remain complete when every ad control is disabled.

## Candidate providers

<!-- requirement
id: GROW-PROVIDER-001
status: Active
kind: Hard
roadmap_ref: REL-V1-GROW_PROVIDER_001
owner: Growth
verification: pnpm docs:check
-->

<a id="GROW-PROVIDER-001"></a>

### GROW-PROVIDER-001 — Conditional V1 commercial candidate registry

The V1 candidate Adapter registry contains exactly:

| Candidate        | Category                                                |
| ---------------- | ------------------------------------------------------- |
| Google AdSense   | Advertising                                             |
| Booking          | Lodging Affiliate                                       |
| Agoda            | Lodging Affiliate                                       |
| Trip.com         | Travel Affiliate                                        |
| Klook            | Activities Affiliate                                    |
| KKday            | Activities Affiliate                                    |
| Expedia          | Travel Affiliate                                        |
| Rentalcars       | Car-rental Affiliate                                    |
| Airalo           | Connectivity Affiliate                                  |
| Travel Insurance | Insurance Affiliate category; provider not yet selected |

Registry presence means only that an adapter may be evaluated. It does not represent a signed contract, brand approval, regional availability, production activation, launch commitment, or promise that all candidates will be integrated. Each candidate can be rejected, deferred, or remain disabled independently.

Before enablement, a candidate must pass documented contract and brand-term review, regional availability, disclosure and `rel` policy, privacy and consent review, [ENG-PERF-001](09-Engineering-Handbook.md#ENG-PERF-001), security redirect/host allowlisting, authorized-data review, and a control available for that release. MVP optional surfaces use typed static configuration and emergency kill switches under [ARCH-FLAG-001](05-System-Architecture.md#ARCH-FLAG-001); V1 may additionally use the dynamic platform under [ARCH-FLAG-002](05-System-Architecture.md#ARCH-FLAG-002), but a dynamic assignment cannot override a static emergency disable.

Roadmap: [REL-V1-GROW_PROVIDER_001](11-Roadmap.md#REL-V1-GROW_PROVIDER_001).

#### Acceptance Criteria

- Registry validation contains all ten listed candidates with the exact category and no unapproved provider represented as enabled.
- Status output distinguishes candidate, reviewed, approved, configured, enabled, rejected, and deferred without treating candidate status as launch evidence.
- Every enabled candidate has current evidence for contract/brand, region, disclosure/rel, privacy/consent, performance, security allowlist, authorized data, and release-appropriate control gates.
- One candidate can be disabled or removed without affecting another candidate or core weather and destination use.
- Review language and release evidence make no commitment to integrate all candidates and no claim that an unevaluated candidate is available.

## Experiments

<!-- requirement
id: GROW-EXPERIMENT-001
status: Active
kind: Hard
roadmap_ref: REL-V1-GROW_EXPERIMENT_001
owner: Growth
verification: pnpm docs:check
-->

<a id="GROW-EXPERIMENT-001"></a>

### GROW-EXPERIMENT-001 — V1 hypothesis-led, privacy-safe experiments

A/B experiments begin only with the V1 dynamic Feature Flag platform in [ARCH-FLAG-002](05-System-Architecture.md#ARCH-FLAG-002). MVP has only typed static configuration and emergency kill switches under [ARCH-FLAG-001](05-System-Architecture.md#ARCH-FLAG-001); it performs no audience segmentation, percentage rollout, live experiment assignment, or remotely mutable per-request treatment. A static emergency disable always overrides a V1 dynamic assignment.

Before exposure, each experiment record defines a stable experiment and version ID, falsifiable hypothesis, control and treatment, eligible audience, deterministic assignment unit, allocation, **one primary metric**, guardrail metrics, UTC start date/time, UTC end date/time, minimum sample or decision rule, owner, stop condition, and rollback control. Assignment and analysis use only approved allowlisted event fields and collect no extra personal information.

Control and treatment use the same canonical URL and indexability outcome. Experiments do not create query-parameter or path variants for indexing, change canonical or hreflang identity, cloak crawler content, block core cached weather reads, or publish unsupported commercial, safety, price, or destination claims. Results record exposure validity, primary and guardrail outcomes, limitations, and the ship/stop/iterate decision; ending an experiment removes stale assignment code and retains only approved aggregate evidence.

Roadmap: [REL-V1-GROW_EXPERIMENT_001](11-Roadmap.md#REL-V1-GROW_EXPERIMENT_001).

#### Acceptance Criteria

- The MVP configuration schema and runtime contain no dynamic segmentation, percentage rollout, live experiment assignment, or remote per-request mutation.
- Every V1 experiment fixture is rejected unless hypothesis, variants, audience, deterministic assignment, allocation, one primary metric, guardrails, UTC dates, sample/decision rule, owner, stop condition, and rollback control are complete.
- Repeated evaluation for the same experiment version, subject, and context yields the same assignment, while failure or unknown configuration is disabled and a static kill switch wins.
- SEO tests prove both variants retain one canonical URL, hreflang and indexability outcome and create no indexable path/query variant or crawler cloaking.
- Privacy schemas prove experiment assignment adds no field or PII beyond approved analytics allowlists, and core weather reads remain available when dynamic evaluation fails.
- Closure evidence records aggregate outcomes, limitations, decision, and cleanup of stale treatment code without claiming that an experiment requires or guarantees launch.
