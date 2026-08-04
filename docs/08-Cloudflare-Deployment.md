---
title: Cloudflare Deployment
authority: Deployment
status: Active
last_updated: 2026-07-17
---

# Cloudflare Deployment

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Platform boundary

<!-- requirement
id: DEP-FREE-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DEP_FREE_001
owner: Deployment
verification: pnpm docs:check
-->

<a id="DEP-FREE-001"></a>

### DEP-FREE-001 — Cloudflare-only free-plan-compatible core

Core runtime infrastructure is Cloudflare-only: Pages/Workers runtime and CDN, D1, KV, Cron Triggers, and Cloudflare Web Analytics, with R2 bound only when an approved need exists. Weather ingestion uses bounded batches and the smallest required binding set. The core remains operable when optional commercial and external analytics integrations are absent.

GA4 and Plausible are disabled-by-default, fully removable external adapters; they are not core infrastructure and their optional existence does not weaken the Cloudflare-only core rule. No documentation change here activates either adapter.

Before each implementation phase and before production release, the owner reviews Cloudflare's **current** free-plan quotas, current official product availability, and expected request, CPU, D1, KV, Cron, bandwidth, and storage usage. Evidence records the review date, official source, measured/estimated usage, safety margin, and mitigation. Numeric quotas are not treated as permanent facts in code or this contract.

Roadmap: [REL-MVP-DEP_FREE_001](11-Roadmap.md#REL-MVP-DEP_FREE_001).

#### Acceptance Criteria

- A deployment inventory shows that every core runtime, database, cache, schedule, and default analytics dependency is Cloudflare-hosted and free-plan compatible.
- Removing GA4, Plausible, Affiliate, advertising, and R2 leaves core weather ingestion and reads operable.
- A dated current-quota review covers all enabled Cloudflare products, expected usage, safety margin, and a no-cost mitigation for each identified risk.
- CI rejects a fixed quota assumption presented as permanent configuration without current official evidence.
- Load and batch-size evidence stays within the reviewed free-plan envelope before production approval.

<!-- requirement
id: DEP-PAGES-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DEP_PAGES_001
owner: Deployment
verification: pnpm docs:check
-->

<a id="DEP-PAGES-001"></a>

### DEP-PAGES-001 — Pages-first with controlled Workers fallback

Cloudflare Pages is the preferred deployment path, using the current official Cloudflare-supported Next.js adapter. A preview environment must prove App Router routes, Server Components, SSG, SSR, ISR/revalidation, route handlers, D1/KV bindings, scheduled jobs, static assets, and rollback behavior before production promotion.

If Pages is incompatible with a required capability, the team may switch to the current official Cloudflare Workers deployment target only after all three gates pass: reproducible compatibility evidence demonstrates the Pages blocker, an Accepted ADR records alternatives and consequences, and Product Owner approval confirms the change. The fallback must preserve the Cloudflare-only free-plan-compatible core and all route behavior; adapter preference alone is not sufficient evidence.

Roadmap: [REL-MVP-DEP_PAGES_001](11-Roadmap.md#REL-MVP-DEP_PAGES_001).

#### Acceptance Criteria

- Preview evidence exercises App Router, Server Components, SSG, SSR, ISR/invalidation, API routes, D1, KV, Cron/service bindings, and static assets on Pages.
- Production cannot promote an adapter/runtime combination that failed any required preview compatibility check.
- A switch to Workers is blocked unless compatibility evidence, an Accepted ADR, and explicit Product Owner approval all exist.
- The Workers fallback remains on Cloudflare and passes the same free-plan, behavior, smoke, and rollback checks.
- Deployment documentation identifies the active target and adapter version without claiming unsupported compatibility.

## Configuration

<!-- requirement
id: DEP-CONFIG-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DEP_CONFIG_001
owner: Deployment
verification: pnpm docs:check
-->

<a id="DEP-CONFIG-001"></a>

### DEP-CONFIG-001 — Exact typed configuration and secret handling

The runtime configuration vocabulary is exactly:

```text
APP_ENV
APP_BASE_URL
DEFAULT_LOCALE
SUPPORTED_LOCALES
WEATHER_PRIMARY_PROVIDER
WEATHER_FALLBACK_PROVIDER
WEATHERAPI_SECRET          # secret; optional until the adapter is enabled
WEATHER_DATA_MAX_AGE_MINUTES
AFFILIATE_*_ENABLED
AFFILIATE_*_ID             # secret or config according to provider classification
ADS_ENABLED
ADMIN_ENABLED
CLOUDFLARE_ANALYTICS_ENABLED
GA4_ENABLED
PLAUSIBLE_ENABLED
```

A typed runtime schema parses every configured value. Production fails fast before serving traffic when a required value is missing, malformed, internally inconsistent, or enables an adapter without its required secret/binding. Development provides `.env.example` with names and safe placeholders only; real credentials use Cloudflare Secrets and environment-scoped bindings.

Secrets never enter source control, build output, client bundles, public environment variables, URLs, logs, analytics, error pages, preview artifacts, or test snapshots. Preview and production use separate bindings and secrets. Disabled optional adapters require no secret and are omitted from browser/runtime integration paths.

Roadmap: [REL-MVP-DEP_CONFIG_001](11-Roadmap.md#REL-MVP-DEP_CONFIG_001).

#### Acceptance Criteria

- Schema tests cover every exact name, valid value, invalid value, missing required value, and enablement/secret dependency.
- Production startup fails before traffic on invalid configuration, while disabled optional adapters require no credential.
- `.env.example` contains all applicable names and no real secret; secret scanning finds none in source, build, logs, bundles, artifacts, or snapshots.
- Preview and production binding inventories are isolated and cannot resolve one another's secrets or data stores.
- Unknown configuration names do not implicitly enable capabilities, and all `*_ENABLED` defaults are safe.

## Delivery pipeline

<!-- requirement
id: DEP-CICD-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DEP_CICD_001
owner: Deployment
verification: pnpm docs:check
-->

<a id="DEP-CICD-001"></a>

### DEP-CICD-001 — Verified preview, migrations, Cron, and production promotion

The delivery pipeline installs with the locked package manager, then runs format checking, lint/import boundaries, type checking, unit/integration tests, the documentation gate, production build, security/secret checks, and the separately owned performance/SEO/accessibility gates. It creates an immutable preview artifact before any production change.

Database migrations are explicit, ordered deployment steps: validate and apply to preview, run migration/repository checks and smoke tests, then apply the reviewed production migration before traffic promotion. Application startup never performs destructive auto-migration. A migration failure stops promotion.

Preview smoke checks cover homepage, country, city, ranking, search shell, `/explore` shell/map read model, public v1 success/error envelopes, KV hit and D1 fallback, stale behavior, unavailable behavior, static assets, security headers, no provider call on user reads, and scheduled weather/maintenance bindings without triggering an unapproved live integration. Production smoke checks repeat representative public reads, binding health, active snapshot/read-model freshness, error redaction, Cron registration, and previous-version availability immediately after promotion.

Cron configuration registers the six-hour weather sync at minute 17 and the approved maintenance schedule with environment separation and overlap protection. Featured hourly storage is limited to two local forecast days; all active cities retain seven daily dates. Smoke tests use fixtures or approved non-mutating checks unless a separately approved deployment explicitly authorizes live provider/database effects. The free-plan rationale is recorded in [ADR-001](12-ADR/ADR-001-tiered-six-hour-weather-ingestion.md).

Roadmap: [REL-MVP-DEP_CICD_001](11-Roadmap.md#REL-MVP-DEP_CICD_001).

#### Acceptance Criteria

- Every required static/test/build/security/document gate passes on the immutable artifact before preview deployment.
- Preview migrations and migration tests pass before production migration; any failure stops promotion without traffic switch.
- Preview and production smoke suites cover the listed routes, envelopes, cache/fallback/stale behavior, bindings, headers, redaction, and provider-call prohibition.
- Scheduled bindings are present only in their intended environment, use the approved schedules, and cannot overlap an active run.
- Production promotion reuses the verified artifact rather than rebuilding different code.
- Pipeline evidence records command, exit status, artifact identity, environment, migration version, smoke result, and approval without exposing secrets.

## Rollback

<!-- requirement
id: DEP-ROLLBACK-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DEP_ROLLBACK_001
owner: Deployment
verification: pnpm docs:check
-->

<a id="DEP-ROLLBACK-001"></a>

### DEP-ROLLBACK-001 — Application, configuration, data, and Cron rollback

Every production promotion retains the previous known-good application artifact, configuration version, binding inventory, Cron configuration, migration version, active snapshot pointer, and cache/read-model version. Rollback restores the previous compatible application and configuration without rebuilding, disables a faulty new schedule or optional integration, and preserves the last active snapshot and last-known-good read models.

Migrations are additive and backward-compatible through the rollback window. A failed release does not automatically reverse a data migration destructively; the previous application must operate against the migrated schema until a separately reviewed corrective migration is applied. Cache-version changes retain the previous readable prefix through that window.

Rollback triggers include failed production smoke, binding or Cron failure, elevated error/unavailable rates, corrupt or missing active data, security regression, or an attributable performance/SEO gate failure. After rollback, the owner repeats production smoke checks, verifies active data and schedule state, records impact and evidence, and opens a decision log. A new architectural decision creates or updates an ADR; otherwise the record states `ADR: none — no new architectural decision`.

Roadmap: [REL-MVP-DEP_ROLLBACK_001](11-Roadmap.md#REL-MVP-DEP_ROLLBACK_001).

#### Acceptance Criteria

- A rehearsal restores the previous immutable artifact and configuration without a rebuild and passes the production smoke suite.
- The previous application remains compatible with the current schema and previous cache prefix throughout the declared rollback window.
- Rollback preserves the active and last-known-good snapshots and does not publish a pending/failed candidate.
- Faulty Cron and optional integrations can be disabled independently without deleting core data or credentials.
- The rollback record includes trigger, artifact/config/migration versions, timing, user impact, smoke evidence, known limitations, next step, and the required ADR statement.
