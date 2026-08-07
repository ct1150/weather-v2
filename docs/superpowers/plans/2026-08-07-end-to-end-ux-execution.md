# Where Not Rain — End-to-End UX Execution Plan

Date: 2026-08-07
Status: Active
Owner: Product / UX / Web

## Goal

Turn the current Weather Radar and Trip Planner from two adjacent feature sets into one coherent travel-weather decision journey:

1. Discover where / when weather is suitable.
2. Inspect a country and city without losing the selected date context.
3. Add the selected destination into an itinerary.
4. Import an existing itinerary with as little manual cleanup as possible.
5. Use the workspace in a decision-first mode, with editing available only when needed.

Every phase must be independently releasable and must pass the existing production deployment and smoke gates before the next phase is considered complete.

---

## Phase 1 — Navigation, trust and landing-page consistency

Priority: P0
Implementation: complete
Release: validating production

### Changes

- Make the Where Not Rain logo return to the true localized Weather Radar homepage (`/`, `/zh-cn`, `/zh-hant`).
- Add active-state semantics/styles for Weather Radar and Trip Planner navigation.
- Replace fixed forecast array indexes for `weekend` and `next_week` with calendar-aware date-window selection derived from actual forecast dates.
- Apply the same window logic to homepage radar and country weather explorers.
- Keep exact dates visible for ambiguous windows.
- Align the Simplified Chinese `/zh-cn/trips` landing information architecture with the English and Traditional Chinese product landing pages.
- Remove internal go-to-market / B2B strategy copy from the consumer page.

### Acceptance criteria

- Clicking the logo from any public page returns to the localized Weather Radar root.
- The current top-level product area is visually and semantically active in the header.
- On a Friday, `This weekend / 本周末` resolves to the immediately following Saturday and Sunday, not fixed offsets 5 and 6.
- `Next week / 下周` is based on the next calendar Monday and uses only forecast days that actually exist.
- English, Simplified Chinese and Traditional Chinese trip landing pages expose the same product structure and primary tasks.
- Deploy + product smoke pass.

---

## Phase 2 — Connect Weather Radar to Trip Planner

Priority: P1

### Changes

- Preserve selected date/window context from country comparison into city detail URLs.
- Read that context on city pages and visually emphasize the selected travel dates.
- Add a localized `Add to my trip / 加入我的行程 / 加入我的行程` action from city weather detail.
- Pre-populate a workspace day with selected city and selected date when entering from Weather Radar.
- Preserve locale and existing workspace data when adding a destination.

### Acceptance criteria

- Country -> city navigation retains the selected date range/window in the URL.
- City pages visibly explain which dates are being evaluated.
- `Add to trip` creates or appends a workspace day without destroying an existing itinerary.
- The user lands on the correct localized workspace.
- Deploy + product smoke pass for EN / zh-CN / zh-Hant routes.

---

## Phase 3 — Reduce Markdown-import manual work

Priority: P1

### Changes

- Change the import affordance language from implementation terminology to user terminology (`Import existing itinerary`), keeping Markdown as a supported-format hint.
- Start with an empty editor instead of pre-filling a sample itinerary.
- Provide a distinct `Try sample / 使用示例 / 試用範例` action.
- Infer forecast city from imported headings / route text when an unambiguous supported city is present.
- Infer day type from recognizable activity keywords (beach/island, outdoor, indoor, otherwise city).
- Preserve manual override for every inferred field.
- Surface only unresolved days as needing user attention.

### Acceptance criteria

- A normal Tokyo / Kyoto / Osaka style itinerary imports with cities pre-selected when names are recognizable.
- Obvious beach/island days are inferred as beach; museum-heavy days can be inferred as indoor.
- Ambiguous content remains unassigned rather than being guessed silently.
- Existing Markdown parsing remains backward compatible.
- Deploy + product smoke pass.

---

## Phase 4 — Decision-first workspace and destructive-action protection

Priority: P2

### Changes

- Reorder the workspace so the first meaningful view is the trip decision summary and high-risk days, not a wall of edit fields.
- Default each day to a compact decision card with an explicit `Edit day / 编辑当天 / 編輯當天` affordance.
- Keep detailed city/date/type/flexibility/activity/notes controls collapsible.
- Add confirmation before replacing the current itinerary with a template.
- Add confirmation before starting a blank itinerary.
- Move `Start blank trip` into a lower-priority / more-actions area.
- Keep Refresh Weather as the primary workspace action; Share and Export remain secondary.

### Acceptance criteria

- A returning user can see overall trip status and high-risk days before editing fields.
- Editing controls are reachable but do not dominate the initial mobile viewport.
- Template and blank-trip actions cannot wipe work without confirmation.
- Existing local storage, sharing and export behavior remain intact.
- Deploy + product smoke pass.

---

## Release discipline

For every phase:

1. Add or update focused tests before/with implementation.
2. Run through repository quality gates: format, lint, library build, typecheck, tests, docs gate, static export, worker builds, pipeline contracts, secret scan.
3. Deploy through the existing main-branch Cloudflare workflow.
4. Verify production product smoke.
5. Record the phase completion in this plan by changing its status and adding the deployed commit/run.

## Definition of done

The UX refactor is complete when a first-time user can naturally follow this path without learning the site architecture:

**Choose dates -> discover suitable weather -> inspect a city -> add it to a trip -> import or edit the itinerary -> understand what to keep/change -> act on Plan B.**
