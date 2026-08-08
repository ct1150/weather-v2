import { describe, expect, it } from "vitest";
import {
  activityItemsToLegacy,
  legacyActivityToStructured,
  normalizeActivityItems,
  normalizeTripActivity,
  type LegacyActivityContext,
} from "./activity-intelligence";

const context: LegacyActivityContext = {
  dayId: "day-1",
  cityId: "jp-tokyo",
  dayTheme: "outdoor",
  dayFlexible: true,
  dayNotes: "",
};

describe("Trip activity v2 migration", () => {
  it("migrates legacy text deterministically", () => {
    const activity = legacyActivityToStructured("09:00 Ueno Park", 0, context);
    expect(activity).toMatchObject({
      id: "activity-day-1-1-ueno-park",
      title: "Ueno Park",
      cityId: "jp-tokyo",
      startTime: "09:00",
      environment: "outdoor",
      flexibility: "movable",
      reservation: "none",
    });
    expect(activity.weatherSensitivity).toEqual(["rain", "heat", "cold", "wind", "uv"]);
  });

  it("keeps indoor activities weather-light", () => {
    const activity = legacyActivityToStructured("14:00 Tokyo National Museum", 1, context);
    expect(activity.environment).toBe("indoor");
    expect(activity.weatherSensitivity).toEqual([]);
  });

  it("treats transport and fixed-day legacy content as fixed", () => {
    const transport = legacyActivityToStructured("17:30 Train to Kyoto", 0, context);
    expect(transport.category).toBe("transport");
    expect(transport.flexibility).toBe("fixed");
    expect(transport.reservation).toBe("required");

    const fixed = legacyActivityToStructured("10:00 Senso-ji", 0, {
      ...context,
      dayFlexible: false,
    });
    expect(fixed.flexibility).toBe("fixed");
  });

  it("prefers valid structured data over the compatibility projection", () => {
    const items = normalizeActivityItems(
      [
        {
          id: "poi-activity",
          title: "teamLab Planets",
          cityId: "jp-tokyo",
          startTime: "10:00",
          category: "attraction",
          environment: "indoor",
          weatherSensitivity: [],
          flexibility: "fixed",
          reservation: "required",
          priority: "must",
          poiId: "jp-tokyo-teamlab-planets",
          alternatives: [],
          notes: "Timed ticket",
        },
      ],
      ["10:00 old text"],
      context,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "teamLab Planets", poiId: "jp-tokyo-teamlab-planets" });
  });

  it("rejects malformed structured activity and can fall back to legacy", () => {
    expect(normalizeTripActivity({ title: "" }, 0, context)).toBeNull();
    const items = normalizeActivityItems([{ title: "" }], ["09:00 Ueno Park"], context);
    expect(items[0]?.title).toBe("Ueno Park");
  });

  it("projects structured items back to portable legacy text", () => {
    const items = [
      legacyActivityToStructured("09:00 Ueno Park", 0, context),
      legacyActivityToStructured("Tokyo Station", 1, context),
    ];
    expect(activityItemsToLegacy(items)).toEqual(["09:00 Ueno Park", "Tokyo Station"]);
  });
});
