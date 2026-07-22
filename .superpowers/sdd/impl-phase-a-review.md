# Where Not Rain — Phase A (Kiro MVP Tasks 1–8) Independent QA Review

- **Reviewer:** software-qa-engineer (严过关 / Yan), team `software-wnr-impl`
- **Date:** 2026-07-20
- **Workspace:** `/root/test/weather` (WSL `Ubuntu24`)
- **Method:** Re-ran each Task 1–8 exact `Verify` command independently inside WSL (capturing exit codes); ran phase-level `pnpm -r build` + `pnpm -r test`; verified `weather.txt` integrity; audited import boundaries; scanned for credentials / real external integration; confirmed Tasks 9–24 are unchecked. No claims were trusted — every `Verify` was executed.

## Task verification table

| Task | Method (exact Verify command re-run)                                                                          | Observed result                                                                                                                                                                                                                                                                    | Verdict            |
| ---- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1    | `node --test tooling/eslint-config/boundaries.test.mjs` (3 tests) `&& pnpm lint && pnpm -r build`             | boundary test **3/3 pass**; `pnpm -r build` **exit 0** (TS6059 resolved); **`pnpm lint` FAILS (exit 1, 1 error)** — original 2 errors now FIXED, but a NEW error remains: `packages/db/src/read-model-resolver.test.ts:83` (`_params` unused, `@typescript-eslint/no-unused-vars`) | **FAIL** (blocker) |
| 2    | `pnpm --filter @wnr/config exec vitest run src/runtime-config.test.ts && pnpm --filter @wnr/config build`     | **16 tests pass**; build exit 0                                                                                                                                                                                                                                                    | PASS               |
| 3    | `pnpm --filter @wnr/db exec vitest run src/geography-repository.test.ts && pnpm --filter @wnr/db build`       | **16 tests pass**; build exit 0                                                                                                                                                                                                                                                    | PASS               |
| 4    | `pnpm --filter @wnr/db exec vitest run src/migrations.test.ts && pnpm --filter @wnr/db build`                 | **12 tests pass**; build exit 0                                                                                                                                                                                                                                                    | PASS               |
| 5    | `pnpm --filter @wnr/domain exec vitest run src/score/travel-score.test.ts && pnpm --filter @wnr/domain build` | **13 tests pass**; build exit 0                                                                                                                                                                                                                                                    | PASS               |
| 6    | `pnpm --filter @wnr/weather exec vitest run src/provider.test.ts && pnpm --filter @wnr/weather build`         | **7 tests pass**; build exit 0                                                                                                                                                                                                                                                     | PASS               |
| 7    | `pnpm --filter @wnr/weather-sync exec vitest run src/sync.test.ts && pnpm --filter @wnr/weather-sync build`   | **6 tests pass**; build exit 0                                                                                                                                                                                                                                                     | PASS               |
| 8    | `pnpm --filter @wnr/db exec vitest run src/read-model-resolver.test.ts && pnpm --filter @wnr/db build`        | **6 tests pass**; build exit 0                                                                                                                                                                                                                                                     | PASS               |

> T1's `node --test` and `pnpm -r build` pass; only the `pnpm lint` gate fails, but that gate is part of the T1 `Verify` command, so the command as a whole does **not** exit 0. The boundary test itself is real (exercises actual forbidden import directions on disk fixtures), not vacuous.

## Phase-level regression

- **`pnpm -r build`** → **exit 0**. All 18 workspace projects build (TS6059 fixed and stable).
- **`pnpm -r test`** → **exit 0**. Exact counts:
  - `packages/config`: 16 passed
  - `packages/domain`: 13 passed
  - `packages/weather`: 7 passed
  - `packages/db`: 34 passed (3 files: geography-repository 16 + migrations 12 + read-model-resolver 6)
  - `workers/weather-sync`: 6 passed
  - `apps/web`, `workers/maintenance`, `packages/ui`, `packages/i18n`, `packages/seo`, `packages/analytics`, `packages/test-utils`: 0 (no test files yet; `passWithNoTests: true`)
  - **Total: 76 tests, 0 failures.**
- Note: the eslint boundary test (3 tests) is run via T1's `node --test`, not under `pnpm -r test`, so it is not in the 76 above.

## weather.txt integrity

- **sha256 = `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`**
- **size = 15938 bytes**
- **MATCH** — identical to the required hash; file never modified during Phase A.

## Boundary audit

- `tooling/eslint-config/index.js`: `eslint-plugin-boundaries` with `default: "disallow"`; `provider-adapter` isolated to `packages/weather/src/provider.ts` and classified **before** `package`; `app` may NOT import `provider-adapter`; only `worker` may.
- `boundaries.test.mjs` exercises **real** forbidden directions on disk fixtures: app→provider-adapter **rejected**, app→db **allowed**, worker→provider **allowed** (3 genuine assertions, not vacuous).
- Repo-wide grep: `@wnr/weather` is imported **only** by `workers/weather-sync/src/sync.ts` (+ its test). No `apps/*` or `packages/*` import it. `apps/web/src` contains only a comment mentioning `@wnr/weather` (no import).
- No `fetch()` / external network calls in any `.ts` source; the provider is `FakeWeatherProvider` only (deterministic, network-free). No `.env`/credentials committed (grep for `apiKey|secret|token|Bearer|AKIA|sk-` matched only `docs/*.md` policy text).
- **Result: PASS** — no boundary violations; the would-fail rule exists and is exercised.

## Tasks 9–24

- All remain `[ ]` (unchecked) in `tasks.md`. Confirmed. Phase A scope correctly limited to 1–8.

## Overall verdict: **REOPEN** (2nd independent QA re-verify, 2026-07-20 — T1 still FAIL; Phase A NOT approved)

### Critical / Major findings

- **CRITICAL — false completion claim (Task 1), 2nd independent re-verify (2026-07-20).** The Engineer claimed _"T1's full Verify exits 0"_ after fixing the first 2 lint errors. On re-run, the original 2 errors ARE fixed (isolated eslint on both files exits 0), but `pnpm lint` (the `pnpm -r lint` step inside the T1 `Verify` command) **STILL exits 1** — now with a NEW error in `packages/db/src/read-model-resolver.test.ts:83` (`_params` unused, `@typescript-eslint/no-unused-vars`). So the T1 `Verify` command does **not** exit 0. The claim is FALSE and the `[ ]` checkbox for T1 remains invalid. (Boundary test 3/3 and `pnpm -r build` do pass; only `pnpm lint` fails.)
- **MAJOR — lint errors in Phase A source files** (root cause of the T1 failure):
  - _Original 2 errors — NOW FIXED (verified 2026-07-20, 2nd pass):_ (1) `packages/config/src/runtime-config.ts:114` — `prefer-const` (`let affiliates`); (2) `packages/domain/src/score/travel-score.test.ts:132` — `no-unused-vars` (`confidence` unused). Both pass isolated eslint (exit 0) after the Engineer's fix; both were within Phase A scope (T2, T5).
  - _NEW error — STILL OPEN:_ `packages/db/src/read-model-resolver.test.ts:83:39` — `@typescript-eslint/no-unused-vars`: `_params` is defined but never used. This is a **source defect** in a T8 Phase A test file → route to Engineer. Minimal fix: remove the unused binding. (T8's own `Verify` only runs `vitest` + `build`, which does not invoke eslint, so this error was never surfaced by the T8 gate — only by T1's repo-wide `pnpm lint` gate.)
- **Minor (reporting only, not a verification failure).** `impl-phase-a-report.md` states _"Total targeted tests in Phase A suites: 69"_. Actual total is **79** (3 boundary + 76 vitest). Arithmetic error in the report; the tests themselves are correct and green.

### Required before re-closing T1

1. Engineer resolves the remaining lint error: `packages/db/src/read-model-resolver.test.ts:83` (`_params` unused). (The original 2 errors are already fixed.)
2. Re-run the exact T1 `Verify` (`node --test boundaries.test.mjs` → `pnpm lint` → `pnpm -r build`) and confirm **all three** exit 0 — i.e. `pnpm lint` must now exit 0.
3. Re-check the T1 box only after that.

### Notes

- T2–T8 `Verify` commands all exit 0; their targeted tests and package builds are green.
- `tasks.md` T1 `Evidence` was corrected in place because it was a false claim (see the inline QA-review note on Task 1).
