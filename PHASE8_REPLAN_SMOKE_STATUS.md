# Phase 8 Adaptive Replanning smoke status

- Conclusion: success
- Deploy head SHA: c26a444e1a2ebf51664276da7dfbf4a737a5a607
- Deploy run: https://github.com/ct1150/weather-v2/actions/runs/31320097163
- Verified at: 2026-08-09T15:08:06Z

## Checks

- real persisted hourly weather snapshot read: success
- deterministic same-day later smoke proposal: success
- OWNER replan apply: success
- EDITOR replan apply: success
- fixed transport constraint unchanged: success
- VIEWER apply rejected: success
- stale baseVersion rejected with current version: success
- normal immutable  revisions created: success
- replan audit retains weather snapshot and selected activity IDs: success
