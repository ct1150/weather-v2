# Founder PRD — OPC least-rain destination engine

Date: 2026-08-19  
Status: Product-owner approved implementation direction  
Product: Where Not Rain

## 1. Product thesis

Where Not Rain is an automated decision tool for travellers whose dates are fixed but destination is still open.

> **Dates fixed. Where is it least likely to rain within reach?**

The product does one job: compare supported destinations for the selected dates and return a **Top 3** shortlist ordered by rain risk.

## 2. OPC operating model

The product must remain suitable for a one-person company:

- automated weather ingestion and static/read-only delivery;
- bounded geography and forecast horizon;
- no user-content moderation requirement;
- no live booking, payment or customer-service operation;
- no dependency on LLM itinerary quality;
- no full collaborative itinerary platform;
- monetization only after the user chooses a destination.

## 3. Core user

A traveller planning within the next 14 days who already knows:

- when they can travel;
- roughly how long the trip is;
- that the destination may change;
- that rain materially affects the choice.

## 4. Core job

```text
choose travel dates
→ optionally apply explicit weather limits
→ receive Top 3 least-rain destinations
→ compare daily weather
→ choose one destination
→ open booking links or enable reminders
```

## 5. Ranking contract

**Rain is the only ranking target.**

The dry score may use:

- average daily rain probability;
- average precipitation amount;
- a bounded surcharge for one severe rain day;
- forecast data completeness and confidence.

The dry score must not silently include:

- wind;
- temperature;
- UV;
- family or senior profiles;
- beach or outdoor preferences;
- commercial value;
- live prices.

## 6. Optional hard limits

Users may explicitly exclude destinations using:

- maximum daily rain probability;
- maximum wind speed;
- minimum night temperature;
- maximum daytime temperature.

A destination that violates any selected limit is excluded rather than receiving an opaque score penalty.

## 7. Output contract

The primary result contains no more than three destinations. Each destination shows:

- dry score;
- peak rain probability;
- daily weather;
- temperature range;
- wind and UV cautions;
- forecast freshness;
- selection and comparison actions.

## 8. Selection and commerce

Ranking and affiliate value are strictly separated.

Commercial actions may appear only after the user selects a destination. The first conversion event is `destination_selected`, not trip creation or account registration.

## 9. Advanced tools

Existing Trips, collaboration, route optimization, execution mode and adaptive replanning remain reachable for existing users but are:

- removed from primary navigation;
- removed from the public sitemap;
- marked `noindex` at the Trips landing page;
- frozen from new product expansion until the core decision funnel is validated.

## 10. Explicit non-goals

- general AI travel assistant;
- full collaborative itinerary platform;
- complete POI and opening-hours database;
- live flight, rail, hotel or ticket inventory;
- real-time price-aware budget engine;
- OTA checkout or payment;
- community, reviews or travel feed;
- global coverage before supported regional demand is validated.

## 11. North-star metric

**Weekly valid destination selections**:

```text
valid dates submitted
→ Top 3 returned
→ one destination selected
```

Supporting metrics:

- query completion rate;
- no-result rate;
- Top 3 detail click-through;
- destination selection rate;
- shortlist share rate;
- post-selection commercial click rate;
- reminder opt-in and return rate.
