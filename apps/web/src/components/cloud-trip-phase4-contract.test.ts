import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controls = readFileSync(new URL("./CloudTripControls.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./TripCollaborationPanel.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../trips/cloud-sync.ts", import.meta.url), "utf8");

describe("Cloud Trip phase 4 UX contract", () => {
  it("keeps collaboration intelligence behind a dedicated cloud panel", () => {
    expect(controls).toContain("TripCollaborationPanel");
    expect(controls).toContain("currentVersion={metadata.lastSyncedVersion}");
    expect(panel).toContain("data-trip-collaboration-intelligence");
    expect(panel).toContain("data-trip-activity-feed");
    expect(panel).toContain("data-trip-comments");
    expect(panel).toContain("data-trip-decisions");
  });

  it("supports activity, contextual discussion, decisions and structured revision diff", () => {
    expect(panel).toContain("listCloudTripActivity");
    expect(panel).toContain("createCloudTripComment");
    expect(panel).toContain("createCloudTripDecision");
    expect(panel).toContain("updateCloudTripDecisionStatus");
    expect(panel).toContain("readCloudTripRevisionDiff");
    expect(panel).toContain("data-revision-diff");
    expect(client).toContain("/activity?limit=50");
    expect(client).toContain("/comments");
    expect(client).toContain("/decisions");
    expect(client).toContain("/diff");
  });

  it("keeps Viewer read only and destructive moderation owner-only", () => {
    expect(panel).toContain('const writable = accessRole !== "viewer"');
    expect(panel).toContain('const owner = accessRole === "owner"');
    expect(panel).toContain("if (!writable");
    expect(panel).toContain("if (!owner");
  });

  it("ships English, Simplified Chinese and Traditional Chinese collaboration language", () => {
    expect(panel).toContain('open: "Collaboration"');
    expect(panel).toContain('open: "协作"');
    expect(panel).toContain('open: "協作"');
    expect(panel).toContain('decisions: "Decisions"');
    expect(panel).toContain('decisions: "决定"');
  });

  it("advertises phase 4 capability flags through the cloud client", () => {
    expect(client).toContain("collaborationActivity?: boolean");
    expect(client).toContain("tripComments?: boolean");
    expect(client).toContain("tripDecisions?: boolean");
    expect(client).toContain("revisionDiff?: boolean");
  });
});
