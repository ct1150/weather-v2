# ADR-001: Tiered six-hour weather ingestion

- Status: Accepted
- Date: 2026-08-05
- Supersedes: `ARCH-DATAFLOW-001`, `DEP-CICD-001` only where they require an hourly schedule and full hourly persistence for every enabled city

## Context

The destination map expands from seven public cities to 36 in phase one and approximately 62 in phase two. Persisting seven daily rows, 168 hourly rows, scores and indexed ranking rows for every city every hour approaches or exceeds Cloudflare D1 Free daily written-row capacity before useful regional coverage is reached. The public country decision map uses date-range daily aggregates; it does not need seven days of hourly rows for every destination.

## Decision

Weather ingestion runs every six hours at minute 17. Every active city receives seven complete daily rows and daily score inputs. Only the curated featured set receives hourly rows, limited to the next two city-local days. Candidate snapshots remain immutable, retain the frozen enabled/featured scope, pass the existing coverage gate, and use the existing fenced pending-to-active publication protocol.

The public static build remains on the same six-hour cadence. A later feature may expand hourly coverage only after a dated free-plan budget review proves adequate margin.

## Alternatives considered

- Keep hourly full-city ingestion and limit the catalogue to roughly ten cities: rejected because it defeats the country-map travel decision value.
- Remove D1 and use only build-time weather: rejected because it removes the existing authoritative publication and recovery path.
- Move to a paid Cloudflare plan: rejected because the product contract requires a free-plan-compatible core.
- Store hourly rows for every city but delete them aggressively: rejected because write quota, not only storage, is the immediate constraint.

## Consequences

- Country range comparisons retain full seven-day coverage for all cities.
- Hourly city detail is available only for featured destinations and the next 48 hours; other hourly requests truthfully return unavailable instead of fabricated data.
- Forecast freshness changes from at most roughly one hour to at most roughly six hours.
- The implementation has substantial D1 write and provider-request safety margin for the phase-one catalogue.

## Cloudflare Free-plan impact

Review date: 2026-08-05. For 36 active destinations and up to 13 featured destinations, the expected indexed D1 weather/score write volume is approximately 12,000–15,000 rows per day, compared with the current Free daily allowance of 100,000 written rows. Four scheduled invocations per day and fewer than 50 provider subrequests per invocation remain within Workers Free limits. The no-cost mitigation for unexpected growth is to reduce the featured set before reducing daily destination coverage.

## Security, SEO, and performance impact

Provider isolation, lock fencing, candidate validation and immutable activation are unchanged. More static country and city routes remain far below Pages file limits. Smaller snapshots reduce D1 batch work and scheduled Worker CPU pressure. No new user data or tracking is introduced.

## Upgrade path

Phase two can add daily-only destinations until observed D1 usage reaches 60% of the reviewed allowance. Expanding hourly coverage, increasing cadence, or introducing a new provider requires a fresh budget review and an update to this ADR.
