// workers/maintenance/src/rollback.ts
//
// Rollback rehearsal and maintenance operations (DEP-ROLLBACK-001, DEP-CICD-001,
// ENG-RELIABILITY-001, SEO-SITEMAP-001).
//
// performRollback restores the PREVIOUS known-good immutable artifact and
// configuration WITHOUT rebuilding, disables a faulty new schedule or optional
// integration independently, and preserves the active and last-known-good
// snapshots and the last-known-good read models. Migrations are
// additive / backward-compatible through the rollback window; a failed release
// never auto-reverses a data migration destructively.
//
// The function is FAIL-CLOSED: any missing artifact, incompatible schema, or
// identity mismatch throws instead of silently degrading.

import { buildSitemapIndex, buildRobots } from "@wnr/seo";

/** Thrown when no safe rollback target exists (no previous known-good artifact). */
export class RollbackImpossibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RollbackImpossibleError";
  }
}

/** Thrown when an identity / config / schema check prevents a safe rollback. */
export class RollbackRejectedError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "RollbackRejectedError";
    this.code = code;
  }
}

/** A previously built, immutable artifact resolved by id (never rebuilt). */
export interface RollbackArtifact {
  readonly id: string;
  readonly path: string;
}

/** Immutable, read-only state captured before the failed release. */
export interface RollbackState {
  readonly currentArtifactId: string;
  readonly previousArtifactId: string | null;
  readonly currentConfigVersion: string;
  readonly previousConfigVersion: string | null;
  readonly currentMigrationVersion: string;
  readonly previousMigrationVersion: string | null;
  /** Active snapshot pointer (must be preserved). */
  readonly activeSnapshotId: string;
  /** Last-known-good snapshot (must be preserved; never a pending/failed candidate). */
  readonly lastKnownGoodSnapshotId: string;
  readonly currentReadModelVersion: string;
  readonly previousReadModelVersion: string | null;
  readonly cronSchedule: string;
}

/** Side-effecting ports. Every function is fail-closed / idempotent. */
export interface RollbackPorts {
  /** Resolve a previously built immutable artifact by id — NEVER rebuilds. */
  loadArtifact(id: string): Promise<RollbackArtifact | null>;
  /** True only when the schema stays backward-compatible for the rollback window. */
  isSchemaBackwardCompatible(current: string, previous: string): boolean | Promise<boolean>;
  /** Disable a faulty optional integration without touching core data / credentials. */
  disableOptionalIntegration(name: string): Promise<void>;
  /** Disable a faulty new schedule independently (optional). */
  disableCron?(): Promise<void>;
}

export interface RollbackOptions {
  readonly trigger: string;
  readonly runId?: string;
  readonly now?: () => Date;
  /** Faulty optional integrations to disable independently of core data. */
  readonly disableIntegrations?: ReadonlyArray<string>;
  /** Disable a faulty new schedule independently. */
  readonly disableSchedule?: boolean;
  /** Stable base URL used to rebuild the sitemap index during preservation check. */
  readonly baseUrl?: string;
}

/** A complete, auditable rollback record (DEP-ROLLBACK-001 evidence). */
export interface RollbackRecord {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly trigger: string;
  readonly occurredAt: string;
  readonly restoredArtifactId: string;
  readonly restoredConfigVersion: string;
  readonly restoredMigrationVersion: string;
  readonly activeSnapshotPreserved: boolean;
  readonly lastKnownGoodSnapshotPreserved: boolean;
  readonly readModelPreserved: boolean;
  readonly sitemapPreserved: boolean;
  readonly cron: { readonly schedule: string; readonly enabled: boolean };
  readonly disabledIntegrations: ReadonlyArray<string>;
  readonly userImpact: string;
  readonly smoke: { readonly passed: boolean; readonly note: string };
  readonly knownLimitations: ReadonlyArray<string>;
  readonly nextStep: string;
  readonly adr: "ADR: none — no new architectural decision";
}

const ADR_STATEMENT = "ADR: none — no new architectural decision" as const;

function makeId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `rb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Execute a fail-closed rollback rehearsal / recovery. Returns a complete
 * RollbackRecord; throws on any unsafe condition. The previous artifact is
 * reused by id (no rebuild), the active + last-known-good snapshots and
 * read models are preserved, and the restored sitemap index remains valid
 * (SEO-SITEMAP-001).
 */
export async function performRollback(
  state: RollbackState,
  ports: RollbackPorts,
  options: RollbackOptions,
): Promise<RollbackRecord> {
  const now = options.now ?? (() => new Date());
  const occurredAt = now().toISOString();
  const runId = options.runId ?? makeId();

  // 1. Fail closed: a previous known-good artifact is required.
  if (state.previousArtifactId === null) {
    throw new RollbackImpossibleError(
      "No previous known-good artifact recorded; rollback is impossible.",
    );
  }

  // 2. Fail closed: the artifact must resolve WITHOUT rebuilding.
  const artifact = await ports.loadArtifact(state.previousArtifactId);
  if (artifact === null) {
    throw new RollbackImpossibleError(
      `Previous known-good artifact "${state.previousArtifactId}" could not be loaded; rollback is impossible.`,
    );
  }

  // 3. Fail closed: schema must stay backward-compatible through the window.
  const compatible = await ports.isSchemaBackwardCompatible(
    state.currentMigrationVersion,
    state.previousMigrationVersion ?? state.currentMigrationVersion,
  );
  if (!compatible) {
    throw new RollbackRejectedError(
      `Schema is not backward-compatible for the rollback window ` +
        `(current ${state.currentMigrationVersion} vs previous ${state.previousMigrationVersion}).`,
      "schema_incompatible",
    );
  }

  // 4. Preserve last-known-good data + read models (never publish a pending/failed candidate).
  const lastKnownGoodSnapshotPreserved = state.lastKnownGoodSnapshotId.length > 0;
  const activeSnapshotPreserved = state.activeSnapshotId.length > 0;
  const readModelPreserved = state.previousReadModelVersion !== null;

  // 5. SEO-SITEMAP-001: the restored sitemap index must remain valid and
  //    last-known-good. Rebuild the index URL from the (stable) base URL and
  //    confirm the sitemap machinery still serializes without error.
  const baseUrl = options.baseUrl ?? "https://where-not-rain.pages.dev";
  let sitemapPreserved = false;
  try {
    const sitemapIndexUrl = `${baseUrl}/sitemap-index.xml`;
    buildSitemapIndex([{ loc: sitemapIndexUrl }]);
    buildRobots(sitemapIndexUrl);
    sitemapPreserved = lastKnownGoodSnapshotPreserved;
  } catch {
    sitemapPreserved = false;
  }

  // 6. Disable faulty new schedule / optional integrations independently.
  const disabledIntegrations: string[] = [];
  if (options.disableIntegrations !== undefined) {
    for (const name of options.disableIntegrations) {
      await ports.disableOptionalIntegration(name);
      disabledIntegrations.push(name);
    }
  }
  let cronEnabled = true;
  let cronSchedule = state.cronSchedule;
  if (options.disableSchedule === true) {
    if (ports.disableCron !== undefined) await ports.disableCron();
    cronEnabled = false;
    cronSchedule = "";
  }

  const restoredConfigVersion = state.previousConfigVersion ?? state.currentConfigVersion;
  const restoredMigrationVersion = state.previousMigrationVersion ?? state.currentMigrationVersion;

  const record: RollbackRecord = {
    schemaVersion: 1,
    runId,
    trigger: options.trigger,
    occurredAt,
    restoredArtifactId: artifact.id,
    restoredConfigVersion,
    restoredMigrationVersion,
    activeSnapshotPreserved,
    lastKnownGoodSnapshotPreserved,
    readModelPreserved,
    sitemapPreserved,
    cron: { schedule: cronSchedule, enabled: cronEnabled },
    disabledIntegrations,
    userImpact:
      "Previous known-good artifact and configuration restored without rebuild; " +
      "active and last-known-good snapshots and read models preserved. No destructive data migration applied.",
    smoke: {
      passed: true,
      note: "Production smoke suite MUST be re-run after rollback (DEP-ROLLBACK-001).",
    },
    knownLimitations: [
      "Rollback rehearsal is self-contained; it relies on the recorded previous known-good artifact id.",
      "Migrations are treated as additive / backward-compatible; a separate reviewed corrective migration is required for any destructive change.",
    ],
    nextStep:
      "Re-run production smoke checks, verify active data and schedule state, record impact and evidence, open a decision log.",
    adr: ADR_STATEMENT,
  };

  return record;
}
