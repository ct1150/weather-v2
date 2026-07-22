---
title: UX Bible
authority: UX
status: Active
last_updated: 2026-07-17
---

# UX Bible

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Information architecture

<!-- requirement
id: UX-IA-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-UX_IA_001
owner: UX
verification: pnpm docs:check
-->

<a id="UX-IA-001"></a>

### UX-IA-001 — Stable discovery information architecture

The navigation model moves from broad weather-led discovery to a country, city, ranking, comparison, planner, or editorial decision. Primary route families are:

- `/` for homepage discovery and Travel Radar;
- `/explore` for Weather Explorer and `/search` for search outcomes;
- `/best-weather`, `/best-weekend`, `/best-beach`, `/best-hiking`, `/best-family`, and `/best-photo` for baseline rankings;
- named seasonal or activity landings only when their product and data contracts are available;
- `/{countrySlug}` and `/{countrySlug}/{citySlug}` for country and city decisions;
- `/compare/{cityA}-vs-{cityB}`, planner, article, and news surfaces when their Roadmap-selected capabilities are active;
- `/admin` for the separately protected operational surface and `/api/*` outside user navigation.

Roadmap: [REL-MVP-UX_IA_001](11-Roadmap.md#REL-MVP-UX_IA_001).

#### Acceptance Criteria

- Global navigation prioritizes Home, Explore, Search, core rankings, and direct destination access before optional commercial or editorial destinations.
- Every primary content page provides a visible path back to broader discovery and at least one meaningful next destination action.
- Country and city slugs remain stable English ASCII identifiers while localized names appear in page content.
- Filters and query parameters do not create new primary navigation nodes or unbounded user-visible route families.
- Unavailable future capabilities are omitted or clearly unavailable; they are not represented as working navigation.
- Mobile and desktop navigation expose the same destinations and accessible names even when their visual controls differ.

## Homepage journey

<!-- requirement
id: UX-HOME-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-UX_HOME_001
owner: UX
verification: pnpm docs:check
-->

<a id="UX-HOME-001"></a>

### UX-HOME-001 — Mobile-first homepage decision flow

The homepage uses this decision order: hero (`Where is NOT raining?`), search, Travel Radar, time-window selection, progressive Weather Explorer, applicable weekend or theme rankings, sunny and rainy city context, popular destinations, recently updated content, eligible editorial content, and footer. Sections whose owning product capability is unavailable are omitted without disrupting the remaining order.

Roadmap: [REL-MVP-UX_HOME_001](11-Roadmap.md#REL-MVP-UX_HOME_001).

#### Acceptance Criteria

- On mobile, search and at least the first three destination recommendations precede the map and optional secondary content.
- The primary destination decision remains usable before Weather Explorer loads and when it never loads.
- Time-window controls are adjacent to or clearly associated with the recommendations they update and expose exact dates where the label could be ambiguous.
- A user can move from a recommendation, search result, or ranking entry to a city page with one clear primary action.
- Optional editorial and commercial sections never displace the core search and recommendation path above them.
- Reordering at responsive breakpoints preserves heading order, keyboard order, and the meaning of the mobile-first sequence.

## Design system

<!-- requirement
id: UX-DESIGN-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-UX_DESIGN_001
owner: UX
verification: pnpm docs:check
-->

<a id="UX-DESIGN-001"></a>

### UX-DESIGN-001 — Semantic visual and motion system

The visual language is clean, restrained, rounded, data-trustworthy, and mobile first. References such as Apple Weather, Airbnb, Google Travel, Linear, Notion, Vercel, Stripe, and Arc Browser may inform principles but their protected visual assets are not copied. Glass effects are limited to local hierarchy and never reduce contrast, legibility, or performance.

The shared system uses CSS variables and Tailwind semantic tokens rather than component-local brand values:

| Token group | Required vocabulary                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color       | `background`, `foreground`, `surface`, `surface-elevated`, `muted`, `primary`, `primary-foreground`, `success`, `warning`, `danger`, `storm`, `border`, `focus-ring` |
| Typography  | `display`, `heading-1` through `heading-4`, `body`, `body-small`, `label`, `caption`                                                                                 |
| Spacing     | 4 px base scale: `1`, `2`, `3`, `4`, `6`, `8`, `10`, `12`, `16`, `20`, `24`                                                                                          |
| Radius      | `sm` 8 px, `md` 12 px, `lg` 16 px, `xl` 24 px, `pill` 999 px                                                                                                         |
| Shadow      | `sm`, `md`, `floating`; dark surfaces prefer borders over heavy shadows                                                                                              |
| Motion      | `fast` 120 ms, `normal` 200 ms, `slow` 320 ms                                                                                                                        |
| Breakpoints | documented mobile-first Tailwind breakpoint vocabulary                                                                                                               |

Roadmap: [REL-MVP-UX_DESIGN_001](11-Roadmap.md#REL-MVP-UX_DESIGN_001).

#### Acceptance Criteria

- Shared components consume semantic tokens; arbitrary brand colors, spacing, radii, shadows, and motion values are not scattered through page code.
- System, light, and dark themes preserve the same semantic hierarchy and content meaning.
- Final color pairs, focus indicators, text, controls, weather states, and overlays satisfy WCAG 2.2 AA contrast requirements.
- Motion uses the documented durations, communicates state rather than decoration, and has a non-animated reduced-motion alternative.
- Responsive layouts start from the smallest supported viewport and do not require horizontal page scrolling for core content.
- Icons have consistent sizing and meaning and do not replace an accessible text label where the meaning is not otherwise explicit.

## Async and degraded states

<!-- requirement
id: UX-STATE-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-UX_STATE_001
owner: UX
verification: pnpm docs:check
-->

<a id="UX-STATE-001"></a>

### UX-STATE-001 — Complete asynchronous state contract

Every asynchronous data surface defines **Skeleton**, **Loading**, **Empty**, **Partial Data**, **Stale Data**, **Error**, **Offline**, and **Retry** behavior. A state communicates what is known, what is unavailable, whether displayed data is current, and what action the user can take.

Roadmap: [REL-MVP-UX_STATE_001](11-Roadmap.md#REL-MVP-UX_STATE_001).

#### Acceptance Criteria

- Skeleton geometry approximates final content and reserves only necessary space so transition to content does not create avoidable layout shift.
- Loading indicators have an accessible status message and do not conceal already usable trustworthy content.
- Empty states distinguish “no matching result” from “data unavailable” and provide an appropriate search, filter-reset, or navigation action.
- Partial Data identifies unavailable fields without treating missing values as zero, safe, or optimal.
- Stale Data remains visibly time-qualified everywhere it appears and never uses styling that implies a fresh observation.
- Error messages use the selected user language, expose no stack, credential, internal provider message, or sensitive implementation detail, and offer retry only when retry is meaningful.
- Offline behavior retains available local or rendered content, labels network-dependent actions, and restores normal state after connectivity returns.
- Retry controls prevent accidental duplicate actions, maintain focus, and report the resulting success or continued failure.

## Accessibility

<!-- requirement
id: UX-A11Y-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-UX_A11Y_001
owner: UX
verification: pnpm docs:check
-->

<a id="UX-A11Y-001"></a>

### UX-A11Y-001 — WCAG 2.2 AA core journeys

Core homepage, search, ranking, explorer fallback, country, city, locale, and commercial-disclosure journeys target WCAG 2.2 AA and remain complete with keyboard and assistive technology.

Roadmap: [REL-MVP-UX_A11Y_001](11-Roadmap.md#REL-MVP-UX_A11Y_001).

#### Acceptance Criteria

- All interactive controls are keyboard reachable and operable in a logical order, with a visible focus indicator and no keyboard trap.
- Heading levels, landmarks, lists, tables, form labels, validation messages, and live status announcements use appropriate semantics.
- Pointer targets are at least 44 × 44 CSS px, or have equivalent spacing and target behavior permitted by WCAG 2.2 AA.
- Color is never the sole carrier of weather, risk, ranking, selection, success, warning, or error meaning.
- Maps, charts, score visualizations, flags, and weather icons provide equivalent text; the map has a list fallback capable of completing the same destination-selection task.
- Content remains understandable at text zoom and responsive reflow, and focus is not obscured by sticky headers, dialogs, or overlays.
- `prefers-reduced-motion` disables nonessential animation and avoids motion-only state changes.
- Automated accessibility checks are supplemented by keyboard and screen-reader review of the core journeys.

## Internationalization and localization

<!-- requirement
id: UX-I18N-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-UX_I18N_001
owner: UX
verification: pnpm docs:check
-->

<a id="UX-I18N-001"></a>

### UX-I18N-001 — Five-locale core experience

The core localized experience supports English, Japanese, Korean, Simplified Chinese, and Traditional Chinese. English uses unprefixed routes; other core locales use `/ja`, `/ko`, `/zh-cn`, and `/zh-tw`. Slugs remain stable English ASCII identifiers while destination names, labels, reasons, metadata inputs, and messages are localized.

Roadmap: [REL-MVP-UX_I18N_001](11-Roadmap.md#REL-MVP-UX_I18N_001).

#### Acceptance Criteria

- User-facing UI strings are dictionary-backed and are not hard-coded into reusable components or domain records.
- A first visit may suggest the browser language but does not force a redirect that removes user choice or destabilizes a shared URL.
- A visible language control changes locale while preserving the corresponding destination or product context when that localized page exists.
- Dates, times, numbers, temperatures, wind speeds, and currencies use locale-aware formatting; weather dates and times use the destination's local time zone rather than the server time zone.
- Users can select °C or °F for display while labels remain explicit; unit choice and language preference persist without storing personal information.
- Missing translation keys fall back to English and are reported in development or validation rather than producing a blank label.
- Localized SEO and safety text receives human or defined quality review and is not generated by unreviewed low-quality runtime translation.

<!-- requirement
id: UX-I18N-002
status: Active
kind: Hard
roadmap_ref: REL-Beta-UX_I18N_002
owner: UX
verification: pnpm docs:check
-->

<a id="UX-I18N-002"></a>

### UX-I18N-002 — Thai and Vietnamese experience

The expanded localized experience adds Thai at `/th` and Vietnamese at `/vi` under the same route stability, formatting, fallback, content-quality, and accessibility rules as the core locales.

Roadmap: [REL-Beta-UX_I18N_002](11-Roadmap.md#REL-Beta-UX_I18N_002).

#### Acceptance Criteria

- Thai and Vietnamese dictionaries cover the complete core journey, including weather reasons, async states, validation, disclosure, stale-data, and safety messaging, before either locale is publicly selectable.
- Locale-aware dates, numbers, units, currency, line wrapping, font coverage, and control sizing are reviewed with representative Thai and Vietnamese content.
- `/th` and `/vi` preserve canonical destination slugs and map to the same underlying country and city identity as other locales.
- Missing keys use the explicit English fallback and are reported; mixed-language output is not accepted as complete locale coverage.
- Public localized content and metadata pass human or defined quality review before becoming indexable.
