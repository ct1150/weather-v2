# Task 9 QA Review — Logical cutover & final verification

- Reviewer: software-qa-engineer (严过关 / Yan)
- Date: 2026-07-20
- Workspace: `\\wsl.localhost\Ubuntu24\root\test\weather` (WSL `Ubuntu24`, `/root/test/weather`)
- Method: independent re-run of every prescribed command via WSL; fresh-eyes semantic audit of the engineer's report claims. The engineer's claims were verified, not trusted.

## Verification results

| # | Check | Method (run in WSL `Ubuntu24`) | Observed result | Verdict |
|---|-------|-------------------------------|-----------------|---------|
| C1 | Active validation `pnpm docs:check` | `cd /root/test/weather && pnpm docs:check` | exit 0; `0 error(s), 0 warning(s); 81 requirement(s), 81 release(s), 178 trace(s)`. No `Needs Decision` in output (test #23 rejects such traces). | **PASS** |
| C2 | Docs test suite `pnpm docs:test` | `pnpm docs:test` | exit 0; `# tests 59 / # pass 59 / # fail 0`. | **PASS** |
| C3 | `pnpm format:check` | `pnpm format:check` | **exit 2**. Fails only on a pre-existing nested snapshot config `.superpowers/sdd/snapshots/task-2/prettier.config.js` that imports `@wnr/prettier-config` (package not installed there). No `.prettierignore` exists, so `prettier --check .` walks the whole repo including that untouched Task-2 snapshot. Docs/SPEC/README are Prettier-clean. | **BLOCKER** (pre-existing / infra; not a cutover defect) |
| C4 | `pnpm -r typecheck` | `pnpm -r typecheck` | **exit 2**. `error TS6059: .../packages/analytics/src/index.ts is not under 'rootDir' '/root/test/weather/tooling/tsconfig/src'`. Root cause: `tooling/tsconfig/library.json` sets `"rootDir": "src"` (inherited by every package via `@wnr/tsconfig/library.json`); that base config was not touched by Task 9. | **BLOCKER** (pre-existing product/tooling config; out of Task 9 scope) |
| C5 | `pnpm -r test` | `pnpm -r test` | exit 0. Every workspace reports "No test files found, exiting with code 0" (vacuous pass). | **PASS** |
| C6 | `pnpm -r build` | `pnpm -r build` | **exit 2**. Same `TS6059 rootDir` failure as C4 (build = `tsc -p tsconfig.json`). | **BLOCKER** (pre-existing; out of Task 9 scope) |
| C7 | Unique authority ownership | Grep `^authority:` across `docs/**/*.md` | All 14 authority docs have exactly one `authority:` front-matter value; the 14 values are distinct: Vision, Product, UX, SEO, Agent Delivery, Architecture, Database, API, Deployment, Engineering, Growth, Source Traceability, Release, Governance. No two docs claim the same domain. | **PASS** |
| C8 | Exact MVP/Beta/V1/V2 assignment | Spot-check `docs/11-Roadmap.md` + full scan of 81 release records | Spot-checks all match: `PRD-FR-007`→Beta (`REL-Beta-PRD_FR_007`), `PRD-FR-009`→V1 (`REL-V1-PRD_FR_009`), `PRD-FR-015`→V2 (`REL-V2-PRD_FR_015`), `DATA-ACTIVITY-001`→V1 (`REL-V1-DATA_ACTIVITY_001`). Full scan: 81/81 records have ID prefix == `first_release`; breakdown MVP=64, V1=6, Beta=8, V2=3. | **PASS** |
| C9 | No product-code changes | Grep `^authority:` / `<!-- requirement -->` / `status:` in `apps/`, `workers/`, `packages/`; `sha256sum weather.txt` | Zero doc markers leaked into product code in any of the three dirs. `weather.txt` SHA-256 = `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d` — matches locked baseline exactly. | **PASS** |
| C10 | Hard-source coverage | `pnpm docs:check` + `node tooling/docs/validate-docs.mjs --mode staging` | Active: 0 errors, 0 warnings, 178 traces, **0 Needs Decision**. Staging: `0 error(s), 0 warning(s); 81 requirement(s), 81 release(s), 178 trace(s)`, exit 0. | **PASS** |
| C11 | No duplicate normative contract | Read `SPEC.md` | Governance/index only. Contains product identity, hard constraints, authority precedence, prose release summary (no copied table), Requirement-ID rules, domain-links table, Kiro status, cutover protocol, conflict handling. Explicitly states "It is not a second domain contract" and "Do not copy release values elsewhere". No `<!-- requirement -->` blocks, no feature/schema/API/performance/release tables. | **PASS** |
| C12 | Kiro MVP-only derivation | Read `.kiro/specs/where-not-rain/{requirements,design,tasks}.md` | `requirements.md` carries a `<!-- derived -->` manifest (64 MVP IDs + digests). Normative body = R01–R64 (MVP only). "Out of current scope" lists future IDs (PRD-FR-007/008/009/010/012–018, ARCH-FLAG-002, DATA-ACTIVITY-001, GROW-EXPERIMENT/PROVIDER/REPORT-001, UX-I18N-002) purely as non-normative links. Digests valid (C1/C10 passing confirms). | **PASS** |
| C13 | No false task completion | Grep tasks.md for checked boxes & `Evidence:` | All 24 tasks are `- [ ]` (unchecked). Exactly 24 `Evidence: pending — verification has not been executed` lines. No task marked complete. | **PASS** |

## Blockers (precisely documented, NOT cutover defects)

- **C3 `pnpm format:check`** — pre-existing failure rooted in `.superpowers/sdd/snapshots/task-2/prettier.config.js` (a Task-2 artifact) importing an unresolvable `@wnr/prettier-config`; no repo `.prettierignore` shields it. Untouched by Task 9. The changed docs/SPEC/README are themselves Prettier-compliant.
- **C4 / C6 `pnpm -r typecheck` & `pnpm -r build`** — pre-existing `TS6059` from `tooling/tsconfig/library.json` (`"rootDir": "src"`) inherited by every package. This is product/tooling code that Task 9 must not and did not modify. Repo was already in this state before cutover.

Per the Task 9 brief's Final Evidence Checklist, regression commands may "pass **or have a precisely documented environment blocker**" — C3/C4/C6 qualify. The Node-only docs checks (C1/C2/C10) fully pass.

## Minor observations (informational, not Critical/Major)

- **M1 (cosmetic):** `SPEC.md` Domain-links table labels (`Data`, `Traceability`, `ADR`) differ slightly from the front-matter `authority:` values (`Database`, `Source Traceability`, and `docs/12-ADR/README.md` has no `authority:` front matter). Display-only; no normative conflict.
- **M2 (process):** The engineer did not run the prescribed `pnpm format:check` (ran a narrower `prettier --check` on only the changed files, which passes). That narrower check is fine, but the full-repo command fails for the pre-existing reason in C3. Documented here for traceability.

## Overall verdict

**CUTOVER APPROVED**

All documentation-authority objectives are met and independently verified: active validation passes (0 errors, 0 Needs Decision, 81 requirements / 81 releases / 178 traces), 59/59 docs tests pass, authority ownership is unique, MVP/Beta/V1/V2 assignment is exact (81/81 consistent), `weather.txt` is byte-stable, `SPEC.md` is governance-only, the Kiro set is MVP-only with valid digests, and all 24 implementation tasks remain correctly unchecked.

The three failing regression commands (`format:check`, `pnpm -r typecheck`, `pnpm -r build`) are **pre-existing failures in product/tooling code and a Task-2 snapshot that Task 9 must not and did not touch**; they are precisely documented as blockers and do not reflect any defect introduced by the cutover. Full regression success is **not** claimed — only the Node-only docs checks are confirmed green.

**Critical/Major findings: none.**
