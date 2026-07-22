/**
 * @wnr/db — ReadModelResolver
 *
 * Authoritative-identity-first resolution of immutable internal cores for the
 * public read path. Implements the contract in docs/07-API-Spec.md (API-CACHE-001)
 * and docs/05-System-Architecture.md (ARCH-CACHE-001, ARCH-RECOVERY-001):
 *
 *  1. Read the authoritative identity from D1 first (D1-active-first).
 *  2. Fail closed unless the active fencing token equals the publication
 *     high-water mark — a possibly stale or partial identity is never served.
 *  3. Derive exactly one KV key from the D1 identity and canonical parameters.
 *  4. On a KV hit, accept the core only after the caller-supplied `verify`
 *     confirms every active identity field and schema/checksum validity.
 *  5. On a KV miss or rejection, fall back to the D1-active loader with the
 *     same validated authority. The resolver never writes KV, invokes the Cache
 *     API, enqueues a repair, or backfills a cache.
 *
 * None of the four composed ports exposes a write/repair/queue/provider/Cache
 * operation, so the read path is structurally read-only.
 */

// ---------------------------------------------------------------------------
// Canonical parameter types (shared key-part vocabulary)
// ---------------------------------------------------------------------------

/** BCP-47-ish locale tag; explicit in every key and never inferred from headers. */
export type Locale = string;

/** Decision window selector used by summary/ranking/map keys. */
export type Window = "today" | "tomorrow" | "week";

/** Measurement system selector. */
export type Unit = "metric" | "imperial";

/** Theme selector for ranking/map keys (e.g. "beach", "city"). */
export type Theme = string;

/** Region selector for ranking keys (e.g. "europe", "world"). */
export type Region = string;

/** Stable canonical city coordinates used by summary keys. */
export interface CanonicalCityKey {
  readonly countrySlug: string;
  readonly citySlug: string;
}

// ---------------------------------------------------------------------------
// Identity and authority types
// ---------------------------------------------------------------------------

/**
 * Publication identity embedded inside an immutable weather core.
 * Matches docs/07-API-Spec.md (API-CACHE-001): weather identity is exactly
 * `{ snapshotId, rankingVersion, modelVersion }` (rankingVersion null except
 * for Rankings and Map).
 */
export interface WeatherCoreIdentity {
  readonly snapshotId: string;
  readonly rankingVersion: string | null;
  readonly modelVersion: string;
}

/** Publication identity embedded inside an immutable content core (API-CACHE-001). */
export interface ContentIdentity {
  readonly contentHash: string;
  readonly contentVersion: string;
}

/** The complete active publication identity as recorded by D1 (design.md). */
export interface WeatherPublicationIdentity {
  readonly snapshotId: string;
  readonly rankingVersion: string | null;
  readonly modelVersion: string;
  readonly publishedAt: string;
  readonly fencingToken: number;
}

/** The authoritative weather publication record returned by D1. */
export interface WeatherPublicationAuthority {
  readonly active: WeatherPublicationIdentity;
  readonly publicationTokenHighWater: number;
}

/**
 * A best-effort manifest hint. It may corroborate D1 authority but can never
 * select or replace it (API-CACHE-001 step 2).
 */
export interface ManifestHint {
  readonly snapshotId: string;
  readonly modelVersion: string;
  readonly fencingToken: number;
}

// ---------------------------------------------------------------------------
// Core data and key types
// ---------------------------------------------------------------------------

/** Averification-bound, identity-stamped immutable core payload. */
export interface ImmutableCore<T> {
  readonly identity: WeatherCoreIdentity | ContentIdentity;
  readonly dataUpdatedAt: string;
  readonly data: T;
  readonly checksum: string;
}

/** Branded KV key. Only {@link CoreDataKeyCodec} may mint one, so caller-controlled
 * snapshot/ranking/model/publication identities can never enter a lookup. */
declare const CoreDataKeyBrand: unique symbol;
export type CoreDataKey = string & { readonly [CoreDataKeyBrand]: true };

function asCoreDataKey(value: string): CoreDataKey {
  return value as CoreDataKey;
}

/** Weather key-part variants fed to {@link CoreDataKeyCodec.encodeWeather}. */
export type WeatherCoreKeyParts =
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

/** Content key-part variants fed to {@link CoreDataKeyCodec.encodeContent}. */
export type ContentCoreKeyParts =
  | {
      readonly kind: "country";
      readonly countrySlug: string;
      readonly locale: Locale;
    }
  | {
      readonly kind: "articles";
      readonly cursorOrFirst: string;
      readonly locale: Locale;
      readonly cityOrAll: string;
    };

// ---------------------------------------------------------------------------
// Read-only ports composed by the resolver
// ---------------------------------------------------------------------------

/** D1-backed reader for the authoritative weather publication identity. */
export interface PublicationAuthorityReader {
  readWeatherPublicationAuthority(): Promise<WeatherPublicationAuthority>;
}

/** Reader for the KV manifest hint (corroboration only). */
export interface ManifestHintReader {
  readActiveHint(): Promise<ManifestHint | null>;
}

/** Read-only reader for worker-published immutable KV cores (no put/delete). */
export interface ImmutableCoreReader {
  get<T>(key: CoreDataKey): Promise<ImmutableCore<T> | null>;
}

/** Read-only loader of cores built from D1-active rows when KV misses/rejects. */
export interface ActiveCoreLoader<Params, T> {
  loadFromActiveD1(
    authority: WeatherPublicationAuthority,
    params: Params,
  ): Promise<ImmutableCore<T> | null>;
}

/** The four read-only ports the resolver orchestrates. */
export interface ResolverPorts<Params, T> {
  readonly publication: PublicationAuthorityReader;
  readonly manifest: ManifestHintReader;
  readonly immutableCore: ImmutableCoreReader;
  readonly activeD1: ActiveCoreLoader<Params, T>;
}

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

/** Per-request resolution inputs. The caller supplies the identity/`buildKey` and
 * the acceptance check so the resolver stays storage-agnostic. */
export interface ResolveCoreRequest<Params, T> {
  readonly params: Params;
  readonly buildKey: (active: WeatherPublicationIdentity, params: Params) => CoreDataKey;
  readonly verify: (
    core: ImmutableCore<T>,
    authority: WeatherPublicationAuthority,
    hint: ManifestHint | null,
  ) => boolean;
}

/** Source of the resolved core — observability only; freshness is request-derived. */
export type ResolvedCoreSource = "kv" | "d1";

/** A verified resolved core plus the authority/hint used to accept it. */
export interface ResolvedCore<T> {
  readonly core: ImmutableCore<T>;
  readonly source: ResolvedCoreSource;
  readonly authority: WeatherPublicationAuthority;
  readonly hint: ManifestHint | null;
}

/** The read-model resolver port. */
export interface ReadModelResolver {
  resolve<Params, T>(
    request: ResolveCoreRequest<Params, T>,
    ports: ResolverPorts<Params, T>,
  ): Promise<ResolvedCore<T> | null>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the active fencing token does not equal the publication
 * high-water mark. The resolver fails closed: a possibly stale identity must
 * never be served (ARCH-RECOVERY-001 / API-CACHE-001).
 */
export class AuthorityFencingMismatchError extends Error {
  public readonly activeFencingToken: number;
  public readonly publicationTokenHighWater: number;

  constructor(activeFencingToken: number, publicationTokenHighWater: number) {
    super(
      `Weather publication authority fencing token ${activeFencingToken} does not match ` +
        `publication high-water ${publicationTokenHighWater}; refusing to serve a possibly stale identity.`,
    );
    this.name = "AuthorityFencingMismatchError";
    this.activeFencingToken = activeFencingToken;
    this.publicationTokenHighWater = publicationTokenHighWater;
  }
}

// ---------------------------------------------------------------------------
// Key codec (canonical serialization — the only place keys are minted)
// ---------------------------------------------------------------------------

/** Owns canonical KV key serialization; exact strings match docs/07-API-Spec.md. */
export interface CoreDataKeyCodec {
  encodeWeather(identity: WeatherPublicationIdentity, parts: WeatherCoreKeyParts): CoreDataKey;
  encodeContent(identity: ContentIdentity, parts: ContentCoreKeyParts): CoreDataKey;
}

/** Shared codec instance implementing the documented KV key formats. */
export const coreDataKeyCodec: CoreDataKeyCodec = {
  encodeWeather(identity: WeatherPublicationIdentity, parts: WeatherCoreKeyParts): CoreDataKey {
    switch (parts.kind) {
      case "summary":
        return asCoreDataKey(
          "core:v1:summary:" +
            `${identity.snapshotId}:${identity.modelVersion}:` +
            `${parts.city.countrySlug}:${parts.city.citySlug}:${parts.window}:${parts.unit}:${parts.locale}`,
        );
      case "forecast":
        return asCoreDataKey(
          "core:v1:forecast:" +
            `${identity.snapshotId}:${identity.modelVersion}:${parts.cityId}:${parts.days}:${parts.unit}`,
        );
      case "ranking":
        return asCoreDataKey(
          "core:v1:rankings:" +
            `${identity.snapshotId}:${identity.rankingVersion}:${identity.modelVersion}:` +
            `${parts.theme}:${parts.window}:${parts.region}:${parts.limit}:${parts.locale}`,
        );
      case "map":
        return asCoreDataKey(
          "core:v1:map:" +
            `${identity.snapshotId}:${identity.rankingVersion}:${identity.modelVersion}:` +
            `${parts.theme}:${parts.window}:${parts.mapRegionKey}:${parts.canonicalBoundsHash}`,
        );
    }
  },

  encodeContent(identity: ContentIdentity, parts: ContentCoreKeyParts): CoreDataKey {
    switch (parts.kind) {
      case "country":
        return asCoreDataKey(
          "core:v1:country:" + `${identity.contentHash}:${identity.contentVersion}:${parts.countrySlug}:en`,
        );
      case "articles":
        return asCoreDataKey(
          "core:v1:articles:" +
            `${identity.contentHash}:${identity.contentVersion}:${parts.cursorOrFirst}:${parts.locale}:${parts.cityOrAll}`,
        );
    }
  },
};

// ---------------------------------------------------------------------------
// Reference identity matcher (caller may wrap this inside `verify`)
// ---------------------------------------------------------------------------

/**
 * Exact weather identity-field matching against the D1-active authority:
 * snapshotId, rankingVersion, and modelVersion must all match. Content cores
 * are not weather cores and return false. The fencing-token equality is enforced
 * separately by the resolver's fail-closed guard.
 */
export function matchWeatherCoreIdentity(
  core: ImmutableCore<unknown>,
  authority: WeatherPublicationAuthority,
): boolean {
  const id = core.identity;
  if (!("snapshotId" in id)) return false;
  return (
    id.snapshotId === authority.active.snapshotId &&
    id.rankingVersion === authority.active.rankingVersion &&
    id.modelVersion === authority.active.modelVersion
  );
}

// ---------------------------------------------------------------------------
// Resolver implementation
// ---------------------------------------------------------------------------

/** Create the default D1-active-first read-model resolver. */
export function createReadModelResolver(): ReadModelResolver {
  return {
    async resolve<Params, T>(
      request: ResolveCoreRequest<Params, T>,
      ports: ResolverPorts<Params, T>,
    ): Promise<ResolvedCore<T> | null> {
      // Step 1–2: read authoritative identity first and fail closed on a fencing
      // mismatch. No KV or D1 lookup happens before this guard.
      const authority = await ports.publication.readWeatherPublicationAuthority();
      if (authority.active.fencingToken !== authority.publicationTokenHighWater) {
        throw new AuthorityFencingMismatchError(
          authority.active.fencingToken,
          authority.publicationTokenHighWater,
        );
      }

      // A manifest hint may corroborate identity but never replace D1 authority.
      const hint = await ports.manifest.readActiveHint();

      // Step 3: derive exactly one key from the validated identity + canonical params.
      const key = request.buildKey(authority.active, request.params);

      // Step 4: KV hit, accepted only after the caller's verify passes.
      const kvCore = await ports.immutableCore.get<T>(key);
      if (kvCore != null && request.verify(kvCore, authority, hint)) {
        return { core: kvCore, source: "kv", authority, hint };
      }

      // Step 5: on miss or rejection, fall back to the D1-active loader. The
      // resolver performs no write, no Cache API call, no repair enqueue.
      const d1Core = await ports.activeD1.loadFromActiveD1(authority, request.params);
      if (d1Core != null && request.verify(d1Core, authority, hint)) {
        return { core: d1Core, source: "d1", authority, hint };
      }

      return null;
    },
  };
}
