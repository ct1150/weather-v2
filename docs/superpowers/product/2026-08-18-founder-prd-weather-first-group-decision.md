# Founder PRD — Weather-first group destination decision

Date: 2026-08-18  
Status: Product-owner approved direction; pending authority cutover  
Product: Where Not Rain · 一起去哪

> This document records the approved implementation direction. It does not replace the active authority documents indexed by `SPEC.md` until a controlled documentation cutover updates the owning Vision, Product, UX, Growth and Roadmap contracts.

## 1. Product thesis

Where Not Rain serves travellers who have already decided **when** they can travel but have not decided **where** to go.

The product combines:

1. a trustworthy weather-first destination shortlist;
2. lightweight group decision-making;
3. lightweight shared trip planning after the destination is chosen.

It does not try to become a general-purpose AI travel assistant, OTA, global itinerary validator or full travel operating system.

### Product statement

> Dates fixed. Destination open. Compare the weather, decide together, then plan together.

### Chinese statement

> 日期定了，去哪还没定？根据天气比较少量候选，让同行人一起决定；目的地确定后，再共同规划每天怎么玩。

## 2. User problem

A group often knows:

- the available dates;
- the approximate trip length;
- who is travelling;
- the type of weather they prefer;
- that they want to take a trip.

They do not know:

- which destination has the strongest weather window;
- which trade-offs matter;
- whether the group agrees;
- how to turn the selected destination into a shared plan without repeating the whole discussion in chat.

Today this usually becomes a fragmented workflow:

```text
search several city forecasts
→ send screenshots in chat
→ debate without one shared comparison
→ lose decisions in message history
→ switch to another tool after choosing a city
```

Where Not Rain should replace that with one continuous decision loop.

## 3. Target user

### Primary segment

Travellers planning a flexible trip in the next 14 days:

- dates are fixed or nearly fixed;
- destination is still open;
- two or more people are involved;
- weather materially affects the choice;
- the group wants a small, explainable shortlist rather than unlimited inspiration.

Typical examples:

- weekend couples;
- families with children;
- families with older adults;
- small groups of friends;
- short self-drive or rail trips;
- island, outdoor, photography, hiking or seasonal-weather trips.

### Secondary segment

A solo traveller who still wants weather-first destination comparison and may share the shortlist later.

### Not the primary user

- travellers who already booked a fixed destination and only need itinerary management;
- users seeking a conversational AI to generate a complete trip from scratch;
- users whose travel date is outside the reliable forecast window;
- users needing live inventory, ticketing, visa or customer-service support;
- professional travel operations requiring complete supplier data.

## 4. Core jobs to be done

### Job A — decide where to go

> When my dates are fixed but the destination is not, help me compare a small set of realistic choices using weather evidence I can understand and share.

### Job B — reach group agreement

> When several people have different preferences, give us one shared shortlist, structured opinions and a clear locked decision.

### Job C — continue planning without restarting

> Once we choose a destination, create one shared planning space where we can collect activities, discuss trade-offs and arrange indoor and outdoor plans around daily weather.

### Job D — revisit only when conditions matter

> Before departure, tell us only when weather changes enough to affect a decision we already made.

## 5. Product principles

1. **Weather first, not weather only.**  
   Weather is the main differentiator, but destination candidates must remain realistic for the trip window and supported geography.

2. **Three to five choices beat an infinite feed.**  
   The product reduces choice overload instead of maximizing content consumption.

3. **Collaboration exists to make decisions.**  
   Comments, votes and revisions must connect to a candidate, activity, day or explicit decision.

4. **No forced login for lightweight participation.**  
   A traveller may create or own a room with an account, but invited voters should be able to participate with a nickname and signed room token.

5. **The forecast window is a product boundary.**  
   The core decision experience supports travel in the next 14 days. Dates beyond the supported forecast horizon are saved as intent, not ranked as precise forecasts.

6. **Commercial content follows the decision.**  
   Destination rankings must not be influenced by affiliate value. Commercial actions appear only after a destination has been chosen or the user explicitly asks to book.

7. **Advanced capabilities stay optional.**  
   Route optimization, itinerary import, execution mode and adaptive replanning may remain available without occupying the primary navigation or acquisition story.

## 6. Product scope

### Core acquisition journey

```text
homepage
→ destination discovery
→ small shortlist
→ shareable decision room
→ group votes and discussion
→ destination locked
→ shared trip created
→ activity shortlist
→ day arrangement by weather
```

### P0 — current product surface

- three-locale weather discovery;
- date and weather-intent selection;
- ranked destination cards with reasons and trade-offs;
- bounded shortlist;
- shareable URL state;
- saved shortlist on device;
- create a local/shared trip from selected destinations;
- cloud-trip comments, decisions and revision history;
- daily weather and activity-aware planning;
- optional advanced execution features.

### P1 — destination decision room

- create a room from discovery;
- room title, dates, party and weather intent;
- three to five destination candidates;
- share token;
- anonymous nickname participation;
- `want / acceptable / avoid` vote;
- candidate-specific comment;
- creator locks destination;
- lock event creates one shared trip.

### P2 — lightweight group planning

- activity candidate pool;
- activity environment: indoor, outdoor or mixed;
- estimated duration;
- fixed or flexible;
- participant preference;
- assign activities to trip days;
- weather suitability hint for each day;
- comments and explicit decisions;
- revisions after meaningful changes.

### P3 — retention

- D-7, D-3 and D-1 weather refresh;
- “what changed since last visit” summary;
- action-level notification only;
- reopen destination decision only when the selected city materially deteriorates and alternatives remain valid.

## 7. Explicit non-goals

The product will not prioritize:

- open-ended AI itinerary chat;
- complete AI-generated itineraries as the primary value;
- global POI completeness;
- global opening-hours verification;
- live flight, train, hotel or ticket inventory;
- OTA checkout;
- budget and expense splitting;
- packing lists;
- universal itinerary auditing;
- live queue prediction;
- general social travel feeds;
- unlimited destination browsing;
- complex project-management collaboration;
- replacing Google Maps, Wanderlog or major OTAs.

## 8. User journey

### 8.1 Create a decision

Required inputs for the mature MVP:

- origin or starting area;
- departure date;
- return date or number of days;
- weather intent;
- party profile;
- transport mode;
- maximum acceptable travel time.

Progressive inputs:

- temperature bounds;
- rain threshold;
- wind threshold;
- beach, city, outdoor or indoor preference;
- candidate countries or regions.

### 8.2 Receive candidates

Output is intentionally bounded to three to five destinations.

Each candidate contains:

- city and country;
- weather match score;
- recommendation reasons;
- primary weather trade-off;
- daily forecast;
- freshness;
- forecast confidence or uncertainty label;
- accessibility status when supported;
- add/remove shortlist action.

### 8.3 Share and decide

The owner creates a room and receives a share link.

A participant:

1. opens the room;
2. enters a nickname;
3. sees the same candidate evidence;
4. votes `want`, `acceptable` or `avoid`;
5. may add one concise reason;
6. sees aggregate group preference.

The owner may:

- add or remove a candidate;
- freeze candidate collection;
- open voting;
- lock one destination;
- reopen only with an explicit reason.

### 8.4 Plan together

After locking:

- the system creates D1…Dn;
- selected destination and dates are immutable unless explicitly reopened;
- participants add activity ideas;
- activities can be marked indoor, outdoor or mixed;
- participants express preference;
- editors assign activities to days;
- the system shows weather suitability by day;
- explicit decisions are recorded separately from general comments.

## 9. State model

```text
draft
→ collecting_candidates
→ voting
→ destination_locked
→ planning
→ ready
→ travelling
→ completed
```

Exceptional transitions:

```text
voting → collecting_candidates
destination_locked → voting
planning → voting
```

Exceptional transitions require:

- owner permission;
- a reason;
- a new room version;
- an activity-log entry.

## 10. Functional requirements

### Discovery

- support a maximum forecast horizon of 14 days in the core experience;
- reject or downgrade dates outside the forecast horizon;
- return no more than five primary candidates;
- keep ranking deterministic for the same preferences and weather snapshot;
- show positive reasons and caution reasons separately;
- keep weather-provider calls outside the user request path.

### Decision room

- room creation must be idempotent;
- room reads may be public only through an unguessable share token;
- participant write access requires a signed participant token;
- invited participants do not need a full account;
- one participant has one active vote per candidate;
- vote updates replace the previous vote;
- destination lock requires owner role;
- the locked destination references the exact candidate and weather snapshot used at lock time.

### Planning

- locking a destination creates or links one cloud trip;
- the trip inherits dates, party profile and selected city;
- activity ideas remain separate from assigned day activities until placed;
- comments can target the whole trip, one day, one candidate or one activity;
- explicit decisions have `open` and `resolved` states;
- all mutations use optimistic concurrency and immutable revisions.

## 11. Trust and data rules

- every weather recommendation references a snapshot ID and update time;
- stale or incomplete data is labeled;
- candidate ranking and commercial placement are separate;
- accessibility estimates state their provider and confidence;
- anonymous participant tokens contain no email or reversible personal identifier;
- free-text comments are not included in analytics events;
- the system must not claim group consensus when only one participant voted;
- a destination may not be shown as locked until the server confirms the mutation.

## 12. MVP geography and reachability strategy

The weather decision product can launch before universal reachability data exists.

### Phase A

- use the current supported city catalog;
- let users constrain countries or regions;
- allow manual candidate removal;
- use weather as the primary ranking signal;
- keep accessibility labeled as unsupported when unavailable.

### Phase B

Pilot reachability in one bounded mode:

- self-drive between road-connected supported cities;
- origin geocoding;
- route duration matrix;
- maximum travel-time filter;
- local estimate fallback labeled as estimate.

### Phase C

Curated rail or flight accessibility:

- supported origin-destination matrix;
- no live price promise;
- no “available ticket” claim;
- commercial search links only after destination lock.

## 13. Metrics

### North-star metric

**Weekly decision rooms with at least two participants, a locked destination and a created shared trip.**

### Acquisition

- homepage → discovery start rate;
- discovery completion rate;
- share-link creation rate;
- organic visits for weather-first destination intent.

### Activation

- time to first three candidates;
- shortlist creation rate;
- share rate;
- second-participant arrival rate;
- first vote rate.

### Decision

- rooms with at least two voters;
- median time to destination lock;
- candidate count at lock;
- reopen rate;
- rooms abandoned before lock.

### Planning

- locked rooms that create a shared trip;
- trips with at least three activity ideas;
- trips with at least one resolved decision;
- trips with at least one day arranged.

### Retention

- D-7, D-3 and D-1 return rate;
- weather-change summary open rate;
- action-level adjustment rate;
- notification disable rate.

### Guardrails

- destination candidate error rate;
- stale-weather exposure;
- rooms with fabricated consensus;
- anonymous participation failure rate;
- commercial content appearing before lock;
- Core Web Vitals regression.

## 14. Commercial model

The decision experience remains independent.

After destination lock, the product may offer:

- accommodation search;
- transport search;
- local activities;
- car rental;
- connectivity;
- insurance.

Rules:

- ranking is never affected by commission;
- paid placement is clearly labeled;
- a commercial provider is optional and replaceable;
- the trip remains usable when every commercial integration is disabled.

## 15. Key risks

### Low frequency

Mitigation:

- focus on weekend and short-horizon travel;
- use group invitations as the growth loop;
- retain saved decision rooms until departure;
- send only decision-changing alerts.

### Weather is not enough

Mitigation:

- add origin, duration and transport constraints progressively;
- expose unsupported accessibility rather than inventing it;
- keep user candidate removal easy.

### Collaboration becomes generic

Mitigation:

- no free-form project board;
- every collaboration object targets a travel decision;
- explicit state machine;
- destination lock as the central transition.

### Data horizon

Mitigation:

- 14-day hard boundary;
- uncertainty labels;
- save future intent without precise ranking.

### Existing product complexity

Mitigation:

- primary navigation has only `Decide where` and `Plan together`;
- imports, route optimization and execution mode are secondary;
- stop new work on out-of-scope modules.

## 16. Definition of success

The product direction is validated when a user can:

1. create a weather-first comparison in under 60 seconds;
2. receive three to five understandable candidates;
3. share one link;
4. get at least one other person to participate without registration;
5. lock a destination;
6. continue into a shared trip without re-entering dates or city;
7. arrange at least one day using weather context.

The direction is not validated by page views, raw trip creation or the number of AI-generated activities.
