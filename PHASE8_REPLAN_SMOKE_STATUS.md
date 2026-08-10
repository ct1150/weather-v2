# Phase 8 Adaptive Replanning smoke status

- Conclusion: success
- Deploy head SHA: a15c1fce7cdaf8b5a5b463e8b56969145474400c
- Deploy run: https://github.com/ct1150/weather-v2/actions/runs/31347823196
- Verified at: 2026-08-10T01:47:48Z

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
