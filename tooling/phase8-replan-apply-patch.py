from pathlib import Path

store_path = Path("workers/trip-api/src/store.ts")
store = store_path.read_text()
sig_old = '''  operation = "update",
  actorEmail: string | null = null,
): Promise<UpdateTripResult> {'''
sig_new = '''  operation = "update",
  actorEmail: string | null = null,
  activityPayload: Readonly<Record<string, unknown>> = {},
): Promise<UpdateTripResult> {'''
if sig_old not in store:
    raise SystemExit("updateTrip signature anchor changed unexpectedly")
store = store.replace(sig_old, sig_new, 1)
payload_old = 'JSON.stringify({ version: nextVersion, operation }),'
payload_new = 'JSON.stringify({ ...activityPayload, version: nextVersion, operation }),' 
if payload_old not in store:
    raise SystemExit("updateTrip activity payload anchor changed unexpectedly")
store = store.replace(payload_old, payload_new, 1)
store_path.write_text(store)

index_path = Path("workers/trip-api/src/index.ts")
text = index_path.read_text()
import_anchor = 'import { listTripRevisions, restoreTripRevision } from "./revisions";\n'
if import_anchor not in text:
    raise SystemExit("index import anchor changed unexpectedly")
text = text.replace(
    import_anchor,
    'import { validateReplanDocumentChange } from "./replan-apply";\n' + import_anchor,
    1,
)

route_helper_anchor = '''function tripIdFromPath(pathname: string): string | null {
  const match = /^\\/api\\/v1\\/trips\\/([a-zA-Z0-9_-]{8,96})$/u.exec(pathname);
  return match?.[1] ?? null;
}
'''
route_helper_new = route_helper_anchor + '''
function tripReplanApplyIdFromPath(pathname: string): string | null {
  const match = /^\\/api\\/v1\\/trips\\/([a-zA-Z0-9_-]{8,96})\\/replan\\/apply$/u.exec(pathname);
  return match?.[1] ?? null;
}
'''
if route_helper_anchor not in text:
    raise SystemExit("tripId route anchor changed unexpectedly")
text = text.replace(route_helper_anchor, route_helper_new, 1)

handle_anchor = '''  const statusTripId = tripStatusIdFromPath(url.pathname);
'''
replan_handler = '''  const replanTripId = tripReplanApplyIdFromPath(url.pathname);
  if (replanTripId !== null) {
    if (request.method !== "POST") {
      return json(request, env, { error: { code: "METHOD_NOT_ALLOWED" } }, 405);
    }
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json(request, env, { error: { code: "INVALID_BODY" } }, 400);
    }
    const object = body as Record<string, unknown>;
    const baseVersion = object.baseVersion;
    const locale = parseLocale(object.locale ?? "en");
    const trip = validateTripDocument(object.document);
    const weatherSnapshotId = object.weatherSnapshotId;
    const selectedChangeIds = object.selectedChangeIds;
    const selectedValid =
      Array.isArray(selectedChangeIds) &&
      selectedChangeIds.length <= 32 &&
      selectedChangeIds.every(
        (item): item is string =>
          typeof item === "string" && /^[a-zA-Z0-9:_-]{1,160}$/u.test(item),
      ) &&
      new Set(selectedChangeIds).size === selectedChangeIds.length;
    if (
      !Number.isInteger(baseVersion) ||
      Number(baseVersion) < 1 ||
      locale === null ||
      trip === null ||
      trip.document.version !== 2 ||
      typeof weatherSnapshotId !== "string" ||
      !/^[a-zA-Z0-9._:-]{4,160}$/u.test(weatherSnapshotId) ||
      !selectedValid
    ) {
      return json(request, env, { error: { code: "INVALID_REPLAN" } }, 400);
    }

    const current = await readTrip(env.DB, userId, replanTripId);
    if (current === null) {
      return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    if (current.accessRole === "viewer") {
      return json(request, env, { error: { code: "FORBIDDEN" } }, 403);
    }
    if (current.version !== Number(baseVersion)) {
      return json(
        request,
        env,
        { error: { code: "VERSION_CONFLICT", currentVersion: current.version } },
        409,
      );
    }

    const validation = validateReplanDocumentChange(
      current.document,
      trip.document,
      selectedChangeIds as ReadonlyArray<string>,
    );
    if (!validation.ok) {
      return json(
        request,
        env,
        { error: { code: "INVALID_REPLAN", reason: validation.code } },
        400,
      );
    }

    const result = await updateTrip(
      env.DB,
      userId,
      replanTripId,
      Number(baseVersion),
      locale,
      trip,
      new Date().toISOString(),
      "replan",
      identity.email,
      {
        weatherSnapshotId,
        selectedChangeIds: validation.changedActivityIds,
      },
    );
    if (result.kind === "missing") {
      return json(request, env, { error: { code: "NOT_FOUND" } }, 404);
    }
    if (result.kind === "forbidden") {
      return json(request, env, { error: { code: "FORBIDDEN" } }, 403);
    }
    if (result.kind === "conflict") {
      return json(
        request,
        env,
        { error: { code: "VERSION_CONFLICT", currentVersion: result.currentVersion } },
        409,
      );
    }
    return json(request, env, { data: result.trip });
  }

'''
if handle_anchor not in text:
    raise SystemExit("handleTrips status anchor changed unexpectedly")
text = text.replace(handle_anchor, replan_handler + handle_anchor, 1)

health_anchor = '''      structuredActivityRevisionDiff: true,
      weatherIntelligence: true,'''
health_new = '''      structuredActivityRevisionDiff: true,
      adaptiveReplanningApply: true,
      weatherIntelligence: true,'''
if health_anchor not in text:
    raise SystemExit("health capability anchor changed unexpectedly")
text = text.replace(health_anchor, health_new, 1)
index_path.write_text(text)
