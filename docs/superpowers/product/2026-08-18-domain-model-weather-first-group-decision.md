# Domain model — Weather-first group destination decision

Date: 2026-08-18  
Status: Product-owner approved direction; pending authority cutover  
Related PRD: `2026-08-18-founder-prd-weather-first-group-decision.md`

> This is a proposed domain design for implementation planning. Active data, API and architecture authority remains in the documents indexed by `SPEC.md` until controlled cutover.

## 1. Design goal

Represent one continuous stateful journey:

```text
weather preferences
→ destination candidates
→ group opinions
→ locked destination
→ shared activity ideas
→ day assignments
→ weather-aware revisions
```

The domain must avoid coupling the decision room to:

- a specific weather provider;
- a specific routing provider;
- an OTA;
- a full user account for every participant;
- LLM-generated itinerary text;
- request-time weather provider calls.

## 2. Aggregate boundaries

### DecisionRoom aggregate

Owns:

- decision context;
- candidate set;
- participants;
- votes;
- destination lock;
- decision-room activity log;
- room version.

Does not own:

- weather snapshot contents;
- full cloud-trip document;
- route geometry;
- commercial inventory.

### Trip aggregate

Existing Cloud Trip continues to own:

- trip document;
- days;
- activities;
- comments and explicit decisions;
- immutable revisions;
- access roles;
- collaboration activity.

A Decision Room links to a Trip only after the destination is locked.

### Weather snapshot aggregate

Existing immutable weather snapshot remains the evidence source.

Decision candidates store references, not copied provider responses.

## 3. Core types

```ts
type DecisionRoomStatus =
  | "draft"
  | "collecting_candidates"
  | "voting"
  | "destination_locked"
  | "planning"
  | "ready"
  | "travelling"
  | "completed";

type TravelMode = "self_drive" | "rail" | "flight" | "other";

type VoteStance = "want" | "acceptable" | "avoid";

type ParticipantRole = "owner" | "editor" | "participant" | "viewer";

type CandidateSource = "system" | "participant";

type AccessibilityConfidence = "verified" | "estimate" | "unsupported";

type ActivityEnvironment = "indoor" | "outdoor" | "mixed";

type ActivityPreference = "must_do" | "want" | "acceptable" | "skip";
```

## 4. Decision room

```ts
interface DecisionRoom {
  readonly id: string;
  readonly publicTokenHash: string;
  readonly title: string;
  readonly status: DecisionRoomStatus;

  readonly ownerUserId: string | null;
  readonly origin: DecisionOrigin | null;
  readonly travelWindow: TravelWindow;
  readonly partyProfile: "adults" | "family" | "senior" | null;
  readonly weatherPreferences: WeatherDecisionPreferences;
  readonly accessibilityPreferences: AccessibilityPreferences;

  readonly candidates: ReadonlyArray<DestinationCandidate>;
  readonly participants: ReadonlyArray<DecisionParticipant>;
  readonly votes: ReadonlyArray<DestinationVote>;

  readonly lockedDestination: LockedDestination | null;
  readonly linkedTripId: string | null;

  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

### Invariants

- a room has one owner identity or one owner recovery secret;
- `from <= to`;
- the core forecast window contains no more than 14 calendar days;
- the active candidate set contains at most five candidates;
- a room cannot enter `voting` with fewer than two candidates;
- a room cannot enter `destination_locked` without one active candidate;
- `linkedTripId` is null until destination lock succeeds;
- all mutations require `baseVersion`;
- version increments exactly once per successful mutation.

## 5. Decision context

```ts
interface TravelWindow {
  readonly from: string;
  readonly to: string;
  readonly timezoneStrategy: "destination_local";
}

interface DecisionOrigin {
  readonly label: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly placeId: string | null;
  readonly countryCode: string | null;
}

interface WeatherDecisionPreferences {
  readonly intent:
    | "dry"
    | "outdoor"
    | "beach"
    | "cool_escape"
    | "warm_escape"
    | "family_comfort"
    | "senior_comfort";

  readonly rainProbabilityMax: number | null;
  readonly temperatureMinC: number | null;
  readonly temperatureMaxC: number | null;
  readonly windSpeedMaxKph: number | null;
  readonly theme: "city" | "beach" | "outdoor" | "indoor" | null;
}

interface AccessibilityPreferences {
  readonly modes: ReadonlyArray<TravelMode>;
  readonly maxTravelMinutes: number | null;
}
```

### Rules

- origin is optional in the first weather-only release;
- unsupported accessibility must never remove a candidate silently;
- a candidate with unsupported accessibility displays `unsupported`;
- user-chosen geography filters are separate from commercial availability.

## 6. Destination candidate

```ts
interface DestinationCandidate {
  readonly id: string;
  readonly roomId: string;
  readonly cityId: string;
  readonly cityName: string;
  readonly countryCode: string;
  readonly countryName: string;

  readonly source: CandidateSource;
  readonly proposedByParticipantId: string | null;
  readonly state: "active" | "removed";

  readonly weatherEvidence: CandidateWeatherEvidence;
  readonly accessibility: CandidateAccessibility;
  readonly explanation: CandidateExplanation;

  readonly addedAt: string;
  readonly removedAt: string | null;
}
```

### Candidate weather evidence

```ts
interface CandidateWeatherEvidence {
  readonly snapshotId: string;
  readonly from: string;
  readonly to: string;
  readonly score: number | null;
  readonly confidence: number | null;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly stale: boolean;
  readonly dataUpdatedAt: string;
}
```

### Candidate accessibility

```ts
interface CandidateAccessibility {
  readonly mode: TravelMode | null;
  readonly travelMinutes: number | null;
  readonly provider: "osrm" | "curated_rail" | "manual" | null;
  readonly confidence: AccessibilityConfidence;
  readonly measuredAt: string | null;
}
```

### Explanation

```ts
interface CandidateExplanation {
  readonly positiveReasonCodes: ReadonlyArray<string>;
  readonly cautionReasonCodes: ReadonlyArray<string>;
  readonly summaryKey: string;
}
```

### Invariants

- candidate ranking is derived, not stored as mutable user input;
- weather score always references the snapshot used;
- a removed candidate retains history;
- a candidate can be restored only by an explicit mutation;
- `provider=null` implies `confidence=unsupported`;
- commercial attributes are not part of candidate ranking.

## 7. Participant identity

```ts
interface DecisionParticipant {
  readonly id: string;
  readonly roomId: string;
  readonly role: ParticipantRole;
  readonly displayName: string;
  readonly userId: string | null;
  readonly participantTokenHash: string | null;
  readonly joinedAt: string;
  readonly lastActiveAt: string;
}
```

### Anonymous participant flow

1. visitor opens room with public share token;
2. visitor enters a bounded display name;
3. server creates participant ID;
4. server returns a signed, room-scoped participant token;
5. later writes require that token;
6. token cannot grant access outside the room.

### Privacy rules

- no email is required;
- analytics receive no display name;
- comments are never included in analytics;
- participant token is stored hashed server-side;
- public share token and write token are different capabilities.

## 8. Destination vote

```ts
interface DestinationVote {
  readonly roomId: string;
  readonly candidateId: string;
  readonly participantId: string;
  readonly stance: VoteStance;
  readonly reason: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

### Invariants

- one participant has one active vote per candidate;
- updating a vote replaces the previous stance;
- vote reason is optional and length-bounded;
- removed candidates are not votable;
- viewers cannot vote;
- aggregate vote summaries never expose participant tokens;
- “group consensus” requires at least two distinct participants.

## 9. Locked destination

```ts
interface LockedDestination {
  readonly candidateId: string;
  readonly cityId: string;
  readonly weatherSnapshotId: string;
  readonly lockedByParticipantId: string;
  readonly lockedAt: string;
  readonly roomVersion: number;
  readonly rationale: string;
}
```

### Lock transaction

The lock operation must atomically:

1. verify owner/editor permission;
2. verify `baseVersion`;
3. verify candidate is active;
4. persist lock evidence;
5. transition room status;
6. create or link one Cloud Trip;
7. copy dates, party profile and destination into the trip;
8. append room activity;
9. return new room and trip version.

If trip creation fails, the room must not appear locked.

## 10. Room activity log

```ts
type DecisionRoomActivityKind =
  | "room_created"
  | "candidate_added"
  | "candidate_removed"
  | "candidate_restored"
  | "voting_opened"
  | "vote_changed"
  | "destination_locked"
  | "destination_reopened"
  | "trip_linked";

interface DecisionRoomActivity {
  readonly id: string;
  readonly roomId: string;
  readonly participantId: string | null;
  readonly kind: DecisionRoomActivityKind;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
  readonly roomVersion: number;
  readonly createdAt: string;
}
```

Payloads must be allowlisted and must not contain free-form comments.

## 11. Shared activity pool

After destination lock:

```ts
interface ActivityCandidate {
  readonly id: string;
  readonly tripId: string;
  readonly cityId: string;
  readonly title: string;
  readonly environment: ActivityEnvironment;
  readonly durationMinutes: number | null;
  readonly fixed: boolean;
  readonly notes: string;
  readonly proposedByParticipantId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

### Participant preference

```ts
interface ActivityCandidatePreference {
  readonly tripId: string;
  readonly activityCandidateId: string;
  readonly participantId: string;
  readonly preference: ActivityPreference;
  readonly updatedAt: string;
}
```

### Assignment

```ts
interface ActivityDayAssignment {
  readonly tripId: string;
  readonly activityCandidateId: string;
  readonly dayId: string;
  readonly order: number;
  readonly assignedByParticipantId: string;
  readonly updatedAt: string;
}
```

### Invariants

- an activity candidate may be unassigned;
- an activity candidate may be assigned to at most one day;
- fixed activities require a date/time before they can be marked fixed;
- assignment updates create a Cloud Trip revision;
- weather suitability is derived from day weather and environment;
- group preference does not automatically assign an activity.

## 12. Weather suitability projection

```ts
interface ActivityWeatherSuitability {
  readonly activityCandidateId: string;
  readonly dayId: string;
  readonly weatherSnapshotId: string;
  readonly state: "good" | "caution" | "poor" | "unknown";
  readonly reasonCodes: ReadonlyArray<string>;
  readonly calculatedAt: string;
}
```

This is a projection, not authoritative user data.

Same inputs must produce the same result.

## 13. Proposed persistence

### Decision room tables

```text
decision_rooms
decision_room_candidates
decision_room_participants
decision_room_votes
decision_room_activity
```

### Planning extension tables

```text
trip_activity_candidates
trip_activity_candidate_preferences
trip_activity_day_assignments
```

### Existing tables reused

```text
trips
trip_revisions
trip_comments
trip_decisions
trip_activity
weather_snapshots
```

## 14. Proposed API surface

### Room lifecycle

```text
POST   /api/v1/decision-rooms
GET    /api/v1/decision-rooms/:publicToken
PATCH  /api/v1/decision-rooms/:roomId
POST   /api/v1/decision-rooms/:roomId/participants
POST   /api/v1/decision-rooms/:roomId/candidates
DELETE /api/v1/decision-rooms/:roomId/candidates/:candidateId
POST   /api/v1/decision-rooms/:roomId/voting/open
POST   /api/v1/decision-rooms/:roomId/lock
POST   /api/v1/decision-rooms/:roomId/reopen
```

### Votes

```text
PUT    /api/v1/decision-rooms/:roomId/votes/:candidateId
DELETE /api/v1/decision-rooms/:roomId/votes/:candidateId
```

### Activity pool

```text
GET    /api/v1/trips/:tripId/activity-candidates
POST   /api/v1/trips/:tripId/activity-candidates
PATCH  /api/v1/trips/:tripId/activity-candidates/:activityId
DELETE /api/v1/trips/:tripId/activity-candidates/:activityId
PUT    /api/v1/trips/:tripId/activity-candidates/:activityId/preference
PUT    /api/v1/trips/:tripId/activity-candidates/:activityId/assignment
```

## 15. Static-export routing constraint

The web app currently uses static export.

The first implementation should avoid arbitrary build-time dynamic pages.

Recommended browser routes:

```text
/discover
/together?room=<publicToken>
/trips
/trips/workspace?trip=<tripId>
```

Localized equivalents:

```text
/zh-cn/together?room=<publicToken>
/zh-hant/together?room=<publicToken>
```

A future migration to runtime Pages/Workers routing may introduce a prettier path such as `/together/:token`, but that requires an explicit deployment and rendering decision.

## 16. Concurrency and idempotency

Every room mutation includes:

```ts
interface MutationEnvelope<T> {
  readonly baseVersion: number;
  readonly idempotencyKey: string;
  readonly payload: T;
}
```

Server behavior:

- duplicate idempotency key returns the original result;
- stale base version returns `409`;
- unauthorized role returns `403`;
- missing room/candidate returns `404`;
- input validation returns `400`;
- all conflict responses include current room version.

## 17. Analytics events

Proposed privacy-safe events:

```text
decision_room_created
decision_room_shared
decision_participant_joined
destination_vote_submitted
destination_locked
destination_reopened
shared_trip_created
activity_candidate_added
activity_preference_submitted
activity_assigned_to_day
```

Allowed dimensions are bounded:

- locale;
- candidate count;
- participant count bucket;
- vote stance;
- room status;
- days until departure bucket;
- source route.

Never send:

- room title;
- nickname;
- comment;
- destination free text;
- activity title;
- share token;
- user ID.

## 18. Migration strategy

The domain is additive.

1. keep existing Discover and Cloud Trip documents;
2. add Decision Room tables and API;
3. create rooms from the existing shortlist;
4. link a room to a Cloud Trip on lock;
5. preserve current local Workspace behavior;
6. add activity pool as a projection into existing Trip activities;
7. do not migrate old trips unless a user explicitly creates a room from them.

## 19. Failure behavior

- weather unavailable: room remains readable, lock may use the last valid snapshot with stale label;
- candidate API unavailable: room keeps stored candidate evidence;
- anonymous token lost: participant may rejoin under a new identity; old vote remains attributable to old participant;
- lock conflict: client reloads latest version and asks owner to confirm again;
- trip creation failure: room stays in voting;
- commercial provider failure: no impact on room or trip;
- route provider failure: accessibility becomes estimate or unsupported, never fabricated.

## 20. Implementation boundary

The first implementation increment should create only:

- decision room aggregate;
- participant identity;
- destination votes;
- destination lock;
- room-to-trip link.

Activity pool and weather scheduling should follow after the room funnel is measured.
