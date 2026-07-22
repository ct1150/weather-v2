# Architecture Decision Records

This directory holds Architecture Decision Records (ADRs) for Where Not Rain. An ADR captures a new architecture decision or a change to an existing architecture decision; routine implementation, confirmation of an existing contract, and phase completion do not require an ADR.

## Phase decision log

Every delivery phase must produce a decision log, whether or not it creates an ADR. The phase log records:

- decision summary;
- validation commands, results, and evidence;
- known limitations;
- next step; and
- ADR disposition.

When the phase introduces no new or changed architecture decision, its exact disposition is:

`ADR: none — no new architectural decision`

A decision log is delivery evidence. It is not an architecture exception and does not replace an ADR when the ADR threshold is met.

## ADR threshold and format

Create or update a numbered Markdown ADR only when the phase makes a new architecture decision or changes an existing one. Each ADR records title, status, date, context, decision, alternatives considered, consequences, Cloudflare Free-plan impact, security/SEO/performance impact, and upgrade path. Proposed material does not override an authority contract.

## Superseding contracts

Only an ADR with status **Accepted** may supersede an existing contract, and only when all of the following are true:

1. the ADR explicitly names every superseded Requirement ID;
2. the ADR explains the replacement decision and consequences; and
3. each owning authority document is updated in the same controlled cutover.

Until all three conditions hold, the existing authority Requirement remains controlling. An ADR cannot silently change release timing or lifecycle; those values remain owned by `docs/11-Roadmap.md`.

## Naming

Use a stable numbered filename such as `ADR-001-cloudflare-deployment-target.md`. If an Accepted ADR is later replaced, preserve its history and status rather than deleting or renumbering it.
