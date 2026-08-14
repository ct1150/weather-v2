import type { TripActivity } from "./activity-intelligence";
import type { RouteAnchor, RouteWaypoint } from "./route-intelligence";

export type TripReservationType =
  | "transport"
  | "ticket"
  | "hotel"
  | "restaurant"
  | "activity";

export interface TripReservation {
  readonly id: string;
  readonly activityId: string;
  readonly type: TripReservationType;
  readonly title: string;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly hard: boolean;
  readonly confirmationRequired: boolean;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface TripExecutionProjection {
  readonly reservations: ReadonlyArray<TripReservation>;
  readonly routeWaypoints: ReadonlyArray<RouteWaypoint>;
  readonly startAnchor: RouteAnchor | null;
  readonly endAnchor: RouteAnchor | null;
}

function reservationType(activity: TripActivity): TripReservationType {
  if (activity.category === "transport") return "transport";
  if (activity.category === "hotel") return "hotel";
  if (activity.category === "food") return "restaurant";
  if (activity.reservation === "required") return "ticket";
  return "activity";
}

export function isHardExecutionConstraint(activity: TripActivity): boolean {
  return (
    activity.category === "transport" ||
    activity.flexibility === "fixed" ||
    activity.reservation === "required"
  );
}

export function projectReservations(
  activities: ReadonlyArray<TripActivity>,
): ReadonlyArray<TripReservation> {
  return activities
    .filter(
      (activity) =>
        activity.category === "transport" ||
        activity.category === "hotel" ||
        activity.reservation !== "none" ||
        activity.flexibility === "fixed",
    )
    .map((activity) => ({
      id: `reservation-${activity.id}`,
      activityId: activity.id,
      type: reservationType(activity),
      title: activity.title,
      startTime: activity.startTime,
      endTime: activity.endTime,
      hard: isHardExecutionConstraint(activity),
      confirmationRequired: activity.reservation === "required",
      latitude: activity.latitude,
      longitude: activity.longitude,
    }));
}

function anchorFromActivity(
  activity: TripActivity,
  suffix: "start" | "end",
): RouteAnchor | null {
  if (activity.latitude === null || activity.longitude === null) return null;
  return {
    id: `${activity.id}-${suffix}`,
    label: activity.title,
    latitude: activity.latitude,
    longitude: activity.longitude,
  };
}

export function hotelAnchors(
  activities: ReadonlyArray<TripActivity>,
): { readonly startAnchor: RouteAnchor | null; readonly endAnchor: RouteAnchor | null } {
  const hotels = activities.filter(
    (activity) =>
      activity.category === "hotel" &&
      activity.latitude !== null &&
      activity.longitude !== null,
  );
  if (hotels.length === 0) return { startAnchor: null, endAnchor: null };
  const first = hotels[0]!;
  const last = hotels.at(-1)!;
  return {
    startAnchor: anchorFromActivity(first, "start"),
    endAnchor: anchorFromActivity(last, "end"),
  };
}

export function projectExecution(
  activities: ReadonlyArray<TripActivity>,
): TripExecutionProjection {
  const anchors = hotelAnchors(activities);
  return {
    reservations: projectReservations(activities),
    routeWaypoints: activities
      .filter(
        (activity) =>
          activity.category !== "hotel" &&
          activity.latitude !== null &&
          activity.longitude !== null,
      )
      .map((activity) => ({
        id: activity.id,
        label: activity.title,
        latitude: activity.latitude!,
        longitude: activity.longitude!,
        locked: isHardExecutionConstraint(activity),
        sourceActivityId: activity.id,
      })),
    startAnchor: anchors.startAnchor,
    endAnchor: anchors.endAnchor,
  };
}

export function reorderActivitiesByRoute(
  activities: ReadonlyArray<TripActivity>,
  routeWaypointIds: ReadonlyArray<string>,
): ReadonlyArray<TripActivity> {
  if (routeWaypointIds.length === 0) return activities;
  const activityById = new Map(activities.map((activity) => [activity.id, activity] as const));
  const reorderableIds = new Set(routeWaypointIds);
  const queue = routeWaypointIds
    .map((id) => activityById.get(id))
    .filter(
      (activity): activity is TripActivity =>
        activity !== undefined && !isHardExecutionConstraint(activity),
    );
  let queueIndex = 0;

  return activities.map((activity) => {
    if (!reorderableIds.has(activity.id) || isHardExecutionConstraint(activity)) return activity;
    const next = queue[queueIndex];
    queueIndex += 1;
    return next ?? activity;
  });
}
