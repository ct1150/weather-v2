import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("./MyTripsDashboard.tsx", import.meta.url), "utf8");
const viewer = readFileSync(new URL("./SharedTripViewer.tsx", import.meta.url), "utf8");
const cloudSync = readFileSync(new URL("../trips/cloud-sync.ts", import.meta.url), "utf8");

describe("Cloud Trip share bearer transport", () => {
  it("keeps the share token in the browser fragment instead of the page query string", () => {
    expect(dashboard).toContain("#token=");
    expect(dashboard).not.toContain("?token=");
    expect(viewer).toContain("window.location.hash");
    expect(viewer).not.toContain("window.location.search");
  });

  it("sends the share token in a dedicated API header instead of an API URL", () => {
    expect(cloudSync).toContain('"x-wnr-share-token": token');
    expect(cloudSync).toContain('"/api/v1/shared-trips/current"');
    expect(cloudSync).toContain('"/api/v1/shared-trips/current/copy"');
    expect(cloudSync).not.toContain("encodeURIComponent(token)");
  });
});
