import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controls = readFileSync(new URL("./CloudTripControls.tsx", import.meta.url), "utf8");
const sync = readFileSync(new URL("../trips/cloud-offline-sync.ts", import.meta.url), "utf8");
const store = readFileSync(new URL("../trips/offline-store.ts", import.meta.url), "utf8");

describe("Cloud Trip offline replay contract", () => {
  it("coalesces offline PATCH state and replays it when connectivity returns", () => {
    expect(controls).toContain("flushQueuedCloudTripUpdate(localMetadata)");
    expect(controls).toContain('window.addEventListener("online", handleOnline)');
    expect(controls).toContain('syncState === "offline"');
    expect(controls).toContain("queueCloudTripUpdate(metadata, workspace, locale)");
    expect(sync).toContain('const CLOUD_UPDATE_PREFIX = "cloud-update:"');
    expect(sync).toContain("existing?.baseVersion ?? metadata.lastSyncedVersion");
  });

  it("does not loop autosave while saving and requires explicit conflict resolution", () => {
    expect(controls).toContain('syncState === "saving"');
    expect(controls).toContain('setSyncState("conflict")');
    expect(controls).toContain("discardQueuedCloudTripUpdate(metadata.cloudTripId)");
    expect(controls).toContain('if (syncState === "conflict") return;');
    expect(sync).toContain("error.status === 409 || error.status === 403");
  });

  it("persists mutation lifecycle state in IndexedDB", () => {
    expect(store).toContain('"pending" | "syncing" | "failed" | "conflict"');
    expect(store).toContain("readOfflineMutation");
    expect(store).toContain("updateOfflineMutation");
    expect(store).toContain("removeOfflineMutation");
  });
});
