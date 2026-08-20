# Founder PRD — Country Travel Weather Map

## Product definition

Where Not Rain is a country-first travel weather map for people who already have a country in mind but have not chosen the exact city, island or region.

```text
choose country
→ see popular destinations on one map
→ read weather icon + lower-rain days + temperature
→ tap a destination for the daily forecast
```

The product does not ask where the traveller is starting, how they will travel or how long the journey takes. It does not mix weather, distance and subjective preferences into an opaque score.

## Core job

> I am considering a country. Show me, at a glance, which popular places in that country have the more suitable weather during the next few days.

## Primary users

- travellers comparing cities or islands inside Japan, South Korea or Southeast Asia;
- flexible travellers whose exact destination changes with rain, heat or wind;
- people who want an answer in seconds rather than a multi-step trip-planning form;
- mobile users opening a shared link while discussing a trip.

## Active product surface

### Homepage

- one country selector;
- crawlable country cards;
- no origin, transport, budget, AI planner or Top 3 query form;
- direct navigation to a stable country page.

### Country map

- defaults to the next seven days;
- displays all supported popular destinations;
- every marker includes a weather icon, lower-rain-day count and temperature range;
- marker activation opens an inline daily forecast;
- supports next three days, next seven days, this weekend and a custom date range;
- supports optional hard limits for rain probability, wind and temperature;
- destinations outside a limit remain visible but become grey and explain why;
- URL preserves date, filters and selected destination for sharing.

### City page

- remains the detailed and SEO-friendly daily forecast;
- reached only after the user expresses interest in a map destination.

## Explicitly out of scope

- starting city and reachability;
- flight, rail or driving time;
- real-time fares, inventory or route search;
- global Top 3 destination ranking;
- opaque Travel Score as a country-map decision input;
- AI itinerary generation;
- group planning, comments or voting;
- account-gated access;
- booking or payment.

Legacy `/discover` and itinerary routes remain compatible for existing links but are removed from primary acquisition, PWA entry and sitemap expansion.

## Weather summary contract

A map marker is a time-window summary, not a claim that every hour has the same weather.

```text
weather symbol
lower-rain days / total selected days
temperature minimum–maximum
```

Daily details show condition, rain probability and temperature. A destination is considered a lower-rain day when expected precipitation is small or the probability-and-amount combination remains below the published conservative threshold.

## Optional limits

Limits are deterministic filters, not hidden score weights:

- highest daily rain probability;
- maximum wind speed;
- lowest overnight temperature;
- highest daytime temperature.

A failed limit never removes a destination from the map. The destination is greyed and the exact failed condition is shown.

## Product analytics

The active funnel becomes:

```text
homepage country-map view
→ country card / selector click
→ country map view
→ city marker or list click
→ city detail open
```

Existing privacy boundaries remain: no user identity, IP, email, free text, exact location, itinerary or raw URL is stored.

## North-star metric

**Country-map sessions that open at least one destination forecast.**

Supporting metrics:

- country selection rate;
- country-map marker interaction rate;
- number of destinations compared per country session;
- filter usage rate;
- city detail open rate;
- country-map share rate;
- time to first visible map result.

## Acceptance criteria

- a new visitor understands the single task without reading documentation;
- selecting a country is the only required interaction;
- the country map defaults to seven days with no submit button;
- all popular destinations remain visible;
- visible controls always have a deterministic effect;
- no active primary page asks for origin, transport or maximum travel time;
- English, Simplified Chinese and Traditional Chinese behave identically;
- country and city pages remain statically exported and crawlable;
- production smoke verifies all three locales and the analytics endpoint.
