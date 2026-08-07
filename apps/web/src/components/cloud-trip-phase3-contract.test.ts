import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("./MyTripsDashboard.tsx", import.meta.url), "utf8");
const manager = readFileSync(new URL("./TripCollaboratorManager.tsx", import.meta.url), "utf8");
const inviteViewer = readFileSync(new URL("./TripInviteViewer.tsx", import.meta.url), "utf8");
const cloudControls = readFileSync(new URL("./CloudTripControls.tsx", import.meta.url), "utf8");
const cloudClient = readFileSync(new URL("../trips/cloud-sync.ts", import.meta.url), "utf8");
const englishInvite = readFileSync(new URL("../app/trips/invite/page.tsx", import.meta.url), "utf8");
const simplifiedInvite = readFileSync(
  new URL("../app/zh-cn/trips/invite/page.tsx", import.meta.url),
  "utf8",
);
const traditionalInvite = readFileSync(
  new URL("../app/zh-hant/trips/invite/page.tsx", import.meta.url),
  "utf8",
);

describe("Cloud Trip phase 3 UX contract", () => {
  it("surfaces collaboration roles and keeps owner controls owner-only", () => {
    expect(dashboard).toContain("trip.accessRole");
    expect(dashboard).toContain("data-trip-access-role");
    expect(dashboard).toContain("const isOwner = trip.accessRole === \"owner\"");
    expect(dashboard).toContain("TripCollaboratorManager");
  });

  it("supports owner invite, role-change, remove and revoke flows", () => {
    expect(manager).toContain("createCloudTripInvite");
    expect(manager).toContain("updateCloudTripMemberRole");
    expect(manager).toContain("removeCloudTripMember");
    expect(manager).toContain("revokeCloudTripInvite");
    expect(manager).toContain("#token=");
  });

  it("keeps invite bearer tokens in fragment plus header transport", () => {
    expect(inviteViewer).toContain('window.location.hash.replace(/^#/u, "")');
    expect(inviteViewer).toContain("sessionStorage");
    expect(cloudClient).toContain('"x-wnr-invite-token"');
    expect(cloudClient).toContain('"/api/v1/trip-invites/current"');
    expect(cloudClient).not.toContain("/api/v1/trip-invites/${");
  });

  it("makes all localized invite pages private to search engines", () => {
    for (const page of [englishInvite, simplifiedInvite, traditionalInvite]) {
      expect(page).toContain("TripInviteViewer");
      expect(page).toContain("index: false");
      expect(page).toContain("follow: false");
    }
  });

  it("makes cloud sync role-aware and exposes append-only revision restore", () => {
    expect(cloudControls).toContain('accessRole === "viewer"');
    expect(cloudControls).toContain("listCloudTripRevisions");
    expect(cloudControls).toContain("restoreCloudTripRevision");
    expect(cloudControls).toContain("data-trip-revisions");
    expect(cloudClient).toContain("accessRole: TripAccessRole");
  });
});
