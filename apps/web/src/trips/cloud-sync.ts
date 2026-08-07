import type { TripWorkspace } from "./workspace";
import { TRIP_API_BASE } from "./auth-client";

export const TRIP_CLOUD_STORAGE_KEY = "wnr:trip-workspace:v2";

export interface CloudTripMetadata {
  readonly cloudTripId: string;
  readonly lastSyncedVersion: number;
  readonly lastSyncedAt: string;
  readonly localDocument: TripWorkspace;
}

export interface CloudTripSummary {
  readonly id: string;
  readonly title: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly status: "active" | "archived";
  readonly locale: "en" | "zh-cn" | "zh-hant";
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CloudTripRecord extends CloudTripSummary {
  readonly document: TripWorkspace;
}

export interface SharedCloudTripRecord {
  readonly title: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly locale: "en" | "zh-cn" | "zh-hant";
  readonly updatedAt: string;
  readonly document: TripWorkspace;
}

export interface CloudTripShareLink {
  readonly token: string;
  readonly tokenPrefix: string;
  readonly createdAt: string;
}

export interface TripApiHealth {
  readonly ok: boolean;
  readonly cloudTrip: boolean;
  readonly cloudSharing?: boolean;
  readonly providers: {
    readonly auth: boolean;
    readonly google: boolean;
    readonly email: boolean;
  };
}

interface ApiEnvelope<T> {
  readonly data?: T;
  readonly error?: { readonly code?: string; readonly currentVersion?: number };
}

export class CloudTripError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly currentVersion?: number,
  ) {
    super(code);
  }
}

function localLocale(locale: string): "en" | "zh-cn" | "zh-hant" {
  return locale === "zh-hant" ? "zh-hant" : locale === "en" ? "en" : "zh-cn";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${TRIP_API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || payload.data === undefined) {
    throw new CloudTripError(
      payload.error?.code ?? `HTTP_${response.status}`,
      response.status,
      payload.error?.currentVersion,
    );
  }
  return payload.data;
}

function shareHeaders(token: string): HeadersInit {
  return { "x-wnr-share-token": token };
}

export async function readTripApiHealth(): Promise<TripApiHealth> {
  const response = await fetch(`${TRIP_API_BASE}/health`, { credentials: "include" });
  if (!response.ok) throw new CloudTripError("HEALTH_UNAVAILABLE", response.status);
  return (await response.json()) as TripApiHealth;
}

export function readCloudMetadata(): CloudTripMetadata | null {
  const value = window.localStorage.getItem(TRIP_CLOUD_STORAGE_KEY);
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CloudTripMetadata>;
    return typeof parsed.cloudTripId === "string" &&
      Number.isInteger(parsed.lastSyncedVersion) &&
      typeof parsed.lastSyncedAt === "string" &&
      typeof parsed.localDocument === "object" &&
      parsed.localDocument !== null
      ? (parsed as CloudTripMetadata)
      : null;
  } catch {
    return null;
  }
}

export function writeCloudMetadata(metadata: CloudTripMetadata): void {
  window.localStorage.setItem(TRIP_CLOUD_STORAGE_KEY, JSON.stringify(metadata));
}

export function clearCloudMetadata(): void {
  window.localStorage.removeItem(TRIP_CLOUD_STORAGE_KEY);
}

export async function createCloudTrip(
  workspace: TripWorkspace,
  locale: string,
): Promise<CloudTripRecord> {
  return api<CloudTripRecord>("/api/v1/trips", {
    method: "POST",
    body: JSON.stringify({ locale: localLocale(locale), document: workspace }),
  });
}

export async function listCloudTrips(
  status: "active" | "archived" | "all" = "all",
): Promise<ReadonlyArray<CloudTripSummary>> {
  const result = await api<{ readonly items: ReadonlyArray<CloudTripSummary> }>(
    `/api/v1/trips?limit=50&status=${status}`,
  );
  return result.items;
}

export async function readCloudTrip(id: string): Promise<CloudTripRecord> {
  return api<CloudTripRecord>(`/api/v1/trips/${encodeURIComponent(id)}`);
}

export async function updateCloudTrip(
  id: string,
  baseVersion: number,
  workspace: TripWorkspace,
  locale: string,
): Promise<CloudTripRecord> {
  return api<CloudTripRecord>(`/api/v1/trips/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      baseVersion,
      locale: localLocale(locale),
      document: workspace,
    }),
  });
}

export async function updateCloudTripStatus(
  id: string,
  baseVersion: number,
  status: "active" | "archived",
): Promise<CloudTripRecord> {
  return api<CloudTripRecord>(`/api/v1/trips/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ baseVersion, status }),
  });
}

export async function deleteCloudTrip(id: string): Promise<void> {
  await api<{ readonly deleted: boolean }>(`/api/v1/trips/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function createCloudTripShare(id: string): Promise<CloudTripShareLink> {
  return api<CloudTripShareLink>(`/api/v1/trips/${encodeURIComponent(id)}/share`, {
    method: "POST",
  });
}

export async function revokeCloudTripShare(id: string): Promise<boolean> {
  const result = await api<{ readonly revoked: boolean }>(
    `/api/v1/trips/${encodeURIComponent(id)}/share`,
    { method: "DELETE" },
  );
  return result.revoked;
}

export async function readSharedCloudTrip(token: string): Promise<SharedCloudTripRecord> {
  return api<SharedCloudTripRecord>("/api/v1/shared-trips/current", {
    headers: shareHeaders(token),
  });
}

export async function copySharedCloudTrip(token: string): Promise<CloudTripRecord> {
  return api<CloudTripRecord>("/api/v1/shared-trips/current/copy", {
    method: "POST",
    headers: shareHeaders(token),
  });
}
