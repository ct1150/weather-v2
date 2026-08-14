import type { RoutePlan } from "./route-intelligence";
import type { TripForecastDay, TripWorkspace } from "./workspace";

const DB_NAME = "wnr-trip-offline";
const DB_VERSION = 1;
const BUNDLE_STORE = "bundles";
const ROUTE_STORE = "routes";
const QUEUE_STORE = "mutations";

export interface OfflineWeatherBundle {
  readonly dataUpdatedAt: string;
  readonly stale: boolean;
  readonly items: ReadonlyArray<TripForecastDay>;
}

export interface OfflineTripBundle {
  readonly workspaceId: string;
  readonly workspace: TripWorkspace;
  readonly weather: OfflineWeatherBundle | null;
  readonly savedAt: string;
}

export interface OfflineRouteRecord {
  readonly key: string;
  readonly workspaceId: string;
  readonly dayId: string;
  readonly plan: RoutePlan;
  readonly savedAt: string;
}

export type OfflineMutationStatus = "pending" | "syncing" | "failed" | "conflict";

export interface OfflineMutation {
  readonly id: string;
  readonly workspaceId: string;
  readonly method: "POST" | "PATCH" | "DELETE";
  readonly url: string;
  readonly body: unknown;
  readonly baseVersion: number | null;
  readonly createdAt: string;
  readonly attempts: number;
  readonly status: OfflineMutationStatus;
  readonly lastError: string | null;
}

function indexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("INDEXED_DB_REQUEST_FAILED"));
  });
}

async function openDb(): Promise<IDBDatabase | null> {
  if (!indexedDbAvailable()) return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BUNDLE_STORE)) {
        db.createObjectStore(BUNDLE_STORE, { keyPath: "workspaceId" });
      }
      if (!db.objectStoreNames.contains(ROUTE_STORE)) {
        const routes = db.createObjectStore(ROUTE_STORE, { keyPath: "key" });
        routes.createIndex("workspaceId", "workspaceId", { unique: false });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queue = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        queue.createIndex("workspaceId", "workspaceId", { unique: false });
        queue.createIndex("status", "status", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("INDEXED_DB_OPEN_FAILED"));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (db === null) return null;
  try {
    const transaction = db.transaction(storeName, mode);
    const result = await requestValue(run(transaction.objectStore(storeName)));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("INDEXED_DB_TX_ABORTED"));
      transaction.onerror = () => reject(transaction.error ?? new Error("INDEXED_DB_TX_FAILED"));
    });
    return result;
  } finally {
    db.close();
  }
}

export async function saveOfflineTripBundle(
  workspace: TripWorkspace,
  weather: OfflineWeatherBundle | null,
): Promise<boolean> {
  try {
    const bundle: OfflineTripBundle = {
      workspaceId: workspace.id,
      workspace,
      weather,
      savedAt: new Date().toISOString(),
    };
    return (await withStore(BUNDLE_STORE, "readwrite", (store) => store.put(bundle))) !== null;
  } catch {
    return false;
  }
}

export async function loadOfflineTripBundle(workspaceId: string): Promise<OfflineTripBundle | null> {
  try {
    const value = await withStore<OfflineTripBundle | undefined>(
      BUNDLE_STORE,
      "readonly",
      (store) => store.get(workspaceId),
    );
    return value ?? null;
  } catch {
    return null;
  }
}

export async function loadMostRecentOfflineTrip(): Promise<OfflineTripBundle | null> {
  const db = await openDb();
  if (db === null) return null;
  try {
    const transaction = db.transaction(BUNDLE_STORE, "readonly");
    const values = await requestValue(
      transaction.objectStore(BUNDLE_STORE).getAll() as IDBRequest<OfflineTripBundle[]>,
    );
    return values.sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0] ?? null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function routeKey(workspaceId: string, dayId: string): string {
  return `${workspaceId}:${dayId}`;
}

export async function saveOfflineRoute(
  workspaceId: string,
  dayId: string,
  plan: RoutePlan,
): Promise<boolean> {
  try {
    const record: OfflineRouteRecord = {
      key: routeKey(workspaceId, dayId),
      workspaceId,
      dayId,
      plan,
      savedAt: new Date().toISOString(),
    };
    return (await withStore(ROUTE_STORE, "readwrite", (store) => store.put(record))) !== null;
  } catch {
    return false;
  }
}

export async function loadOfflineRoute(
  workspaceId: string,
  dayId: string,
): Promise<RoutePlan | null> {
  try {
    const value = await withStore<OfflineRouteRecord | undefined>(
      ROUTE_STORE,
      "readonly",
      (store) => store.get(routeKey(workspaceId, dayId)),
    );
    return value?.plan ?? null;
  } catch {
    return null;
  }
}

export async function enqueueOfflineMutation(
  mutation: Omit<OfflineMutation, "attempts" | "status" | "lastError">,
): Promise<boolean> {
  try {
    const record: OfflineMutation = {
      ...mutation,
      attempts: 0,
      status: "pending",
      lastError: null,
    };
    return (await withStore(QUEUE_STORE, "readwrite", (store) => store.put(record))) !== null;
  } catch {
    return false;
  }
}

export async function listOfflineMutations(workspaceId: string): Promise<ReadonlyArray<OfflineMutation>> {
  const db = await openDb();
  if (db === null) return [];
  try {
    const transaction = db.transaction(QUEUE_STORE, "readonly");
    const index = transaction.objectStore(QUEUE_STORE).index("workspaceId");
    const values = await requestValue(index.getAll(workspaceId) as IDBRequest<OfflineMutation[]>);
    return values.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export async function clearOfflineTrip(workspaceId: string): Promise<void> {
  const db = await openDb();
  if (db === null) return;
  try {
    const transaction = db.transaction([BUNDLE_STORE, ROUTE_STORE, QUEUE_STORE], "readwrite");
    transaction.objectStore(BUNDLE_STORE).delete(workspaceId);
    for (const storeName of [ROUTE_STORE, QUEUE_STORE]) {
      const store = transaction.objectStore(storeName);
      const index = store.index("workspaceId");
      const keys = await requestValue(index.getAllKeys(workspaceId));
      keys.forEach((key) => store.delete(key));
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("INDEXED_DB_TX_ABORTED"));
    });
  } catch {
    // Offline cache deletion is best-effort and must not affect the live trip.
  } finally {
    db.close();
  }
}
