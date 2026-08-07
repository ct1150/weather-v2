import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("./MyTripsDashboard.tsx", import.meta.url), "utf8");
const sharedViewer = readFileSync(new URL("./SharedTripViewer.tsx", import.meta.url), "utf8");
const englishTrips = readFileSync(new URL("../app/trips/page.tsx", import.meta.url), "utf8");
const simplifiedTrips = readFileSync(new URL("../app/zh-cn/trips/page.tsx", import.meta.url), "utf8");
const traditionalTrips = readFileSync(new URL("../app/zh-hant/trips/page.tsx", import.meta.url), "utf8");
const englishShare = readFileSync(new URL("../app/trips/share/page.tsx", import.meta.url), "utf8");
const simplifiedShare = readFileSync(
  new URL("../app/zh-cn/trips/share/page.tsx", import.meta.url),
  "utf8",
);
const traditionalShare = readFileSync(
  new URL("../app/zh-hant/trips/share/page.tsx", import.meta.url),
  "utf8",
);

describe("Cloud Trip phase 2 UX contract", () => {
  it("puts My Trips at the top of every Trips home without removing guest entry points", () => {
    expect(englishTrips).toContain('<MyTripsDashboard locale="en"');
    expect(simplifiedTrips).toContain('<MyTripsDashboard locale="zh-cn"');
    expect(traditionalTrips).toContain('<MyTripsDashboard locale="zh-hant"');
    expect(englishTrips).toContain("Build my trip");
    expect(simplifiedTrips).toContain("建立我的行程");
    expect(traditionalTrips).toContain("建立我的行程");
  });

  it("supports multiple-trip management actions with destructive confirmation", () => {
    expect(dashboard).toContain("listCloudTrips");
    expect(dashboard).toContain("updateCloudTripStatus");
    expect(dashboard).toContain("createCloudTripShare");
    expect(dashboard).toContain("revokeCloudTripShare");
    expect(dashboard).toContain("window.confirm(copy.deleteConfirm)");
    expect(dashboard).toContain("deleteCloudTrip");
  });

  it("keeps shared pages read-only, noindex and copy-to-account based", () => {
    for (const page of [englishShare, simplifiedShare, traditionalShare]) {
      expect(page).toContain("index: false");
      expect(page).toContain("follow: false");
      expect(page).toContain("SharedTripViewer");
    }
    expect(sharedViewer).toContain("readSharedCloudTrip");
    expect(sharedViewer).toContain("copySharedCloudTrip");
    expect(sharedViewer).toContain("Viewing is public");
    expect(sharedViewer).not.toContain("updateCloudTrip(");
  });
});
