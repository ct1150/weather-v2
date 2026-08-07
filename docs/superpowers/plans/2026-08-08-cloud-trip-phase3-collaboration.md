# Where Not Rain — Cloud Trip Phase 3: Collaboration + Revision History

Date: 2026-08-08
Status: In progress

## Outcome

Upgrade Cloud Trip from single-owner cloud storage into controlled asynchronous collaboration without adding realtime infrastructure yet.

Primary journey:

**Owner opens My Trips -> invite collaborator -> collaborator signs in and accepts -> Editor can update the same cloud trip -> Viewer can inspect but cannot mutate -> every cloud mutation writes a revision -> Owner/Editor can restore an earlier revision as a new version.**

## Scope

### Included

1. OWNER / EDITOR / VIEWER authorization model.
2. Owner-only collaborator management.
3. Email-address invitations with high-entropy invite tokens.
4. Invite tokens stored only as SHA-256 hashes.
5. Product-generated invite URLs keep the bearer token in the browser fragment and send it to Trip API in `x-wnr-invite-token`.
6. Invite acceptance requires authentication and exact normalized email match.
7. Collaborator-aware My Trips listing and workspace opening.
8. Editor read/write access; Viewer read-only access.
9. Owner-only archive / restore / delete / public-share / membership administration.
10. Immutable revision snapshots for cloud trip changes.
11. Revision list and rollback; rollback always creates a new latest version rather than rewinding version numbers.
12. Three-language collaboration UI and invite acceptance page.
13. Preview + production D1 migration, API tests, static export, Worker deploy and smoke coverage.

### Explicitly deferred

- Realtime presence, cursors or live co-editing.
- WebSocket / Durable Object synchronization.
- Comment threads and activity feed beyond revision metadata.
- Organization/team workspaces.
- Transfer of ownership.
- Multiple owners.
- Public indexing of invite pages.

## Authorization model

- `OWNER`: inferred from `trips.owner_user_id`; full control.
- `EDITOR`: can read and update document content, inspect revision history and restore a previous revision.
- `VIEWER`: can read the trip and inspect revision history, but cannot update content or restore.
- Only the owner can archive/restore the trip, delete it, create/revoke public share links, create/revoke invitations, change collaborator roles or remove collaborators.
- Non-members receive `404` for private trip resources to avoid exposing trip existence.

## Data model

### `trip_members`

- `trip_id` TEXT NOT NULL
- `user_id` TEXT NOT NULL
- `role` TEXT NOT NULL CHECK(role IN ('editor','viewer'))
- `invited_by_user_id` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- PRIMARY KEY (`trip_id`, `user_id`)

Owners are intentionally not duplicated in this table; `trips.owner_user_id` remains the ownership source of truth.

### `trip_invites`

- `id` TEXT PRIMARY KEY
- `trip_id` TEXT NOT NULL
- `owner_user_id` TEXT NOT NULL
- `email_normalized` TEXT NOT NULL
- `role` TEXT NOT NULL CHECK(role IN ('editor','viewer'))
- `token_hash` TEXT NOT NULL UNIQUE
- `token_prefix` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `expires_at` TEXT NOT NULL
- `accepted_at` TEXT
- `accepted_user_id` TEXT
- `revoked_at` TEXT

Only one active invite per trip/email is retained; creating a replacement revokes the previous active invite.

### `trip_revisions`

- `id` TEXT PRIMARY KEY
- `trip_id` TEXT NOT NULL
- `actor_user_id` TEXT NOT NULL
- `version` INTEGER NOT NULL
- `operation` TEXT NOT NULL
- `locale` TEXT NOT NULL
- `document_json` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- UNIQUE (`trip_id`, `version`)

Migration backfills one baseline snapshot for every existing non-deleted cloud trip at its current version.

## API contract

Authenticated trip access:

- `GET /api/v1/trips` -> owned + collaborator trips with `accessRole`.
- `GET /api/v1/trips/:tripId` -> OWNER/EDITOR/VIEWER.
- `PATCH /api/v1/trips/:tripId` -> OWNER/EDITOR with optimistic `baseVersion`.
- Owner-only existing status/delete/share operations remain owner-only.

Collaborators:

- `GET /api/v1/trips/:tripId/members` -> owner; returns owner + collaborators + pending invites.
- `POST /api/v1/trips/:tripId/invites` -> owner, `{ email, role }`.
- `DELETE /api/v1/trips/:tripId/invites/:inviteId` -> owner.
- `PATCH /api/v1/trips/:tripId/members/:userId` -> owner, `{ role }`.
- `DELETE /api/v1/trips/:tripId/members/:userId` -> owner.

Invite acceptance:

- `GET /api/v1/trip-invites/current` + `x-wnr-invite-token` -> sanitized invite preview.
- `POST /api/v1/trip-invites/current/accept` + auth + `x-wnr-invite-token` -> membership if authenticated email exactly matches invite email.

Revision history:

- `GET /api/v1/trips/:tripId/revisions?limit=30` -> OWNER/EDITOR/VIEWER.
- `POST /api/v1/trips/:tripId/revisions/:version/restore` with `{ baseVersion }` -> OWNER/EDITOR and creates version `baseVersion + 1`.

## Web UX

### My Trips

- Trip cards show `Owner`, `Editor` or `Viewer` access.
- Owner gets Manage collaborators.
- Collaborator can open the shared cloud trip from the same My Trips dashboard.
- Owner-only destructive/share/archive controls are hidden for collaborators.

### Workspace

- Cloud controls show current access role.
- Editor keeps autosave.
- Viewer gets an explicit read-only collaboration banner and cloud autosave is disabled.
- Revision history is available from cloud controls.
- Restore action is offered only to Owner/Editor and uses optimistic concurrency.

### Collaborator manager

- Invite by email as Editor or Viewer.
- Copy invite link even when outbound email delivery is unavailable.
- Show current collaborators and pending invites.
- Owner can change Editor <-> Viewer, revoke invite or remove collaborator.

### Invite page

- English, Simplified Chinese and Traditional Chinese static pages.
- Token lives in `#token=` fragment, not query string.
- Viewing invite metadata does not require auth.
- Accept requires sign-in and matching account email.
- `noindex, nofollow`.

## Revision semantics

- Revision history is append-only.
- Every successful cloud document update writes the new document snapshot at the resulting version.
- Creating a cloud trip writes revision 1.
- Copying a shared trip writes revision 1 for the copied trip.
- Restoring revision N never changes the trip version back to N; it writes that historical document as a new latest version.
- Stale restore uses the same `409 Conflict` rule as normal editing.

## Definition of Done

- Owner can invite an Editor or Viewer by email.
- Invite token plaintext is not persisted in D1 or request URLs/logs generated by the product.
- Wrong signed-in email cannot accept an invite.
- Accepted collaborator appears in My Trips.
- Editor can update; Viewer gets read-only behavior and server-side mutation denial.
- Collaborators cannot archive/delete/share/manage members.
- Owner can change role/remove collaborator/revoke pending invite.
- Every successful document mutation has an immutable revision snapshot.
- Owner/Editor can restore history as a new version with stale-write protection.
- Three-language collaboration/invite surfaces are noindex where appropriate.
- Guest/local-first flow and Phase 1/2 cloud behavior remain intact.
- Preview and production D1 remain isolated.
- Format, lint, typecheck, unit/integration, static export, Worker builds, preview deploy, API smoke and production product smoke pass.
