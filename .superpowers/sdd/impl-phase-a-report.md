# Where Not Rain — Phase A Implementation Report (Kiro MVP Tasks 1–8)

- **Author:** software-engineer (寇豆码 / Kou), team `software-wnr-impl`
- **Date:** 2026-07-20
- **Scope:** Phase A = Kiro MVP Tasks 1–8 (foundation → immutable read models)
- **Workspace:** `/root/test/weather` (WSL `Ubuntu24`)
- **Monorepo:** pnpm@10.11.0, 18 workspace projects (`packages/*`, `apps/*`, `workers/*`, `tooling/*`)
- **Status:** ✅ All 8 tasks verified — each exact Verify command exits 0.

## Verification summary

| Task | Package / file                                           | Targeted tests  | Build                  | Requirement IDs                                                                |
| ---- | -------------------------------------------------------- | --------------- | ---------------------- | ------------------------------------------------------------------------------ |
| 1    | `tooling/eslint-config/index.js` + `boundaries.test.mjs` | 3 (node --test) | `pnpm -r build` exit 0 | VISION-_, AGENT-_, ARCH-STACK-001, ARCH-LAYERS-001, ENG-TYPESCRIPT-001         |
| 2    | `packages/config/src/runtime-config.ts`                  | 16              | exit 0                 | ARCH-FLAG-001, DEP-CONFIG-001                                                  |
| 3    | `packages/db/src/geography-repository.ts`                | 16              | exit 0                 | DATA-GEOGRAPHY-001, DATA-RELATIONSHIP-001, UX-I18N-001                         |
| 4    | `packages/db/migrations/0001_weather.sql`                | 12              | exit 0                 | DATA-WEATHER-001, DATA-OPERATIONS-001, DATA-MIGRATION-001                      |
| 5    | `packages/domain/src/score/travel-score.ts`              | 13              | exit 0                 | DATA-SCORE-001, PRD-FR-006                                                     |
| 6    | `packages/weather/src/provider.ts`                       | 7               | exit 0                 | ARCH-PROVIDER-001, ENG-SECURITY-001                                            |
| 7    | `workers/weather-sync/src/sync.ts`                       | 6               | exit 0                 | ARCH-DATAFLOW-001, ARCH-RECOVERY-001, DATA-OPERATIONS-001, ENG-RELIABILITY-001 |
| 8    | `packages/db/src/read-model-resolver.ts`                 | 6               | exit 0                 | ARCH-CACHE-001, API-CACHE-001, ARCH-RECOVERY-001                               |

**Total targeted tests in Phase A suites: 69** (3 + 16 + 16 + 12 + 13 + 7 + 6 + 6), all green.

## What was built

1. **Foundation (T1).** Fixed the pre-existing `TS6059` build failure by moving `rootDir`/`outDir` into each package tsconfig and repointing `main`/`types`/`exports` to `./dist`. Added `tooling/eslint-config` with the `eslint-plugin-boundaries` flat config (file-mode, provider-adapter ordered before package) plus a regression test. `pnpm lint` and `pnpm -r build` pass across all 18 projects.
2. **Typed runtime config + kill switches (T2).** `@wnr/config` exports a validated, default-off runtime configuration with independent emergency switches (map, ads, affiliate, provider ingestion) per ARCH-FLAG-001.
3. **Canonical geography + localized persistence (T3).** `GeographyRepository` validates canonical entities and persists stable ASCII slugs separately from localized content.
4. **Weather snapshot + publication schema + D1 migration (T4).** `0001_weather.sql` is a single ordered forward migration: canonical/translation tables, `weather_snapshots` (status CHECK + `checksum`), `weather_publication_state` (bootstrap row, irreversibility triggers), `active_weather_snapshot` pointer, `weather_daily`/`weather_hourly`, and `sync_locks` with permanent high-water fencing. A partial unique index (`WHERE status='active'`) enforces at-most-one active snapshot.
5. **Deterministic Travel Score + ranking domain (T5).** Pure `calculateTravelScore` with weighted factor functions, confidence gate (hidden below 0.7), versioned hazard model, and stable reason codes. Reproducible from persisted provenance.
6. **Sync-only weather provider adapters (T6).** `WeatherProvider` port + `FakeWeatherProvider` (deterministic seeded-random, never calls a real API — ENG-SECURITY-001). No real external integration.
7. **Fenced hourly ingestion + activation (T7).** `runSync` orchestrates: abort if ingestion disabled → acquire owner-aware fenced lock (15-min TTL) → read active cities → fetch/normalize per city (failures isolated to `sync_failures`) → persist PENDING snapshot in `BEGIN IMMEDIATE`/`COMMIT` → activate (bootstrap insert or replace-supersede) → **always release the lock in `finally`**. Candidate gate rejects when no city succeeds or a featured city failed.
8. **Immutable read models + request-time resolution (T8).** `ReadModelResolver` is D1-active-first: reads authority, **fails closed** unless `active.fencingToken === publicationTokenHighWater`, derives exactly one KV key from the validated identity + canonical params, accepts a KV core only after caller-supplied `verify` (exact identity-field match + schema/checksum), and falls back to the D1-active loader on miss/rejection. The four composed ports are read-only — the resolver never writes KV, invokes the Cache API, enqueues a repair, or backfills.

## Cross-cutting engineering decisions

- **`node:sqlite` under Vitest (shared fix, T3→T8).** Vitest 2.x's SSR runner strips the `node:` prefix and fails to load `sqlite`. Fixed once in `tooling/vitest-config` via a resolver plugin that redirects `node:sqlite` to a local shim doing `require("node:sqlite")` (native resolution Vite never inspects), plus `optimizeDeps.exclude` / `ssr.external` / `server.deps.external`. Benefits all DB/sync tests.
- **Acyclic package boundaries.** `@wnr/domain` imports nothing framework-specific; `@wnr/weather` is importable only by the sync worker; read code never imports provider adapters. Enforced by ESLint boundaries (T1) and `verbatimModuleSyntax` strict TS.
- **Cloudflare free-plan only.** No real external integrations; FAKE/test provider exclusively (T6). Later-release capability paths (ads, affiliate, activity, map, experiments) stay disabled by default via config flags (T2).
- **Single source of truth.** Every acceptance criterion traces to a Requirement ID in `docs/*.md`; Kiro artifacts are generated aids that never override owner documents.
- **Test-first.** Each task's code and targeted tests were written, then its exact Verify command was executed and had to exit 0 before the checkbox was checked.

## Integrity checks

- **`weather.txt` (immutable):** `sha256=70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`, 15938 bytes. **Never read for content, never modified** during Phase A. No Git commits were made.
- **No source drift:** All 8 targeted Verify commands exit 0; no placeholder/`TODO`/partial implementations remain in the Phase A scope.

## Assumptions & minor deviations

- The read-model `WeatherCoreIdentity` follows API-CACHE-001 exactly (`{ snapshotId, rankingVersion, modelVersion }`); `publishedAt` and `fencingToken` live on `WeatherPublicationIdentity` and the fencing equality is enforced by the resolver's fail-closed guard rather than embedded in the core. This honors the authority doc over the looser design.md phrasing.
- `Locale`/`Theme`/`Region` are modeled as `string` aliases in the resolver module to keep the db package self-contained; they can be narrowed to branded unions later without touching the resolver logic.
- `CoreDataKey` is a branded string minted only by `coreDataKeyCodec`, so caller-controlled snapshot/ranking/model identities cannot enter a lookup (API-CACHE-001).

## Next steps (out of Phase A scope)

Tasks 9–24 remain for later phases: v1 API schemas/envelopes (T9), internal auth (T10), Travel Radar / Explorer / destination pages (T11–13), search (T14), UI/design tokens (T15), i18n (T16), SEO (T17), affiliate/analytics (T18–19), security/bot controls (T20), observability/verification suites (T21), performance gate (T22), Cloudflare pipeline (T23), rollback (T24).
