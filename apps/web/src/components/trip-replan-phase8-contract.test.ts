import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

describe("Phase 8 proposal review/apply UI contract", () => {
  it("keeps analysis separate from explicit apply", () => {
    const panel = source("./TripReplanPanel.tsx");
    expect(panel).toContain('data-trip-replan-review="phase8"');
    expect(panel).toContain("buildDeterministicReplan");
    expect(panel).toContain("/api/v1/trip-hourly");
    expect(panel).toContain("selectedIds");
    expect(panel).toContain("applySelectedProposal");
    expect(panel).toContain("await onApply");
    expect(panel).not.toContain("updateCloudTrip(");
  });

  it("exposes before/after risk and protected unchanged activities", () => {
    const panel = source("./TripReplanPanel.tsx");
    expect(panel).toContain('data-replan-proposal="visible"');
    expect(panel).toContain('data-replan-fixed="unchanged"');
    expect(panel).toContain("change.riskBefore.score");
    expect(panel).toContain("change.riskAfter.score");
    expect(panel).toContain("change.riskReduction");
    expect(panel).toContain("change.travelDeltaMinutes");
  });

  it("ships English, Simplified Chinese and Traditional Chinese review copy", () => {
    const panel = source("./TripReplanPanel.tsx");
    expect(panel).toContain('"zh-cn"');
    expect(panel).toContain('"zh-hant"');
    expect(panel).toContain("Apply selected changes");
    expect(panel).toContain("应用已选变更");
    expect(panel).toContain("套用已選變更");
  });

  it("routes Cloud apply through the dedicated replan endpoint", () => {
    const cloud = source("../trips/cloud-sync.ts");
    const controls = source("./CloudTripControls.tsx");
    expect(cloud).toContain("applyCloudTripReplan");
    expect(cloud).toContain("/replan/apply");
    expect(controls).toContain("TripReplanPanel");
    expect(controls).toContain("applyCloudTripReplan");
    expect(controls).toContain("persistRemote(remote)");
  });
});
