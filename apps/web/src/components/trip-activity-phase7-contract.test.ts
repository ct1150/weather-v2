import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editor = readFileSync(new URL("./StructuredActivityEditor.tsx", import.meta.url), "utf8");
const zhWorkspace = readFileSync(new URL("./TripWorkspace.tsx", import.meta.url), "utf8");
const localizedWorkspace = readFileSync(
  new URL("./LocalizedTripWorkspace.tsx", import.meta.url),
  "utf8",
);
const activity = readFileSync(
  new URL("../trips/activity-intelligence.ts", import.meta.url),
  "utf8",
);
const poi = readFileSync(new URL("../trips/poi-catalog.ts", import.meta.url), "utf8");
const planB = readFileSync(new URL("../trips/activity-plan-b.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../trips/workspace.ts", import.meta.url), "utf8");

describe("Trip Activity Intelligence Phase 7 contract", () => {
  it("upgrades normalization to workspace v2 while retaining compatibility text", () => {
    expect(workspace).toContain("readonly version: 1 | 2");
    expect(workspace).toContain("activityItems?: ReadonlyArray<TripActivity>");
    expect(workspace).toContain("normalizeActivityItems");
    expect(workspace).toContain("activityItemsToLegacy");
    expect(activity).toContain("legacyActivityToStructured");
  });

  it("keeps the structured editor on all workspace surfaces", () => {
    expect(zhWorkspace).toContain("StructuredActivityEditor");
    expect(zhWorkspace).toContain('locale="zh-cn"');
    expect(localizedWorkspace).toContain("StructuredActivityEditor");
    expect(localizedWorkspace).toContain("locale={locale}");
    expect(editor).toContain('data-structured-activities="v2"');
  });

  it("keeps legacy text editing a deterministic v2 migration path", () => {
    expect(zhWorkspace).toContain("activityItems: []");
    expect(localizedWorkspace).toContain("activityItems: []");
  });

  it("ships curated pilot POIs with provenance and weather attributes", () => {
    for (const cityId of [
      "jp-tokyo",
      "jp-kyoto",
      "jp-osaka",
      "kr-seoul",
      "kr-jeju",
      "th-bangkok",
      "th-phuket",
    ]) {
      expect(poi).toContain(`"${cityId}"`);
    }
    expect(poi).toContain('provenance: "curated-v1"');
    expect(poi).toContain("weatherSensitivity");
    expect(poi).toContain("findWeatherFallbacks");
  });

  it("creates concrete Plan B candidates without silent replacement", () => {
    expect(planB).toContain("resolveConcretePlanB");
    expect(planB).toContain("findWeatherFallbacks");
    expect(editor).toContain('data-concrete-plan-b="true"');
    expect(editor).toContain("addFallback");
    expect(editor).not.toContain("replaceActivityAutomatically");
  });

  it("ships English, Simplified and Traditional editor language", () => {
    expect(editor).toContain('title: "Structured activities"');
    expect(editor).toContain('title: "结构化活动"');
    expect(editor).toContain('title: "結構化活動"');
  });
});
