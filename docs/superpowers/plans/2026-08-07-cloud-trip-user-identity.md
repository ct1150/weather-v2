# Where Not Rain — Cloud Trip & User Identity Phase 1

Date: 2026-08-07
Status: Complete

## Outcome

Upgrade the current single-device LocalStorage trip workspace into an optional cloud-backed trip system without adding a login wall to Weather Radar or local trip creation.

The user journey remains guest-first:

**Weather Radar -> add destination -> local trip -> save to cloud -> sign in -> resume the same trip on another device.**

## Scope

### Included

1. Independent Trip D1 database for private user data.
2. Trip API Worker with authentication and Cloud Trip CRUD.
3. Google OAuth and email magic-link provider integration, enabled only when the required production secrets are configured.
4. LocalStorage V2 cloud metadata while preserving V1 guest storage compatibility.
5. Explicit Local -> Cloud migration after sign-in; never upload guest data automatically.
6. Optimistic concurrency with `baseVersion` and `409 Conflict`.
7. Workspace save-state UI: device-only, sign-in required, saving, cloud-saved, offline/local fallback, conflict.
8. Cross-device cloud restore for a signed-in user.
9. Preview/production migrations, Worker deploy, authorization smoke tests and product smoke coverage.

### Explicitly deferred

- Public cloud share links.
- Multiple-trip library redesign.
- Members / invites / OWNER-EDITOR-VIEWER permissions.
- Revision history.
- WebSocket / Durable Object realtime collaboration.

## Architecture

```text
Cloudflare Pages (static Next.js)
        |
        +--> Weather Read Worker --> Weather D1
        |
        +--> Trip API Worker --> Trip D1
                 |
                 +--> Better Auth
                 +--> Trip CRUD
```

Weather D1 and Trip D1 remain separate security and lifecycle domains.

## Data model

`trips`

- `id` TEXT PRIMARY KEY
- `owner_user_id` TEXT NOT NULL
- `title` TEXT NOT NULL
- `start_date` TEXT
- `end_date` TEXT
- `status` TEXT NOT NULL
- `locale` TEXT NOT NULL
- `document_json` TEXT NOT NULL
- `version` INTEGER NOT NULL DEFAULT 1
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `deleted_at` TEXT

Auth tables are owned by Better Auth in the same Trip D1 database.

## API contract

- `GET /health` — public health and provider availability only.
- `/api/auth/*` — Better Auth handler.
- `POST /api/v1/trips` — create a cloud trip from the current normalized workspace.
- `GET /api/v1/trips` — list the authenticated user's active trips (needed for cross-device recovery; full library UI is deferred).
- `GET /api/v1/trips/:tripId` — owner-only read.
- `PATCH /api/v1/trips/:tripId` — owner-only write with `baseVersion`.
- `DELETE /api/v1/trips/:tripId` — soft delete.

## Guest and cloud persistence rules

- Guest workspace remains under `wnr:trip-workspace:v1`.
- Cloud metadata is stored under `wnr:trip-workspace:v2` and contains only `cloudTripId`, `lastSyncedVersion`, `lastSyncedAt` and the normalized local document.
- Guest content is never sent to Trip API until the user explicitly selects **Save to cloud**.
- Cloud API failure never blocks local editing.
- After cloud save, Trip D1 is canonical while LocalStorage remains a working cache/offline fallback.

## Authentication rules

- No sign-in gate for weather discovery or guest trip editing.
- Google provider is enabled only when both Google OAuth secrets exist.
- Email magic-link is enabled only when mail delivery credentials exist.
- Missing provider secrets fail closed and are reported by `/health` without exposing secret material.
- Session cookies are handled by Better Auth and credentialed CORS is restricted to approved product origins.
- Browser code calls the Better Auth REST API directly; the Better Auth SDK remains server-side in the private Trip Worker boundary.

## Optimistic concurrency

Client loads cloud trip version `N` and sends:

```json
{
  "baseVersion": 12,
  "document": {}
}
```

Update succeeds only while DB version is 12. The row becomes version 13. If another device already changed it, the API returns `409 Conflict` with the current server version; the client keeps its local draft and presents an explicit conflict state.

## Execution order

1. Add Phase 1 plan to repository. ✅
2. Add `workers/trip-api` package and D1 migration. ✅
3. Add Better Auth dependency and lockfile. ✅
4. Implement provider-safe auth factory and auth routes. ✅
5. Implement authenticated Trip CRUD + validation + concurrency. ✅
6. Add API tests for unauthenticated access, ownership, create/read/update/delete and conflict behavior. ✅
7. Add web auth client + cloud sync module. ✅
8. Upgrade workspace UI with sign-in/cloud-save/restore states while preserving guest-first behavior. ✅
9. Add local V2 migration / storage tests. ✅
10. Extend Deploy CI for Trip D1, Trip Worker, Better Auth migration and protected smoke. ✅
11. Extend production product smoke. ✅
12. Full PR CI -> merge -> production deploy -> production smoke. ✅

## Definition of Done

- Guest trip flow remains functional with Trip API unavailable. ✅
- Guest trip is not uploaded automatically. ✅
- Auth endpoints fail safely when providers are not configured. ✅
- Authenticated user can create a cloud trip. ✅
- Authenticated user can restore a cloud trip on another device/session. ✅
- Cloud updates use version checking and return 409 on stale writes. ✅
- Logout/local API failures do not destroy the local workspace. ✅
- Private trip content is not exposed through health endpoints or normal request logs. ✅
- Preview and production Trip D1 are separate. ✅
- Format, lint, typecheck, unit/integration, static export, Worker builds, preview deploy and production smoke pass. ✅

## External credential boundary

The code and infrastructure are deployed without hardcoding identity-provider credentials. Actual Google sign-in requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; email magic-link delivery requires the configured mail-provider secret and sender. If those provider credentials are absent, the corresponding sign-in method stays disabled rather than falling back to insecure behavior.

This means the Cloud Trip data plane, auth engine and browser UX are production-ready, while end-user account login becomes available as soon as at least one external identity provider is configured.

## Final verification

- Feature PR: `#10 feat(cloud-trip): add user identity and cloud save phase 1`.
- Final PR Deploy validation: Run `153` (`31164498117`) — success, including preview Trip D1, Better Auth schema migration, protected CRUD and stale-write `409` smoke.
- Merge commit: `44b193b884207b37f4815ce00cc35ecfe7d04b47`.
- Production Deploy: Run `154` (`31164816969`) — success after retrying the first custom-domain propagation window.
- Production Trip D1 migration — success.
- Production Trip Worker deployment — success.
- Production Better Auth schema migration — success.
- Production protected Trip CRUD / `409` conflict smoke — success.
- Production Pages deployment — success.
- Production product smoke — success, including Cloud Trip health and anonymous Cloud Trip `401` rejection.

## Deployed resources

- Preview Trip D1: `wnr-trip-preview`.
- Production Trip D1: `wnr-trip-production`.
- Preview Trip Worker: `where-not-rain-trip-preview`.
- Production Trip Worker: `where-not-rain-trip-production`.
- Public production Trip API/auth domain: `trip.868656.xyz`.

## Next phase

Phase 2 should build on this canonical cloud-trip foundation:

1. `/trips` -> My Trips library for signed-in users.
2. Multiple cloud trips and archive/delete management.
3. Stable read-only Cloud Share links.
4. Copy shared trip into local or cloud workspace.
5. Only after that: members, invites, revision history and collaborative editing.
