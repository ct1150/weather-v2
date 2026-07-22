---
title: System Architecture
authority: Architecture
status: Active
last_updated: 2026-07-17
---

# System Architecture

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## System boundaries

<!-- requirement
id: ARCH-STACK-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ARCH_STACK_001
owner: Architecture
verification: pnpm docs:check
-->

<a id="ARCH-STACK-001"></a>

### ARCH-STACK-001 — MVP continuous technology stack

The MVP application stack is **Next.js App Router**, **React**, and strict **TypeScript**, with **Tailwind CSS**, **shadcn/ui**, **Framer Motion**, **MapLibre GL**, and **Heroicons** for the web experience. The Cloudflare platform stack is **Workers** for runtime execution, **D1** for relational and authoritative publication data, **KV** for worker-published compact read models, **R2** only for an approved asset/export need, **Cron Triggers** for scheduled ingestion and maintenance, **Cloudflare Web Analytics** for default aggregate analytics, **Cloudflare CDN** for static and rendered web delivery, and **Cloudflare Pages** as the preferred deployment target subject to [DEP-PAGES-001](08-Cloudflare-Deployment.md#DEP-PAGES-001).

These named technologies are the continuous MVP baseline, not permission to bypass their owning contracts. Strict TypeScript follows [ENG-TYPESCRIPT-001](09-Engineering-Handbook.md#ENG-TYPESCRIPT-001); package and provider boundaries follow [ARCH-LAYERS-001](#ARCH-LAYERS-001); D1/KV/Cron reads and writes follow [ARCH-DATAFLOW-001](#ARCH-DATAFLOW-001); R2 remains unbound until a demonstrated need passes review; Web Analytics follows [GROW-ANALYTICS-001](10-Growth-Bible.md#GROW-ANALYTICS-001); and deployment remains Pages-first with only the controlled official Workers fallback. Replacing, removing, or adding a core framework, UI system, map engine, Cloudflare storage/runtime service, scheduler, analytics baseline, CDN, or deployment target is an architecture change requiring authority updates and the applicable ADR decision.

Roadmap: [REL-MVP-ARCH_STACK_001](11-Roadmap.md#REL-MVP-ARCH_STACK_001).

#### Acceptance Criteria

- A dependency and build inventory identifies each named web and Cloudflare technology, its exact installed or platform version where applicable, its owning package or binding, and its approved purpose; no unlisted substitute silently replaces a baseline component.
- Production builds compile all application TypeScript in strict mode and render App Router routes with React, Tailwind CSS, shadcn/ui, Framer Motion, MapLibre GL, and Heroicons without crossing the architecture import boundaries.
- Preview evidence exercises Workers runtime behavior, D1, KV, Cron Triggers, Web Analytics, CDN delivery, and the Pages target; R2 is absent unless separate approved evidence names its concrete asset or export need.
- Static and integration checks prove browser and user-read code cannot directly access D1, KV, R2, Cron, or weather-provider adapters and cannot move scheduled writes into a request path.
- Removing disabled optional R2 and commercial adapters leaves the complete core stack operable, while removing any required baseline technology fails the inventory or compatibility gate rather than falling back silently.
- Any core-stack substitution records compatibility and Free-plan evidence, updates every affected owner contract, passes the same build/boundary/preview checks, and cites an Accepted ADR when it creates or changes an architecture decision.

<!-- requirement
id: ARCH-LAYERS-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ARCH_LAYERS_001
owner: Architecture
verification: pnpm docs:check
-->

<a id="ARCH-LAYERS-001"></a>

### ARCH-LAYERS-001 — Acyclic layered architecture

The system uses the dependency direction `UI → Application Use Cases → Domain → Repository/Provider Interfaces`; infrastructure adapters implement inward-facing interfaces. `packages/domain` has no Next.js, Cloudflare SDK, provider DTO, or framework dependency. UI code does not directly access D1, KV, R2, or weather-provider clients, and public API/database records are mapped to dedicated ViewModels before presentation.

The monorepo preserves the documented boundaries: `apps/web` owns UI and read handlers; `workers/weather-sync` owns scheduled ingestion and scoring; `workers/maintenance` owns maintenance jobs; shared `packages/*` own their named framework-independent concerns. Import-boundary checks prevent cycles and make `packages/weather` importable only by `workers/weather-sync`.

Core operation does not require R2. R2 stores static or generated assets, exports, or images only after a demonstrated need justifies the binding and operational cost; weather JSON does not move to R2 merely because R2 is available.

Roadmap: [REL-MVP-ARCH_LAYERS_001](11-Roadmap.md#REL-MVP-ARCH_LAYERS_001).

#### Acceptance Criteria

- A dependency-graph check proves that package edges are acyclic and that domain code imports no framework, Cloudflare SDK, or provider DTO.
- `apps/web` cannot import `packages/weather`, and a user-path attempt to construct a weather-provider adapter fails the boundary check.
- UI and route handlers invoke use cases rather than directly querying infrastructure bindings.
- Shared formulas, route builders, locale behavior, and event names have one implementation rather than route-local copies.
- R2 can be omitted without breaking weather ingestion, scoring, core reads, or recovery.

<!-- requirement
id: ARCH-DATAFLOW-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ARCH_DATAFLOW_001
owner: Architecture
verification: pnpm docs:check
-->

<a id="ARCH-DATAFLOW-001"></a>

### ARCH-DATAFLOW-001 — Scheduled write path and precomputed read path

The hourly weather flow is the only weather write path:

```text
Cron Trigger (hourly)
  1. acquire the owner-aware D1 "weather-sync" lock with a 15-minute expiry; abort if held
  2. create the run and freeze E = enabled city IDs and F = featured IDs at run start
  3. fetch bounded city batches; after primary exhaustion, use the configured fallback
  4. validate provider DTOs and normalize them to internal types
  5. record each failed city and continue with valid cities
  6. transactionally persist the pending snapshot, daily/hourly weather, scores, and one new rankingVersion in D1
  7. validate all records and activation coverage against frozen E and F; fail the candidate on any gate failure
  8. write and checksum-read-back immutable weather keys scoped by snapshotId and ranking/map keys scoped by snapshotId + rankingVersion
  9. acquire the owner-aware D1 `weather-publication` lock and capture its newly incremented monotonic `fencing_token = T`
 10. in one D1 activation transaction require the same unexpired holder and captured `fencing_token = T`, revalidate the candidate and coverage, supersede the old snapshot, activate the candidate, and replace the active publication identity
 11. after commit, replace only `v1:manifest:active` with the exact D1 identity `{ snapshotId, rankingVersion, modelVersion, publishedAt, fencingToken: T }`
 12. mark the run successful or partial and owner-aware release both locks without resetting either lock's fencing-token high-water mark
```

At step 2, an enabled city is exactly a `cities` row whose `status = 'active'`; `E` is that set captured before the first provider fetch, and `F = {city in E | is_featured = 1}` uses the same run-start rows. Let `d0(city)` be the city-local calendar date containing `sync_runs.started_at`. A city belongs to `V` only when the candidate contains runtime-valid daily weather for every date `d0(city)` through `d0(city) + 6`, inclusive, and every row contains the raw inputs required to derive rain, temperature, comfort, humidity, wind, UV, cloud, and visibility factors. Activation requires `|E| > 0`, `100 * |V| >= 95 * |E|`, and `F subset-of V`. The integer inequality is the exact `>= 95%` test; `F subset-of V` is exact 100% featured coverage and passes vacuously when `F` is empty. City enablement changes after run start do not change this denominator.

Step 8 uses high-entropy `snapshotId` and `rankingVersion` values that have never appeared in a manifest, response, log, or public URL. No candidate write overwrites an active key. The candidate becomes discoverable only through step 11, after record validation, coverage validation, immutable-key read-back verification, and D1 activation have succeeded.

The maintenance ranking refresh protocol never creates or activates weather. Maintenance reads the current D1 active `snapshotId = S`, generates a new high-entropy `rankingVersion = R` for every enabled `(theme, window, region, locale)` ranking variant and every enabled canonical map region/bounds variant of S, and checksum-validates the complete expected set. It then acquires `weather-publication` and captures the newly incremented monotonic `fencing_token = T`. In one D1 transaction it requires the same unexpired holder and captured fencing token, rechecks that S is still the sole active snapshot, and updates the fixed active publication row to `(S, R, modelVersion, publishedAt, T)`; otherwise it publishes nothing. Only after that commit may it write a manifest carrying that exact tuple.

Acquiring token T immediately makes every lower-token manifest ineligible at a `/api/v1` resolver until D1 publication at T completes; reads use D1 during that interval. A delayed KV write by an old or stale holder carries a lower fencing token and cannot become effective: every `/api/v1` resolver compares it with both the D1 active publication row and the current `weather-publication` token high-water mark. The sync and maintenance protocols therefore cannot restore a superseded snapshot or ranking generation even when KV writes arrive out of order. A crash before the one-key manifest replacement leaves D1 authoritative and causes D1 fallback, not acceptance of an older hint.

Every user request follows a read-only path with an explicit CDN boundary:

```text
Static asset or SSG/ISR HTML request
  → Cloudflare CDN hit: return only that cached static asset or generated HTML artifact
  → CDN miss: execute the route's rendering/fallback contract

/api/v1 request
  → always execute the application use case; the CDN never directly returns a final API envelope
  → first read the D1 authoritative publication/content identity and, for weather, the publication fencing-token high-water mark
  → derive the exact identity-bound key and read only worker-populated immutable KV CoreData
  → schema-parse, identity-check, and checksum-verify that CoreData
  → on KV miss or any manifest/identity/key/checksum mismatch, read only D1-active/content-authoritative rows
  → do not write or backfill KV or Cache API; subsequent requests continue using D1 until a worker repairs publication
  → derive stale from this request's captured time and assemble its request ID, generation time, and final envelope dynamically
  → return the final envelope as private, no-store

User request ─X→ Open-Meteo / WeatherAPI
```

D1 active publication or content identity is authoritative on every `/api/v1` request; the KV manifest hint is accepted only when its identity exactly matches D1 and never selects identity. A stale, malformed, missing, future-token, lower-token, or D1-mismatched manifest is ignored. The resolver never guesses an ID, lists KV, probes pending data, or searches arbitrary old keys. If authoritative D1 identity cannot be read, the API does not trust KV alone and returns the explicitly contracted unavailable outcome. Deployed static fallback artifacts apply only to eligible page rendering and are never substituted for a final `/api/v1` envelope.

The user read path never writes or repairs a weather read model, computes a score, contacts a provider, mutates KV, or uses the ephemeral Cache API for CoreData or final API responses. Only static assets and SSG/ISR HTML may be direct CDN hits. Every `/api/v1` request executes identity resolution, CoreData resolution, and dynamic envelope assembly; its `stale` value is derived solely from age under the API contract, not from publication status, manifest age, internal KV TTL, or fallback source.

Roadmap: [REL-MVP-ARCH_DATAFLOW_001](11-Roadmap.md#REL-MVP-ARCH_DATAFLOW_001).

#### Acceptance Criteria

- An integration test observes zero provider calls for every public page and read-API use case, including cache misses.
- CDN routing tests prove direct hits return only static assets or SSG/ISR HTML and that every `/api/v1` request executes D1 identity resolution, CoreData resolution, and dynamic envelope assembly.
- A successful Cron run persists pending D1 data, fully validates it, writes and verifies undiscoverable immutable KV keys, activates the D1 pointer transactionally, and only then updates the KV manifest, in exactly that order.
- A failed city is isolated and recorded while valid cities in the bounded batch remain eligible for publication.
- Every `/api/v1` request reads D1 identity before KV; only an exact D1/high-water-token manifest match may resolve immutable worker-published CoreData, and every miss or mismatch resolves only D1-active/content-authoritative rows without request-path storage mutation.
- Failure before D1 activation leaves the active publication unchanged; failure after D1 activation but before manifest update makes the old KV hint ineligible while D1 already identifies the new active publication.
- Only an activated, fully validated snapshot can become the basis of a discoverable public ranking or read model.

<!-- requirement
id: ARCH-PROVIDER-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ARCH_PROVIDER_001
owner: Architecture
verification: pnpm docs:check
-->

<a id="ARCH-PROVIDER-001"></a>

### ARCH-PROVIDER-001 — Sync-only weather-provider port

The internal weather port has this stable minimum shape:

```ts
interface WeatherProvider {
  readonly id: string;
  fetchForecast(request: ForecastRequest): Promise<NormalizedForecast[]>;
  healthCheck(): Promise<ProviderHealth>;
}
```

Open-Meteo is the primary adapter. WeatherAPI is the configured fallback adapter when its deployment flag and credentials are present; otherwise primary exhaustion fails the affected batch. Raw provider DTOs remain private to each adapter; each response is runtime-validated and mapped to normalized metric-domain types before it crosses the adapter boundary.

Timeouts, bounded retries, exponential backoff with jitter, bounded batches, provider-aware rate limiting, and a `CLOSED → OPEN → HALF_OPEN` circuit breaker run only inside the sync worker. Fallback occurs only after the primary breaker is open or retries are exhausted, and the provider switch and sanitized reason are recorded with the sync run. Provider credentials are supplied only through deployment-owned secret bindings.

Roadmap: [REL-MVP-ARCH_PROVIDER_001](11-Roadmap.md#REL-MVP-ARCH_PROVIDER_001).

#### Acceptance Criteria

- Both adapters satisfy the same port and return normalized internal records rather than provider DTOs.
- Invalid, empty, extreme, and partial provider responses are validated and isolated before persistence or activation.
- Tests cover timeout, bounded retry, jittered backoff, circuit-breaker transitions, primary-to-fallback switching, and both-provider failure.
- Provider switching records adapter IDs and a sanitized failure reason without credentials or raw provider bodies.
- Provider resilience code and credentials are unreachable from browser and user-request bundles.

## Caching and recovery

<!-- requirement
id: ARCH-CACHE-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ARCH_CACHE_001
owner: Architecture
verification: pnpm docs:check
-->

<a id="ARCH-CACHE-001"></a>

### ARCH-CACHE-001 — Versioned compact read models

Only sync and maintenance workers write immutable KV read models; user paths only read them, never backfill a miss, and never use the ephemeral Cache API for CoreData or final API responses. A read-model schema or serialization change increments the leading key version. Every weather-derived summary, forecast, ranking, map, and approved Compare key contains `snapshotId`; candidate keys are immutable and cannot overwrite an in-flight read of an active version.

```text
v1:manifest:active
v1:city:{cityId}:summary:{snapshotId}:{locale}:{unit}
v1:city:{cityId}:forecast:{snapshotId}:{unit}
v1:ranking:{snapshotId}:{rankingVersion}:{theme}:{window}:{region}:{locale}
v1:map:{snapshotId}:{rankingVersion}:{theme}:{window}:{mapRegionKey}:{canonicalBoundsHash}
v1:country:{countryId}:{locale}
v1:compare:{snapshotId}:{cityA}-{cityB}:{window}:{locale}    # approved pairs only
```

`v1:manifest:active` is the only mutable weather publication key and contains exactly `{ snapshotId, rankingVersion, modelVersion, publishedAt, fencingToken }`. It is only a hint for the complete validated generation named by the D1 active publication identity; it remains small and contains no model payload. Both opaque IDs are high entropy. Before publication they are absent from manifests, public responses, public URLs, analytics, and logs, and direct clients cannot select them.

Every immutable weather value carries `{ data, dataUpdatedAt, snapshotId, rankingVersion, modelVersion, checksum }`. `rankingVersion` is a non-null string for ranking and map values and is `null` for summary, forecast, and Compare values. Checksums are verified after write and before use. On every `/api/v1` read, a resolver first obtains D1 identity and the publication-token high-water mark; it accepts a manifest only on an exact five-field match and accepts the immutable value only when its identity and checksum also match. Ranking/map data therefore cannot cross generations. Map values carry the canonical `mapRegionKey` and `canonicalBoundsHash` fixed by the API schema, contain only compact marker fields, and contain no hourly array. Cache cardinality is bounded by enumerated dimensions, canonical map tile regions/bounds, and approved comparison pairs.

| Data            | Target TTL | Invalidation                                                |
| --------------- | ---------: | ----------------------------------------------------------- |
| Country         |    30 days | Active-version invalidation on content change               |
| City metadata   |     7 days | Metadata version change; excludes hourly weather            |
| Current weather |     1 hour | Refreshed only by Cron; stale-while-revalidate is sync-only |
| Forecast        |     1 hour | Bound to snapshot version                                   |
| Rankings/maps   |     1 hour | New rankingVersion after activated sync or maintenance      |
| Articles        |      1 day | Publish or update                                           |
| Images          |   365 days | Immutable content-hash filenames                            |

KV eventual consistency is never used for locks, counters, snapshot activation, or another critical state transition.

Roadmap: [REL-MVP-ARCH_CACHE_001](11-Roadmap.md#REL-MVP-ARCH_CACHE_001).

#### Acceptance Criteria

- Tests prove that changing a read-model schema changes the key version; summary, forecast, and Compare bind to one snapshot ID; ranking and map bind to one exact `(snapshotId, rankingVersion)` pair.
- Publication fault tests stop after every numbered step and prove that no pending candidate becomes discoverable; delayed lower-token sync/maintenance writes are ignored and cannot roll back D1 identity.
- Resolver tests cover exact D1/manifest match, token-high-water mismatch, old/future manifest, manifest miss/error, referenced-key mismatch, and D1 failure; every `/api/v1` path reads D1 first, never probes another KV snapshot, and performs no storage write or backfill.
- Cached values always expose enough version, checksum, and timestamp metadata to derive API/page freshness without a provider call.
- Map payload fixtures contain only compact marker fields and no hourly forecast arrays.
- A static analysis or integration check proves that KV is not the authoritative lock, counter, or activation store and that `v1:manifest:active` is the only mutable weather publication key.

<!-- requirement
id: ARCH-RECOVERY-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ARCH_RECOVERY_001
owner: Architecture
verification: pnpm docs:check
-->

<a id="ARCH-RECOVERY-001"></a>

### ARCH-RECOVERY-001 — Last-known-good activation and degraded reads

D1 lock rows retain a per-key monotonic fencing token. Each successful acquisition increments and returns the token; expiry or owner-aware release clears ownership but never resets or reuses the high-water mark. The default `weather-sync` lease is 15 minutes. Sync overlap is prevented by holder/expiry checks, while every sync or maintenance publication is additionally fenced by the captured `weather-publication` token.

A candidate snapshot remains pending while normalized weather, scores, alerts, rankings, and frozen run-city scope are completed in D1. Full validation and the exact coverage gates run before any KV write. After immutable-key checksum verification, the publisher executes the sole repository activation transaction. That transaction verifies the same unexpired holder and captured fencing token, then atomically performs the bootstrap or replacement protocol defined by Database, updates the fixed active publication identity with that token, and executes final assertions. Schema constraints guarantee at most one pointer/active status; the repository protocol guarantees exactly one after successful bootstrap. A conflict, expired lease, changed token, or failed assertion rolls back.

Only after commit may the holder write the exact D1 tuple to `v1:manifest:active`. A later acquisition increments the high-water mark immediately, so delayed KV writes from any old holder are ineffective even before the next publication commits. Failure between D1 commit and manifest replacement causes `/api/v1` requests to ignore the mismatched old hint and use D1. Orphan immutable keys remain undiscoverable and are later collected after the rollback window.

Provider failure preserves the D1 active publication. On every `/api/v1` read, a missing or mismatched hint falls back only to D1 active data without backfilling KV or Cache API; if D1 fails, an eligible page render may use deployed static content, while `/api/v1` returns a typed unavailable outcome. `stale` is not a fallback signal: it is true exactly when `now - dataUpdatedAt > WEATHER_DATA_MAX_AGE_MINUTES`, with equality false, regardless of internal KV/D1 source. No degraded result is described as live, and no user path contacts a provider.

Roadmap: [REL-MVP-ARCH_RECOVERY_001](11-Roadmap.md#REL-MVP-ARCH_RECOVERY_001).

#### Acceptance Criteria

- Concurrent-run tests allow only one unexpired holder, prove expired-lock recovery, and prove every acquisition returns a strictly greater, never-reused fencing token.
- Fault-injection tests prove invalid candidates and stale-holder KV writes cannot change effective publication identity.
- Transaction tests prove activation rejects an expired or changed captured token and atomically commits the post-bootstrap singleton; coverage fixtures test 94.99%, 95%, featured misses, an empty enabled set, and run-start membership changes.
- Resolver tests prove every `/api/v1` request validates D1 identity first, rejects any manifest whose five fields or token high-water mark differ, and leaves every miss for worker repair without request-path KV or Cache API writes.
- Stale boundary tests prove age equal to `WEATHER_DATA_MAX_AGE_MINUTES` is fresh and one instant beyond is stale, independent of source and publication status.
- Absence of trustworthy D1-active data produces the typed unavailable API outcome; only eligible page rendering may use deployed static data, and neither path fabricates data.

## Rendering authority

<!-- requirement
id: ARCH-RENDER-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ARCH_RENDER_001
owner: Architecture
verification: pnpm docs:check
-->

<a id="ARCH-RENDER-001"></a>

### ARCH-RENDER-001 — Route rendering matrix

This is the only route rendering matrix. It owns route mode and default update/invalidation behavior. The final column is a cross-domain pointer to the independently owned [SEO indexability policy](03-SEO-Bible.md#SEO-INDEXABILITY-001), not a duplicate definition of its quality conditions.

| Route class                                    | Mode                   | Default update/invalidation                                                 | Index rule                                                            |
| ---------------------------------------------- | ---------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Methodology, legal, and stable marketing pages | SSG                    | Rebuild on release                                                          | Index after passing the quality gate                                  |
| Homepage, country, city, weather-led rankings  | ISR                    | 3600 seconds; actively invalidate by snapshot version after successful sync | Index after passing the quality gate                                  |
| Article                                        | SSG                    | Rebuild on publish or edit                                                  | Index after review                                                    |
| Allowlisted Compare (Beta)                     | ISR                    | 3600 seconds; invalidate when a city snapshot changes                       | Index only allowlisted combinations                                   |
| `/explore`                                     | SSR shell + client map | CDN shell; cache map read model for 3600 seconds                            | Shell may be indexed; filter parameters canonicalize to a stable page |
| `/search` and arbitrary query results          | SSR                    | No persistent prerender                                                     | `noindex,follow`                                                      |
| `/admin`, preview pages, and `/api/*`          | Dynamic                | Per-request API core resolution; no final-envelope caching                  | `noindex` or non-HTML                                                 |

Fallback and cache-header rules are part of the rendering contract: SSG serves the last successfully deployed static artifact; ISR serves the last successfully generated artifact and resolves current data through [ARCH-RECOVERY-001](#ARCH-RECOVERY-001); `/explore` keeps a CDN-cacheable shell while its versioned map model follows the one-hour cache; `/search`, Admin, and preview HTML are not persistently prerendered; API responses follow [API-CACHE-001](07-API-Spec.md#API-CACHE-001). Public cache headers must not outlive the matrix interval or the underlying read-model TTL. Personalized, authenticated, preview, and error responses are private or `no-store` and never enter a shared cache.

A route may depart from this matrix only after Architecture records the reason and verification evidence. Any departure that affects indexing also requires an update to the SEO-owned indexability table.

Roadmap: [REL-MVP-ARCH_RENDER_001](11-Roadmap.md#REL-MVP-ARCH_RENDER_001).

#### Acceptance Criteria

- A route-registry test covers every matrix row and verifies its exact mode and default update/invalidation behavior.
- There is no second rendering table containing mode, revalidation, invalidation, fallback, TTL, or cache-header values elsewhere in the authority set.
- ISR invalidation changes with activated snapshot version and never activates an unvalidated candidate.
- Shared-cache tests prove that authenticated, preview, personalized, and error responses are not cached publicly.
- Any approved route exception includes architecture evidence, and an indexability-affecting exception links to the corresponding SEO update.

## Capability controls

<!-- requirement
id: ARCH-FLAG-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ARCH_FLAG_001
owner: Architecture
verification: pnpm docs:check
-->

<a id="ARCH-FLAG-001"></a>

### ARCH-FLAG-001 — Typed static configuration and emergency kill switches

The baseline control plane is build/deployment-supplied typed static configuration with safe defaults and emergency kill switches. It controls the map, advertising, each Affiliate slot or provider, and the weather-provider master enablement. Evaluation occurs server-side before optional code or data is exposed; an absent or unknown key is disabled rather than implicitly enabled.

This baseline is not a dynamic Feature Flag platform: it performs no user segmentation, percentage rollout, live experimentation, or per-request remote mutation. Configuration names, validation, and secret placement are owned by [DEP-CONFIG-001](08-Cloudflare-Deployment.md#DEP-CONFIG-001).

Roadmap: [REL-MVP-ARCH_FLAG_001](11-Roadmap.md#REL-MVP-ARCH_FLAG_001).

#### Acceptance Criteria

- Typed parsing rejects invalid values and treats absent or unknown optional controls as disabled.
- Tests independently disable the map, advertising, each Affiliate control, and all provider ingestion without disabling core cached destination reads.
- Server-rendered output and browser bundles omit disabled optional integrations rather than hiding an already activated integration.
- The baseline contains no segmentation, percentage rollout, experiment assignment, or remotely mutable flag behavior.
- Emergency switches can be changed through the approved deployment configuration and rolled back without a schema migration.

<!-- requirement
id: ARCH-FLAG-002
status: Active
kind: Hard
roadmap_ref: REL-V1-ARCH_FLAG_002
owner: Architecture
verification: pnpm docs:check
-->

<a id="ARCH-FLAG-002"></a>

### ARCH-FLAG-002 — Dynamic Feature Flag platform

The dynamic Feature Flag platform adds server-side audience segmentation, deterministic percentage rollout, staged rollout, and experiment assignment while preserving safe defaults. Flag identity and assignment are stable for the defined subject and evaluation context, and unknown or unavailable flags evaluate disabled.

The platform must not create indexable variants, alter canonical identity, expose secret targeting rules, or make core weather reads depend on a remote flag service. Experiment policy and metrics remain with their owning Growth contracts rather than being redefined here.

Roadmap: [REL-V1-ARCH_FLAG_002](11-Roadmap.md#REL-V1-ARCH_FLAG_002).

#### Acceptance Criteria

- Repeated evaluation of the same flag, subject, and context returns the same assignment.
- Percentage and audience rollouts are bounded, mutually testable, and default disabled on configuration or service failure.
- Search crawlers and ordinary users receive one canonical URL regardless of assignment, with no indexable variant parameters.
- Dynamic evaluation cannot block core cached weather reads or bypass an emergency static kill switch.
- Audit output records flag/version and assignment reason without personal data or secret targeting configuration.
