import type { TripActivity } from "./activity-intelligence";

/**
 * Clean-room route execution layer inspired by generic itinerary-planning behavior.
 * No TREK source is copied here. Algorithms are standard nearest-neighbor + 2-opt.
 */
export type RouteProfile = "driving" | "walking" | "cycling";

export interface RouteWaypoint {
  readonly id: string;
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly locked: boolean;
  readonly sourceActivityId: string | null;
}

export interface RouteAnchor {
  readonly id: string;
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface RouteLeg {
  readonly fromId: string;
  readonly toId: string;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly geometry: ReadonlyArray<readonly [number, number]>;
}

export interface RoutePlan {
  readonly profile: RouteProfile;
  readonly waypointIds: ReadonlyArray<string>;
  readonly legs: ReadonlyArray<RouteLeg>;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly geometry: ReadonlyArray<readonly [number, number]>;
  readonly source: "routed" | "estimated";
}

export interface RouteMatrixEntry {
  readonly fromId: string;
  readonly toId: string;
  readonly durationMinutes: number;
  readonly distanceMeters: number | null;
}

export interface RouteCostMatrix {
  readonly entries: ReadonlyArray<RouteMatrixEntry>;
}

export interface OsrmRouteOptions {
  readonly profile?: RouteProfile;
  readonly baseUrl?: string;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

const EARTH_RADIUS_M = 6_371_000;
const DEFAULT_ROUTE_BASE = "https://router.project-osrm.org/route/v1";
const DEFAULT_TABLE_BASE = "https://router.project-osrm.org/table/v1";
const MAX_ROUTED_WAYPOINTS = 12;
const MAX_TABLE_POINTS = 24;

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineMeters(
  left: RouteWaypoint | RouteAnchor,
  right: RouteWaypoint | RouteAnchor,
): number {
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimatedSpeedKph(profile: RouteProfile): number {
  if (profile === "walking") return 4.8;
  if (profile === "cycling") return 14;
  return 24;
}

function estimatedLeg(
  from: RouteWaypoint | RouteAnchor,
  to: RouteWaypoint | RouteAnchor,
  profile: RouteProfile,
): RouteLeg {
  const straight = haversineMeters(from, to);
  const roadFactor = profile === "walking" ? 1.12 : profile === "cycling" ? 1.16 : 1.25;
  const distanceMeters = Math.round(straight * roadFactor);
  const durationSeconds = Math.max(
    60,
    Math.round(distanceMeters / ((estimatedSpeedKph(profile) * 1000) / 3600)),
  );
  return {
    fromId: from.id,
    toId: to.id,
    distanceMeters,
    durationSeconds,
    geometry: [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ],
  };
}

function routeDistance(
  order: ReadonlyArray<RouteWaypoint>,
  start: RouteAnchor | null,
  end: RouteAnchor | null,
): number {
  if (order.length === 0) {
    return start !== null && end !== null ? haversineMeters(start, end) : 0;
  }
  let distance = start === null ? 0 : haversineMeters(start, order[0]!);
  for (let index = 0; index < order.length - 1; index += 1) {
    distance += haversineMeters(order[index]!, order[index + 1]!);
  }
  if (end !== null) distance += haversineMeters(order.at(-1)!, end);
  return distance;
}

function nearestNeighbor(
  candidates: ReadonlyArray<RouteWaypoint>,
  start: RouteAnchor | null,
): RouteWaypoint[] {
  if (candidates.length <= 1) return [...candidates];
  const remaining = [...candidates];
  const result: RouteWaypoint[] = [];
  let current: RouteWaypoint | RouteAnchor = start ?? remaining.shift()!;
  if (start === null) result.push(current as RouteWaypoint);

  while (remaining.length > 0) {
    remaining.sort((left, right) => {
      const distanceDelta = haversineMeters(current, left) - haversineMeters(current, right);
      return Math.abs(distanceDelta) > 0.0001 ? distanceDelta : left.id.localeCompare(right.id);
    });
    const next = remaining.shift()!;
    result.push(next);
    current = next;
  }
  return result;
}

function twoOpt(
  source: ReadonlyArray<RouteWaypoint>,
  start: RouteAnchor | null,
  end: RouteAnchor | null,
): RouteWaypoint[] {
  if (source.length < 2) return [...source];
  let best = [...source];
  let bestDistance = routeDistance(best, start, end);
  let changed = true;
  while (changed) {
    changed = false;
    for (let left = 0; left < best.length - 1; left += 1) {
      for (let right = left + 1; right < best.length; right += 1) {
        const candidate = [
          ...best.slice(0, left),
          ...best.slice(left, right + 1).reverse(),
          ...best.slice(right + 1),
        ];
        const distance = routeDistance(candidate, start, end);
        if (distance + 0.01 < bestDistance) {
          best = candidate;
          bestDistance = distance;
          changed = true;
        }
      }
    }
  }
  return best;
}

/**
 * Optimize only movable runs between locked waypoints. Locked items keep their exact positions,
 * which makes required tickets/transports safe by construction.
 */
export function optimizeRouteOrder(
  waypoints: ReadonlyArray<RouteWaypoint>,
  anchors: { readonly start?: RouteAnchor | null; readonly end?: RouteAnchor | null } = {},
): ReadonlyArray<RouteWaypoint> {
  if (waypoints.length <= 1) return [...waypoints];
  const start = anchors.start ?? null;
  const end = anchors.end ?? null;
  const output: RouteWaypoint[] = [];
  let cursor = 0;
  let previousAnchor: RouteAnchor | null = start;

  while (cursor < waypoints.length) {
    const lockedIndex = waypoints.findIndex((item, index) => index >= cursor && item.locked);
    const boundary = lockedIndex === -1 ? waypoints.length : lockedIndex;
    const run = waypoints.slice(cursor, boundary);
    const locked = lockedIndex === -1 ? null : waypoints[lockedIndex]!;
    const runEnd: RouteAnchor | null =
      locked === null
        ? end
        : {
            id: locked.id,
            label: locked.label,
            latitude: locked.latitude,
            longitude: locked.longitude,
          };
    output.push(...twoOpt(nearestNeighbor(run, previousAnchor), previousAnchor, runEnd));
    if (locked !== null) {
      output.push(locked);
      previousAnchor = {
        id: locked.id,
        label: locked.label,
        latitude: locked.latitude,
        longitude: locked.longitude,
      };
      cursor = lockedIndex + 1;
    } else {
      break;
    }
  }
  return output;
}

export function activityWaypoints(
  activities: ReadonlyArray<TripActivity>,
): ReadonlyArray<RouteWaypoint> {
  return activities
    .filter(
      (activity) =>
        activity.latitude !== null &&
        activity.longitude !== null &&
        Number.isFinite(activity.latitude) &&
        Number.isFinite(activity.longitude),
    )
    .map((activity) => ({
      id: activity.id,
      label: activity.title,
      latitude: activity.latitude!,
      longitude: activity.longitude!,
      locked:
        activity.flexibility === "fixed" ||
        activity.reservation === "required" ||
        activity.category === "transport",
      sourceActivityId: activity.id,
    }));
}

export function estimateRoutePlan(
  waypoints: ReadonlyArray<RouteWaypoint>,
  profile: RouteProfile = "driving",
  anchors: { readonly start?: RouteAnchor | null; readonly end?: RouteAnchor | null } = {},
): RoutePlan {
  const ordered = optimizeRouteOrder(waypoints, anchors);
  const nodes: Array<RouteWaypoint | RouteAnchor> = [];
  if (anchors.start) nodes.push(anchors.start);
  nodes.push(...ordered);
  if (anchors.end) nodes.push(anchors.end);
  const legs: RouteLeg[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    legs.push(estimatedLeg(nodes[index]!, nodes[index + 1]!, profile));
  }
  return {
    profile,
    waypointIds: ordered.map((waypoint) => waypoint.id),
    legs,
    distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    geometry: legs.flatMap((leg, index) => (index === 0 ? leg.geometry : leg.geometry.slice(1))),
    source: "estimated",
  };
}

interface OsrmRouteResponse {
  readonly code?: string;
  readonly routes?: ReadonlyArray<{
    readonly distance?: number;
    readonly duration?: number;
    readonly geometry?: { readonly coordinates?: ReadonlyArray<readonly [number, number]> };
    readonly legs?: ReadonlyArray<{ readonly distance?: number; readonly duration?: number }>;
  }>;
}

interface OsrmTableResponse {
  readonly code?: string;
  readonly durations?: ReadonlyArray<ReadonlyArray<number | null>>;
  readonly distances?: ReadonlyArray<ReadonlyArray<number | null>>;
}

function coord(node: RouteWaypoint | RouteAnchor): string {
  return `${node.longitude},${node.latitude}`;
}

function routeBase(baseUrl: string | undefined): string {
  return (baseUrl ?? DEFAULT_ROUTE_BASE).replace(/\/$/u, "");
}

function tableBase(baseUrl: string | undefined): string {
  if (baseUrl === undefined) return DEFAULT_TABLE_BASE;
  return baseUrl.replace(/\/route\/v1\/?$/u, "/table/v1").replace(/\/$/u, "");
}

function requestInit(signal: AbortSignal | undefined): RequestInit | undefined {
  return signal === undefined ? undefined : { signal };
}

export async function fetchRoutedPlan(
  waypoints: ReadonlyArray<RouteWaypoint>,
  anchors: { readonly start?: RouteAnchor | null; readonly end?: RouteAnchor | null } = {},
  options: OsrmRouteOptions = {},
): Promise<RoutePlan> {
  const profile = options.profile ?? "driving";
  const ordered = optimizeRouteOrder(waypoints, anchors);
  const nodes: Array<RouteWaypoint | RouteAnchor> = [];
  if (anchors.start) nodes.push(anchors.start);
  nodes.push(...ordered);
  if (anchors.end) nodes.push(anchors.end);
  if (nodes.length < 2) return estimateRoutePlan(waypoints, profile, anchors);
  if (nodes.length > MAX_ROUTED_WAYPOINTS) throw new Error("ROUTE_TOO_MANY_WAYPOINTS");

  const request = options.fetchImpl ?? fetch;
  const url = `${routeBase(options.baseUrl)}/${profile}/${nodes.map(coord).join(";")}?overview=full&geometries=geojson&steps=false`;
  const response = await request(url, requestInit(options.signal));
  if (!response.ok) throw new Error(`ROUTE_HTTP_${response.status}`);
  const payload = (await response.json()) as OsrmRouteResponse;
  const route = payload.code === "Ok" ? payload.routes?.[0] : undefined;
  if (
    route === undefined ||
    typeof route.distance !== "number" ||
    typeof route.duration !== "number" ||
    !Array.isArray(route.geometry?.coordinates)
  ) {
    throw new Error("ROUTE_INVALID_RESPONSE");
  }

  const rawLegs = route.legs ?? [];
  const legs: RouteLeg[] = nodes.slice(0, -1).map((node, index) => ({
    fromId: node.id,
    toId: nodes[index + 1]!.id,
    distanceMeters: Math.round(rawLegs[index]?.distance ?? 0),
    durationSeconds: Math.round(rawLegs[index]?.duration ?? 0),
    geometry: [],
  }));
  return {
    profile,
    waypointIds: ordered.map((waypoint) => waypoint.id),
    legs,
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
    geometry: route.geometry.coordinates,
    source: "routed",
  };
}

export async function fetchRouteCostMatrix(
  sources: ReadonlyArray<RouteWaypoint>,
  destinations: ReadonlyArray<RouteWaypoint>,
  options: OsrmRouteOptions = {},
): Promise<RouteCostMatrix> {
  const profile = options.profile ?? "driving";
  const nodes = [...sources, ...destinations];
  if (nodes.length === 0) return { entries: [] };
  if (nodes.length > MAX_TABLE_POINTS) throw new Error("ROUTE_MATRIX_TOO_MANY_POINTS");
  const sourceIndexes = sources.map((_, index) => index);
  const destinationIndexes = destinations.map((_, index) => sources.length + index);
  const params = new URLSearchParams({
    annotations: "duration,distance",
    sources: sourceIndexes.join(";"),
    destinations: destinationIndexes.join(";"),
  });
  const request = options.fetchImpl ?? fetch;
  const url = `${tableBase(options.baseUrl)}/${profile}/${nodes.map(coord).join(";")}?${params.toString()}`;
  const response = await request(url, requestInit(options.signal));
  if (!response.ok) throw new Error(`ROUTE_MATRIX_HTTP_${response.status}`);
  const payload = (await response.json()) as OsrmTableResponse;
  if (payload.code !== "Ok" || !Array.isArray(payload.durations)) {
    throw new Error("ROUTE_MATRIX_INVALID_RESPONSE");
  }
  const entries: RouteMatrixEntry[] = [];
  sources.forEach((source, sourceIndex) => {
    destinations.forEach((destination, destinationIndex) => {
      const seconds = payload.durations?.[sourceIndex]?.[destinationIndex];
      if (typeof seconds !== "number" || !Number.isFinite(seconds)) return;
      const meters = payload.distances?.[sourceIndex]?.[destinationIndex];
      entries.push({
        fromId: source.id,
        toId: destination.id,
        durationMinutes: Math.max(0, Math.round(seconds / 60)),
        distanceMeters:
          typeof meters === "number" && Number.isFinite(meters) ? Math.round(meters) : null,
      });
    });
  });
  return { entries };
}

export function routeMatrixMinutes(
  matrix: RouteCostMatrix | undefined,
  fromId: string,
  toId: string,
): number | null {
  const entry = matrix?.entries.find((item) => item.fromId === fromId && item.toId === toId);
  return entry?.durationMinutes ?? null;
}
