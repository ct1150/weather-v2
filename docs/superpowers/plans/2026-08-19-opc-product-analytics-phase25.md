# OPC Phase 2.5 — Product funnel analytics

## Goal

Measure the current least-rain destination loop before adding more product surface:

```text
view → submit → result / no result → interact → select → save / reopen / share / recheck → commerce
```

## Scope

- dedicated `product-analytics` Cloudflare Worker;
- one allowlisted event per request;
- fixed D1 table `wnr_product_events_v1` in the existing Trip database;
- bounded dimensions for origin, transport, travel-time bucket, trip window, result counts and
  explicit weather-limit flags;
- saved-search, reopen, copy-link and calendar reminder events;
- versioned SQL queries for funnel, origin demand, zero-result diagnosis, retention and commerce;
- production health and deployment gates;
- automatic 90-day retention without another scheduled service.

The original implementation targeted Workers Analytics Engine. Production deployment showed that
the account-level Analytics Engine feature was not enabled and cannot be activated by Wrangler or
the existing deployment token. The storage adapter therefore uses the already-provisioned D1
service while preserving the same fixed projection and aggregate SQL contract. This avoids a
manual account prerequisite and starts validation without adding another database or vendor.

## Privacy boundary

The collector stores no account, email, IP, user/session/device identifier, raw URL, query string,
free text, saved-search URL, itinerary or precise location. Payloads are capped at 8 KiB, validated
by the shared analytics allowlist, accepted only from the canonical web origin and rejected when
stale or materially future-dated. The event table is isolated and is never joined to trip or user
records.

## Explicitly out of scope

- analytics dashboard;
- cross-day user identity or cohort fingerprinting;
- account or cookie-based attribution;
- email, Web Push or scheduled notification delivery;
- new destination, planning, collaboration or booking features.

## Validation gate

After release, freeze major product work until both conditions are met:

- at least 14 days of collection;
- at least 300 discovery views and 100 submitted discovery queries.

Phase 3 must be selected from measured evidence rather than implemented as a feature bundle.
