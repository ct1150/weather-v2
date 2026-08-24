# Weather V2 Growth Dashboard V1

## Goal

Validate the active country-first product with real anonymous behavior before enabling Affiliate
offers or changing the public brand domain.

## Funnel

```text
Acquisition
homepage weather view
→ country click

Activation
country map view
→ city interaction

Decision
city interaction
→ city detail open

Retention intent
country map view
→ destination shortlist
```

The dashboard reports 7-day and 28-day windows. It does not create a user/session/device identifier,
so it deliberately does not claim cohort retention, unique users or session conversion.

## Working validation gate

The 28-day gate is intended to answer one question: **is there enough evidence to start a small
monetization experiment?**

- sample: at least 300 homepage weather views;
- country selection rate: at least 20%;
- country-map city interaction rate: at least 30%;
- city-detail-open rate: at least 15%;
- shortlist intent rate: at least 5%.

These are founder working thresholds, not external benchmarks. `ready_for_monetization_test` requires
sufficient sample plus at least four of five checks. Until then Affiliate may remain configured but
zero-fill, and domain migration remains deferred.

## Security

`/growth` is served by the product-analytics Worker, not the public static site. It is disabled when
`GROWTH_DASHBOARD_PASSWORD` is absent or shorter than 12 characters. When enabled it uses HTTP Basic
authentication, returns no-store responses and marks HTML noindex/nofollow.

## Acceptance

- 7-day and 28-day aggregates come only from `wnr_product_events_v1`;
- country and city rankings use bounded IDs already allowed by analytics;
- City Detail opens are distinguishable from in-map city interactions by route template;
- Affiliate events and revenue do not participate in the pre-monetization gate;
- missing dashboard password cannot weaken or block product analytics collection;
- normal format, lint, typecheck, tests, web build, Worker build and secret scan remain green.
