---
title: Founder Vision
authority: Vision
status: Active
last_updated: 2026-07-17
---

# Founder Vision

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Product identity and position

<!-- requirement
id: VISION-POSITION-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-VISION_POSITION_001
owner: Vision
verification: pnpm docs:check
-->

<a id="VISION-POSITION-001"></a>

### VISION-POSITION-001 — Travel Decision Engine positioning

The product name is **Where Not Rain**, its slogan is **“Find Sunshine. Plan Better.”**, and its category is a weather-driven travel discovery platform. It is a **Travel Decision Engine**, not a traditional city-by-city weather lookup site: the experience helps travelers discover where conditions are best and move from discovery through an informed travel decision.

Roadmap: [REL-MVP-VISION_POSITION_001](11-Roadmap.md#REL-MVP-VISION_POSITION_001).

#### Acceptance Criteria

- Public product identity uses Where Not Rain and “Find Sunshine. Plan Better.” unless an approved brand decision changes both the owning authority and affected product surfaces.
- Product descriptions distinguish destination decision support from a conventional weather lookup site.
- Claims about AI, weather, price, availability, or recommendation provenance are accurate and do not imply capabilities or evidence the product does not have.

## Market

<!-- requirement
id: VISION-MARKET-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-VISION_MARKET_001
owner: Vision
verification: pnpm docs:check
-->

<a id="VISION-MARKET-001"></a>

### VISION-MARKET-001 — Priority travel markets

Primary markets are Japan, South Korea, Singapore, Malaysia, Thailand, Vietnam, Indonesia, the Philippines, Hong Kong, and Taiwan. Secondary expansion regions are North America, Europe, and Australia. Product discovery, localization, destination coverage, and commercial evaluation must respect this ordering unless the Vision authority records an approved market change.

Roadmap: [REL-MVP-VISION_MARKET_001](11-Roadmap.md#REL-MVP-VISION_MARKET_001).

#### Acceptance Criteria

- Strategy and planning materials preserve all ten named primary markets and the three secondary expansion regions.
- Market prioritization is visible when deciding localization, destination coverage, content, and partner evaluation.
- A market-order change is documented in this authority rather than inferred from a one-off implementation decision.

## User value

<!-- requirement
id: VISION-VALUE-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-VISION_VALUE_001
owner: Vision
verification: pnpm docs:check
-->

<a id="VISION-VALUE-001"></a>

### VISION-VALUE-001 — Fast, explainable destination decisions

Where Not Rain helps a traveler answer: Where should I travel this weekend? Where is sunny? Which city has the best outdoor weather? Where should I avoid? The target journey replaces repeated city searches with regional discovery, comparable and explainable destination signals, a confident selection, and optional travel booking or activity steps.

Roadmap: [REL-MVP-VISION_VALUE_001](11-Roadmap.md#REL-MVP-VISION_VALUE_001).

#### Acceptance Criteria

- The core journey supports discovering multiple destinations before requiring a city choice.
- Recommendations expose enough weather suitability and risk reasoning for a user to understand the decision.
- Product proposals are rejected when they add complexity without improving a documented user decision or business priority.

## Success priorities

<!-- requirement
id: VISION-METRICS-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-VISION_METRICS_001
owner: Vision
verification: pnpm docs:check
-->

<a id="VISION-METRICS-001"></a>

### VISION-METRICS-001 — Measurable product outcomes

Every feature must improve at least one of the founder priorities: **SEO, conversion, retention, revenue, or performance**. Decision efficiency and content quality are supporting measures. The product establishes baselines before interpreting change and reviews trends rather than presenting unsupported success claims.

Roadmap: [REL-MVP-VISION_METRICS_001](11-Roadmap.md#REL-MVP-VISION_METRICS_001).

#### Acceptance Criteria

- Each feature proposal names at least one primary priority and an observable measure before implementation.
- The measurement set covers decision efficiency, SEO, retention, conversion, content engagement, revenue where applicable, and web performance.
- Reviews distinguish an established baseline from a target and do not fabricate prices, discounts, reviews, traffic, conversion, or recommendation evidence.

## Commercial evolution

<!-- requirement
id: VISION-BUSINESS-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-VISION_BUSINESS_001
owner: Vision
verification: pnpm docs:check
-->

<a id="VISION-BUSINESS-001"></a>

### VISION-BUSINESS-001 — Revenue-model narrative

Commercial evolution follows three narrative stages. First, establish useful audience discovery with privacy-conscious analytics and carefully controlled advertising. Next, add relevant transaction partnerships across lodging, activities, transport, connectivity, and travel protection when contractual, regional, disclosure, privacy, security, and performance checks pass. Later, evaluate paid decision-support products such as longer-horizon trends and assisted planning when evidence supports user value.

These stages describe revenue-model maturity only. They do not assign a product feature to a release, promise any provider integration, or authorize unsupported data claims; feature timing is owned solely by the Roadmap.

Roadmap: [REL-MVP-VISION_BUSINESS_001](11-Roadmap.md#REL-MVP-VISION_BUSINESS_001).

#### Acceptance Criteria

- Commercial surfaces remain subordinate to a useful and trustworthy travel-decision journey.
- A provider or premium concept is not treated as launched merely because it appears in this narrative.
- Any enabled commercial capability has explicit disclosure, lawful and authorized data, privacy review, performance controls, and a safe disable path in its owning domain contract.

## Cost and scale

<!-- requirement
id: VISION-COST-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-VISION_COST_001
owner: Vision
verification: pnpm docs:check
-->

<a id="VISION-COST-001"></a>

### VISION-COST-001 — Sustainable low-cost operation

Architecture and product choices prioritize scalability, low operating cost, mobile-first delivery, and compatibility with the Cloudflare Free plan. Free-plan compatibility is a design constraint, not permission to hard-code temporary quotas or compromise correctness, security, privacy, accessibility, or transparent degraded behavior.

Roadmap: [REL-MVP-VISION_COST_001](11-Roadmap.md#REL-MVP-VISION_COST_001).

#### Acceptance Criteria

- Proposed capabilities include a current cost and Cloudflare Free-plan compatibility check in the owning technical authority.
- Current provider quotas are revalidated before deployment and are not represented as permanent guarantees.
- When a capability cannot operate safely within the approved constraints, it is disabled or degraded transparently rather than shifted into an unbounded user-request dependency.
