// @wnr/config — typed runtime configuration and emergency kill switches (ARCH-FLAG-001).
//
// The baseline control plane is build/deployment-supplied, strongly typed, and ships with
// SAFE DEFAULTS: every optional capability is OFF unless explicitly and validly enabled.
// Evaluation happens server-side before any optional code or data path is exposed. The
// baseline performs NO user segmentation, percentage rollout, live experimentation, or
// per-request remote mutation — those belong to the later-release dynamic flag platform
// (ARCH-FLAG-002), which is intentionally out of scope here.
//
// Contract (single source of truth: ARCH-FLAG-001 / design.md "Typed configuration and
// emergency controls"):
//   - map, advertising, each Affiliate slot/provider, and weather-provider ingestion are
//     independently toggled emergency switches.
//   - An absent or unknown optional control is DISABLED, never implicitly enabled.
//   - Invalid values are REJECTED (typed parse error), not silently coerced.
//   - Core cached destination reads are NEVER gated by a kill switch.

/** A single emergency switch. `enabled` is the only required field. */
export interface CapabilityFlag {
  readonly enabled: boolean;
  /** Optional human-readable reason, surfaced in audit logs (never personal data). */
  readonly reason?: string;
}

/**
 * The fully-resolved, immutable runtime configuration.
 *
 * `coreReadsEnabled` is a readonly literal `true`: core cached destination reads must
 * remain available even when every optional integration is killed.
 */
export interface RuntimeConfig {
  readonly map: CapabilityFlag;
  readonly advertising: CapabilityFlag;
  readonly affiliates: ReadonlyMap<string, CapabilityFlag>;
  readonly weatherProvider: CapabilityFlag;
  readonly coreReadsEnabled: true;
}

/** Thrown when raw configuration cannot be safely coerced into {@link RuntimeConfig}. */
export class ConfigParseError extends Error {
  /** The configuration key that failed validation. */
  readonly key: string;

  constructor(key: string, message: string) {
    super(`Invalid runtime configuration for "${key}": ${message}`);
    this.name = "ConfigParseError";
    this.key = key;
  }
}

/** A frozen, always-disabled flag used as the safe default for every capability. */
const DISABLED: CapabilityFlag = Object.freeze({ enabled: false });

/** The safe-by-default configuration: every optional capability off, core reads on. */
export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = Object.freeze({
  map: DISABLED,
  advertising: DISABLED,
  affiliates: Object.freeze(new Map<string, CapabilityFlag>()),
  weatherProvider: DISABLED,
  coreReadsEnabled: true,
});

/** Shape accepted by {@link parseRuntimeConfig}. Only known keys are read. */
export interface RawRuntimeConfig {
  map?: unknown;
  advertising?: unknown;
  affiliates?: Record<string, unknown>;
  weatherProvider?: unknown;
}

function parseFlag(key: string, raw: unknown): CapabilityFlag {
  if (raw === true) return Object.freeze({ enabled: true });
  if (raw === false) return Object.freeze({ enabled: false });
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const enabled = obj.enabled;
    if (typeof enabled !== "boolean") {
      throw new ConfigParseError(key, "expected `enabled` to be a boolean");
    }
    const reason = obj.reason;
    if (reason !== undefined && typeof reason !== "string") {
      throw new ConfigParseError(key, "optional `reason` must be a string");
    }
    return typeof reason === "string"
      ? Object.freeze({ enabled, reason })
      : Object.freeze({ enabled });
  }
  if (raw === undefined || raw === null) {
    // Absent control -> disabled (caller treats undefined as the safe default).
    return DISABLED;
  }
  throw new ConfigParseError(key, `unexpected value of type ${typeof raw}`);
}

/**
 * Parse and validate raw (build/deployment-supplied) configuration into a typed, immutable
 * {@link RuntimeConfig}.
 *
 * @param raw Build/deployment configuration. `null`/`undefined` yields the safe default.
 *   Unknown top-level keys are ignored (never enabled). Invalid values throw.
 */
export function parseRuntimeConfig(raw: unknown): RuntimeConfig {
  if (raw === null || raw === undefined) return DEFAULT_RUNTIME_CONFIG;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConfigParseError("(root)", "expected a configuration object");
  }
  const input = raw as Record<string, unknown>;

  const map = input.map === undefined ? DISABLED : parseFlag("map", input.map);
  const advertising = input.advertising === undefined ? DISABLED : parseFlag("advertising", input.advertising);
  const weatherProvider =
    input.weatherProvider === undefined ? DISABLED : parseFlag("weatherProvider", input.weatherProvider);

  const affiliates = new Map<string, CapabilityFlag>();
  if (input.affiliates !== undefined) {
    if (input.affiliates === null || typeof input.affiliates !== "object" || Array.isArray(input.affiliates)) {
      throw new ConfigParseError("affiliates", "expected a record of slot -> flag");
    }
    const record = input.affiliates as Record<string, unknown>;
    for (const [slot, flagRaw] of Object.entries(record)) {
      affiliates.set(slot, parseFlag(`affiliates.${slot}`, flagRaw));
    }
  }

  return Object.freeze({
    map,
    advertising,
    affiliates: Object.freeze(affiliates),
    weatherProvider,
    coreReadsEnabled: true,
  });
}

/** Read a single Affiliate slot's flag, or the disabled default when the slot is absent. */
export function getAffiliate(config: RuntimeConfig, slot: string): CapabilityFlag {
  return config.affiliates.get(slot) ?? DISABLED;
}

/** Convenience: whether a specific Affiliate slot is enabled. */
export function isAffiliateEnabled(config: RuntimeConfig, slot: string): boolean {
  return getAffiliate(config, slot).enabled;
}
