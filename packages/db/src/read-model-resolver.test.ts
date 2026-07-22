import { describe, it, expect } from "vitest";
import { FakeKv } from "@wnr/test-utils";
import {
  createReadModelResolver,
  coreDataKeyCodec,
  matchWeatherCoreIdentity,
  AuthorityFencingMismatchError,
  type WeatherPublicationAuthority,
  type WeatherCoreKeyParts,
  type ImmutableCore,
  type CoreDataKey,
  type ImmutableCoreReader,
  type ActiveCoreLoader,
  type ManifestHint,
  type ResolveCoreRequest,
  type ResolverPorts,
} from "./read-model-resolver.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TS = "2026-07-20T00:00:00Z";

function makeAuthority(overrides: Partial<WeatherPublicationAuthority> = {}): WeatherPublicationAuthority {
  return {
    active: {
      snapshotId: "snap-1",
      rankingVersion: null,
      modelVersion: "mv1",
      publishedAt: TS,
      fencingToken: 1,
      ...(overrides.active ?? {}),
    },
    publicationTokenHighWater: 1,
    ...overrides,
  };
}

const SUMMARY_PARAMS: WeatherCoreKeyParts = {
  kind: "summary",
  city: { countrySlug: "portugal", citySlug: "lisbon" },
  window: "week",
  locale: "en",
  unit: "metric",
};

function makeCore(authority: WeatherPublicationAuthority, data: string): ImmutableCore<string> {
  return {
    identity: {
      snapshotId: authority.active.snapshotId,
      rankingVersion: authority.active.rankingVersion,
      modelVersion: authority.active.modelVersion,
    },
    dataUpdatedAt: TS,
    data,
    checksum: "ck-" + data,
  };
}

// A reader backed by an in-memory KV that records every key it is asked for.
class KvBackedReader implements ImmutableCoreReader {
  public getCalls: string[] = [];
  constructor(private readonly kv: FakeKv) {}

  async get<T>(key: CoreDataKey): Promise<ImmutableCore<T> | null> {
    this.getCalls.push(key);
    const raw = await this.kv.get(key);
    if (raw == null) return null;
    return JSON.parse(raw) as ImmutableCore<T>;
  }
}

function buildPorts(opts: {
  authority: WeatherPublicationAuthority;
  hint?: ManifestHint | null;
  kv: FakeKv;
  d1Core?: ImmutableCore<string> | null;
}): { ports: ResolverPorts<WeatherCoreKeyParts, string>; kvReader: KvBackedReader; d1Calls: number[] } {
  const kvReader = new KvBackedReader(opts.kv);
  const d1Calls: number[] = [];
  const d1: ActiveCoreLoader<WeatherCoreKeyParts, string> = {
    async loadFromActiveD1(authority) {
      d1Calls.push(1);
      if (opts.d1Core == null) return null;
      // Echo the validated authority so the produced core identity matches.
      return {
        ...opts.d1Core,
        identity: {
          snapshotId: authority.active.snapshotId,
          rankingVersion: authority.active.rankingVersion,
          modelVersion: authority.active.modelVersion,
        },
      };
    },
  };
  const ports: ResolverPorts<WeatherCoreKeyParts, string> = {
    publication: { readWeatherPublicationAuthority: async () => opts.authority },
    manifest: { readActiveHint: async () => (opts.hint === undefined ? null : opts.hint) },
    immutableCore: kvReader,
    activeD1: d1,
  };
  return { ports, kvReader, d1Calls };
}

function buildRequest(): ResolveCoreRequest<WeatherCoreKeyParts, string> {
  return {
    params: SUMMARY_PARAMS,
    buildKey: (active, params) => coreDataKeyCodec.encodeWeather(active, params),
    verify: (core, authority) => matchWeatherCoreIdentity(core, authority),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReadModelResolver — authoritative identity + immutable cores", () => {
  it("reads the D1 authority first and derives exactly one KV key on a hit", async () => {
    const authority = makeAuthority();
    const kv = new FakeKv();
    const key = coreDataKeyCodec.encodeWeather(authority.active, SUMMARY_PARAMS);
    await kv.put(key, JSON.stringify(makeCore(authority, "summary-hit")));

    const { ports, kvReader } = buildPorts({ authority, kv });
    const resolver = createReadModelResolver();
    const result = await resolver.resolve(buildRequest(), ports);

    expect(result).not.toBeNull();
    expect(result?.source).toBe("kv");
    expect(result?.core.data).toBe("summary-hit");
    // Exactly one key is derived and looked up; D1 is not consulted on a KV hit.
    expect(kvReader.getCalls).toHaveLength(1);
    expect(kvReader.getCalls[0]).toBe(key);
    expect(kv.list().size).toBe(1); // no write occurred
  });

  it("fails closed on an active/high-water fencing mismatch and never reads KV", async () => {
    const authority = makeAuthority({
      active: { fencingToken: 2 },
      publicationTokenHighWater: 1,
    });
    const kv = new FakeKv();
    const { ports, kvReader } = buildPorts({ authority, kv });

    const resolver = createReadModelResolver();
    await expect(resolver.resolve(buildRequest(), ports)).rejects.toBeInstanceOf(
      AuthorityFencingMismatchError,
    );
    expect(kvReader.getCalls).toHaveLength(0);
  });

  it("accepts a core only when every active identity field matches exactly", async () => {
    const authority = makeAuthority();
    const kv = new FakeKv();
    // Seed a KV core whose snapshotId does NOT match the authority (rejection).
    const mismatched: ImmutableCore<string> = {
      ...makeCore(authority, "stale"),
      identity: {
        snapshotId: "snap-999",
        rankingVersion: null,
        modelVersion: "mv1",
      },
    };
    const key = coreDataKeyCodec.encodeWeather(authority.active, SUMMARY_PARAMS);
    await kv.put(key, JSON.stringify(mismatched));

    const d1Core = makeCore(authority, "from-d1");
    const { ports, d1Calls } = buildPorts({ authority, kv, d1Core });

    const resolver = createReadModelResolver();
    const result = await resolver.resolve(buildRequest(), ports);

    // KV rejected -> falls back to D1, which yields the matching core.
    expect(result).not.toBeNull();
    expect(result?.source).toBe("d1");
    expect(result?.core.data).toBe("from-d1");
    expect(d1Calls).toHaveLength(1);
  });

  it("falls back to D1 on a KV miss without writing KV", async () => {
    const authority = makeAuthority();
    const kv = new FakeKv(); // empty -> KV miss
    const d1Core = makeCore(authority, "fallback");
    const { ports } = buildPorts({ authority, kv, d1Core });

    const resolver = createReadModelResolver();
    const result = await resolver.resolve(buildRequest(), ports);

    expect(result).not.toBeNull();
    expect(result?.source).toBe("d1");
    expect(result?.core.data).toBe("fallback");
    // Resolver never populates KV; the backing store remains empty.
    expect(kv.list().size).toBe(0);
  });

  it("returns null when both KV misses and D1 has no core", async () => {
    const authority = makeAuthority();
    const kv = new FakeKv();
    const { ports } = buildPorts({ authority, kv, d1Core: null });

    const resolver = createReadModelResolver();
    const result = await resolver.resolve(buildRequest(), ports);

    expect(result).toBeNull();
  });

  it("serves when the hint disagrees but D1 authority is valid (hint never overrides)", async () => {
    const authority = makeAuthority();
    const kv = new FakeKv();
    const key = coreDataKeyCodec.encodeWeather(authority.active, SUMMARY_PARAMS);
    await kv.put(key, JSON.stringify(makeCore(authority, "hint-test")));
    // Hint carries a different fencing token — it must NOT block a valid D1 authority.
    const hint: ManifestHint = { snapshotId: "snap-1", modelVersion: "mv1", fencingToken: 42 };

    const { ports } = buildPorts({ authority, kv, hint });
    const resolver = createReadModelResolver();
    const result = await resolver.resolve(buildRequest(), ports);

    expect(result).not.toBeNull();
    expect(result?.source).toBe("kv");
    expect(result?.core.data).toBe("hint-test");
  });
});
