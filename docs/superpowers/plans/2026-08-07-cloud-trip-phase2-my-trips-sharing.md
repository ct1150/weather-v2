# Where Not Rain — Cloud Trip Phase 2: My Trips + Read-only Sharing

Date: 2026-08-07
Status: In progress

## Outcome

Turn `/trips` into the authenticated trip home while preserving the guest-first marketing/build/import entry points, and add safe read-only cloud sharing that can be copied into another user's independent trip.

Primary journey:

**Sign in -> My Trips -> open / archive / delete / share -> recipient opens read-only share -> copy to My Trips -> edit independently.**

## Scope

### Included

1. My Trips dashboard on `/trips`, `/zh-cn/trips`, `/zh-hant/trips`.
2. Active and archived trip lists with date range, update time and cloud version.
3. Open cloud trip into the existing workspace.
4. Archive / restore using optimistic version checks.
5. Soft delete with explicit confirmation in the UI.
6. One active read-only share link per trip.
7. Share tokens generated with Web Crypto; D1 stores only SHA-256 token hashes.
8. Generating a new share link revokes the previous active link.
9. Public read-only share route in all three locales.
10. Copy shared trip to the signed-in user's independent cloud trip.
11. Preview and production D1 migrations, API tests, product contract tests and smoke coverage.

### Explicitly deferred

- Collaborative editing.
- OWNER / EDITOR / VIEWER memberships.
- Invites and email invitations.
- Revision history and rollback UI.
- Realtime WebSocket / Durable Object sync.
- Public indexing of shared trips.

## Security model

- A share URL is an unguessable bearer capability.
- Raw share tokens are returned only at creation time and are never stored in D1.
- D1 stores `SHA-256(token)` and a short non-sensitive prefix for support/debug display only.
- Shared trip API responses never expose owner user IDs, auth records or internal share rows.
- Shared pages are `noindex` and no-store.
- Delete immediately makes related shares unreadable because public reads require a non-deleted trip.
- Revoke disables the current active share.
- Copy validates the stored trip document again before creating the recipient-owned trip.

## Data model

### Existing `trips`

Use existing `status IN ('active', 'archived')` and optimistic `version`.

### New `trip_shares`

- `id` TEXT PRIMARY KEY
- `trip_id` TEXT NOT NULL
- `owner_user_id` TEXT NOT NULL
- `token_hash` TEXT NOT NULL UNIQUE
- `token_prefix` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `revoked_at` TEXT

Indexes:

- one active-share lookup by `(trip_id, owner_user_id, revoked_at)`
- public token hash lookup

## API contract

Authenticated:

- `GET /api/v1/trips?status=active|archived|all&limit=50`
- `PATCH /api/v1/trips/:tripId/status` with `{ baseVersion, status }`
- existing `GET/PATCH/DELETE /api/v1/trips/:tripId`
- `POST /api/v1/trips/:tripId/share` -> revoke old + create new raw token
- `DELETE /api/v1/trips/:tripId/share` -> revoke active link

Public / mixed:

- `GET /api/v1/shared-trips/:token` -> read-only sanitized trip
- `POST /api/v1/shared-trips/:token/copy` -> authenticated independent copy

## Web UX

### Trips home

Authenticated users see My Trips first:

- Active / Archived tabs
- Open
- Share
- Archive / Restore
- Delete
- New trip
- Import itinerary

Guests still see the existing hero and build/import CTAs; an account is never required to start planning.

### Share page

- Clearly marked read-only.
- Show title, dates and day-by-day itinerary content.
- No edit controls.
- CTA: `Copy to my trips`.
- If not signed in, explain that copying to cloud requires sign-in; viewing remains public.
- `robots: noindex, nofollow`.

## Execution order

1. Save this Phase 2 plan.
2. Create isolated feature branch.
3. Add `0002_trip_shares.sql`.
4. Extend store: status updates, share create/revoke/public read/copy.
5. Extend Worker routes and validation.
6. Add SQLite/API tests for owner isolation, archive/restore, token hashing, revoke, public read and copy.
7. Extend web cloud client.
8. Add My Trips dashboard and localized copy.
9. Add localized static share pages using query-string token.
10. Add UX/API contract tests.
11. Extend preview/production smoke.
12. Full PR CI -> merge -> production deploy -> production product smoke.

## Definition of Done

- Existing guest build/import/workspace flows remain functional.
- Signed-in user can manage multiple cloud trips from Trips home.
- Archive/restore is version-safe and stale writes return 409.
- Delete is soft and removed from My Trips.
- Share token plaintext never appears in D1 schema/rows or logs.
- Old share URL stops working after regeneration/revoke.
- Public share can be viewed without auth but cannot be edited.
- Copy requires auth and produces a new owner-scoped trip ID with version 1.
- Shared pages are noindex.
- Preview and production D1 remain isolated.
- Format, lint, typecheck, unit/integration, static export, Worker builds, preview deploy, API smoke and production product smoke pass.
