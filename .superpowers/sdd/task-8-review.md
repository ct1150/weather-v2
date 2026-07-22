# Task 8 Review

1. Strengthen every task Verify so zero tests cannot pass: require expected implementation/test artifact with `test -f`, then run targeted test/build. Performance task must run Lighthouse CI and a RUM gate command; deployment task must run preview deployment contract/smoke scripts (not just typecheck). Keep all tasks pending.
2. Restore useful implementation design interfaces calibrated to current authority: application use cases/ViewModels/ports, D1-active-first ReadModelResolver with immutable KV and no user writes, AsyncState<T>, key/interface shapes and API adapter boundary. Do not restore obsolete KV-first/stable-key contracts or duplicate authority.

## Re-review findings

1. Eliminate zero-test gates without changing shared Vitest config: use `.test.ts` artifact paths, pass `--passWithNoTests=false` for every Vitest command, and wrap Node test output with a TAP count assertion requiring `# tests` > 0.
2. Model D1 authority as `{ active: WeatherPublicationIdentity, publicationTokenHighWater: number }`; verification requires all active identity fields match and active fencing token equals high-water.
3. Expand Task 23 Verify to build immutable artifact, deploy preview and capture artifact/environment identity, run preview migrations + repository checks, smoke that exact deployment, and run promotion contract/dry-run proving production reuses the same artifact and fails closed.
