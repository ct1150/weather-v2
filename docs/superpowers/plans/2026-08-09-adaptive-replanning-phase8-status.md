# Phase 8 execution status

Date: 2026-08-09

- Slice A — bounded hourly weather read: Complete
- Slice B — deterministic activity risk: Complete
- Slice C — deterministic replan solver: Complete
- Slice D — secure proposal apply boundary: Complete
- Slice E — review / apply UX: Complete
- Slice F — Today / Execution Mode + release: Implementation and Preview end-to-end acceptance complete; final repository/production gate pending

## Slice D acceptance

- OWNER/EDITOR apply creates the normal next Cloud Trip version and immutable revision.
- VIEWER apply is rejected server-side.
- Stale `baseVersion` is rejected with the current version.
- Unrelated trip/day metadata edits are rejected.
- Actual structured activity changes must exactly match user-approved activity IDs.
- No-op apply is rejected.
- Successful revision operation is `replan`.
- Audit payload records `weatherSnapshotId` and approved activity IDs.
- Full repository Deploy 295 and Phase 5/6/7/Hourly Preview regressions passed.

## Slice E acceptance

- Review/Apply panel reads hourly weather and builds the deterministic solver proposal without mutating the workspace.
- Before/after activity and risk scores are visible before apply.
- Protected fixed activities are explicitly shown as unchanged.
- Users can select only the changes they approve.
- Local-only and Viewer states can inspect proposals but cannot apply Cloud changes.
- Cloud apply calls only the dedicated `/replan/apply` boundary.
- Local workspace state is updated only after the server returns the accepted Cloud Trip revision.
- English, Simplified Chinese and Traditional Chinese review copy is present.
- Focused Activity Risk + Solver + proposal UI contract tests and Web typecheck passed.
- Full repository Deploy 301 and Phase 5/6/7/Hourly Preview regressions passed.

## Slice F acceptance so far

- Today Mode resolves the active trip day using the destination timezone rather than the device timezone.
- Current/next structured activity, current hourly weather, activity risk and fixed constraints are surfaced in execution view.
- Cloud-backed Today Mode can surface relevant Weather Insights and the latest accepted replan audit.
- English, Simplified Chinese and Traditional Chinese Today Mode copy is present.
- Focused Today Mode resolver/UI contracts and Web typecheck passed.
- Dedicated Phase 8 Preview end-to-end smoke passed against real persisted hourly weather.
- The end-to-end smoke verifies deterministic same-day replanning, OWNER and EDITOR apply, fixed transport preservation, VIEWER rejection, stale-version rejection, normal `replan` revisions and weather-snapshot audit context.
- Final smoke/workflow formatting has been normalized and the temporary formatter workflow removed.

## Final Phase 8 gate

Run the final normal-user acceptance head through:

1. full Deploy repository gate and Preview deployment;
2. Phase 5 Weather Intelligence regression;
3. Phase 6 Discovery regression;
4. Phase 7 Activity Intelligence regression;
5. Phase 8 Hourly Weather regression;
6. Phase 8 Adaptive Replanning Preview smoke.

If all six are green, mark PR #37 ready, squash merge to `main`, then require the production Deploy plus Phase 8 Production smoke on the resulting release SHA before marking Phase 8 Complete.
