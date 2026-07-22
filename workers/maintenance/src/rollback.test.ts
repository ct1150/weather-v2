// workers/maintenance/src/rollback.test.ts
//
// Rollback rehearsal + maintenance operation tests (DEP-ROLLBACK-001,
// DEP-CICD-001, ENG-RELIABILITY-001, SEO-SITEMAP-001).
//
// These prove: the previous known-good immutable artifact is reused WITHOUT
// rebuilding; active + last-known-good snapshots and read models are preserved;
// the restored sitemap index remains valid; faulty schedules / optional
// integrations can be disabled independently; and every unsafe condition fails
// closed (no previous artifact, unloadable artifact, incompatible schema).

import { describe, it, expect } from "vitest";
import {
  performRollback,
  RollbackImpossibleError,
  RollbackRejectedError,
  type RollbackState,
  type RollbackPorts,
  type RollbackArtifact,
} from "./rollback.js";

function baseState(overrides: Partial<RollbackState> = {}): RollbackState {
  return {
    currentArtifactId: "wnr-cur",
    previousArtifactId: "wnr-prev",
    currentConfigVersion: "cfg-2",
    previousConfigVersion: "cfg-1",
    currentMigrationVersion: "0002",
    previousMigrationVersion: "0001",
    activeSnapshotId: "snap-active",
    lastKnownGoodSnapshotId: "snap-lg",
    currentReadModelVersion: "rm-2",
    previousReadModelVersion: "rm-1",
    cronSchedule: "0 * * * *",
    ...overrides,
  };
}

function basePorts(overrides: Partial<RollbackPorts> = {}): RollbackPorts {
  const ports: RollbackPorts = {
    loadArtifact: async (id: string): Promise<RollbackArtifact | null> =>
      id === "wnr-prev" ? { id, path: `/art/${id}` } : null,
    isSchemaBackwardCompatible: () => true,
    disableOptionalIntegration: async (_name: string): Promise<void> => {
      /* recorded by the test via closure if needed */
    },
    ...overrides,
  };
  return ports;
}

describe("performRollback", () => {
  it("restores previous artifact, preserves snapshots/read models/sitemap, and records the ADR", async () => {
    const rec = await performRollback(baseState(), basePorts(), { trigger: "failed_smoke" });
    expect(rec.restoredArtifactId).toBe("wnr-prev");
    expect(rec.activeSnapshotPreserved).toBe(true);
    expect(rec.lastKnownGoodSnapshotPreserved).toBe(true);
    expect(rec.readModelPreserved).toBe(true);
    expect(rec.sitemapPreserved).toBe(true);
    expect(rec.adr).toBe("ADR: none — no new architectural decision");
    expect(rec.cron.enabled).toBe(true);
    expect(rec.disabledIntegrations).toEqual([]);
    expect(rec.schemaVersion).toBe(1);
  });

  it("is fail-closed when no previous known-good artifact exists", async () => {
    await expect(
      performRollback(baseState({ previousArtifactId: null }), basePorts(), { trigger: "x" }),
    ).rejects.toBeInstanceOf(RollbackImpossibleError);
  });

  it("is fail-closed when the previous artifact cannot be loaded", async () => {
    const ports = basePorts({ loadArtifact: async () => null });
    await expect(
      performRollback(baseState(), ports, { trigger: "x" }),
    ).rejects.toBeInstanceOf(RollbackImpossibleError);
  });

  it("is fail-closed when the schema is not backward-compatible", async () => {
    const ports = basePorts({ isSchemaBackwardCompatible: () => false });
    await expect(
      performRollback(baseState(), ports, { trigger: "x" }),
    ).rejects.toBeInstanceOf(RollbackRejectedError);
  });

  it("disables a faulty optional integration independently without losing core data", async () => {
    const disabled: string[] = [];
    const ports = basePorts({
      disableOptionalIntegration: async (name: string) => {
        disabled.push(name);
      },
    });
    const rec = await performRollback(baseState(), ports, {
      trigger: "bad_affiliate",
      disableIntegrations: ["affiliate"],
    });
    expect(rec.disabledIntegrations).toEqual(["affiliate"]);
    expect(disabled).toEqual(["affiliate"]);
    expect(rec.restoredArtifactId).toBe("wnr-prev");
    expect(rec.lastKnownGoodSnapshotPreserved).toBe(true);
    expect(rec.readModelPreserved).toBe(true);
  });

  it("disables a faulty schedule independently", async () => {
    let cronDisabled = false;
    const ports = basePorts({
      disableCron: async () => {
        cronDisabled = true;
      },
    });
    const rec = await performRollback(baseState(), ports, {
      trigger: "bad_cron",
      disableSchedule: true,
    });
    expect(rec.cron.enabled).toBe(false);
    expect(rec.cron.schedule).toBe("");
    expect(cronDisabled).toBe(true);
  });

  it("reuses the immutable artifact without rebuilding (loadArtifact called with previous id)", async () => {
    const loaded: string[] = [];
    const ports = basePorts({
      loadArtifact: async (id: string) => {
        loaded.push(id);
        return id === "wnr-prev" ? { id, path: `/art/${id}` } : null;
      },
    });
    await performRollback(baseState(), ports, { trigger: "x" });
    expect(loaded).toEqual(["wnr-prev"]);
  });
});
