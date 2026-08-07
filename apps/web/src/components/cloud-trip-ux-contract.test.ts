import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const simplified = readFileSync(new URL("./TripWorkspace.tsx", import.meta.url), "utf8");
const localized = readFileSync(new URL("./LocalizedTripWorkspace.tsx", import.meta.url), "utf8");
const controls = readFileSync(new URL("./CloudTripControls.tsx", import.meta.url), "utf8");

describe("Cloud Trip workspace UX contract", () => {
  it("keeps guest editing and adds cloud controls to all workspace implementations", () => {
    expect(simplified).toContain("<CloudTripControls");
    expect(simplified).toContain('locale="zh-cn"');
    expect(localized).toContain("<CloudTripControls");
    expect(localized).toContain("locale={locale}");
  });

  it("requires an explicit cloud-save action before creating a cloud trip", () => {
    expect(controls).toContain("saveToCloud");
    expect(controls).toContain("createCloudTrip(workspace, locale)");
    expect(controls).toContain("copy.localOnly");
    expect(controls).not.toContain("useEffect(() => createCloudTrip");
  });

  it("surfaces offline and version-conflict states without deleting the local workspace", () => {
    expect(controls).toContain('setSyncState("conflict")');
    expect(controls).toContain('setSyncState("offline")');
    expect(controls).toContain("loadLatest");
  });
});
