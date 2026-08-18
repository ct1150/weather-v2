# Information architecture — Weather-first group destination decision

Date: 2026-08-18  
Status: Product-owner approved direction; pending authority cutover  
Related PRD: `2026-08-18-founder-prd-weather-first-group-decision.md`

## 1. IA objective

Make the entire product understandable through two verbs:

1. **Decide where**
2. **Plan together**

Users should not need to understand internal modules such as Travel Radar, Weather Discovery, Cloud Trip, Workspace, Execution Mode or adaptive replanning before receiving value.

## 2. Primary navigation

### English

```text
Where Not Rain · Decide together
[Decide where] [Plan together] [Language]
```

### Simplified Chinese

```text
Where Not Rain · 一起去哪
[一起去哪] [共同规划] [语言]
```

### Traditional Chinese

```text
Where Not Rain · 一起去哪
[一起去哪] [共同規劃] [語言]
```

### Navigation rules

- the brand links to the localized homepage;
- `Decide where` links directly to localized `/discover`;
- `Plan together` links to localized `/trips`;
- imports, execution mode, route optimization and exports are not top-level navigation items;
- locale fallback routes to localized discovery, not an advanced workspace;
- country and city weather pages remain within the decision area.

## 3. Primary route map

```text
/
├─ /discover
├─ /together?room=<token>             planned
├─ /[country]
├─ /[country]/[city]
└─ /trips
   ├─ /trips/workspace
   ├─ /trips/share
   ├─ /trips/new                      advanced
   └─ /trips/execution                advanced
```

Localized mirrors:

```text
/zh-cn/...
/zh-hant/...
```

## 4. Route responsibilities

### `/` — product orientation

Primary purpose:

- explain the dates-fixed, destination-open problem;
- send users to weather comparison;
- provide a secondary path to continue an existing shared trip;
- retain crawlable weather rankings and country guides.

Primary CTA:

```text
Compare destinations
```

Secondary CTA:

```text
Continue shared planning
```

Not a primary CTA:

```text
Import existing itinerary
```

### `/discover` — destination comparison

Primary purpose:

- choose dates and weather intent;
- compare three to five destinations;
- understand reasons and trade-offs;
- save candidates;
- share the current comparison;
- create a decision room.

Current behavior retained:

- advanced filters under progressive disclosure;
- shareable URL;
- saved shortlist;
- daily weather;
- city detail links;
- create trip from shortlist.

Planned behavior:

- origin and travel-time preferences;
- `Create decision room`;
- room status and participant count;
- direct transition to `/together`.

### `/together?room=<token>` — decision room

Planned static-shell route.

Primary purpose:

- give every participant the same evidence;
- collect structured destination opinions;
- discuss a candidate;
- show aggregate group preference;
- let owner lock one destination.

Page sections:

```text
Room summary
Candidate cards
Group vote summary
Candidate discussion
Decision history
Owner controls
```

Anonymous participant entry:

```text
Nickname
→ Join room
→ Vote
```

No full registration wall.

### `/trips` — shared planning hub

Primary purpose:

- continue trips created after a destination decision;
- show product value before login state;
- provide one entry to local/shared workspace;
- explain collaboration model;
- keep advanced import as a small secondary link.

### `/trips/workspace` — shared trip

Primary purpose:

- edit days and activities;
- view weather context;
- discuss changes;
- record explicit decisions;
- view revisions.

Planned information order:

```text
Trip decision summary
Days and weather
Activity candidate pool
Day assignments
Comments and decisions
Advanced tools
```

### `/trips/new` — advanced import

Status:

- maintained;
- indexable only if SEO strategy supports it;
- not promoted on homepage or top navigation;
- used by users who already possess an itinerary.

### `/trips/execution` — advanced execution

Status:

- maintained;
- linked from a prepared trip, not global navigation;
- route, offline and today-mode capability remain optional;
- no new expansion until the core decision funnel is validated.

## 5. Homepage hierarchy

```text
1. Hero: dates fixed, destination open
2. Primary CTA: compare destinations
3. Three-step decision flow
4. Weather shortlist / ranked cards
5. Map
6. Country guides
7. Footer
```

The homepage must not lead with:

- AI itinerary generation;
- account login;
- cloud save;
- execution mode;
- import;
- route optimization.

## 6. Discover hierarchy

```text
1. Date range
2. Primary weather intent
3. Update results
4. Optional preferences
5. Best three to five matches
6. Saved shortlist
7. Map
8. Comparison
9. Share / create room
10. Create shared trip fallback
```

### Result-card content order

```text
Rank
Destination
Primary recommendation
Primary caution
Weather match
Daily weather
Save / remove
View city
```

Score is supporting evidence, not the headline.

## 7. Decision room hierarchy

### Header

- room name;
- dates;
- owner;
- status;
- participant count;
- share action.

### Candidate card

- destination;
- weather fit;
- positive reasons;
- watch-outs;
- daily forecast;
- accessibility evidence;
- vote controls;
- comments;
- owner remove action.

### Group summary

- participant count;
- votes by stance;
- candidates with no votes;
- disagreement indicator;
- no artificial “winner” before owner locks.

### Owner action

```text
Lock destination
```

Requires explicit confirmation and displays:

- chosen destination;
- latest weather freshness;
- vote distribution;
- any unresolved `avoid` reasons;
- effect: creates shared trip.

## 8. Shared planning hierarchy

After destination lock:

```text
1. Destination decision banner
2. Dates and daily weather
3. Activity ideas
4. Group preferences
5. Day arrangement
6. Open decisions
7. Discussion and revision history
8. Advanced tools
```

### Destination decision banner

Shows:

- locked city;
- who locked it;
- when;
- weather snapshot time;
- reopen action for owner;
- link back to decision history.

### Activity idea card

Shows:

- activity title;
- indoor/outdoor/mixed;
- estimated duration;
- fixed/flexible;
- participant preferences;
- current day assignment;
- weather fit for assigned day.

## 9. Terminology map

| Internal/old term | User-facing term |
|---|---|
| Travel Radar | Weather shortlist |
| Weather Discovery | Decide where / 一起去哪 |
| Trip Planner | Plan together / 共同规划 |
| Workspace | Shared trip / 共享行程 |
| Cloud Trip | Shared trip |
| Collaboration panel | Discussion & decisions |
| Intent score | Weather match |
| Phase 7/8/9 | Never shown |
| Execution Mode | Today / 出行模式, only inside a trip |
| Adaptive Replanning | Weather adjustment |
| Candidate shortlist | Saved destinations |
| DecisionRoom | Decision room / 目的地决策房间 |

## 10. Progressive disclosure

### Always visible

- dates;
- weather intent;
- shortlist;
- recommendation reasons;
- cautions;
- share;
- group decision status.

### Optional

- strict temperature/rain/wind thresholds;
- party type;
- trip style;
- accessibility details;
- revisions;
- route optimization;
- exports;
- cloud settings;
- execution tools.

## 11. Authentication placement

### No login required

- browse weather;
- create local shortlist;
- open a public room;
- join with nickname;
- vote;
- read a shared trip when token permits.

### Login requested after value

- own a persistent room;
- recover room across devices;
- create/edit cloud trip;
- invite editors;
- enable notifications;
- manage several trips.

Login prompt:

> Your decision is saved on this device. Sign in to recover it across devices and keep the group updated when the weather changes.

## 12. Mobile IA

Mobile order is strict:

```text
decision
→ evidence
→ action
```

Avoid:

- horizontal comparison tables;
- sidebars;
- persistent multi-panel editors;
- hidden critical owner controls.

Mobile decision room:

- sticky room status and share;
- vertically stacked candidates;
- vote controls within thumb reach;
- owner lock action sticky only after confirmation prerequisites.

## 13. SEO IA

Indexable:

- homepage;
- `/discover`;
- fixed weather-intent landing pages when added;
- country pages;
- city pages;
- public explanatory product pages;
- optional anonymized showcase rooms only with explicit owner opt-in.

Not indexable:

- private decision rooms;
- tokenized room URLs;
- shared trip tokens;
- account pages;
- local workspace state;
- execution mode;
- query-specific shortlist combinations.

Canonical rules:

- `/discover` query variants canonicalize to localized `/discover`;
- decision room pages use `noindex`;
- share tokens never appear in sitemap;
- country/city weather pages remain crawlable acquisition surfaces.

## 14. Commercial placement

Before destination lock:

- no commercial ranking;
- no hotel cards between candidates;
- no sponsored candidate disguised as recommendation.

After lock:

- separate “Book this trip” area;
- clearly labeled provider;
- no change to weather or vote ordering.

## 15. De-emphasis map

### Keep and maintain

- weather sync/read pipeline;
- discovery ranking;
- shortlist;
- saved destinations;
- city/country SEO;
- Cloud Trip;
- comments;
- decisions;
- revisions;
- daily weather;
- local-first storage.

### Hide from primary IA

- import;
- templates;
- route optimization;
- execution mode;
- PDF/ICS exports;
- offline map utilities;
- detailed reservation tools.

### Stop expanding

- AI itinerary generator;
- universal itinerary audit;
- budget;
- packing;
- journal;
- generic chat;
- global real-time inventory.

## 16. Current code mapping

| IA surface | Current implementation |
|---|---|
| Homepage | `apps/web/src/app/page.tsx`, localized home pages |
| Primary header | `apps/web/src/components/SiteHeader.tsx` |
| Destination discovery | `WeatherDiscoveryPlannerV2.tsx` |
| Saved shortlist | `DiscoveryRetentionCompanion.tsx` |
| Trips hub | localized `/trips/page.tsx` |
| Shared workspace | `TripWorkspace.tsx`, `LocalizedTripWorkspace.tsx` |
| Cloud controls | `CloudTripControls.tsx` |
| Discussion and decisions | `TripCollaborationPanel.tsx` |
| Advanced execution | `TripExecutionWorkspace.tsx` |

## 17. IA acceptance criteria

- top navigation contains exactly two product tasks plus language;
- homepage primary CTA always points to discovery;
- homepage no longer promotes itinerary import as a peer task;
- trips landing starts from a chosen destination;
- import remains accessible but visually secondary;
- every locale communicates the same product hierarchy;
- current weather rankings remain crawlable;
- advanced capabilities remain reachable from context;
- no implemented page promises anonymous voting until the room feature ships.
