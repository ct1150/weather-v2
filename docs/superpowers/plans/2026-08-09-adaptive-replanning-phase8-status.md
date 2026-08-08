# Phase 8 execution status

Date: 2026-08-09

- Slice A — bounded hourly weather read: Complete
- Slice B — deterministic activity risk: Complete
- Slice C — deterministic replan solver: Complete
- Slice D — secure proposal apply boundary: Complete
- Slice E — review / apply UX: Focused acceptance passed; full repository Preview gate pending
- Slice F — Today / Execution Mode + release: Not started

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

## Slice E focused acceptance

- Review/Apply panel reads hourly weather and builds the deterministic solver proposal without mutating the workspace.
- Before/after activity and risk scores are visible before apply.
- Protected fixed activities are explicitly shown as unchanged.
- Users can select only the changes they approve.
- Local-only and Viewer states can inspect proposals but cannot apply Cloud changes.
- Cloud apply calls only the dedicated `/replan/apply` boundary.
- Local workspace state is updated only after the server returns the accepted Cloud Trip revision.
- English, Simplified Chinese and Traditional Chinese review copy is present.
- Focused Activity Risk + Solver + proposal UI contract tests and Web typecheck passed.

The next gate is full repository CI + Preview deployment + Phase 5/6/7/Hourly regression smoke on the same Slice E acceptance head. Slice F starts only after that gate is green.
