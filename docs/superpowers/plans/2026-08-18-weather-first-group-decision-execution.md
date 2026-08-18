# Weather V2 — Weather-first group decision execution plan

Date: 2026-08-18  
Status: Phase 0 implemented in this branch; Phases 1–4 planned  
Branch: `agent/weather-first-group-decision`

## 1. Goal

Reduce the product to one coherent loop:

```text
dates fixed
→ destination open
→ compare by weather
→ decide together
→ plan together
→ revisit only when weather changes the plan
```

The implementation must reuse the current weather, shortlist, Cloud Trip, comments, decisions and revision infrastructure rather than creating a second travel product.

## 2. Product guardrails

1. Core forecast horizon is 14 days.
2. Primary candidate set is three to five destinations.
3. Weather is the main signal, but unsupported accessibility is labeled rather than invented.
4. Anonymous room participation must not require email.
5. Destination lock is explicit and owner-controlled.
6. Commercial value never affects candidate ranking.
7. Route optimization, execution mode and import remain secondary.
8. No new generic AI itinerary generation.
9. Weather provider boundaries remain unchanged.
10. The four-workflow low-frequency CI/CD model remains unchanged.

## 3. Phase 0 — product scope and entry-point cutover

### Deliverables

- Founder PRD;
- proposed domain model;
- information architecture;
- implementation plan;
- README product-direction summary;
- global navigation changed to:
  - `Decide where / 一起去哪`;
  - `Plan together / 共同规划`;
- homepage changed to:
  - dates-fixed, destination-open value proposition;
  - discovery as primary CTA;
  - shared planning as secondary CTA;
  - no homepage-level itinerary import CTA;
  - three-step decision explanation;
- Trips landing changed to:
  - start after destination choice;
  - preserve My Trips;
  - explain comments, explicit decisions and revisions;
  - keep import as an advanced text link;
  - remove generic itinerary-template promotion;
- regression contracts updated.

### Acceptance

- EN, zh-CN and zh-Hant expose identical hierarchy;
- weather rankings, country links and city SEO remain;
- no advanced feature is deleted;
- import URLs remain valid;
- full PR CI passes;
- no production deployment before merge.

## 4. Phase 1 — decision context and reachable shortlist

### Objective

Make destination recommendations more realistic without requiring global travel inventory.

### Domain changes

Add:

```text
DecisionContext
Origin
TravelWindow
AccessibilityPreferences
CandidateAccessibility
```

### Product changes

Discovery inputs:

- origin;
- travel dates;
- travel mode;
- maximum travel time;
- weather intent;
- party type.

### Pilot strategy

First release supports one bounded accessibility mode:

- self-drive;
- road-connected supported destinations;
- origin geocoding;
- OSRM-compatible duration matrix;
- maximum travel-time filter;
- explicit `estimated` or `unsupported` status.

Rail and flight are not included in the first accessibility implementation.

### Technical changes

- pure accessibility domain contract in `packages/domain` or web trip domain package;
- route-provider adapter reused from existing route intelligence;
- bounded matrix requests;
- cache by origin, destinations, mode and route-data version;
- fail-open to weather-only results with unsupported label;
- never remove all candidates because routing failed.

### Tests

- deterministic candidate filtering;
- missing-origin fallback;
- provider failure;
- cross-sea/unreachable candidate;
- maximum travel time;
- no commercial field in ranking.

### Acceptance

- time to first candidate remains acceptable;
- every accessibility value displays provider/confidence;
- no candidate is labeled reachable without evidence;
- weather snapshot remains the ranking evidence source.

## 5. Phase 2 — destination decision room

### Objective

Turn a shareable shortlist into a measurable group decision.

### Data model

Add D1 migrations:

```text
decision_rooms
decision_room_candidates
decision_room_participants
decision_room_votes
decision_room_activity
```

### API

Implement:

```text
POST /api/v1/decision-rooms
GET  /api/v1/decision-rooms/:publicToken
POST /api/v1/decision-rooms/:roomId/participants
PUT  /api/v1/decision-rooms/:roomId/votes/:candidateId
POST /api/v1/decision-rooms/:roomId/lock
POST /api/v1/decision-rooms/:roomId/reopen
```

### Web route

Use a static shell compatible with current export:

```text
/together?room=<publicToken>
/zh-cn/together?room=<publicToken>
/zh-hant/together?room=<publicToken>
```

### Participant model

- owner authenticates through existing account or owner secret;
- invited participant joins with nickname;
- server returns room-scoped signed participant token;
- one vote per participant per candidate;
- token has no access outside room.

### Vote model

Stances:

```text
want
acceptable
avoid
```

The UI must not auto-declare a winner.

### Destination lock

- owner only;
- confirmation modal;
- shows vote distribution and cautions;
- requires current room version;
- atomically creates/links Cloud Trip;
- persists locked weather snapshot;
- appends immutable activity.

### Tests

- anonymous join;
- invalid/expired token;
- vote replacement;
- removed candidate cannot be voted;
- viewer cannot lock;
- stale room version;
- idempotent lock;
- trip creation rollback;
- three-locale UI contract;
- noindex on room shell.

### Acceptance

- invited participant reaches first vote without registration;
- owner can lock destination;
- shared trip opens with dates and city already populated;
- no duplicate trip on retry.

## 6. Phase 3 — shared activity candidates

### Objective

Make post-lock collaboration useful without becoming a general project-management tool.

### Data model

Add:

```text
trip_activity_candidates
trip_activity_candidate_preferences
trip_activity_day_assignments
```

### Activity fields

- title;
- indoor/outdoor/mixed;
- expected duration;
- fixed/flexible;
- notes;
- proposer;
- participant preference;
- assigned day.

### UI

Workspace order:

```text
locked destination summary
→ daily weather
→ activity idea pool
→ group preferences
→ day assignments
→ comments and decisions
→ advanced tools
```

### Behavior

- activity ideas begin unassigned;
- participants mark `must do / want / acceptable / skip`;
- editors assign an activity to a day;
- weather suitability appears for each possible day;
- assignment writes a Trip revision;
- no automatic assignment solely from votes.

### Reuse

- Cloud Trip comments;
- Cloud Trip decisions;
- revision diff;
- activity-intelligence weather sensitivity;
- existing structured activities;
- local-first storage.

### Tests

- one assignment per activity;
- fixed activity validation;
- vote replacement;
- day-weather projection;
- assignment revision;
- conflict handling;
- viewer permissions.

### Acceptance

- a locked room can produce a shared activity pool;
- at least one activity can be assigned with weather context;
- group preference and actual schedule remain distinct.

## 7. Phase 4 — weather-change retention

### Objective

Create a reason to return before departure.

### Schedule

Evaluate at:

```text
D-7
D-3
D-1
```

Use existing weather snapshots and trip weather rules.

### Notification principle

Do not send ordinary forecast summaries.

Send only when:

- destination-level decision materially changes before lock; or
- an assigned outdoor/indoor activity changes suitability after lock.

### Change summary

```text
What changed
What is affected
What remains unchanged
Suggested action
Latest snapshot time
```

### Channels

First:

- in-product “since last visit” summary.

Then:

- Web Push or email after explicit opt-in.

### Tests

- no alert for insignificant changes;
- stale snapshot suppression;
- quiet hours;
- per-room/day rate limit;
- fixed activity protection;
- deep link to affected room/day.

### Acceptance

- return user can understand the change in one screen;
- no alert is sent without an affected decision;
- notifications can be disabled per room.

## 8. Phase 5 — authority documentation cutover

The implementation direction must eventually be reflected in active authority:

- `docs/00-Founder-Vision.md`;
- `docs/01-Product-PRD.md`;
- `docs/02-UX-Bible.md`;
- `docs/03-SEO-Bible.md`;
- `docs/05-System-Architecture.md`;
- `docs/06-Database.md`;
- `docs/07-API-Spec.md`;
- `docs/10-Growth-Bible.md`;
- `docs/11-Roadmap.md`;
- `docs/13-Requirements-Traceability.md`;
- Kiro-derived manifests;
- `SPEC.md`.

This is a controlled documentation batch, not an incidental edit inside a feature PR.

## 9. PR breakdown

### PR A — scope and IA

Implemented by this branch:

- docs package;
- README;
- header;
- localized homepage;
- localized Trips landing;
- contracts.

### PR B — accessibility pilot

- context model;
- origin input;
- self-drive matrix;
- discovery integration;
- tests.

### PR C — room storage and API

- migrations;
- repositories;
- API;
- participant tokens;
- unit/integration tests.

### PR D — room UI

- static shell;
- share;
- join;
- voting;
- lock;
- localized contracts.

### PR E — room-to-trip transition

- atomic lock/link;
- Cloud Trip creation;
- workspace destination summary;
- revision evidence.

### PR F — activity pool

- tables/API;
- UI;
- preferences;
- assignment;
- weather projection.

### PR G — retention

- change detector;
- in-product summary;
- optional notification delivery.

## 10. Validation gates

Every PR:

1. `pnpm format:check`
2. `pnpm lint`
3. library builds
4. `pnpm typecheck`
5. `pnpm test`
6. documentation gate
7. Next static export
8. Worker builds
9. pipeline contracts
10. secret scan

Room and API PRs also require:

- D1 migration tests;
- auth/authorization tests;
- conflict/idempotency tests;
- privacy-field tests;
- production smoke extension.

## 11. Analytics rollout

Phase 0 reuses current events.

Phase 2 adds allowlisted events:

```text
decision_room_created
decision_room_shared
decision_participant_joined
destination_vote_submitted
destination_locked
```

Phase 3 adds:

```text
activity_candidate_added
activity_preference_submitted
activity_assigned_to_day
```

No event may include:

- nickname;
- comments;
- room title;
- share token;
- activity title;
- precise origin coordinates.

## 12. Rollout and feature flags

Proposed flags:

```text
GROUP_DECISION_ROOMS
ANONYMOUS_ROOM_PARTICIPATION
ACCESSIBILITY_SELF_DRIVE
ACTIVITY_CANDIDATE_POOL
DECISION_CHANGE_SUMMARY
```

Rollout order:

1. internal test rooms;
2. owner-only room creation;
3. invite participants;
4. destination lock;
5. trip creation;
6. activity pool;
7. retention.

## 13. Rollback

- Phase 0 is copy/navigation only and can be reverted independently;
- Decision Room tables are additive;
- disabling room flag returns users to shareable Discover URLs;
- existing Cloud Trips remain valid;
- no migration rewrites existing Trip documents;
- advanced execution features remain untouched.

## 14. Success gate before further expansion

Do not add rail, flights, generic AI planning or more advanced collaboration until the pilot demonstrates:

- meaningful discovery completion;
- shortlist sharing;
- at least two participants per active room;
- destination lock;
- transition to shared trip;
- activity planning use.

The product must prove the decision loop before increasing data and feature scope.
