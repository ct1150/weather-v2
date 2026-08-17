import { describe, expect, it, vi } from "vitest";

import {
  estimateRoutePlan,
  fetchRouteCostMatrix,
  fetchRoutedPlan,
  optimizeRouteOrder,
  routeMatrixMinutes,
  type RouteAnchor,
  type RouteWaypoint,
} from "./route-intelligence";

function waypoint(id: string, latitude: number, longitude: number, locked = false): RouteWaypoint {
  return { id, label: id, latitude, longitude, locked, sourceActivityId: id };
}

const hotel: RouteAnchor = {
  id: "hotel",
  label: "Hotel",
  latitude: 35.68,
  longitude: 139.76,
};

describe("route intelligence", () => {
  it("optimizes movable waypoints while preserving a locked waypoint position", () => {
    const input = [
      waypoint("far", 35.72, 139.82),
      waypoint("locked", 35.69, 139.77, true),
      waypoint("east", 35.7, 139.81),
      waypoint("near", 35.681, 139.761),
    ];
    const optimized = optimizeRouteOrder(input, { start: hotel, end: hotel });

    expect(optimized[1]?.id).toBe("locked");
    expect(new Set(optimized.map((item) => item.id))).toEqual(
      new Set(input.map((item) => item.id)),
    );
  });

  it("optimizes a two-stop route when a hotel anchor makes order meaningful", () => {
    const optimized = optimizeRouteOrder(
      [waypoint("far", 35.72, 139.82), waypoint("near", 35.681, 139.761)],
      { start: hotel },
    );

    expect(optimized.map((item) => item.id)).toEqual(["near", "far"]);
  });

  it("is deterministic for identical input", () => {
    const input = [
      waypoint("b", 35.7, 139.79),
      waypoint("a", 35.7, 139.79),
      waypoint("c", 35.71, 139.8),
    ];
    expect(optimizeRouteOrder(input, { start: hotel })).toEqual(
      optimizeRouteOrder(input, { start: hotel }),
    );
  });

  it("creates an estimated route with hotel bookends", () => {
    const plan = estimateRoutePlan(
      [waypoint("one", 35.69, 139.77), waypoint("two", 35.7, 139.78)],
      "driving",
      { start: hotel, end: hotel },
    );

    expect(plan.source).toBe("estimated");
    expect(plan.legs).toHaveLength(3);
    expect(plan.distanceMeters).toBeGreaterThan(0);
    expect(plan.durationSeconds).toBeGreaterThan(0);
    expect(plan.geometry.length).toBeGreaterThanOrEqual(4);
  });

  it("parses a routed OSRM plan", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "Ok",
            routes: [
              {
                distance: 3200,
                duration: 720,
                geometry: {
                  coordinates: [
                    [139.76, 35.68],
                    [139.77, 35.69],
                  ],
                },
                legs: [{ distance: 3200, duration: 720 }],
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const plan = await fetchRoutedPlan(
      [waypoint("one", 35.69, 139.77)],
      { start: hotel },
      { fetchImpl },
    );

    expect(plan.source).toBe("routed");
    expect(plan.distanceMeters).toBe(3200);
    expect(plan.durationSeconds).toBe(720);
    expect(plan.legs[0]).toMatchObject({ fromId: "hotel", toId: "one" });
  });

  it("builds a source-to-destination route cost matrix", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "Ok",
            durations: [
              [600, 1200],
              [300, 900],
            ],
            distances: [
              [5000, 10000],
              [2000, 7000],
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const matrix = await fetchRouteCostMatrix(
      [waypoint("s1", 35.68, 139.76), waypoint("s2", 35.69, 139.77)],
      [waypoint("d1", 35.7, 139.78), waypoint("d2", 35.71, 139.79)],
      { fetchImpl },
    );

    expect(routeMatrixMinutes(matrix, "s1", "d2")).toBe(20);
    expect(routeMatrixMinutes(matrix, "s2", "d1")).toBe(5);
    expect(routeMatrixMinutes(matrix, "missing", "d1")).toBeNull();
  });
});
