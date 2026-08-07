# Where Not Rain — Cloud Trip & User Identity Phase 1

Date: 2026-08-07
Status: PR deployment validation

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
- Missing provider secrets must fail closed and be reported by `/health` without exposing secret material.
- Session cookies must be secure in production and CORS must be restricted to the product origin / approved preview origins.

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

1. Add Phase 1 plan to repository.
2. Add `workers/trip-api` package and D1 migration.
3. Add Better Auth dependency and lockfile through CI builder.
4. Implement provider-safe auth factory and auth routes.
5. Implement authenticated Trip CRUD + validation + concurrency.
6. Add API tests for unauthenticated access, ownership, create/read/update/delete and conflict behavior.
7. Add web auth client + cloud sync module.
8. Upgrade workspace UI with sign-in/cloud-save/restore states while preserving guest-first behavior.
9. Add local V2 migration tests.
10. Extend Deploy CI: build trip-api, apply Trip D1 migrations, deploy preview/production Trip Worker, configure available secrets, run health/auth smoke.
11. Extend product production smoke.
12. Full PR CI -> merge -> production deploy -> production smoke.

## Definition of Done

- Guest trip flow remains functional with Trip API unavailable.
- Guest trip is not uploaded automatically.
- Auth endpoints fail safely when providers are not configured.
- Signed-in user can create a cloud trip.
- Signed-in user can reopen the same cloud trip from another browser/device.
- Cloud updates use version checking and return 409 on stale writes.
- Logout/local API failures do not destroy the local workspace.
- Private trip content never appears in logs or public health endpoints.
- Preview and production Trip D1 are separate.
- Format, lint, typecheck, unit/integration, static export, Worker builds, preview deploy and production smoke pass.

## External credential boundary

The code and infrastructure can be fully deployed without hardcoding credentials. Actual Google sign-in requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; email magic-link delivery requires the configured mail-provider secret and sender. If those secrets are absent, the provider remains disabled rather than falling back to insecure behavior.

## Build progress

- Phase 1 source is implemented on `feature/cloud-trip-phase1`.
- Dedicated D1 databases have been created and resolved into Wrangler configuration: `wnr-trip-preview` and `wnr-trip-production`.
- Better Auth `1.6.26` is locked for web + Trip API.
- Trip store, bounded document validation and authenticated API integration tests pass, including anonymous `401`, owner isolation, CRUD and stale-write `409`.
- Web local/cloud metadata tests pass.
- Workspace UX contract confirms guest-first explicit cloud save, localized Cloud Trip controls, offline fallback and conflict handling.
- Temporary branch builder completed successfully and has been removed from `main`; final validation now runs only through the standard Deploy pipeline.
- Next gate: deploy preview Trip D1 + Trip Worker, migrate Better Auth schema and pass protected preview CRUD/conflict smoke.
