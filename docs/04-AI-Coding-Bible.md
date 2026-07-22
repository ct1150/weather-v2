---
title: AI Coding Bible
authority: Agent Delivery
status: Active
last_updated: 2026-07-17
---

# AI Coding Bible

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Delivery protocol

<!-- requirement
id: AGENT-PROTOCOL-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-AGENT_PROTOCOL_001
owner: Agent Delivery
verification: pnpm docs:check
-->

<a id="AGENT-PROTOCOL-001"></a>

### AGENT-PROTOCOL-001 — Authority-first, phase-gated delivery

Before changing implementation, an Agent reads the current authority entry point and the documents that own the affected decisions. During Draft staging, that entry point is `SPEC.md`; after controlled cutover, the Agent follows the reading order and unique-owner map in [Documentation Governance](README.md). The Agent resolves release timing only through the affected requirement's link to [Roadmap](11-Roadmap.md) and works on one currently approved release phase at a time.

The Agent identifies the applicable Requirement IDs, acceptance criteria, boundaries, and verification commands before editing. It does not begin a later phase, opportunistically implement delayed scope, or treat a documented API shape as capability activation. Completion of a phase requires Product Owner review before work advances to the next phase.

Roadmap: [REL-MVP-AGENT_PROTOCOL_001](11-Roadmap.md#REL-MVP-AGENT_PROTOCOL_001).

#### Acceptance Criteria

- A change record names the authority entry point, affected owner documents, Requirement IDs, and one approved release phase before implementation starts.
- Review evidence shows that later-release scope was neither implemented nor silently pulled into the active phase.
- Every cross-domain question is resolved by the unique-owner map and the requirement's Roadmap link rather than by copying a non-owning document.
- The phase output stops for Product Owner confirmation before starting the next release phase.
- During migration, no Agent starts product implementation from a Draft authority document or treats Draft content as a replacement for `SPEC.md`.

<!-- requirement
id: AGENT-BOUNDARY-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-AGENT_BOUNDARY_001
owner: Agent Delivery
verification: pnpm docs:check
-->

<a id="AGENT-BOUNDARY-001"></a>

### AGENT-BOUNDARY-001 — Production-quality implementation boundaries

An Agent delivers runnable, scoped work. Production changes contain no pseudocode, knowingly non-runnable placeholder, dead code, unexplained implementation marker, unused dependency, or critical business behavior without applicable tests. New dependencies require a demonstrated need, exact approved versioning, compatibility review, and confirmation that an existing platform or repository capability cannot satisfy the requirement more simply.

The Agent preserves the dependency and provider-call boundaries owned by [ARCH-LAYERS-001](05-System-Architecture.md#ARCH-LAYERS-001) and [ARCH-DATAFLOW-001](05-System-Architecture.md#ARCH-DATAFLOW-001). It does not expose credentials, invent travel, price, availability, review, weather, or safety claims, create low-quality index surfaces, or change brand, core routes, scoring definitions, release assignment, or an authority owner's contract without approval.

When requested work conflicts with an authority, ownership is ambiguous, source intent cannot be proven, or an exception would change architecture, the Agent stops the affected implementation, records the conflict and impact, and escalates under [Documentation Governance](README.md#conflict-resolution). It never silently weakens, strengthens, duplicates, or bypasses a contract.

Roadmap: [REL-MVP-AGENT_BOUNDARY_001](11-Roadmap.md#REL-MVP-AGENT_BOUNDARY_001).

#### Acceptance Criteria

- Static review finds no pseudocode, unused dependency, dead implementation, or unexplained placeholder in the delivered scope.
- Every new dependency has a recorded purpose, exact version, boundary impact, and rejected simpler alternative.
- Tests prove critical changed behavior and the architecture boundary checks continue to reject prohibited dependency or provider-call paths.
- Change review finds no unsupported commercial, destination, weather, price, review, or safety claim and no unapproved brand, route, score, or release change.
- Every authority conflict or ambiguity is logged and escalated before implementation proceeds; no conflicting change is concealed as an implementation detail.

## Definition of Done

<!-- requirement
id: AGENT-DOD-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-AGENT_DOD_001
owner: Agent Delivery
verification: pnpm docs:check
-->

<a id="AGENT-DOD-001"></a>

### AGENT-DOD-001 — Evidence-based Definition of Done

A feature, fix, migration, or documentation phase is done only when it satisfies all applicable owning requirements and acceptance criteria; contains complete production behavior with no dead or pseudo implementation; and passes its applicable format, lint, import-boundary, strict type, unit, integration, end-to-end, non-functional, security, documentation, build, and smoke checks.

The Agent also verifies applicable mobile and desktop behavior, keyboard operation, dark mode, async and degraded states, analytics, SEO, internationalization, privacy, security, performance, migration, configuration, and operational effects. Documentation and environment examples are updated when their owned contract changes. A new or changed architectural decision updates an ADR; otherwise the exact phase statement is `ADR: none — no new architectural decision`.

A checkbox, file presence, previous run, expected result, or narrative confidence is not verification. The final record contains the exact command, execution date, exit status, and concise observed result. A failing, skipped, unavailable, or partial check is reported as such and blocks any broader completion claim.

Roadmap: [REL-MVP-AGENT_DOD_001](11-Roadmap.md#REL-MVP-AGENT_DOD_001).

#### Acceptance Criteria

- The delivery maps every applicable acceptance criterion to implementation or documentation evidence and identifies any criterion that remains unmet.
- Recorded verification includes exact commands, date, exit status, and observed result; all checks required for the completion claim have succeeded.
- Appropriate unit, integration, end-to-end, non-functional, build, security, and smoke evidence exists for the changed behavior, or the scope is explicitly not declared complete.
- Applicable accessibility, responsive, state, analytics, SEO, i18n, privacy, security, performance, migration, configuration, and operations impacts are verified rather than assumed.
- The record contains either the created or updated ADR link or the exact no-ADR statement, and no task is marked complete solely because a file exists.

## Documentation and handoff

<!-- requirement
id: AGENT-DOCS-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-AGENT_DOCS_001
owner: Agent Delivery
verification: pnpm docs:check
-->

<a id="AGENT-DOCS-001"></a>

### AGENT-DOCS-001 — Traceable handoff, decision log, and derived Kiro files

Every phase handoff uses this decision-log structure:

```text
Phase: Phase N — Name

Completed
- ...

Decision summary
- ...

Changed files
- path: purpose

Verification evidence
- command: date, exit status, observed result

Performance / SEO / security / privacy impact
- ...

Known limitations
- ...

ADR
- link, or: none — no new architectural decision

Next step / awaiting confirmation
- ...
```

The decision summary records material choices and their authority, not only a list of edits. Known limitations include blocked, deferred, untested, environment-dependent, and later-release work. The next step identifies the gate or owner confirmation required and never represents later scope as already approved.

[`.kiro/specs/where-not-rain/requirements.md`](../.kiro/specs/where-not-rain/requirements.md), [`.kiro/specs/where-not-rain/design.md`](../.kiro/specs/where-not-rain/design.md), and [`.kiro/specs/where-not-rain/tasks.md`](../.kiro/specs/where-not-rain/tasks.md) are derived implementation materials. They cite and digest authority Requirement IDs, remain limited to their generated release scope, and cannot override, add to, weaken, or reassign an authority contract. A conflict is resolved in favor of the authority owner and requires regeneration of the derived file; an existing Kiro task remains incomplete until its exact `Verify:` command succeeds and dated evidence is recorded.

Roadmap: [REL-MVP-AGENT_DOCS_001](11-Roadmap.md#REL-MVP-AGENT_DOCS_001).

#### Acceptance Criteria

- Every phase handoff contains completed work, decision summary, changed files, verification evidence, cross-cutting impact, known limitations, ADR statement, and next step or confirmation gate.
- Decisions cite owning Requirement IDs, and unresolved conflicts identify the owner and escalation rather than selecting a convenient source.
- Kiro manifests and cited IDs validate against the current authority documents and contain no normative obligation without an authority source.
- A Kiro conflict cannot change authority behavior or release assignment; the derived file is regenerated after the authority decision.
- No Kiro task is checked complete without a successful execution of its exact `Verify:` command and dated evidence summary.
