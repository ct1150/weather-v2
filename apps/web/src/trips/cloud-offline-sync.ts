import {
  CloudTripError,
  updateCloudTrip,
  type CloudTripMetadata,
  type CloudTripRecord,
} from "./cloud-sync";
import {
  enqueueOfflineMutation,
  readOfflineMutation,
  removeOfflineMutation,
  updateOfflineMutation,
  type OfflineMutation,
} from "./offline-store";
import { normalizeWorkspace, type TripWorkspace } from "./workspace";

const CLOUD_UPDATE_PREFIX = "cloud-update:";

interface QueuedCloudUpdateBody {
  readonly cloudTripId: string;
  readonly locale: "en" | "zh-cn" | "zh-hant";
  readonly document: TripWorkspace;
}

export type CloudOfflineFlushStatus = "empty" | "synced" | "conflict" | "failed";

export interface CloudOfflineFlushResult {
  readonly status: CloudOfflineFlushStatus;
  readonly remote: CloudTripRecord | null;
  readonly errorCode: string | null;
}

interface FlushOptions {
  readonly updater?: typeof updateCloudTrip;
}

function localLocale(locale: string): "en" | "zh-cn" | "zh-hant" {
  return locale === "zh-hant" ? "zh-hant" : locale === "en" ? "en" : "zh-cn";
}

function mutationId(cloudTripId: string): string {
  return `${CLOUD_UPDATE_PREFIX}${cloudTripId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseQueuedBody(value: unknown): QueuedCloudUpdateBody | null {
  if (!isObject(value)) return null;
  if (typeof value.cloudTripId !== "string" || value.cloudTripId.length === 0) return null;
  if (value.locale !== "en" && value.locale !== "zh-cn" && value.locale !== "zh-hant") {
    return null;
  }
  if (!isObject(value.document)) return null;
  try {
    return {
      cloudTripId: value.cloudTripId,
      locale: value.locale,
      document: normalizeWorkspace(value.document),
    };
  } catch {
    return null;
  }
}

export function shouldQueueCloudWrite(error: unknown): boolean {
  if (!(error instanceof CloudTripError)) return true;
  return error.status === 429 || error.status >= 500;
}

export async function queueCloudTripUpdate(
  metadata: CloudTripMetadata,
  workspace: TripWorkspace,
  locale: string,
): Promise<boolean> {
  const id = mutationId(metadata.cloudTripId);
  const existing = await readOfflineMutation(id);
  const baseVersion = existing?.baseVersion ?? metadata.lastSyncedVersion;
  const body: QueuedCloudUpdateBody = {
    cloudTripId: metadata.cloudTripId,
    locale: localLocale(locale),
    document: normalizeWorkspace(workspace),
  };
  return enqueueOfflineMutation({
    id,
    workspaceId: workspace.id,
    method: "PATCH",
    url: `/api/v1/trips/${encodeURIComponent(metadata.cloudTripId)}`,
    body,
    baseVersion,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });
}

function errorCode(error: unknown): string {
  if (error instanceof CloudTripError) return error.code;
  return error instanceof Error ? error.message : "OFFLINE_SYNC_FAILED";
}

async function markFailure(
  mutation: OfflineMutation,
  status: "failed" | "conflict",
  error: unknown,
): Promise<void> {
  await updateOfflineMutation(mutation.id, {
    status,
    attempts: mutation.attempts + 1,
    lastError: errorCode(error),
  });
}

export async function flushQueuedCloudTripUpdate(
  metadata: CloudTripMetadata,
  options: FlushOptions = {},
): Promise<CloudOfflineFlushResult> {
  const id = mutationId(metadata.cloudTripId);
  const mutation = await readOfflineMutation(id);
  if (mutation === null) return { status: "empty", remote: null, errorCode: null };
  if (mutation.status === "conflict") {
    return { status: "conflict", remote: null, errorCode: mutation.lastError };
  }
  const body = parseQueuedBody(mutation.body);
  if (
    body === null ||
    mutation.method !== "PATCH" ||
    mutation.baseVersion === null ||
    body.cloudTripId !== metadata.cloudTripId ||
    mutation.workspaceId !== body.document.id
  ) {
    await updateOfflineMutation(id, {
      status: "failed",
      attempts: mutation.attempts + 1,
      lastError: "OFFLINE_MUTATION_INVALID",
    });
    return { status: "failed", remote: null, errorCode: "OFFLINE_MUTATION_INVALID" };
  }

  await updateOfflineMutation(id, {
    status: "syncing",
    attempts: mutation.attempts + 1,
    lastError: null,
  });
  const updater = options.updater ?? updateCloudTrip;
  try {
    const remote = await updater(
      body.cloudTripId,
      mutation.baseVersion,
      body.document,
      body.locale,
    );
    await removeOfflineMutation(id);
    return { status: "synced", remote, errorCode: null };
  } catch (error) {
    if (error instanceof CloudTripError && (error.status === 409 || error.status === 403)) {
      await markFailure(mutation, "conflict", error);
      return { status: "conflict", remote: null, errorCode: error.code };
    }
    await markFailure(mutation, "failed", error);
    return { status: "failed", remote: null, errorCode: errorCode(error) };
  }
}

export async function discardQueuedCloudTripUpdate(cloudTripId: string): Promise<boolean> {
  return removeOfflineMutation(mutationId(cloudTripId));
}
