// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCloudMetadata,
  readCloudMetadata,
  TRIP_CLOUD_STORAGE_KEY,
  writeCloudMetadata,
} from "./cloud-sync";
import { createBlankWorkspace } from "./workspace";

describe("cloud trip metadata", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips cloud identity without replacing guest storage", () => {
    const workspace = createBlankWorkspace({
      id: "local-1",
      title: "Cloud candidate",
      now: "2026-08-07T00:00:00.000Z",
    });
    writeCloudMetadata({
      cloudTripId: "trip_abc12345",
      lastSyncedVersion: 2,
      lastSyncedAt: "2026-08-07T01:00:00.000Z",
      localDocument: workspace,
    });

    expect(readCloudMetadata()).toMatchObject({
      cloudTripId: "trip_abc12345",
      lastSyncedVersion: 2,
    });
    expect(window.localStorage.getItem(TRIP_CLOUD_STORAGE_KEY)).toContain("Cloud candidate");
  });

  it("fails closed on malformed metadata", () => {
    window.localStorage.setItem(TRIP_CLOUD_STORAGE_KEY, "{bad");
    expect(readCloudMetadata()).toBeNull();
    clearCloudMetadata();
    expect(readCloudMetadata()).toBeNull();
  });
});
