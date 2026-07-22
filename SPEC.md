# Where Not Rain — Documentation Index & Governance

> **Authoritative governance index.** This file is the entry point and authority index for the Where Not Rain documentation system. It is not a second domain contract; the domain documents listed below own every normative requirement. Read it first, then follow the [Domain document links](#domain-document-links) table.

## Product identity

- **Product:** Where Not Rain
- **Slogan:** Find Sunshine. Plan Better.
- **Positioning:** a Travel Decision Engine — users discover the best destinations to travel in the next 7 days and complete the decision path from discovery and comparison to booking, without searching city by city.
- **Category:** AI-powered, weather-driven travel discovery platform.
- **Historical requirements source:** `weather.txt` (locked baseline; see [Hard constraints](#hard-constraints)).

## Hard constraints

These constraints are non-negotiable for the current cutover and the MVP baseline:

- **Cloudflare free-plan only.** Core infrastructure is Cloudflare-only and free-plan compatible. Pages is the preferred deployment target; moving to official Workers deployment requires compatibility evidence, an ADR, and product approval.
- **No product-code change during cutover.** This task performs a documentation cutover only. No code under `apps/`, `workers/`, or `packages/` is modified.
- **`weather.txt` is historical input after cutover.** It is the immutable audit source for traceability, not an implementation authority, and must not be edited.
- **No external integration performed.** This change contains no real affiliate, advertising, analytics, Cloudflare, database, or deployment integration.
- **Single source of truth.** Every normative requirement lives in exactly one domain document (see [Authority precedence](#authority-precedence)).

## Authority precedence

1. **Domain documents** (the `docs/*.md` set in the [Domain document links](#domain-document-links) table) are the authoritative owners of their contracts.
2. **This `SPEC.md` index** governs navigation, precedence, and conflict rules only; it does not redefine any requirement.
3. **Kiro-derived files** (`.kiro/specs/where-not-rain/*`) are generated implementation material derived from the authority set. They may cite Requirement IDs but **cannot override** an authority document.

If a Kiro file, an index, a trace record, or a non-owning domain document conflicts with the owning domain document, the owner wins.

## Current release summary

Releases proceed in the order **MVP → Beta → V1 → V2**. `docs/11-Roadmap.md` is the **sole owner** of `first_release` and `lifecycle` and is the only file that stores those values. The complete, machine-validated release registry (one row per Active Hard requirement) lives there:

- **MVP** — the current in-delivery baseline; contains every requirement except the explicitly approved delayed IDs.
- **Beta** — comparison, weekend planner, growth-loop recommendations, protected read-only admin, articles/RSS, Thai/Vietnamese internationalization, and custom growth reports.
- **V1** — seasonal travel, travel-news editorial workflow, dynamic feature flags, mixed-activity score, experiments, and the affiliate provider registry.
- **V2** — AI Travel Match and the 30-Day Outlook.

See [`docs/11-Roadmap.md`](docs/11-Roadmap.md) for the authoritative release and lifecycle records. Do not copy release values elsewhere.

## Requirement ID rules

- **Format:** stable, non-reusable IDs of the form `DOMAIN-NAME-NNN` (for example `ENG-PERF-001`, `PRD-FR-001`, `ARCH-RENDER-001`).
- **Ownership:** each ID has exactly one owning domain document; other documents may cite the ID but must not restate or redefine its contract.
- **One release each:** every Active Hard requirement has exactly one deterministic `roadmap_ref` (for example `REL-MVP-ENG_PERF_001`) and is released exactly once.
- **Acceptance criteria:** every Active Hard requirement carries explicit acceptance criteria.
- **Registry:** the authoritative release assignment is [`docs/11-Roadmap.md`](docs/11-Roadmap.md); the immutable source audit is [`docs/13-Requirements-Traceability.md`](docs/13-Requirements-Traceability.md).

## Domain document links

| Document                                                                       | Title                         | Authority      |
| ------------------------------------------------------------------------------ | ----------------------------- | -------------- |
| [`docs/README.md`](docs/README.md)                                             | Documentation Governance      | Governance     |
| [`docs/00-Founder-Vision.md`](docs/00-Founder-Vision.md)                       | Founder Vision                | Vision         |
| [`docs/01-Product-PRD.md`](docs/01-Product-PRD.md)                             | Product PRD                   | Product        |
| [`docs/02-UX-Bible.md`](docs/02-UX-Bible.md)                                   | UX Bible                      | UX             |
| [`docs/03-SEO-Bible.md`](docs/03-SEO-Bible.md)                                 | SEO Bible                     | SEO            |
| [`docs/04-AI-Coding-Bible.md`](docs/04-AI-Coding-Bible.md)                     | AI Coding Bible               | Agent Delivery |
| [`docs/05-System-Architecture.md`](docs/05-System-Architecture.md)             | System Architecture           | Architecture   |
| [`docs/06-Database.md`](docs/06-Database.md)                                   | Database and Scoring          | Data           |
| [`docs/07-API-Spec.md`](docs/07-API-Spec.md)                                   | API Specification             | API            |
| [`docs/08-Cloudflare-Deployment.md`](docs/08-Cloudflare-Deployment.md)         | Cloudflare Deployment         | Deployment     |
| [`docs/09-Engineering-Handbook.md`](docs/09-Engineering-Handbook.md)           | Engineering Handbook          | Engineering    |
| [`docs/10-Growth-Bible.md`](docs/10-Growth-Bible.md)                           | Growth Bible                  | Growth         |
| [`docs/11-Roadmap.md`](docs/11-Roadmap.md)                                     | Roadmap                       | Release        |
| [`docs/12-ADR/`](docs/12-ADR/README.md)                                        | Architecture Decision Records | ADR            |
| [`docs/13-Requirements-Traceability.md`](docs/13-Requirements-Traceability.md) | Requirements Traceability     | Traceability   |

## Kiro-derived status

The three Kiro files are **MVP-only derived manifests** generated from the authority requirements selected through `docs/11-Roadmap.md`. Their digests are validated by `tooling/docs/validate-docs.mjs` and must stay current; a stale or mismatched digest fails active validation.

- [`.kiro/specs/where-not-rain/requirements.md`](.kiro/specs/where-not-rain/requirements.md) — MVP EARS requirements (derived).
- [`.kiro/specs/where-not-rain/design.md`](.kiro/specs/where-not-rain/design.md) — MVP implementation design (derived).
- [`.kiro/specs/where-not-rain/tasks.md`](.kiro/specs/where-not-rain/tasks.md) — MVP tasks with verification evidence (derived).

These files are implementation material. They never override an authority document.

## Change & cutover protocol

1. New authority documents begin as `status: Draft` and are non-authoritative while this `SPEC.md` index remains the sole implementation authority.
2. Staging validation must prove complete requirements, releases, traceability, links, and derived Kiro coverage before any authority status changes.
3. Cutover is one controlled logical batch: activate the complete authority set, replace this `SPEC.md` with its governance index, refresh the Kiro-derived files and the root `README.md`, then run active validation and regression checks.
4. On any cutover check failure, restore the prior authority marker and keep the new documents Draft; a partially activated set is never authoritative.
5. After a successful cutover, `weather.txt` becomes immutable historical input for audit and traceability, not an implementation authority.

## Conflict handling

1. Locate the owner in the [Domain document links](#domain-document-links) table; that owner's Requirement block controls the decision.
2. Resolve release timing and lifecycle only through the requirement's `roadmap_ref` in [`docs/11-Roadmap.md`](docs/11-Roadmap.md).
3. A Kiro-derived file, an index, a trace record, or a non-owning domain document cannot override the owner.
4. An Accepted ADR may supersede a contract only under the policy in [`docs/12-ADR/README.md`](docs/12-ADR/README.md), and only when the authority document is updated in the same cutover.
5. If ownership is ambiguous or source intent cannot be proven, stop implementation, record the issue as Needs Decision, and request Product Owner resolution. Never silently delete, weaken, strengthen, or duplicate a contract.

## Validation

Maintainers and agents must run the documentation validators:

```bash
pnpm docs:test     # parser and validator unit tests
pnpm docs:check    # active-mode authority validation (after cutover)
node tooling/docs/validate-docs.mjs --mode staging   # migration-mode checks
```

Validation evidence, known limitations, and the phase decision log are recorded before a phase is declared complete. The repository is not a Git repository; no commit is created as part of documentation work.
