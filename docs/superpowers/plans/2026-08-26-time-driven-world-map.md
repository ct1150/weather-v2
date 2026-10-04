# Time-driven world map cutover

Date: 2026-08-26  
Status: Implemented direction  
Product: Where Not Rain

## Decision

Make the homepage itself the core product and reduce the first decision to one thing: **when do you want to travel?**

```text
choose time
→ this weekend / next 7 days / custom forecast dates
→ world map updates
→ country ranking updates
→ open a country
→ compare cities
```

Starting city, transport mode and maximum one-way planning time are removed from primary acquisition. They remain available only in the advanced `/discover` compatibility route.

## Why

The origin/reachability flow introduces configuration before the user receives any weather value. For the primary Where Not Rain job, reachability is not necessary to answer the first question:

> During the dates I can travel, where is it less likely to rain?

The world map already provides the strongest visual answer. Making the selected forecast window drive the map removes an extra decision layer and makes the product immediately understandable.

## Homepage interaction

Default preset:

- next 7 days

Additional presets:

- this weekend, resolved from actual forecast calendar dates
- custom dates, constrained to the available forecast window

The selected period drives both:

- world-map country colors and preview cards
- the country strip below the map

No origin, transport or travel-time input appears in the homepage path.

## Rain-window semantics

A city day is treated as mostly rain-free when:

1. the forecast condition is a dry-compatible condition;
2. the condition is not explicit rain, drizzle, shower, thunder, hail, snow or sleet;
3. expected precipitation is at most 0.5 mm when precipitation amount is available;
4. rain probability at most 35% is used only as the fallback when precipitation amount is unavailable.

For each selected time window:

1. compute each city's mostly-rain-free-day percentage;
2. rank cities by dry-day percentage descending;
3. break ties by lower total expected precipitation;
4. then by lower peak rain chance;
5. use the best three cities to summarize the country;
6. country score is the mean dry-day percentage of those best three cities.

This intentionally answers whether a country contains good travel options instead of averaging every supported city.

## Acquisition hierarchy

Primary:

```text
homepage time window
→ world map
→ country map
→ city weather
```

Secondary SEO entry points remain:

- weekly least-rain rankings
- weekend rankings
- country weather maps
- city weather pages

Advanced compatibility:

- `/discover` remains reachable for saved/direct links
- `/discover` is `noindex`
- `/discover` is removed from sitemap, Header primary navigation and PWA start URL

## Guardrails

- Time is the only required homepage input.
- The map and country strip must use the same selected dates.
- Do not hide supported countries because weather is poor.
- Rain-window scoring must remain explainable from daily forecasts.
- Country and city maps remain crawlable.
- Advanced itinerary and reachability features must not leak back into primary acquisition without a new product decision.
- No new live provider dependency is introduced into the browser path.

## Supersession

For primary homepage acquisition and product positioning, this document supersedes:

- `docs/superpowers/plans/2026-08-25-home-decision-positioning.md`
- the `/discover`-first interpretation of `docs/superpowers/product/2026-08-19-founder-prd-opc-dry-destination-engine.md`

Those documents remain historical context for the advanced reachability engine and earlier cutovers.
