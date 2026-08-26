# Home decision positioning realignment

Date: 2026-08-25  
Status: Implemented direction  
Product: Where Not Rain

## Decision

Re-align the public acquisition experience with the long-lived Founder Vision and the OPC least-rain destination engine:

> Dates fixed. Where is it least likely to rain within reach?

The homepage is a product-orientation and acquisition page. Its primary action is the least-rain destination finder at `/discover`. The world weather map remains on the homepage as a secondary visual exploration layer rather than the primary product task.

## Why

The country-first homepage shipped on 2026-08-20 made the map itself the product. That is useful for browsing, but it weakens the distinctive user job and competes directly with generic weather-map products. The existing `/discover` implementation already contains the differentiated decision flow: starting hub, bounded reachability, dates, explicit weather limits, Top 3 rain-risk ranking and `destination_selected` measurement.

This change restores one coherent funnel without discarding the recent map investment.

## Product hierarchy

```text
homepage
→ choose dates / starting hub in /discover
→ reachable destination set
→ explicit hard limits
→ rain-risk ranking
→ Top 3
→ destination_selected
→ country/city weather evidence or post-selection commerce
```

Secondary exploration:

```text
homepage world map
→ country weather map
→ city daily weather
```

## Implemented changes

1. Homepage H1 and descriptions now state the dates-fixed / destination-open problem.
2. Homepage primary CTA points to localized `/discover`.
3. The world map remains directly below the hero and is explicitly labeled as secondary exploration.
4. Header primary navigation points to localized `/discover`.
5. `/discover` is restored from legacy/noindex to indexable primary product status in all three locales.
6. `/discover` is restored to the sitemap with complete hreflang alternates.
7. PWA start URL and shortcut point to `/discover`.
8. Homepage and discovery metadata/JSON-LD describe a weather-driven destination decision product instead of a generic world weather map.
9. Production smoke and regression contracts are updated so CI preserves this hierarchy.
10. Country and city maps remain indexable and unchanged as acquisition/evidence surfaces.

## Guardrails

- Rain remains the only ranking target.
- Reachability is eligibility, not a hidden score weight.
- Transport time may only break ties after dry score and forecast confidence.
- Wind and temperature remain explicit hard limits when selected.
- Commercial placement remains after explicit destination selection.
- Trips and advanced itinerary tools remain outside primary acquisition.
- No new runtime AI, booking, payment or live transport dependency is introduced.

## Supersession note

For homepage acquisition and primary product positioning, this document supersedes the 2026-08-20 country-first weather-map cutover. The country-weather-map PRD remains authoritative historical context for the country-map interaction itself, which is intentionally preserved.

The core product direction remains consistent with:

- `docs/00-Founder-Vision.md`
- `docs/superpowers/product/2026-08-19-founder-prd-opc-dry-destination-engine.md`
