# Task 9 Brief — Perform logical cutover and final verification

**Source:** `docs/superpowers/plans/2026-07-17-spec-documentation-refactor.md` → Task 9
**Date started:** 2026-07-20
**Workspace:** `\\wsl.localhost\Ubuntu24\root\test\weather` (non-Git repository)

## Global Constraints (apply to the whole task)

- Follow `docs/superpowers/specs/2026-07-17-spec-optimization-design.md` exactly.
- Do **not** modify product code under `apps/`, `workers/`, or `packages/`.
- Keep `weather.txt` unchanged (locked baseline: 1,476 lines, SHA-256 `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`).
- New domain documents remain `Draft / Non-authoritative` until this cutover task.
- During migration, the existing `SPEC.md` remains authoritative and the worktree must not be used to start product implementation. **This task performs the cutover that lifts that freeze.**
- `docs/11-Roadmap.md` is the only file that stores `first_release` and `lifecycle`; domain requirements store only `roadmap_ref`.
- No actual affiliate, advertising, analytics, Cloudflare, database, or deployment integration occurs in this change.
- Do not mark existing Kiro implementation tasks complete unless their exact `Verify:` command passes and evidence is recorded (they remain pending here).
- The directory is not a Git repository. Do not add commit steps or claim commits; end each step with a validation checkpoint.

## Task 9: Perform logical cutover and final verification

**Files:**
- Modify: all new `docs/*.md` front matter from `Draft` to `Active`.
- Modify: `SPEC.md`
- Modify: `README.md`
- Modify: `package.json` only if Task 2 scripts need formatting correction.

**Interfaces:**
- Consumes the fully validated staging set.
- Produces the active authoritative documentation system.

- [ ] **Step 1: Run the pre-cutover gate**

Run:
```bash
pnpm docs:test
node tooling/docs/validate-docs.mjs --mode staging
```
Expected: tests PASS; staging validator reports no errors other than the explicitly recognized pre-cutover state. If any content, trace, release, digest, link, or coverage error exists, stop before changing authority status.

- [ ] **Step 2: Activate domain documents in one controlled batch**

Change every authority front matter status to `Active`. Replace `SPEC.md` with a concise active document containing product identity, hard constraints, authority precedence, current release summary, Requirement ID rules, domain links, Kiro-derived status, change/cutover protocol, and conflict handling. It must not copy feature, schema, API, performance, or release tables.

- [ ] **Step 3: Update root README**

Add a "Documentation authority" section linking `SPEC.md`, `docs/README.md`, Roadmap, and Kiro-derived files. Replace references such as `SPEC §7.2` with stable document/Requirement links. Keep commands and monorepo layout accurate.

- [ ] **Step 4: Run active validation**

Run: `pnpm docs:check`

Expected: exit code 0; zero errors, zero `Needs Decision`, all authority docs Active, every Hard requirement released once, all links and Kiro digests valid.

- [ ] **Step 5: Run repository regression checks**

Run:
```bash
pnpm docs:test
pnpm format:check
pnpm -r typecheck
pnpm -r test
pnpm -r build
```
Expected: every command exits 0. If package installation is unavailable, report that exact blocker and still run all Node-only docs tests/checks; do not claim full regression success.

- [ ] **Step 6: Run independent semantic audit**

The reviewer must verify: unique authority ownership, exact MVP/Beta/V1/V2 assignment, no product-code changes, original Hard-source coverage, all audited gaps closed, no duplicate normative contract, Kiro MVP-only derivation, and no false task completion. Any Critical or Major finding reopens the relevant task and requires rerunning Steps 4–5.

- [ ] **Step 7: Record the cutover decision log**

In `docs/11-Roadmap.md`, record date, changed authority set, validation commands/results, known limitations, and `ADR: none — no new architectural decision` unless implementation actually created or changed an architecture decision. Do not create a Git commit because the workspace is not a Git repository.

## Final Evidence Checklist

- `weather.txt` SHA-256 remains `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`.
- `pnpm docs:test` passes.
- `pnpm docs:check` exits 0 in active mode.
- `pnpm format:check`, recursive typecheck, tests, and builds pass or have a precisely documented environment blocker.
- Traceability has zero `Needs Decision` and maps every Hard source requirement.
- Roadmap is the only release/lifecycle owner.
- Kiro requirements/design/tasks satisfy bidirectional MVP coverage and current digests.
- `SPEC.md` is an index/governance entry point, not a second domain contract.
- Product source files under `apps/`, `workers/`, and `packages/` are unchanged.
