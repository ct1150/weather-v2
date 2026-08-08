# Where Not Rain — Cloud Trip Phase 4: Collaboration Intelligence

Date: 2026-08-08
Status: In progress

## Outcome

Turn Phase 3 asynchronous collaboration into an understandable shared decision workflow: collaborators can see what changed, discuss decisions in context, and inspect revision-to-revision diffs without realtime infrastructure.

Primary journey:

**Open shared trip -> inspect recent activity -> compare a revision with the previous version -> discuss a day or revision -> capture an explicit decision -> resolve/reopen the decision as plans evolve.**

## Scope

1. Append-only collaboration activity feed backed by durable D1 events.
2. Trip comments with optional day and revision context.
3. Decision records with open/resolved state and optional day context.
4. Structured revision diff for title, party profile, day add/remove, date, destination, theme, flexibility, activities and notes.
5. OWNER/EDITOR can comment and create/resolve decisions; VIEWER remains read-only but can inspect activity/comments/decisions/diffs.
6. Owner-only destructive moderation for comments and decisions.
7. Three-language collaboration workspace UI.
8. Preview + production D1 migration, API tests, static export, Worker deploy and dedicated Phase 4 smoke coverage.

## Explicitly deferred

- Realtime presence, cursors, live co-editing, WebSocket or Durable Object synchronization.
- Rich-text comments, reactions and @mentions.
- External notification/email digests.
- Organization workspaces, ownership transfer or multiple owners.

## Product principle

Phase 4 is **decision-first, not chat-first**. Comments explain context; decision records capture what the team actually agreed to; activity and revision diff provide auditability.

## Authorization

- OWNER: read/write comments and decisions, resolve/reopen, destructive moderation, revision diff.
- EDITOR: read/write comments and decisions, resolve/reopen, revision diff.
- VIEWER: read activity/comments/decisions/revision diff only.
- Non-members receive 404 for private collaboration resources.

## Definition of Done

- Activity records document mutations and Phase 4 collaboration actions.
- Comment create/list and owner moderation work with day/revision context.
- Decision create/list/resolve/reopen and owner moderation work.
- Revision diff is structured and deterministic from immutable snapshots.
- Viewer mutations are rejected server-side.
- Collaboration panel is localized in English, Simplified Chinese and Traditional Chinese.
- Phase 1-3 behavior remains intact.
- Format, lint, typecheck, unit/integration, static export, preview D1/Worker/Pages and Phase 4 preview/production smoke pass.
