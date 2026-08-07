# Where Not Rain — End-to-End UX Execution Plan

Date: 2026-08-07
Status: Complete
Owner: Product / UX / Web

## Goal

Turn Weather Radar and Trip Planner from two adjacent feature sets into one coherent travel-weather decision journey:

1. Discover where / when weather is suitable.
2. Inspect a country and city without losing the selected date context.
3. Add the selected destination into an itinerary.
4. Import an existing itinerary with as little manual cleanup as possible.
5. Use the workspace in a decision-first mode, with editing available only when needed.

All four phases were released independently through the existing Cloudflare production workflow and closed only after production verification.

---

## Phase 1 — Navigation, trust and landing-page consistency

Priority: P0
Status: Complete
Production run: `31146771831`

### Delivered

- Where Not Rain logo now returns to the true localized Weather Radar homepage (`/`, `/zh-cn`, `/zh-hant`).
- Weather Radar and Trip Planner expose active navigation state.
- Fixed array offsets for `weekend` and `next_week` were replaced by calendar-aware date-window selection from actual forecast dates.
- Homepage Radar and country weather explorers use the same window semantics.
- Exact dates remain visible for ambiguous windows.
- Simplified Chinese `/zh-cn/trips` now follows the same consumer product structure as English and Traditional Chinese.
- Internal go-to-market / B2B strategy copy was removed from the consumer page.

### Verification

- Friday weekend tests resolve to the immediately following Saturday and Sunday.
- Format, lint, typecheck, unit/integration tests, docs gate, static export, Workers and production deployment passed.
- Production smoke passed before Phase 2 was released.

---

## Phase 2 — Connect Weather Radar to Trip Planner

Priority: P1
Status: Complete
Production run: `31148100356`

### Delivered

- Country comparison preserves selected travel dates/window in city-detail URLs.
- City detail surfaces the selected date context when entered from Weather Radar.
- English, Simplified Chinese and Traditional Chinese city pages now bridge into Trip Planner.
- `Add to my trip / 加入我的行程` safely reuses a pristine blank day or appends to an existing itinerary.
- Existing itinerary title, party profile, days and activities are preserved.
- Locale is preserved into the destination workspace.
- The bridge includes server-visible explanatory copy plus a client action for local-storage mutation/navigation.

### Verification

- PR Deploy CI was fully green before merge.
- Production smoke verified English, Simplified Chinese and Traditional Chinese city-to-trip surfaces.
- Existing Radar, city, workspace and API smoke checks remained green.

---

## Phase 3 — Reduce itinerary-import manual work

Priority: P1
Status: Complete
Production run: `31148642476`

### Delivered

- User-facing CTA changed from implementation terminology to `Import existing itinerary / 导入现有行程 / 匯入現有行程`.
- Import editor now starts empty instead of pre-filling sample content.
- Explicit `Try sample / 使用示例 / 試用範例` action is available.
- Supported cities are inferred from headings/route text only when exactly one city matches.
- Obvious beach/island, indoor and outdoor day types are inferred from itinerary content.
- Ambiguous multi-city days and unsupported cities remain unresolved instead of being silently guessed.
- Preview surfaces inferred city/day type and identifies only days needing confirmation.
- Existing Markdown parser and manual workspace editing remain available.

### Verification

- Tests cover Chinese and English city inference, beach/indoor/outdoor inference, ambiguous multi-city input and unsupported destinations.
- PR Deploy CI was fully green before merge.
- Production smoke verified EN / zh-CN / zh-Hant landing and import routes, plus all prior product checks.

---

## Phase 4 — Decision-first workspace and destructive-action protection

Priority: P2
Status: Complete
PR validation run: `31148437283`
Production run: `31149012406`

### Delivered

- Workspace trip summary appears before low-frequency configuration.
- Each day shows its weather decision before edit controls.
- Per-day city/date/type/flexibility/activity/notes controls are collapsed behind an accessible native `<details>` editor.
- Global trip settings and templates are collapsible.
- Template replacement requires explicit confirmation.
- Starting a blank itinerary requires explicit confirmation.
- Print / blank-trip controls were moved behind a lower-priority `More trip actions` disclosure.
- Refresh Weather remains the primary workspace action; sharing/export behavior and local storage remain unchanged.
- Print CSS hides editing disclosures while preserving decision output.

### Verification

- A focused UX contract test locks summary-before-settings, decision-before-editor and destructive-action confirmations.
- Phase 4 PR CI passed Format, Lint, library build, Typecheck, tests, docs, static export, Worker builds and pipeline checks before merge.
- Final production deployment and complete product smoke passed.

---

## Final production state

Final production commit: `009ba3cece5aa74721b9c6213f9249f7ed45122f`
Final production run: `31149012406`
Final production smoke: success

The released user journey is now:

**Choose dates -> discover suitable weather -> inspect a city -> add it to a trip -> import or edit the itinerary -> understand what to keep/change -> act on Plan B.**

## Release discipline used

For every phase:

1. Add or update focused tests with the implementation.
2. Pass repository quality gates: format, lint, library build, typecheck, tests, docs gate, static export, Worker builds, pipeline contracts and secret scan.
3. Deploy through the existing main-branch Cloudflare workflow.
4. Verify production product smoke before allowing the next phase to merge.
5. Keep temporary codemod/build helpers out of the final main branch.
