# Task 2 Review

## Verdict

- Spec compliance: ❌
- Code quality: Changes requested

## Critical

1. Trace coverage must prove the locked `weather.txt` is completely covered, reject exact duplicate mappings, and prevent Suggestion/Example traces from targeting Active Hard requirements.
2. Implement minimum checks for authority placeholders/empty sections/old `SPEC §N` references and ensure SPEC/README/docs index files link Active authority docs without containing requirement contracts.

## Important

1. Parse Kiro design units and task blocks, validate each unit/task has valid MVP IDs, and require completed evidence to explicitly contain a date and exit code 0 summary.
2. Enforce deterministic `REL-<release>-<requirement_with_underscores>` IDs, `REL-*` roadmap_ref values, Roadmap anchors, and requirement links to those anchors.
3. Either support reference-style Markdown links or reject them explicitly; only-inline is acceptable if enforced.
4. For Changed/Rejected traces require structured approval text, not a loose `approved` substring. Use `Approved: YYYY-MM-DD by Product Owner — <reason>`.
5. Add regression fixtures for every item above.

## Non-blocking concerns

- Current unmigrated `pnpm docs:check` exit 1 is expected until Task 9.
- MODULE_TYPELESS_PACKAGE_JSON warning is non-blocking; do not add root `type: module` in this task.

## Re-review findings

1. Replace the uniform index target whitelist with per-index allowed targets: root README may link SPEC, docs index, Roadmap, and three Kiro files; SPEC/docs index may link authority docs and declared navigation targets.
2. Support rationale-only Suggestion/Example trace records with `requirement_id: NONE`; only Hard must target Active Hard, and non-Hard must never target Active Hard.
3. Exclude the explicit `## Out of current scope` non-normative section from Kiro prose ID coverage while keeping derived manifest IDs MVP-only.
4. Strip fenced code before index-contract detection; only actual requirement markers outside fences are contracts. The phrase `Acceptance Criteria` alone is allowed in governance prose.
5. Parse optional checkbox tasks `- [ ]*` and `- [x]*` as well as ordinary parent/child tasks. Add positive and negative fixtures for all five points.
