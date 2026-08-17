import { describe, expect, it } from "vitest";

import { routeContextFingerprint } from "./route-cache";
import type { RouteAnchor, RouteWaypoint } from "./route-intelligence";

function waypoint(id: string, latitude: number, longitude: number, locked = false): RouteWaypoint {
  return { id, label: id, latitude, longitude, locked, sourceActivityId: id };
}

const hotel: RouteAnchor = {
  id: "hotel",
  label: "Hotel",
  latitude: 35.68,
  longitude: 139.76,
};

describe("route cache fingerprint", () => {
  it("is deterministic for the same route context", () => {
    const waypoints = [waypoint("a", 35.69, 139.77), waypoint("b", 35.7, 139.78)];
    const first = routeContextFingerprint(waypoints, { start: hotel, end: hotel });
    const second = routeContextFingerprint(waypoints, { start: hotel, end: hotel });

    expect(first).toBe(second);
  });

  it("changes when order, coordinates, locks or anchors change", () => {
    const base = [waypoint("a", 35.69, 139.77), waypoint("b", 35.7, 139.78)];
    const fingerprint = routeContextFingerprint(base, { start: hotel });

    expect(routeContextFingerprint([...base].reverse(), { start: hotel })).not.toBe(fingerprint);
    expect(
      routeContextFingerprint([waypoint("a", 35.691, 139.77), base[1]!], { start: hotel }),
    ).not.toBe(fingerprint);
    expect(
      routeContextFingerprint([waypoint("a", 35.69, 139.77, true), base[1]!], { start: hotel }),
    ).not.toBe(fingerprint);
    expect(routeContextFingerprint(base, { end: hotel })).not.toBe(fingerprint);
  });
});
