---
title: Documentation Governance
authority: Governance
status: Active
last_updated: 2026-07-17
---

# Documentation Governance

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Reading order

During staging, read `SPEC.md` first and treat the Draft set only as migration material. After a successful controlled cutover, use this order:

1. `docs/README.md` for governance, ownership, and conflict rules.
2. `docs/00-Founder-Vision.md` for identity, market, value, and commercial direction.
3. `docs/01-Product-PRD.md`, `docs/02-UX-Bible.md`, and `docs/03-SEO-Bible.md` for product and experience contracts.
4. `docs/04-AI-Coding-Bible.md`, `docs/05-System-Architecture.md`, `docs/06-Database.md`, `docs/07-API-Spec.md`, `docs/08-Cloudflare-Deployment.md`, `docs/09-Engineering-Handbook.md`, and `docs/10-Growth-Bible.md` for delivery and domain contracts.
5. `docs/11-Roadmap.md` for first release and lifecycle assignments.
6. `docs/12-ADR/` for accepted architectural decisions and `docs/13-Requirements-Traceability.md` for source audit evidence.
7. `.kiro/specs/where-not-rain/` only as derived implementation material; it never overrides an authority document.

## Unique authority owners

Each decision has exactly one owning document. Other documents may cite a Requirement ID but must not restate or redefine its normative contract.

| Decision domain                                                         | Unique owner                           |
| ----------------------------------------------------------------------- | -------------------------------------- |
| Documentation governance and conflict protocol                          | `docs/README.md`                       |
| Product vision, market, and revenue-model narrative                     | `docs/00-Founder-Vision.md`            |
| Functional scope and product acceptance                                 | `docs/01-Product-PRD.md`               |
| UX, design system, states, accessibility, and locale UX                 | `docs/02-UX-Bible.md`                  |
| SEO, content, indexability, and quality gates                           | `docs/03-SEO-Bible.md`                 |
| Coding-agent conduct, delivery protocol, and Definition of Done         | `docs/04-AI-Coding-Bible.md`           |
| Architecture, data flow, rendering, caching, and recovery               | `docs/05-System-Architecture.md`       |
| Data models, scoring, indexes, migrations, and retention                | `docs/06-Database.md`                  |
| API requests, responses, validation, authentication, and rate contracts | `docs/07-API-Spec.md`                  |
| Cloudflare environments, deployment, CI/CD, and rollback                | `docs/08-Cloudflare-Deployment.md`     |
| Testing, performance, security, privacy, observability, and reliability | `docs/09-Engineering-Handbook.md`      |
| Analytics, Affiliate, advertising, providers, and experiments           | `docs/10-Growth-Bible.md`              |
| `first_release`, `lifecycle`, release order, and phase gates            | `docs/11-Roadmap.md`                   |
| Accepted architecture exceptions                                        | `docs/12-ADR/`                         |
| Historical-source classification and audit mappings                     | `docs/13-Requirements-Traceability.md` |

## Requirement contract format

Requirement IDs are stable and must not be reused. Every Active Hard requirement has a matching explicit HTML anchor, acceptance criteria, exactly one deterministic `roadmap_ref`, and an inline link to that Roadmap anchor. Domain metadata stores no release or lifecycle value.

The following is an example only; its fence is required so it is not parsed as a real contract:

```markdown
<!-- requirement
id: ENG-PERF-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_PERF_001
owner: Engineering
verification: pnpm docs:check
-->

<a id="ENG-PERF-001"></a>

### ENG-PERF-001 — Performance release gate

Roadmap: [REL-MVP-ENG_PERF_001](11-Roadmap.md#REL-MVP-ENG_PERF_001).

#### Acceptance Criteria

- The documented gate passes.
```

Metadata keys are exactly `id`, `status`, `kind`, `roadmap_ref`, `owner`, and `verification`. Requirement status is `Active`, `Deprecated`, or `Superseded`; kind is `Hard` or `Guidance`. A released ID remains present when deprecated or superseded.

## Release registry format

`docs/11-Roadmap.md` is the only location that stores `first_release` and `lifecycle`. Each Active Hard requirement has exactly one single-line JSON comment, a deterministic ID of `REL-${first_release}-${requirement_id.replaceAll("-", "_")}`, an explicit matching anchor, and one equivalent human-readable table row.

The following fenced record is an example only:

```markdown
<!-- release: {"first_release":"MVP","id":"REL-MVP-ENG_PERF_001","lifecycle":"Continuous","requirement_id":"ENG-PERF-001"} -->
```

Allowed first releases are `MVP`, `Beta`, `V1`, and `V2`; allowed lifecycles are `Launch` and `Continuous`. Release order is MVP, then Beta, then V1, then V2.

## Trace record format

`docs/13-Requirements-Traceability.md` stores immutable source mappings. Release values are not repeated there; they resolve through each requirement's `roadmap_ref`.

The following fenced record is an example only:

```markdown
<!-- trace: {"classification":"Hard","coverage":"Covered","line_end":691,"line_start":675,"rationale":"Direct migration","requirement_id":"ENG-PERF-001","source_excerpt":"# PERFORMANCE","source_sha256":"70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d"} -->
```

A trace record contains exactly `classification`, `coverage`, `line_end`, `line_start`, `rationale`, `requirement_id`, `source_excerpt`, and `source_sha256`. Changed or Rejected source material requires dated Product Owner approval and a non-empty rationale. Cutover is blocked while any record is marked Needs Decision.

## Draft and cutover protocol

1. New authority documents remain `status: Draft` and are non-authoritative while `SPEC.md` remains the sole implementation authority.
2. Draft content may migrate existing contracts for review, but no developer or agent may use the staging worktree to begin product implementation.
3. Staging validation must establish complete requirements, releases, traceability, links, and derived Kiro coverage before authority status changes.
4. Cutover is one controlled logical batch: activate the complete authority set, replace `SPEC.md` with its governance index, refresh Kiro-derived files and the root README, then run active validation and regression checks.
5. If any cutover check fails, restore the old `SPEC.md` authority marker and keep the new documents Draft; a partially activated set is never authoritative.
6. After successful cutover, `weather.txt` is immutable historical input for audit and traceability, not an implementation authority.

## Conflict resolution

1. Identify the owner in the unique authority table; that owner's Requirement block controls the domain decision.
2. Resolve release timing and lifecycle only through the requirement's `roadmap_ref` in `docs/11-Roadmap.md`.
3. A Kiro-derived file, index, trace record, or non-owning domain document cannot override the owner.
4. An Accepted ADR can supersede a contract only under the policy in `docs/12-ADR/README.md`; the authority document must change in the same cutover.
5. If ownership is ambiguous or source intent cannot be proven, stop implementation, record the issue as Needs Decision, and request Product Owner resolution. Never silently delete, weaken, strengthen, or duplicate a contract.

## Validation

Use `pnpm docs:test` for parser and validator tests. Use `node tooling/docs/validate-docs.mjs --mode staging` during migration and `pnpm docs:check` only after the controlled activation batch. Validation evidence, known limitations, and the phase decision log must be recorded before a phase is declared complete.
