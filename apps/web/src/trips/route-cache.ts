import type { RouteAnchor, RouteWaypoint } from "./route-intelligence";

function coordinate(value: number): string {
  return value.toFixed(5);
}

function anchorValue(anchor: RouteAnchor | null | undefined): string {
  if (anchor == null) return "-";
  return `${anchor.id}:${coordinate(anchor.latitude)}:${coordinate(anchor.longitude)}`;
}

export function routeContextFingerprint(
  waypoints: ReadonlyArray<RouteWaypoint>,
  anchors: { readonly start?: RouteAnchor | null; readonly end?: RouteAnchor | null } = {},
): string {
  const waypointValue = waypoints
    .map(
      (item) =>
        `${item.id}:${coordinate(item.latitude)}:${coordinate(item.longitude)}:${item.locked ? "1" : "0"}`,
    )
    .join("|");
  return `start=${anchorValue(anchors.start)};waypoints=${waypointValue};end=${anchorValue(anchors.end)}`;
}
