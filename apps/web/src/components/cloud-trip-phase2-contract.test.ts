import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("./MyTripsDashboard.tsx", import.meta.url), "utf8");
const sharedViewer = readFileSync(new URL("./SharedTripViewer.tsx", import.meta.url), "utf8");
const englishTrips = readFileSync(new URL("../app/trips/page.tsx", import.meta.url), "utf8");
const simplifiedTrips = readFileSync(
  new URL("../app/zh-cn/trips/page.tsx", import.meta.url),
  "utf8",
);
const traditionalTrips = readFileSync(
  new URL("../app/zh-hant/trips/page.tsx", import.meta.url),
  "utf8",
);
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
  it("keeps My Trips and guest entry points under the shared-planning value proposition", () => {
    const tripHomes = [
      {
        source: englishTrips,
        dashboard: '<MyTripsDashboard locale="en"',
        headline: "Destination chosen?",
        discover: 'href="/discover"',
        workspace: 'href="/trips/workspace"',
        advancedImport: 'href="/trips/new"',
      },
      {
        source: simplifiedTrips,
        dashboard: '<MyTripsDashboard locale="zh-cn"',
        headline: "去哪已经确定？",
        discover: 'href="/zh-cn/discover"',
        workspace: 'href="/zh-cn/trips/workspace"',
        advancedImport: 'href="/zh-cn/trips/new"',
      },
      {
        source: traditionalTrips,
        dashboard: '<MyTripsDashboard locale="zh-hant"',
        headline: "去哪已經確定？",
        discover: 'href="/zh-hant/discover"',
        workspace: 'href="/zh-hant/trips/workspace"',
        advancedImport: 'href="/zh-hant/trips/new"',
      },
    ] as const;

    for (const page of tripHomes) {
      const heroIndex = page.source.indexOf('<section className="trip-hero">');
      const dashboardIndex = page.source.indexOf(page.dashboard);
      expect(heroIndex).toBeGreaterThan(-1);
      expect(dashboardIndex).toBeGreaterThan(heroIndex);
      expect(page.source).toContain(page.headline);
      expect(page.source).toContain(page.discover);
      expect(page.source).toContain(page.workspace);
      expect(page.source).toContain(page.advancedImport);
    }
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
