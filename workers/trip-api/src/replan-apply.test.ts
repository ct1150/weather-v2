import { describe, expect, it } from "vitest";

import { validateReplanDocumentChange } from "./replan-apply";

function activity(id: string, title = id, startTime = "09:00") {
  return {
    id,
    title,
    cityId: "jp-tokyo",
    startTime,
    endTime: null,
    durationMinutes: 120,
    latitude: 35.68,
    longitude: 139.76,
    category: "leisure",
    environment: "outdoor",
    weatherSensitivity: ["rain", "heat", "wind"],
    flexibility: "movable",
    reservation: "none",
    priority: "preferred",
    poiId: null,
    alternatives: [],
    notes: "",
  };
}

function workspace() {
  return {
    version: 2,
    id: "trip-local",
    title: "Tokyo weather trip",
    partyProfile: "family",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:01:00.000Z",
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2026-08-10",
        cityId: "jp-tokyo",
        cityName: "Tokyo",
        countryName: "Japan",
        theme: "outdoor",
        flexible: true,
        activities: ["09:00 garden", "14:00 museum"],
        activityItems: [activity("garden", "garden"), activity("museum", "museum", "14:00")],
        notes: "hotel by 19:00",
      },
    ],
  };
}

describe("Phase 8 replan apply document guard", () => {
  it("accepts only the explicitly selected structured activity change", () => {
    const current = workspace();
    const proposed = structuredClone(current);
    proposed.updatedAt = "2026-08-09T00:02:00.000Z";
    proposed.days[0]!.activityItems[0]!.startTime = "11:00";
    proposed.days[0]!.activities[0] = "11:00 garden";

    expect(validateReplanDocumentChange(current, proposed, ["garden"])).toEqual({
      ok: true,
      changedActivityIds: ["garden"],
    });
  });

  it("rejects unrelated trip/day metadata changes", () => {
    const current = workspace();
    const changedTitle = structuredClone(current);
    changedTitle.title = "Sneaky rename";
    changedTitle.days[0]!.activityItems[0]!.startTime = "11:00";
    changedTitle.days[0]!.activities[0] = "11:00 garden";

    const changedDate = structuredClone(current);
    changedDate.days[0]!.date = "2026-08-11";
    changedDate.days[0]!.activityItems[0]!.startTime = "11:00";
    changedDate.days[0]!.activities[0] = "11:00 garden";

    expect(validateReplanDocumentChange(current, changedTitle, ["garden"])).toMatchObject({
      ok: false,
      code: "trip_metadata_changed",
    });
    expect(validateReplanDocumentChange(current, changedDate, ["garden"])).toMatchObject({
      ok: false,
      code: "day_metadata_changed",
    });
  });

  it("rejects reordered/added structured activities and legacy-only edits", () => {
    const current = workspace();
    const reordered = structuredClone(current);
    reordered.days[0]!.activityItems.reverse();
    reordered.days[0]!.activities.reverse();

    const legacyOnly = structuredClone(current);
    legacyOnly.days[0]!.activities[1] = "15:00 museum";

    expect(validateReplanDocumentChange(current, reordered, ["garden", "museum"])).toMatchObject({
      ok: false,
      code: "activity_structure_changed",
    });
    expect(validateReplanDocumentChange(current, legacyOnly, ["museum"])).toMatchObject({
      ok: false,
      code: "legacy_projection_changed",
    });
  });

  it("requires selected IDs to exactly match the actual structured changes", () => {
    const current = workspace();
    const proposed = structuredClone(current);
    proposed.days[0]!.activityItems[0]!.startTime = "11:00";
    proposed.days[0]!.activities[0] = "11:00 garden";

    expect(validateReplanDocumentChange(current, proposed, ["museum"])).toMatchObject({
      ok: false,
      code: "selected_change_mismatch",
    });
    expect(validateReplanDocumentChange(current, proposed, ["garden", "museum"])).toMatchObject({
      ok: false,
      code: "selected_change_mismatch",
    });
  });

  it("rejects no-op or non-v2 apply documents", () => {
    const current = workspace();
    expect(validateReplanDocumentChange(current, current, [])).toMatchObject({
      ok: false,
      code: "no_changes",
    });
    expect(
      validateReplanDocumentChange({ ...current, version: 1 }, current, ["garden"]),
    ).toMatchObject({
      ok: false,
      code: "workspace_v2_required",
    });
  });
});
