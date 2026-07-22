---
title: Engineering Handbook
authority: Engineering
status: Active
last_updated: 2026-07-17
---

# Engineering Handbook

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Code quality

<!-- requirement
id: ENG-TYPESCRIPT-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_TYPESCRIPT_001
owner: Engineering
verification: pnpm docs:check
-->

<a id="ENG-TYPESCRIPT-001"></a>

### ENG-TYPESCRIPT-001 — Strict, bounded TypeScript implementation

All production TypeScript compiles under strict mode with no unchecked escape hatch used to suppress an unexplained type error. External, configuration, storage, queue, analytics, provider, and API inputs are runtime-validated at their boundary before mapping into domain types. Domain entities, persistence records, provider DTOs, API contracts, and UI ViewModels remain distinct types.

Shared formulas, event names, route builders, locale behavior, constants, and schemas have one owning implementation. Code follows the acyclic dependency rules in [ARCH-LAYERS-001](05-System-Architecture.md#ARCH-LAYERS-001), uses exhaustive handling for closed unions, and keeps optional behavior safe and explicit. Suppression comments, non-null assertions, and broad `any` are rejected unless the narrowest unavoidable use has a documented invariant and a test.

Roadmap: [REL-MVP-ENG_TYPESCRIPT_001](11-Roadmap.md#REL-MVP-ENG_TYPESCRIPT_001).

#### Acceptance Criteria

- Recursive strict type checking exits successfully for every workspace package and application.
- Boundary tests reject malformed external, configuration, storage, analytics, provider, and API values before they enter domain logic.
- Static checks prove persistence records and provider DTOs do not leak into domain or UI contracts and package dependencies remain acyclic.
- Lint or review finds no unexplained `any`, suppression, unsafe assertion, duplicate formula, event name, route builder, or locale implementation.
- Closed-union fixtures exercise every supported value and fail safely for an unknown value.

## Verification strategy

<!-- requirement
id: ENG-TEST-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_TEST_001
owner: Engineering
verification: pnpm docs:check
-->

<a id="ENG-TEST-001"></a>

### ENG-TEST-001 — Required test suites and critical paths

The test pyramid contains deterministic unit tests, boundary-focused integration tests, representative end-to-end journeys, and non-functional release checks. Tests use fixed clocks, explicit city time zones, controlled provider/storage fakes, and production-equivalent builds where behavior depends on bundling or rendering. A critical scoring, migration, publication, cache, authentication, or recovery change cannot merge without tests for its success and failure paths.

Required unit coverage includes:

- score formulas, normalization boundaries, missing factors, confidence, hazard penalty, reason codes, and model versions;
- time windows, city-local dates, time zones, daylight-saving transitions, unit conversion, and locale formatting;
- provider DTO validation and normalization;
- URL and canonical identity construction;
- typed static-control defaults and unknown-key behavior.

Required integration coverage includes:

- ordered D1 migrations, repositories, constraints, indexes, and rollback-window compatibility;
- immutable KV CoreData hit, miss, mismatch, stale calculation, D1 fallback, and no request-path write or provider call;
- Cron success, overlap, partial city failure, primary-provider exhaustion, configured fallback, candidate rejection, and last-known-good preservation;
- API schema, validation, stable errors, request IDs, authentication, authorization, replay prevention, rate limits, and cache-cardinality controls;
- multilingual names and aliases in search;
- sitemap, robots, canonical, hreflang, JSON-LD, quality, and indexability outcomes.

Required end-to-end paths are:

1. Open the homepage, switch to Weekend ranking, and enter a city page.
2. Search for Tokyo, select the result by keyboard, and inspect its seven-day forecast.
3. Switch the map to Beach and open a destination, with the accessible list fallback also verified.
4. In the release where Compare is active, compare Tokyo and Osaka and verify canonical ordering and result correctness.
5. Switch language and units and verify the URL, local date, and displayed values.
6. With an approved Affiliate adapter enabled, record a click without blocking navigation and reach only an allowlisted target.
7. Exercise stale, partial, empty, offline, error, unavailable, and retry behavior without losing the last trustworthy decision context.

Non-functional checks include Lighthouse CI under [ENG-PERF-001](#ENG-PERF-001), axe accessibility, format, lint and import boundaries, strict type checking, production build, route-level JavaScript budget, security headers, dependency and secret scanning, documentation validation, and a minimum load/cache-hit smoke test.

Roadmap: [REL-MVP-ENG_TEST_001](11-Roadmap.md#REL-MVP-ENG_TEST_001).

#### Acceptance Criteria

- Unit, integration, end-to-end, and non-functional manifests map every listed case to at least one executable test or an explicitly release-gated test.
- Changed critical behavior has both positive and negative fixtures, and repeated runs are deterministic under fixed time, locale, and provider/storage inputs.
- User-read integration tests observe zero weather-provider calls and zero request-path KV or Cache API writes on hits, misses, stale data, and unavailable data.
- Each active end-to-end path passes on its required viewport/input mode; delayed paths cannot activate before their Roadmap capability.
- CI blocks merge or promotion when any applicable suite, build, security, documentation, accessibility, bundle, or smoke check fails.

## Performance

<!-- requirement
id: ENG-PERF-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_PERF_001
owner: Engineering
verification: pnpm docs:check
-->

<a id="ENG-PERF-001"></a>

### ENG-PERF-001 — Dual-layer performance release gate

The product target is Lighthouse **100** for Performance, SEO, Accessibility, and Best Practices on every representative page; this target is not achieved by hiding required content, disabling production behavior, or excluding enabled scripts from the test path.

The first blocking layer is Lighthouse CI against a production build. It tests the homepage, a country page, a city page, a baseline ranking page, and the search shell. Each page runs exactly **3 times** with representative mid-tier mobile-device emulation, **4× CPU slowdown**, **1.6 Mbps downlink**, **750 Kbps uplink**, and **150 ms RTT**. The gate uses each page's median of the three runs. Every representative page must independently meet **Performance >= 95**, **SEO = 100**, **Accessibility = 100**, and **Best Practices = 100**; one page below one threshold blocks release. Map, Analytics, and every enabled commercial or experiment script use the same loading path as production.

The second blocking layer is production real-user telemetry from Cloudflare Web Analytics or a privacy-approved equivalent RUM source. For each route class, a rolling **28-day p75** is evaluated against **LCP < 2.0 seconds**, **CLS < 0.05**, and **INP < 200 milliseconds**. A route class requires at least **100 valid samples** in the window for a hard decision; fewer samples are reported but do not block. Exceeding any threshold in **2 consecutive daily evaluation windows** creates a performance incident, pauses new releases, and first disables optional commercial and experiment scripts through the applicable emergency control. If the regression is attributable to the latest deployment and rollback would restore the metric, that deployment is rolled back under [DEP-ROLLBACK-001](08-Cloudflare-Deployment.md#DEP-ROLLBACK-001).

Roadmap: [REL-MVP-ENG_PERF_001](11-Roadmap.md#REL-MVP-ENG_PERF_001).

#### Acceptance Criteria

- CI evidence identifies the production artifact, five representative pages, exact device/network settings, all three run values, each median, and the four threshold decisions.
- A fixture below 95/100/100/100 on any one representative page blocks promotion, while scores of 100 remain visible as the product target.
- Production evaluation groups valid samples by route class, uses rolling 28-day p75, enforces only at 100 or more samples, and reports a smaller sample without blocking.
- Boundary fixtures prove LCP equal to 2.0 seconds, CLS equal to 0.05, and INP equal to 200 milliseconds fail the strict production limits.
- Incident tests require two consecutive failing daily windows, pause release, disable optional commercial/experiment scripts first, and perform rollback only when attribution and recovery evidence support it.
- Audit evidence proves required content and enabled production-path map, Analytics, commercial, and experiment scripts were not hidden or bypassed to pass the gate.

## Security and abuse prevention

<!-- requirement
id: ENG-SECURITY-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_SECURITY_001
owner: Engineering
verification: pnpm docs:check
-->

<a id="ENG-SECURITY-001"></a>

### ENG-SECURITY-001 — Layered application and supply-chain security

All untrusted input is bounded and runtime-validated, output is contextually encoded, and every D1 query is parameterized. Content Security Policy is least-privilege and deployment security headers include HSTS, Referrer-Policy, Permissions-Policy, and X-Content-Type-Options. HTML, attributes, URLs, JSON-LD, logs, and analytics treat external text as data; no unsafe rendering path can execute injected script.

Outbound server requests are restricted to approved schemes, exact hosts, ports, paths, redirect behavior, timeouts, and response sizes to prevent SSRF. Affiliate and other redirects resolve only provider-owned allowlisted destinations and never accept an arbitrary caller target. Internal HTTP operations, when unavoidable, follow [API-INTERNAL-001](07-API-Spec.md#API-INTERNAL-001) for strong credentials, signed method/path/body, timestamp, nonce, short replay window, constant-time verification, authorization, rate limiting, and audit.

Cache and publication inputs follow canonical parameter allowlists, bounded cardinality, schema and identity verification, checksums, and the Architecture-owned activation rules so poisoning cannot select or publish untrusted data. Provider payloads are validated and isolated before activation. Secrets use [DEP-CONFIG-001](08-Cloudflare-Deployment.md#DEP-CONFIG-001), never entering source, build output, browser bundles, URLs, logs, analytics, errors, previews, or snapshots.

Dependencies are locked, reviewed, scanned for vulnerabilities and suspicious packages, and checked together with repository secret scanning. Admin remains disabled by default and, when active, requires reliable identity, least-privilege authorization, audit, CSRF protection where applicable, no public caching, and no production write or sensitive data exposure beyond its separately approved scope.

Roadmap: [REL-MVP-ENG_SECURITY_001](11-Roadmap.md#REL-MVP-ENG_SECURITY_001).

#### Acceptance Criteria

- Security tests cover XSS in every output context, SQL injection in every input family, CSP and required headers, SSRF variants and redirects, open redirect, replay, cache poisoning, provider-data poisoning, and secret leakage.
- D1 spies prove untrusted values use parameter bindings, and output fixtures cannot break their HTML, attribute, URL, JSON-LD, log, or analytics context.
- SSRF and redirect fixtures reject unapproved scheme, host, port, path, DNS/redirect change, and caller-supplied outbound target before a sensitive request occurs.
- Internal-route tests reject missing, malformed, expired, replayed, incorrectly signed, and unauthorized calls before side effects.
- Secret and dependency scans pass against source, lockfile, artifacts, bundles, logs, errors, previews, and snapshots.
- Admin tests prove default-off behavior, authentication, least privilege, audit, no shared caching, no unauthorized mutation, and redaction of internal or sensitive data.

<!-- requirement
id: ENG-BOT-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_BOT_001
owner: Engineering
verification: pnpm docs:check
-->

<a id="ENG-BOT-001"></a>

### ENG-BOT-001 — Four-level Bot Protection and rate enforcement

MVP provides application-layer enforcement at all four levels below. Cloudflare-native controls may run ahead of it when available, but they are an enhancement and never the sole core defense.

| Level | Scope                                                 | Default per-IP limit                                   | Over-limit action                                    |
| ----- | ----------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| L1    | Cacheable public HTML                                 | 120 requests/minute and a 30 requests/10 seconds burst | `429` plus `Retry-After`                             |
| L2    | Public read API and map data                          | 60 requests/minute                                     | `429` plus a short cooldown                          |
| L3    | Search, Compare, and other high-cardinality endpoints | 30 requests/minute                                     | `429`; repeated excess becomes a challenge candidate |
| L4    | Internal sync, maintenance, and Admin                 | 10 requests/minute plus strong authentication          | Reject, audit, and record a security event           |

When the same source reaches **3× the applicable threshold within 5 minutes**, or an available Cloudflare automation/abuse signal fires, the system applies Managed Challenge when the plan supports it; otherwise it extends the application cooldown. Cache keys use parameter allowlists and explicit cardinality bounds.

A crawler is trusted only through Cloudflare Verified Bots or reverse-DNS followed by forward-DNS verification; User-Agent alone is never sufficient. A verified mainstream search crawler accessing public indexable content is exempt from an interactive challenge, but remains subject to an abnormal-traffic safety ceiling. Limit changes before launch require measured load evidence, an update to this requirement, corresponding tests, and a phase decision-log entry.

Roadmap: [REL-MVP-ENG_BOT_001](11-Roadmap.md#REL-MVP-ENG_BOT_001).

#### Acceptance Criteria

- Boundary tests cover the last allowed and first rejected request for L1's minute and burst windows and for every L2, L3, and L4 minute window.
- Window-reset and cooldown fixtures prove counters reset as designed and 3× threshold within five minutes triggers challenge candidacy or extended cooldown.
- L1 returns `429` with `Retry-After`; L2 returns `429` with a short cooldown; L3 returns `429` and escalates repeated excess; L4 rejects, audits, and records a security event in addition to strong authentication.
- Forged crawler User-Agents receive no trust, while Verified Bots or reverse-then-forward DNS verification permits legitimate mainstream search crawling without interactive challenge.
- Cache-key amplification, encoded/duplicate parameter, map-bound, arbitrary search/Compare cardinality, and authenticated-endpoint bypass tests remain bounded.
- Cloudflare-native rules can be absent without removing application enforcement, and any numerical adjustment carries load evidence, updated tests, and a decision-log record.

## Privacy, observability, and reliability

<!-- requirement
id: ENG-PRIVACY-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_PRIVACY_001
owner: Engineering
verification: pnpm docs:check
-->

<a id="ENG-PRIVACY-001"></a>

### ENG-PRIVACY-001 — Data minimization, redaction, and user disclosure

The system collects and retains only data required by an approved product, security, aggregate analytics, or operational purpose. Custom analytics and operational stores do not contain IP addresses, precise location, email, raw search text, full User-Agent, cookies, Authorization values, API keys, credentials, provider bodies, or reversible user identifiers. Country analytics is anonymous and aggregate; destination and country cells below their owning privacy threshold are merged into `other`.

Logs use allowlisted structured fields and sanitized stable error codes. Query strings and headers are excluded by default and any approved field is normalized and redacted before emission. Retention is bounded and documented; deletion and cleanup preserve legally or operationally required aggregate evidence without retaining prohibited raw data.

Privacy, Cookie, Affiliate Disclosure, and data-source pages accurately describe enabled behavior. Optional analytics, advertising, Affiliate, and experiment adapters remain disabled until their consent, purpose, data-flow, retention, regional, and vendor review is complete. Admin exposes only minimum aggregate and sanitized operational data to authorized roles.

Roadmap: [REL-MVP-ENG_PRIVACY_001](11-Roadmap.md#REL-MVP-ENG_PRIVACY_001).

#### Acceptance Criteria

- Schema and sink tests reject IP, precise location, email, raw search text, full User-Agent, cookie, Authorization, API key, secret, provider body, and reversible identifier fields.
- Log fixtures containing sensitive headers, query values, SQL, stack, path, provider, and credential text emit only allowlisted fields and sanitized error codes.
- Retention tests remove expired optional raw operational records while preserving only approved aggregate or required audit evidence.
- Enabled-data-flow review matches public Privacy, Cookie, Affiliate Disclosure, and data-source pages and records consent or lawful-purpose decisions where applicable.
- Optional analytics, ads, Affiliate, experiments, and Admin remain disabled when review, consent, regional, retention, or access-control prerequisites are absent.

<!-- requirement
id: ENG-OBSERVABILITY-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_OBSERVABILITY_001
owner: Engineering
verification: pnpm docs:check
-->

<a id="ENG-OBSERVABILITY-001"></a>

### ENG-OBSERVABILITY-001 — Structured logs, metrics, and actionable signals

Structured logs use the common fields `timestamp`, `level`, `service`, `requestId` or `runId`, `event`, `durationMs`, `status`, and `errorCode`. Values are bounded, timestamps are UTC, IDs support correlation without becoming personal identifiers, and [ENG-PRIVACY-001](#ENG-PRIVACY-001) redaction applies before every sink.

Required sync signals are run status, provider adapter, primary-to-fallback switch, success and failure city counts, duration, activation outcome, and source-data freshness. Required cache and storage signals are internal KV hit/miss/mismatch, D1 fallback, D1/KV read and write failures by authorized path, and read-model repair/publication outcomes. Required request signals are 5xx, 404, typed unavailable outcomes, API latency, and rate-limit decisions. Required quality signals are stale-city count, cities without a valid forecast, ranking generation count and anomaly distribution, broken links, structured-data errors, deployment/smoke status, and the performance indicators in [ENG-PERF-001](#ENG-PERF-001).

Metrics use bounded labels; route templates, stable codes, and enumerated dimensions replace raw URLs, query strings, stack messages, city-scale unbounded IDs where aggregation is sufficient, and arbitrary provider text. Alerts point to an owning runbook or authority contract and distinguish actionable failure from expected stale, no-fill, or insufficient-sample states.

Roadmap: [REL-MVP-ENG_OBSERVABILITY_001](11-Roadmap.md#REL-MVP-ENG_OBSERVABILITY_001).

#### Acceptance Criteria

- Log schema tests require all common fields appropriate to request or run events, validate UTC timestamps and bounded values, and apply privacy redaction before sink emission.
- Fixture runs emit the required sync, provider switch, city outcome, duration, activation, and freshness signals.
- KV hit/miss/mismatch, D1 fallback, storage failure, request 5xx/404/unavailable/latency/rate-limit, stale/forecast/ranking, SEO, and deployment fixtures emit their named metrics.
- Cardinality tests reject raw URL, query string, arbitrary exception/provider text, and other unbounded labels in favor of route templates and stable enumerations.
- Every alert identifies an owner and response reference and does not page solely for an expected no-fill or an under-100-sample performance report.

<!-- requirement
id: ENG-RELIABILITY-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-ENG_RELIABILITY_001
owner: Engineering
verification: pnpm docs:check
-->

<a id="ENG-RELIABILITY-001"></a>

### ENG-RELIABILITY-001 — Verified degraded service and recovery readiness

Reliability tests and operations must preserve trustworthy travel-decision service through provider, sync, KV, D1, candidate-publication, and deployment faults. The normative lock, activation, stale, KV/D1 fallback, static fallback, unavailable, and last-known-good mechanics are owned only by [ARCH-RECOVERY-001](05-System-Architecture.md#ARCH-RECOVERY-001); this requirement does not restate or alter them. Architecture's user-path provider prohibition remains governed by [ARCH-DATAFLOW-001](05-System-Architecture.md#ARCH-DATAFLOW-001), and deployment rollback mechanics remain governed by [DEP-ROLLBACK-001](08-Cloudflare-Deployment.md#DEP-ROLLBACK-001).

Engineering owns proof that these paths work: fault injection covers sync overlap and expiry, single-city and provider failures, invalid and partial candidates, stale presentation, KV miss/corruption/unavailability, D1 degradation, publication interruption, unavailable API behavior, eligible deployed-page fallback, failed promotion, and rollback rehearsal. No degraded path labels stale data as live, publishes an unvalidated candidate, mutates read models from a user request, calls a provider from a user request, or invents missing data.

Each production incident records detection time, affected route class or run, user impact, stable error codes, mitigation, recovery evidence, data-integrity result, known limitations, follow-up owner, and decision-log/ADR outcome. Recovery objectives and alert thresholds are measured from evidence before they become release commitments.

Roadmap: [REL-MVP-ENG_RELIABILITY_001](11-Roadmap.md#REL-MVP-ENG_RELIABILITY_001).

#### Acceptance Criteria

- Fault-injection evidence covers provider/sync failure, invalid candidate, stale data, KV miss/mismatch/failure, D1 degradation, interrupted publication, failed deployment, and rollback without redefining Architecture's recovery algorithm.
- Tests prove stale data is visibly identified, only trustworthy active data is used, and no user-path provider call, score computation, publication, cache repair, or fabricated result occurs.
- API and eligible page tests produce exactly their Architecture/API-owned unavailable or fallback outcomes under D1 and KV faults.
- A rollback rehearsal passes [DEP-ROLLBACK-001](08-Cloudflare-Deployment.md#DEP-ROLLBACK-001) checks and confirms previous-version and last-known-good availability.
- Incident records contain detection, scope, user impact, stable codes, mitigation, recovery and integrity evidence, limitations, owner, and decision-log/ADR outcome.
