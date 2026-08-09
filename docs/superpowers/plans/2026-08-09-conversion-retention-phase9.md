# Where Not Rain — Phase 9: Conversion & Retention

Date: 2026-08-09
Status: In Progress

## Outcome

Convert an already-completed travel decision into **contextual, disclosed and privacy-safe commercial opportunities and retention hooks** without allowing commercial logic to influence weather discovery, weather risk, adaptive replanning or fixed constraints.

Target product loop:

**weather decision -> trip/replan context -> eligible commercial opportunity -> secure affiliate adapter -> measurable impression/click -> opt-in retention readiness**

The product must remain useful when every commercial flag is disabled or every provider has no fill.

## Non-negotiable trust boundaries

1. Commercial logic never changes weather scores, weather reason codes, discovery ordering, activity risk or replan ordering.
2. Commercial opportunities are derived only after a user-relevant decision context exists.
3. The contextual resolver never fabricates provider URLs and never selects an arbitrary redirect target.
4. Final outbound links continue to pass through the existing provider-neutral Affiliate adapter with HTTPS host/path allowlists, disclosure, `sponsored nofollow`, kill switches and no-fill suppression.
5. Disabled/no-fill/weak-context states render nothing rather than a dead or misleading block.
6. Analytics payloads remain allowlisted and may not contain itinerary text, activity names, notes, precise coordinates, email, account/session/device identifiers or raw query strings.
7. Notifications remain opt-in and rate-limited before any delivery channel integration.
8. Billing remains deferred. Phase 9 may define entitlements only; it does not integrate a billing provider unless separately approved.

---

## Existing baseline to reuse

### Affiliate safety layer

`packages/analytics/src/affiliate-adapter.ts` already provides:

- provider-neutral categories (`hotel`, `activities`, `flights`, `sim`, `insurance`, `car_rental`);
- provider host/path allowlists;
- HTTPS-only outbound validation;
- per-slot runtime kill switches;
- stale/empty/unauthorized suppression;
- sponsored disclosure / rel attributes;
- zero-shift no-fill behavior;
- bounded `affiliate_impression` / `affiliate_click` descriptors.

Phase 9 does **not** replace these controls.

### Analytics privacy layer

`packages/analytics/src/events.ts` already provides:

- strict event allowlists;
- versioned schemas;
- route-template allowlists;
- privacy-field rejection;
- unknown-field stripping;
- non-blocking sink behavior.

Phase 9 extends this system rather than creating a parallel analytics stack.

### Runtime controls

`packages/config/src/runtime-config.ts` is safe-by-default: optional affiliate slots are disabled unless explicitly enabled.

---

# Slice A — Contextual conversion resolver

Status: In Progress

## Goal

Create a **pure deterministic resolver** that answers only:

> Given the product decision context, which commercial category/surface is contextually eligible, if any?

It must not know provider URLs, commission rates, commercial bids, weather rankings or affiliate provider internals.

## Contract

```text
ConversionContext
- stage:
    discovery_decided
    trip_planning
    trip_transport
    weather_replan
    trip_preparation
- destinationId?
- hasDestinationDecision
- hasTrip
- hasStructuredActivities
- carDependent
- weatherAction?
- indoorFallbackAvailable
- tripStartsWithinDays?

ContextualCommercialOpportunity
- category
- surface
- slot
- destinationId
- reasonCode
- priority
```

Initial deterministic mapping:

- `discovery_decided` + real destination decision -> `hotel`, optionally `flights` as a lower-priority second opportunity;
- `trip_planning` + structured activity context -> `activities`;
- `trip_transport` + explicitly car-dependent trip -> `car_rental`;
- `weather_replan` + explicit indoor fallback context -> `activities` only;
- insurance is **not** emitted merely because weather worsened;
- `trip_preparation` + near-term trip -> `sim`;
- weak/missing decision context -> no opportunity.

The resolver may return a bounded ordered list, maximum two opportunities, with stable deterministic ordering.

## Slice A acceptance

- [ ] resolver is pure and deterministic;
- [ ] weak/missing context returns no opportunity;
- [ ] discovery opportunity requires an actual destination decision;
- [ ] activity tickets require trip/activity context;
- [ ] car rental requires explicit car dependency;
- [ ] bad weather alone never emits insurance;
- [ ] weather replan emits an activity opportunity only when a concrete indoor fallback exists;
- [ ] SIM opportunity requires preparation/near-term context;
- [ ] output contains no provider URL, commission/bid or weather score fields;
- [ ] output ordering is stable and bounded to at most two opportunities;
- [ ] focused unit tests pass;
- [ ] existing Affiliate adapter tests remain green;
- [ ] full repository Preview gate passes before Slice B.

---

# Slice B — Discovery / Trip / Weather surfaces

Status: Planned

## Goal

Render contextual opportunities only where the decision context exists, then resolve a real outbound action through the existing secure Affiliate adapter.

Candidate surfaces:

- Discovery shortlist/compare result after destination decision: hotel / flight;
- Trip Workspace structured-day planning: activities;
- car-dependent Trip context: car rental;
- weather-driven replan review / Today Mode with concrete indoor fallback: activity ticket;
- trip preparation context: SIM/eSIM.

Requirements:

- EN / zh-CN / zh-Hant disclosure copy;
- zero misleading UI when slot disabled, provider data missing or no-fill;
- commercial cards never reorder weather/discovery/replan content;
- accessibility and mobile layout;
- outbound target always resolved through the Affiliate adapter.

---

# Slice C — Funnel analytics + privacy gates

Status: Planned

## Goal

Measure the product-to-conversion funnel with bounded privacy-safe events.

Target funnel:

```text
weather_discovery_view
-> destination_shortlisted
-> trip_created
-> weather_insight_opened
-> replan_proposed
-> replan_accepted
-> affiliate_impression
-> affiliate_click
```

Requirements:

- extend the existing allowlisted analytics union/version validator;
- use destination IDs / bounded enums, never itinerary text;
- reject activity titles, notes, precise coordinates, email, user/session/device IDs and raw query strings;
- unknown extra fields continue to be discarded;
- analytics remain non-blocking;
- explicit privacy regression tests.

---

# Slice D — Notification preference / readiness model

Status: Planned

## Goal

Make future Weather Insight notifications safe to add later without enabling delivery yet.

Preference contract should cover:

- opt-in enabled state;
- eligible severity threshold;
- quiet hours;
- maximum daily cadence;
- per-trip monitoring preference where supported;
- explicit unsubscribe/disable state.

Rules:

- default off;
- low-confidence / minor weather noise never eligible;
- quiet periods and rate limits are deterministic;
- no email/PWA delivery provider integration is required in this slice.

---

# Slice E — Premium entitlement boundary

Status: Planned

## Goal

Define testable product entitlement boundaries without billing integration.

Candidate entitlements:

- number of actively monitored trips;
- proactive notification eligibility;
- revision-history horizon;
- advanced multi-city comparison limits;
- adaptive replan proposal limits/features;
- collaboration limits/features.

Requirements:

- free baseline remains useful;
- entitlement checks are deterministic and provider-neutral;
- no payment/billing SDK;
- billing remains deferred until analytics demonstrate repeated monitoring/replanning value.

---

# Slice F — Release review / smoke

Status: Planned

Preview and Production release review must verify:

1. weak commercial context produces no surface;
2. valid context resolves the intended category only;
3. kill-switch off produces zero commercial UI;
4. invalid/non-allowlisted outbound target is suppressed;
5. commercial surfaces do not alter weather/discovery/replan ordering;
6. affiliate impression/click events validate through the privacy allowlist;
7. forbidden itinerary/privacy fields are rejected;
8. notification preference defaults off and enforces cadence/quiet hours;
9. premium entitlement checks are deterministic and billing-free.

---

## Phase 9 Definition of Done

- [ ] contextual commercial resolver is deterministic and decision-first;
- [ ] contextual affiliate surfaces use the existing secure adapter;
- [ ] commercial surfaces never influence weather/risk/replan scoring;
- [ ] disabled/no-fill states produce zero misleading UI;
- [ ] affiliate impression/click funnel is measurable;
- [ ] privacy tests reject itinerary/sensitive content;
- [ ] notification readiness is opt-in and rate-limited before delivery integration;
- [ ] premium entitlements are documented and testable without billing integration;
- [ ] EN / zh-CN / zh-Hant commercial disclosure surfaces complete;
- [ ] full format/lint/typecheck/unit/integration/docs/static-export gates pass;
- [ ] dedicated Preview and Production Phase 9 smoke pass.

## Execution order

1. Slice A — contextual conversion resolver.
2. Slice B — contextual product surfaces using secure Affiliate adapter.
3. Slice C — funnel analytics + privacy gates.
4. Slice D — notification preference/readiness model.
5. Slice E — premium entitlement contract, billing deferred.
6. Slice F — release review / Preview + Production smoke.

No slice advances past its acceptance gate with a known safety, privacy, trust or CI failure.
