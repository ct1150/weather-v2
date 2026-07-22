<!-- derived: {"generated_at":"2026-07-17","schema":1,"sources":[{"digest":"sha256:bdf23f67b803755d128c9863552393cb43f92cdfc2769c045f7e248a640f1b8b","ids":["VISION-BUSINESS-001","VISION-COST-001","VISION-MARKET-001","VISION-METRICS-001","VISION-POSITION-001","VISION-VALUE-001"],"path":"docs/00-Founder-Vision.md"},{"digest":"sha256:c0dd1692f639554323e24c445b9594f4fdc85fc7aec15805d82ac0248ca04afc","ids":["PRD-FR-001","PRD-FR-002","PRD-FR-003","PRD-FR-004","PRD-FR-005","PRD-FR-006","PRD-FR-011"],"path":"docs/01-Product-PRD.md"},{"digest":"sha256:e588bed6068f067c9400cbc4752c3114331e112b26893b181ba0938a34f95794","ids":["UX-A11Y-001","UX-DESIGN-001","UX-HOME-001","UX-I18N-001","UX-IA-001","UX-STATE-001"],"path":"docs/02-UX-Bible.md"},{"digest":"sha256:56411d73776f2358a1dee8e46a64154cb88386210f36b6c8a40e390a4c294a81","ids":["SEO-CONTENT-001","SEO-INDEXABILITY-001","SEO-PAGE-001","SEO-QUALITY-001","SEO-SITEMAP-001","SEO-STRUCTURED-001"],"path":"docs/03-SEO-Bible.md"},{"digest":"sha256:7205aad209b3ffa188be100036134f88bd34293eb361858a4d0d784ec64e2a8c","ids":["AGENT-BOUNDARY-001","AGENT-DOCS-001","AGENT-DOD-001","AGENT-PROTOCOL-001"],"path":"docs/04-AI-Coding-Bible.md"},{"digest":"sha256:62deeb1fb61a6e8efab9f3f5da62bab4346379bbba8e72f5e48c13caaced06c2","ids":["ARCH-CACHE-001","ARCH-DATAFLOW-001","ARCH-FLAG-001","ARCH-LAYERS-001","ARCH-PROVIDER-001","ARCH-RECOVERY-001","ARCH-RENDER-001","ARCH-STACK-001"],"path":"docs/05-System-Architecture.md"},{"digest":"sha256:31dbb4298991a34a92e685c1429f914813c655f3f4cc10036af348a788b3c0e9","ids":["DATA-GEOGRAPHY-001","DATA-MIGRATION-001","DATA-OPERATIONS-001","DATA-RELATIONSHIP-001","DATA-SCORE-001","DATA-WEATHER-001"],"path":"docs/06-Database.md"},{"digest":"sha256:2a8a73d38694b4a6626c6550b57eeaf6a67c275d5a949d7be1efbf4a6fd87d7e","ids":["API-CACHE-001","API-ENVELOPE-001","API-INTERNAL-001","API-READ-001","API-VALIDATION-001"],"path":"docs/07-API-Spec.md"},{"digest":"sha256:ce06813e2858b22dcb4de73e957c144745e25f5564d162e61f290d85b9d37381","ids":["DEP-CICD-001","DEP-CONFIG-001","DEP-FREE-001","DEP-PAGES-001","DEP-ROLLBACK-001"],"path":"docs/08-Cloudflare-Deployment.md"},{"digest":"sha256:9cfe55cdc3ec2f82812e19101975acad5ba328c8ee7f8ceee24d28de9921f188","ids":["ENG-BOT-001","ENG-OBSERVABILITY-001","ENG-PERF-001","ENG-PRIVACY-001","ENG-RELIABILITY-001","ENG-SECURITY-001","ENG-TEST-001","ENG-TYPESCRIPT-001"],"path":"docs/09-Engineering-Handbook.md"},{"digest":"sha256:5db173cf8a1ff73330152c3608b7e5a53a2352be21be32d7f023bc78295bd8fa","ids":["GROW-ADS-001","GROW-AFF-001","GROW-ANALYTICS-001"],"path":"docs/10-Growth-Bible.md"}]} -->

# Where Not Rain — MVP Design

This implementation design is derived from the authority set. Authority documents own all product, architecture, data, API, quality, release, and operational contracts; this file organizes implementation boundaries and does not redefine them.

## System design

### Authority-led delivery and product intent

_Requirements: VISION-POSITION-001, VISION-MARKET-001, VISION-VALUE-001, VISION-METRICS-001, AGENT-PROTOCOL-001, AGENT-BOUNDARY-001, AGENT-DOD-001, AGENT-DOCS-001_

Implementation starts from the active authority entry point, resolves release through Roadmap, and records exact verification evidence. Product naming, market order, explainability, and measurable outcomes flow into use-case acceptance tests rather than being duplicated as local constants. Kiro material remains a generated implementation aid and never overrides an owner document.

### MVP stack and acyclic package boundaries

_Requirements: ARCH-STACK-001, ARCH-LAYERS-001, ENG-TYPESCRIPT-001_

The monorepo keeps domain logic framework-independent, maps infrastructure records into domain and view types, and prevents browser/read code from importing provider adapters. Strict TypeScript and import-boundary checks make forbidden dependency directions compile- or lint-time failures.

```text
apps/web ───────────────▶ application/domain ports
workers/weather-sync ───▶ domain + db + weather adapters
workers/maintenance ────▶ domain + db + seo
packages/weather ───────▶ domain (sync worker import only)
```

The UI and route-handler layers are adapters around application use cases. Use cases accept canonical input plus a request context, depend only on ports, and return dedicated ViewModels or typed application errors; persistence rows, provider DTOs, Cloudflare bindings, and HTTP response objects do not cross this boundary.

```ts
type ApplicationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApplicationError };

interface RequestContext {
  readonly requestId: string;
  readonly locale: Locale;
  readonly now: string;
}

interface QueryUseCase<Input, ViewModel> {
  execute(input: Input, context: RequestContext): Promise<ApplicationResult<ViewModel>>;
}

type GetTravelRadar = QueryUseCase<TravelRadarQuery, TravelRadarViewModel>;
type GetCountryPage = QueryUseCase<CountryPageQuery, CountryPageViewModel>;
type GetCityPage = QueryUseCase<CityPageQuery, CityPageViewModel>;
type GetRanking = QueryUseCase<RankingQuery, RankingPageViewModel>;
type SearchDestinations = QueryUseCase<SearchQuery, SearchResultsViewModel>;
```

Infrastructure implements narrow ports rather than being imported by use cases. The port split keeps user reads read-only and lets integration tests prove ordering and side effects.

```ts
interface GeographyReader {
  findCountry(query: CanonicalCountryQuery): Promise<Country | null>;
  findCity(query: CanonicalCityQuery): Promise<City | null>;
}

interface ScoreReader {
  listRanked(identity: WeatherPublicationIdentity, query: RankingQuery): Promise<RankedCity[]>;
}

interface SearchReader {
  search(query: CanonicalSearchQuery): Promise<SearchMatch[]>;
}

interface AnalyticsSink {
  emit(event: AllowlistedAnalyticsEvent): Promise<void>;
}
```

`ApplicationError`, canonical query types, and event payloads are closed internal unions whose exact mappings remain delegated to their owning authority contracts rather than copied here.

### Scheduled ingestion and provider isolation

_Requirements: ARCH-DATAFLOW-001, ARCH-PROVIDER-001, ARCH-RECOVERY-001, DATA-OPERATIONS-001_

The hourly worker acquires owner-aware fenced locks, freezes run scope, fetches bounded provider batches, validates normalized records, persists a pending candidate, computes scores/read models, validates coverage, activates in D1, and then publishes the manifest hint. Provider timeout, retry, circuit-breaker, and fallback behavior exists only inside the sync worker. Per-city failures are isolated and recorded.

### Authoritative identity and immutable read models

_Requirements: ARCH-CACHE-001, API-CACHE-001, ARCH-RECOVERY-001_

D1 returns one authority record shaped as `{ active: WeatherPublicationIdentity, publicationTokenHighWater: number }`. Worker-written KV values are immutable identity-bound CoreData; API requests validate that the active identity fencing token equals the high-water token before one exact KV lookup and fall back only to rows for that same D1-active authority without request-path repair. Request IDs, generation time, and stale booleans are assembled per request and never stored in CoreData.

The resolver composes four read-only ports. Its implementation invokes `PublicationAuthorityReader` first and fails closed unless `active.fencingToken === publicationTokenHighWater`. It derives exactly one key from `authority.active` and canonical parameters, then accepts an immutable core only when every active identity field (`snapshotId`, `rankingVersion`, `modelVersion`, `publishedAt`, and `fencingToken`) matches exactly and schema/checksum verification succeeds. A manifest hint may corroborate identity but never replaces D1 authority. On a KV miss or rejection, the resolver calls the D1-active loader with the same validated authority. None of these user-path ports exposes `put`, `delete`, repair, queue, provider, or Cache API operations.

```ts
interface WeatherPublicationIdentity {
  readonly snapshotId: string;
  readonly rankingVersion: string | null;
  readonly modelVersion: string;
  readonly publishedAt: string;
  readonly fencingToken: number;
}

interface WeatherPublicationAuthority {
  readonly active: WeatherPublicationIdentity;
  readonly publicationTokenHighWater: number;
}

interface PublicationAuthorityReader {
  readWeatherPublicationAuthority(): Promise<WeatherPublicationAuthority>;
}

interface ManifestHintReader {
  readActiveHint(): Promise<ManifestHint | null>;
}

interface ImmutableCoreReader {
  get<T>(key: CoreDataKey): Promise<ImmutableCore<T> | null>;
}

interface ActiveCoreLoader<Params, T> {
  loadFromActiveD1(
    authority: WeatherPublicationAuthority,
    params: Params,
  ): Promise<ImmutableCore<T> | null>;
}

interface ResolverPorts<Params, T> {
  readonly publication: PublicationAuthorityReader;
  readonly manifest: ManifestHintReader;
  readonly immutableCore: ImmutableCoreReader;
  readonly activeD1: ActiveCoreLoader<Params, T>;
}

interface ReadModelResolver {
  resolve<Params, T>(
    request: ResolveCoreRequest<Params, T>,
    ports: ResolverPorts<Params, T>,
  ): Promise<ResolvedCore<T>>;
}

interface ResolveCoreRequest<Params, T> {
  readonly params: Params;
  readonly buildKey: (active: WeatherPublicationIdentity, params: Params) => CoreDataKey;
  readonly verify: (
    core: ImmutableCore<T>,
    authority: WeatherPublicationAuthority,
    hint: ManifestHint | null,
  ) => boolean;
}
```

Key construction uses typed parts so caller-controlled snapshot, ranking, model, or publication identities cannot enter a lookup. `CoreDataKeyCodec` owns canonical serialization; the exact strings, endpoint dimensions, TTLs, and validators remain in the linked Architecture/API contracts.

```ts
type WeatherCoreKeyParts =
  | {
      readonly kind: "summary";
      readonly city: CanonicalCityKey;
      readonly window: Window;
      readonly locale: Locale;
      readonly unit: Unit;
    }
  | {
      readonly kind: "forecast";
      readonly cityId: string;
      readonly days: number;
      readonly unit: Unit;
    }
  | {
      readonly kind: "ranking";
      readonly theme: Theme;
      readonly window: Window;
      readonly region: Region;
      readonly locale: Locale;
      readonly limit: number;
    }
  | {
      readonly kind: "map";
      readonly theme: Theme;
      readonly window: Window;
      readonly mapRegionKey: string;
      readonly canonicalBoundsHash: string;
    };

interface CoreDataKeyCodec {
  encodeWeather(identity: WeatherPublicationIdentity, parts: WeatherCoreKeyParts): CoreDataKey;
  encodeContent(identity: ContentIdentity, parts: ContentCoreKeyParts): CoreDataKey;
}

interface ImmutableCore<T> {
  readonly identity: WeatherCoreIdentity | ContentIdentity;
  readonly dataUpdatedAt: string;
  readonly data: T;
  readonly checksum: string;
}
```

`ResolvedCore<T>` records the verified core and whether it came from immutable KV or active D1 for observability only; freshness is still derived from the captured request time, never from that source tag.

### Geography, weather, operations, and migration storage

_Requirements: DATA-GEOGRAPHY-001, DATA-WEATHER-001, DATA-OPERATIONS-001, DATA-MIGRATION-001, DATA-RELATIONSHIP-001_

D1 migrations are ordered and forward-compatible. Canonical entities and stable ASCII slugs are separate from localized content; weather rows are snapshot-versioned and keyed by city-local dates/times. Repository constraints, runtime schemas, parameterized statements, required indexes, bounded retention, and immutable publication identity are verified with migration and query-plan fixtures.

### Deterministic Travel Score kernel

_Requirements: DATA-SCORE-001, PRD-FR-001, PRD-FR-002, PRD-FR-006_

Pure domain functions normalize authority-defined factors, preserve missingness, compute confidence, apply the versioned hazard model, aggregate exact city-local windows, and emit stable reason codes. Scores and rankings are reproducible from persisted source provenance and model versions. Theme output is hidden when required inputs or confidence gates fail.

### Public read API and error envelopes

_Requirements: API-READ-001, API-ENVELOPE-001, API-VALIDATION-001, API-INTERNAL-001, API-CACHE-001_

Route handlers expose the authority-defined v1 shapes through application use cases. Validation and canonicalization occur before storage access; unknown or duplicate inputs fail with stable errors. Internal jobs prefer Cron/service bindings, and any exceptional internal route uses signed, replay-resistant, authorized requests. Final API envelopes are private and no-store.

A public route is an API adapter, not a repository. The adapter validates the complete request before invoking a use case, maps the resulting ViewModel to immutable CoreData, delegates conditional-response and per-request envelope assembly, and maps typed failures through the centrally owned API error table. Exact endpoint fields, status mappings, key serialization, and envelope shapes stay in the API authority.

```ts
interface PublicReadAdapter<Input, ViewModel, CoreData> {
  parse(request: Request): ApplicationResult<Input>;
  readonly useCase: QueryUseCase<Input, ViewModel>;
  toCore(viewModel: ViewModel): CoreData;
}

interface HttpResponseAssembler<CoreData> {
  respond(core: CoreData, context: RequestContext, request: Request): Promise<Response>;
  respondError(error: ApplicationError, context: RequestContext): Response;
}
```

Provider adapters are a separate sync-only boundary:

```ts
interface WeatherProvider {
  readonly id: string;
  fetchForecast(request: ForecastRequest): Promise<NormalizedForecast[]>;
  healthCheck(): Promise<ProviderHealth>;
}
```

### Route rendering and bounded index surface

_Requirements: ARCH-RENDER-001, SEO-INDEXABILITY-001, SEO-QUALITY-001_

A route registry maps each route class to the Architecture-owned rendering mode and invalidation behavior, while SEO independently evaluates indexability and content quality. Tests prove every route class has one rendering policy, one canonical identity, and a deterministic indexability outcome without copying either authority table here.

### Typed configuration and emergency controls

_Requirements: ARCH-FLAG-001, DEP-CONFIG-001, PRD-FR-011_

Server-side typed configuration defaults optional capabilities off and omits disabled code/data paths. Independent emergency switches cover map, ads, Affiliate slots/providers, and provider ingestion. Configuration and secrets are environment-scoped, validated before traffic, and excluded from client bundles and logs.

### Travel Radar homepage

_Requirements: PRD-FR-001, UX-HOME-001, UX-STATE-001, VISION-VALUE-001_

The homepage renders crawlable recommendation cards before the progressive map, keeps exact window dates in shareable URL state, and derives reasons from stable score codes. The view model carries source update time and stale state so degraded content remains useful without claiming live data.

```ts
interface TravelRadarViewModel {
  readonly window: Window;
  readonly includedDates: readonly string[];
  readonly cards: readonly DestinationCardViewModel[];
  readonly freshness: FreshnessViewModel;
}

interface DestinationCardViewModel {
  readonly destination: DestinationLinkViewModel;
  readonly score: ScoreViewModel;
  readonly weather: WeatherSummaryViewModel;
  readonly reasonCodes: readonly ReasonCode[];
}
```

The ViewModel contains display-ready domain meaning but no localized prose, database rows, HTTP metadata, or provider fields; i18n and API presenters project it for their respective adapters.

### Weather Explorer and accessible fallback

_Requirements: PRD-FR-002, UX-A11Y-001, UX-STATE-001, ENG-PERF-001_

MapLibre is an interactive enhancement loaded after primary content. Theme, window, marker meaning, clustering, keyboard behavior, and list fallback share one compact read model. WebGL/script failure produces an equivalent ranked-list decision path and never blocks homepage LCP.

### Country and city decision pages

_Requirements: PRD-FR-003, PRD-FR-004, DATA-GEOGRAPHY-001, DATA-WEATHER-001, UX-STATE-001_

Country and city use cases assemble canonical geography, active weather, scores, update context, local dates, links, and conditional modules into dedicated view models. Missing or low-confidence fields become explicit partial/unavailable states; optional commercial/editorial areas disappear when their owned capability or qualified data is unavailable.

```ts
interface CountryPageViewModel {
  readonly country: CountryHeaderViewModel;
  readonly cities: readonly DestinationLinkViewModel[];
  readonly rankings: readonly RankingSectionViewModel[];
  readonly relatedLinks: readonly DestinationLinkViewModel[];
}

interface CityPageViewModel {
  readonly city: CityHeaderViewModel;
  readonly weather: AsyncState<WeatherSummaryViewModel>;
  readonly score: ScoreViewModel;
  readonly forecast: AsyncState<ForecastViewModel>;
  readonly localDates: readonly string[];
  readonly relatedLinks: readonly DestinationLinkViewModel[];
  readonly commercial: readonly CommercialPlacementViewModel[];
}
```

Presenters suppress unavailable optional modules and retain explicit unavailable fields in required decision content; they do not coerce missing weather or score values to zero.

### Fuzzy search

_Requirements: PRD-FR-005, API-VALIDATION-001, UX-A11Y-001, ENG-PRIVACY-001_

Search normalizes bounded Unicode input, resolves localized names and approved aliases to canonical entities, uses parameterized indexed queries, and returns deterministic typed results. The combobox is keyboard complete. Measurement emits an approved destination key or other, never raw unmatched search text.

### Baseline destination rankings

_Requirements: PRD-FR-006, DATA-SCORE-001, SEO-QUALITY-001, SEO-INDEXABILITY-001_

Maintenance publishes only authority-approved baseline ranking routes from active score generations. Each page exposes model, time window, update time, and coverage context. Insufficient candidates, hidden scores, or unsupported themes suppress generation or indexing rather than producing thin pages.

### Provider-neutral commercial surfaces

_Requirements: PRD-FR-011, GROW-AFF-001, GROW-ADS-001, ARCH-FLAG-001, VISION-BUSINESS-001_

UI components consume provider-neutral view models, apply localized disclosure and safe link attributes, enforce parsed HTTPS host/path allowlists, and dispatch analytics best-effort without delaying navigation. Disabled, invalid, stale, unauthorized, or unfilled surfaces emit no misleading block and no layout shift.

### Five-locale experience and formatting

_Requirements: UX-I18N-001, SEO-PAGE-001, DATA-GEOGRAPHY-001_

Dictionary-backed UI, reason-code translation, locale-aware formatting, stable canonical slugs, and destination-local time are centralized in the i18n package. English is unprefixed; the four localized route prefixes preserve the same canonical entity. Missing keys fall back to English and fail development quality reporting.

### Design system, accessibility, and complete states

_Requirements: UX-IA-001, UX-DESIGN-001, UX-STATE-001, UX-A11Y-001_

Shared semantic tokens and state primitives preserve heading/keyboard order across responsive layouts, provide 44×44 targets and visible focus, and avoid color-only meaning. Every asynchronous surface implements skeleton, loading, empty, partial, stale, error, offline, retry, and ready behavior with reduced-motion support.

The shared discriminated union keeps partial, stale, unavailable, and retry semantics explicit. Retry is a serializable action descriptor rather than an embedded callback so Server Component ViewModels can cross the rendering boundary safely.

```ts
type AsyncState<T> =
  | { readonly kind: "skeleton"; readonly label: string }
  | { readonly kind: "loading"; readonly label: string; readonly previous?: T }
  | {
      readonly kind: "empty";
      readonly reason: "no-match" | "unavailable";
      readonly action?: UiAction;
    }
  | { readonly kind: "partial"; readonly data: T; readonly unavailableFields: readonly string[] }
  | { readonly kind: "stale"; readonly data: T; readonly updatedAt: string }
  | { readonly kind: "error"; readonly code: string; readonly retry?: RetryAction }
  | { readonly kind: "offline"; readonly retained?: T }
  | { readonly kind: "ready"; readonly data: T };

interface RetryAction {
  readonly action: "retry";
  readonly disabled: boolean;
  readonly attempt: number;
}
```

Localized components turn descriptors into controls, preserve focus, prevent duplicate retries, and announce transitions. A stale variant always carries its visible update time, while partial data names unavailable fields instead of inventing values.

### Metadata, structured data, sitemap, and content quality

_Requirements: SEO-PAGE-001, SEO-STRUCTURED-001, SEO-QUALITY-001, SEO-SITEMAP-001, SEO-CONTENT-001, SEO-INDEXABILITY-001_

The SEO package builds metadata and visible-content JSON-LD from route view models, evaluates deterministic positive/negative quality fixtures, and writes a canonical page registry. Sitemap partitions consume only approved canonical registry rows; content and safety claims retain qualified evidence and review status.

### Analytics and privacy boundaries

_Requirements: GROW-ANALYTICS-001, ENG-PRIVACY-001, ENG-OBSERVABILITY-001_

Analytics accepts only versioned allowlisted events and fields, discards unknown fields, and remains non-blocking. Structured logs and metrics use bounded route templates and stable codes. Sink schemas reject raw searches, IPs, precise locations, credentials, cookies, provider bodies, and reversible identifiers.

### Security and four-level bot enforcement

_Requirements: ENG-SECURITY-001, ENG-BOT-001, API-INTERNAL-001, API-VALIDATION-001_

Boundary schemas, output encoding, parameterized SQL, least-privilege CSP/headers, outbound allowlists, replay protection, and secret scanning provide layered defense. Application rate enforcement implements all four authority levels; crawler trust uses verified signals rather than User-Agent and cache cardinality is bounded.

### Performance, tests, observability, and recovery proof

_Requirements: ENG-PERF-001, ENG-TEST-001, ENG-OBSERVABILITY-001, ENG-RELIABILITY-001, AGENT-DOD-001_

Deterministic unit, integration, end-to-end, fault-injection, accessibility, security, build, and non-functional suites map to active acceptance criteria. Lighthouse and production telemetry use the authority-owned gates. Failure fixtures prove last-known-good behavior, unavailable outcomes, no user-path provider/cache writes, and actionable redacted signals.

### Cloudflare delivery, preview, and rollback

_Requirements: DEP-FREE-001, DEP-PAGES-001, DEP-CICD-001, DEP-ROLLBACK-001, VISION-COST-001_

The verified artifact targets the Pages-first Cloudflare path, uses isolated preview/production bindings, applies explicit migrations, exercises scheduled bindings and representative smoke paths, and retains the prior compatible artifact/configuration. Current free-plan evidence is reviewed before promotion; rollback preserves active and last-known-good data.

## MVP coverage appendix

| Authority requirement                                                                   | Design unit                                                                                                                                         |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AGENT-BOUNDARY-001](../../../docs/04-AI-Coding-Bible.md#AGENT-BOUNDARY-001)            | Authority-led delivery and product intent                                                                                                           |
| [AGENT-DOCS-001](../../../docs/04-AI-Coding-Bible.md#AGENT-DOCS-001)                    | Authority-led delivery and product intent                                                                                                           |
| [AGENT-DOD-001](../../../docs/04-AI-Coding-Bible.md#AGENT-DOD-001)                      | Authority-led delivery and product intent; Performance, tests, observability, and recovery proof                                                    |
| [AGENT-PROTOCOL-001](../../../docs/04-AI-Coding-Bible.md#AGENT-PROTOCOL-001)            | Authority-led delivery and product intent                                                                                                           |
| [API-CACHE-001](../../../docs/07-API-Spec.md#API-CACHE-001)                             | Authoritative identity and immutable read models; Public read API and error envelopes                                                               |
| [API-ENVELOPE-001](../../../docs/07-API-Spec.md#API-ENVELOPE-001)                       | Public read API and error envelopes                                                                                                                 |
| [API-INTERNAL-001](../../../docs/07-API-Spec.md#API-INTERNAL-001)                       | Public read API and error envelopes; Security and four-level bot enforcement                                                                        |
| [API-READ-001](../../../docs/07-API-Spec.md#API-READ-001)                               | Public read API and error envelopes                                                                                                                 |
| [API-VALIDATION-001](../../../docs/07-API-Spec.md#API-VALIDATION-001)                   | Public read API and error envelopes; Fuzzy search; Security and four-level bot enforcement                                                          |
| [ARCH-CACHE-001](../../../docs/05-System-Architecture.md#ARCH-CACHE-001)                | Authoritative identity and immutable read models                                                                                                    |
| [ARCH-DATAFLOW-001](../../../docs/05-System-Architecture.md#ARCH-DATAFLOW-001)          | Scheduled ingestion and provider isolation                                                                                                          |
| [ARCH-FLAG-001](../../../docs/05-System-Architecture.md#ARCH-FLAG-001)                  | Typed configuration and emergency controls; Provider-neutral commercial surfaces                                                                    |
| [ARCH-LAYERS-001](../../../docs/05-System-Architecture.md#ARCH-LAYERS-001)              | MVP stack and acyclic package boundaries                                                                                                            |
| [ARCH-PROVIDER-001](../../../docs/05-System-Architecture.md#ARCH-PROVIDER-001)          | Scheduled ingestion and provider isolation                                                                                                          |
| [ARCH-RECOVERY-001](../../../docs/05-System-Architecture.md#ARCH-RECOVERY-001)          | Scheduled ingestion and provider isolation; Authoritative identity and immutable read models                                                        |
| [ARCH-RENDER-001](../../../docs/05-System-Architecture.md#ARCH-RENDER-001)              | Route rendering and bounded index surface                                                                                                           |
| [ARCH-STACK-001](../../../docs/05-System-Architecture.md#ARCH-STACK-001)                | MVP stack and acyclic package boundaries                                                                                                            |
| [DATA-GEOGRAPHY-001](../../../docs/06-Database.md#DATA-GEOGRAPHY-001)                   | Geography, weather, operations, and migration storage; Country and city decision pages; Five-locale experience and formatting                       |
| [DATA-MIGRATION-001](../../../docs/06-Database.md#DATA-MIGRATION-001)                   | Geography, weather, operations, and migration storage                                                                                               |
| [DATA-OPERATIONS-001](../../../docs/06-Database.md#DATA-OPERATIONS-001)                 | Scheduled ingestion and provider isolation; Geography, weather, operations, and migration storage                                                   |
| [DATA-RELATIONSHIP-001](../../../docs/06-Database.md#DATA-RELATIONSHIP-001)             | Geography, weather, operations, and migration storage                                                                                               |
| [DATA-SCORE-001](../../../docs/06-Database.md#DATA-SCORE-001)                           | Deterministic Travel Score kernel; Baseline destination rankings                                                                                    |
| [DATA-WEATHER-001](../../../docs/06-Database.md#DATA-WEATHER-001)                       | Geography, weather, operations, and migration storage; Country and city decision pages                                                              |
| [DEP-CICD-001](../../../docs/08-Cloudflare-Deployment.md#DEP-CICD-001)                  | Cloudflare delivery, preview, and rollback                                                                                                          |
| [DEP-CONFIG-001](../../../docs/08-Cloudflare-Deployment.md#DEP-CONFIG-001)              | Typed configuration and emergency controls                                                                                                          |
| [DEP-FREE-001](../../../docs/08-Cloudflare-Deployment.md#DEP-FREE-001)                  | Cloudflare delivery, preview, and rollback                                                                                                          |
| [DEP-PAGES-001](../../../docs/08-Cloudflare-Deployment.md#DEP-PAGES-001)                | Cloudflare delivery, preview, and rollback                                                                                                          |
| [DEP-ROLLBACK-001](../../../docs/08-Cloudflare-Deployment.md#DEP-ROLLBACK-001)          | Cloudflare delivery, preview, and rollback                                                                                                          |
| [ENG-BOT-001](../../../docs/09-Engineering-Handbook.md#ENG-BOT-001)                     | Security and four-level bot enforcement                                                                                                             |
| [ENG-OBSERVABILITY-001](../../../docs/09-Engineering-Handbook.md#ENG-OBSERVABILITY-001) | Analytics and privacy boundaries; Performance, tests, observability, and recovery proof                                                             |
| [ENG-PERF-001](../../../docs/09-Engineering-Handbook.md#ENG-PERF-001)                   | Weather Explorer and accessible fallback; Performance, tests, observability, and recovery proof                                                     |
| [ENG-PRIVACY-001](../../../docs/09-Engineering-Handbook.md#ENG-PRIVACY-001)             | Fuzzy search; Analytics and privacy boundaries                                                                                                      |
| [ENG-RELIABILITY-001](../../../docs/09-Engineering-Handbook.md#ENG-RELIABILITY-001)     | Performance, tests, observability, and recovery proof                                                                                               |
| [ENG-SECURITY-001](../../../docs/09-Engineering-Handbook.md#ENG-SECURITY-001)           | Security and four-level bot enforcement                                                                                                             |
| [ENG-TEST-001](../../../docs/09-Engineering-Handbook.md#ENG-TEST-001)                   | Performance, tests, observability, and recovery proof                                                                                               |
| [ENG-TYPESCRIPT-001](../../../docs/09-Engineering-Handbook.md#ENG-TYPESCRIPT-001)       | MVP stack and acyclic package boundaries                                                                                                            |
| [GROW-ADS-001](../../../docs/10-Growth-Bible.md#GROW-ADS-001)                           | Provider-neutral commercial surfaces                                                                                                                |
| [GROW-AFF-001](../../../docs/10-Growth-Bible.md#GROW-AFF-001)                           | Provider-neutral commercial surfaces                                                                                                                |
| [GROW-ANALYTICS-001](../../../docs/10-Growth-Bible.md#GROW-ANALYTICS-001)               | Analytics and privacy boundaries                                                                                                                    |
| [PRD-FR-001](../../../docs/01-Product-PRD.md#PRD-FR-001)                                | Deterministic Travel Score kernel; Travel Radar homepage                                                                                            |
| [PRD-FR-002](../../../docs/01-Product-PRD.md#PRD-FR-002)                                | Deterministic Travel Score kernel; Weather Explorer and accessible fallback                                                                         |
| [PRD-FR-003](../../../docs/01-Product-PRD.md#PRD-FR-003)                                | Country and city decision pages                                                                                                                     |
| [PRD-FR-004](../../../docs/01-Product-PRD.md#PRD-FR-004)                                | Country and city decision pages                                                                                                                     |
| [PRD-FR-005](../../../docs/01-Product-PRD.md#PRD-FR-005)                                | Fuzzy search                                                                                                                                        |
| [PRD-FR-006](../../../docs/01-Product-PRD.md#PRD-FR-006)                                | Deterministic Travel Score kernel; Baseline destination rankings                                                                                    |
| [PRD-FR-011](../../../docs/01-Product-PRD.md#PRD-FR-011)                                | Typed configuration and emergency controls; Provider-neutral commercial surfaces                                                                    |
| [SEO-CONTENT-001](../../../docs/03-SEO-Bible.md#SEO-CONTENT-001)                        | Metadata, structured data, sitemap, and content quality                                                                                             |
| [SEO-INDEXABILITY-001](../../../docs/03-SEO-Bible.md#SEO-INDEXABILITY-001)              | Route rendering and bounded index surface; Baseline destination rankings; Metadata, structured data, sitemap, and content quality                   |
| [SEO-PAGE-001](../../../docs/03-SEO-Bible.md#SEO-PAGE-001)                              | Five-locale experience and formatting; Metadata, structured data, sitemap, and content quality                                                      |
| [SEO-QUALITY-001](../../../docs/03-SEO-Bible.md#SEO-QUALITY-001)                        | Route rendering and bounded index surface; Baseline destination rankings; Metadata, structured data, sitemap, and content quality                   |
| [SEO-SITEMAP-001](../../../docs/03-SEO-Bible.md#SEO-SITEMAP-001)                        | Metadata, structured data, sitemap, and content quality                                                                                             |
| [SEO-STRUCTURED-001](../../../docs/03-SEO-Bible.md#SEO-STRUCTURED-001)                  | Metadata, structured data, sitemap, and content quality                                                                                             |
| [UX-A11Y-001](../../../docs/02-UX-Bible.md#UX-A11Y-001)                                 | Weather Explorer and accessible fallback; Fuzzy search; Design system, accessibility, and complete states                                           |
| [UX-DESIGN-001](../../../docs/02-UX-Bible.md#UX-DESIGN-001)                             | Design system, accessibility, and complete states                                                                                                   |
| [UX-HOME-001](../../../docs/02-UX-Bible.md#UX-HOME-001)                                 | Travel Radar homepage                                                                                                                               |
| [UX-I18N-001](../../../docs/02-UX-Bible.md#UX-I18N-001)                                 | Five-locale experience and formatting                                                                                                               |
| [UX-IA-001](../../../docs/02-UX-Bible.md#UX-IA-001)                                     | Design system, accessibility, and complete states                                                                                                   |
| [UX-STATE-001](../../../docs/02-UX-Bible.md#UX-STATE-001)                               | Travel Radar homepage; Weather Explorer and accessible fallback; Country and city decision pages; Design system, accessibility, and complete states |
| [VISION-BUSINESS-001](../../../docs/00-Founder-Vision.md#VISION-BUSINESS-001)           | Provider-neutral commercial surfaces                                                                                                                |
| [VISION-COST-001](../../../docs/00-Founder-Vision.md#VISION-COST-001)                   | Cloudflare delivery, preview, and rollback                                                                                                          |
| [VISION-MARKET-001](../../../docs/00-Founder-Vision.md#VISION-MARKET-001)               | Authority-led delivery and product intent                                                                                                           |
| [VISION-METRICS-001](../../../docs/00-Founder-Vision.md#VISION-METRICS-001)             | Authority-led delivery and product intent                                                                                                           |
| [VISION-POSITION-001](../../../docs/00-Founder-Vision.md#VISION-POSITION-001)           | Authority-led delivery and product intent                                                                                                           |
| [VISION-VALUE-001](../../../docs/00-Founder-Vision.md#VISION-VALUE-001)                 | Authority-led delivery and product intent; Travel Radar homepage                                                                                    |

## Out of current scope

This section is non-normative. Future requirements remain governed by the authority documents and [Roadmap](../../../docs/11-Roadmap.md): [ARCH-FLAG-002](../../../docs/05-System-Architecture.md#ARCH-FLAG-002), [DATA-ACTIVITY-001](../../../docs/06-Database.md#DATA-ACTIVITY-001), [GROW-EXPERIMENT-001](../../../docs/10-Growth-Bible.md#GROW-EXPERIMENT-001), [GROW-PROVIDER-001](../../../docs/10-Growth-Bible.md#GROW-PROVIDER-001), [GROW-REPORT-001](../../../docs/10-Growth-Bible.md#GROW-REPORT-001), [PRD-FR-007](../../../docs/01-Product-PRD.md#PRD-FR-007), [PRD-FR-008](../../../docs/01-Product-PRD.md#PRD-FR-008), [PRD-FR-009](../../../docs/01-Product-PRD.md#PRD-FR-009), [PRD-FR-010](../../../docs/01-Product-PRD.md#PRD-FR-010), [PRD-FR-012](../../../docs/01-Product-PRD.md#PRD-FR-012), [PRD-FR-013](../../../docs/01-Product-PRD.md#PRD-FR-013), [PRD-FR-014](../../../docs/01-Product-PRD.md#PRD-FR-014), [PRD-FR-015](../../../docs/01-Product-PRD.md#PRD-FR-015), [PRD-FR-016](../../../docs/01-Product-PRD.md#PRD-FR-016), [PRD-FR-017](../../../docs/01-Product-PRD.md#PRD-FR-017), [PRD-FR-018](../../../docs/01-Product-PRD.md#PRD-FR-018), [UX-I18N-002](../../../docs/02-UX-Bible.md#UX-I18N-002). No implementation task or MVP design obligation is created by these links.
