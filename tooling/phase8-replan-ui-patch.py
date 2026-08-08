from pathlib import Path

cloud_path = Path("apps/web/src/trips/cloud-sync.ts")
cloud = cloud_path.read_text()
health_anchor = '''  readonly revisionDiff?: boolean;
  readonly providers: {'''
health_new = '''  readonly revisionDiff?: boolean;
  readonly adaptiveReplanningApply?: boolean;
  readonly providers: {'''
if health_anchor not in cloud:
    raise SystemExit("TripApiHealth anchor changed unexpectedly")
cloud = cloud.replace(health_anchor, health_new, 1)

update_anchor = '''export async function updateCloudTrip(
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
'''
replan_helper = update_anchor + '''
export async function applyCloudTripReplan(
  id: string,
  baseVersion: number,
  workspace: TripWorkspace,
  locale: string,
  weatherSnapshotId: string,
  selectedChangeIds: ReadonlyArray<string>,
): Promise<CloudTripRecord> {
  return api<CloudTripRecord>(`/api/v1/trips/${encodeURIComponent(id)}/replan/apply`, {
    method: "POST",
    body: JSON.stringify({
      baseVersion,
      locale: localLocale(locale),
      document: workspace,
      weatherSnapshotId,
      selectedChangeIds,
    }),
  });
}
'''
if update_anchor not in cloud:
    raise SystemExit("updateCloudTrip anchor changed unexpectedly")
cloud = cloud.replace(update_anchor, replan_helper, 1)
cloud_path.write_text(cloud)

controls_path = Path("apps/web/src/components/CloudTripControls.tsx")
controls = controls_path.read_text()
import_anchor = '''  CloudTripError,
  createCloudTrip,
'''
import_new = '''  CloudTripError,
  applyCloudTripReplan,
  createCloudTrip,
'''
if import_anchor not in controls:
    raise SystemExit("CloudTripControls cloud import anchor changed unexpectedly")
controls = controls.replace(import_anchor, import_new, 1)
component_import_anchor = '''import { TripCollaborationPanel } from "./TripCollaborationPanel";
import { TripWeatherIntelligencePanel } from "./TripWeatherIntelligencePanel";
'''
component_import_new = '''import { TripCollaborationPanel } from "./TripCollaborationPanel";
import { TripReplanPanel } from "./TripReplanPanel";
import { TripWeatherIntelligencePanel } from "./TripWeatherIntelligencePanel";
'''
if component_import_anchor not in controls:
    raise SystemExit("CloudTripControls component import anchor changed unexpectedly")
controls = controls.replace(component_import_anchor, component_import_new, 1)

callback_anchor = '''  const loadLatest = useCallback(async (): Promise<void> => {
    if (metadata === null) return;
    try {
      const remote = await readCloudTrip(metadata.cloudTripId);
      persistRemote(remote);
      setSyncState("saved");
    } catch {
      setSyncState("offline");
    }
  }, [metadata, persistRemote]);
'''
callback_new = callback_anchor + '''
  const applyReplan = useCallback(
    async (
      proposedWorkspace: TripWorkspace,
      weatherSnapshotId: string,
      selectedChangeIds: ReadonlyArray<string>,
    ): Promise<void> => {
      if (
        metadata === null ||
        signedInEmail === null ||
        accessRole === null ||
        accessRole === "viewer"
      ) {
        throw new Error("REPLAN_APPLY_UNAVAILABLE");
      }
      setSyncState("saving");
      try {
        const remote = await applyCloudTripReplan(
          metadata.cloudTripId,
          metadata.lastSyncedVersion,
          proposedWorkspace,
          locale,
          weatherSnapshotId,
          selectedChangeIds,
        );
        persistRemote(remote);
        setSyncState("saved");
      } catch (error: unknown) {
        if (error instanceof CloudTripError && error.status === 409) {
          setSyncState("conflict");
        } else if (error instanceof CloudTripError && error.status === 403) {
          applyAccessRole("viewer");
          setSyncState("saved");
        } else {
          setSyncState("offline");
        }
        throw error;
      }
    },
    [accessRole, applyAccessRole, locale, metadata, persistRemote, signedInEmail],
  );
'''
if callback_anchor not in controls:
    raise SystemExit("loadLatest callback anchor changed unexpectedly")
controls = controls.replace(callback_anchor, callback_new, 1)

render_anchor = '''      {metadata !== null && signedInEmail !== null && accessRole !== null ? (
        <TripWeatherIntelligencePanel
'''
render_new = '''      <TripReplanPanel
        locale={locale}
        workspace={workspace}
        cloudReady={metadata !== null && signedInEmail !== null}
        canApply={
          metadata !== null &&
          signedInEmail !== null &&
          accessRole !== null &&
          accessRole !== "viewer"
        }
        onApply={applyReplan}
      />

      {metadata !== null && signedInEmail !== null && accessRole !== null ? (
        <TripWeatherIntelligencePanel
'''
if render_anchor not in controls:
    raise SystemExit("TripWeatherIntelligencePanel render anchor changed unexpectedly")
controls = controls.replace(render_anchor, render_new, 1)
controls_path.write_text(controls)
