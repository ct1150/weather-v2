import { describe, expect, it } from "vitest";

import type { TripActivity } from "./activity-intelligence";
import {
  hotelAnchors,
  isHardExecutionConstraint,
  isRouteSequenceLocked,
  projectExecution,
  projectReservations,
  reorderActivitiesByRoute,
} from "./trip-execution";

function activity(id: string, overrides: Partial<TripActivity> = {}): TripActivity {
  return {
    id,
    title: id,
    cityId: "jp-tokyo",
    startTime: null,
    endTime: null,
    durationMinutes: 60,
    latitude: 35.68,
    longitude: 139.76,
    category: "attraction",
    environment: "outdoor",
    weatherSensitivity: ["rain"],
    flexibility: "movable",
    reservation: "none",
    priority: "preferred",
    poiId: null,
    alternatives: [],
    notes: "",
    ...overrides,
  };
}

describe("trip execution constraints", () => {
  it("treats transport, fixed and required-reservation activities as hard constraints", () => {
    expect(isHardExecutionConstraint(activity("train", { category: "transport" }))).toBe(true);
    expect(isHardExecutionConstraint(activity("ticket", { reservation: "required" }))).toBe(true);
    expect(isHardExecutionConstraint(activity("fixed", { flexibility: "fixed" }))).toBe(true);
    expect(isHardExecutionConstraint(activity("walk"))).toBe(false);
  });

  it("sequence-locks scheduled activities without turning them into hard reservations", () => {
    const scheduled = activity("scheduled", { startTime: "14:00" });

    expect(isHardExecutionConstraint(scheduled)).toBe(false);
    expect(isRouteSequenceLocked(scheduled)).toBe(true);
    expect(projectExecution([scheduled]).routeWaypoints[0]?.locked).toBe(true);
  });

  it("projects canonical structured activities into execution reservations", () => {
    const reservations = projectReservations([
      activity("train", { category: "transport" }),
      activity("museum", { reservation: "required" }),
      activity("optional"),
    ]);

    expect(reservations.map((item) => item.activityId)).toEqual(["train", "museum"]);
    expect(reservations[0]).toMatchObject({ type: "transport", hard: true });
    expect(reservations[1]).toMatchObject({ type: "ticket", confirmationRequired: true });
  });

  it("uses hotel activities as start/end route anchors", () => {
    const first = activity("hotel-a", { category: "hotel", title: "Hotel A" });
    const last = activity("hotel-b", {
      category: "hotel",
      title: "Hotel B",
      latitude: 35.7,
      longitude: 139.8,
    });
    const anchors = hotelAnchors([first, activity("walk"), last]);

    expect(anchors.startAnchor?.label).toBe("Hotel A");
    expect(anchors.endAnchor?.label).toBe("Hotel B");
  });

  it("never moves hard constraints when persisting an optimized route", () => {
    const source = [
      activity("a"),
      activity("train", { category: "transport" }),
      activity("b"),
      activity("c"),
    ];
    const reordered = reorderActivitiesByRoute(source, ["c", "train", "b", "a"]);

    expect(reordered[1]?.id).toBe("train");
    expect(new Set(reordered.map((item) => item.id))).toEqual(
      new Set(source.map((item) => item.id)),
    );
  });

  it("keeps scheduled activities in place while untimed activities reorder", () => {
    const source = [
      activity("a"),
      activity("scheduled", { startTime: "14:00" }),
      activity("b"),
    ];
    const reordered = reorderActivitiesByRoute(source, ["b", "scheduled", "a"]);

    expect(reordered.map((item) => item.id)).toEqual(["b", "scheduled", "a"]);
    expect(reordered[1]?.startTime).toBe("14:00");
  });

  it("keeps non-geocoded activities in their original slots while route points reorder", () => {
    const source = [
      activity("a"),
      activity("note", { latitude: null, longitude: null }),
      activity("b"),
    ];
    const reordered = reorderActivitiesByRoute(source, ["b", "a"]);

    expect(reordered.map((item) => item.id)).toEqual(["b", "note", "a"]);
  });

  it("produces one execution projection for reservations, route points and anchors", () => {
    const projection = projectExecution([
      activity("hotel", { category: "hotel" }),
      activity("museum", { reservation: "required" }),
      activity("park"),
    ]);

    expect(projection.startAnchor?.label).toBe("hotel");
    expect(projection.routeWaypoints.map((item) => item.id)).toEqual(["museum", "park"]);
    expect(projection.routeWaypoints[0]?.locked).toBe(true);
    expect(projection.routeWaypoints[1]?.locked).toBe(false);
  });
});
