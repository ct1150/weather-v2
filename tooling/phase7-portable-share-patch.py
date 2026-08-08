from pathlib import Path

path = Path("apps/web/src/trips/workspace.ts")
text = path.read_text()
old = '''export function encodeWorkspaceShare(workspace: TripWorkspace): string {
  const payload = JSON.stringify(normalizeWorkspace(workspace, workspace.updatedAt));
  if (payload.length > MAX_SHARE_PAYLOAD) throw new Error("TRIP_SHARE_PAYLOAD_TOO_LARGE");
  return bytesToBase64Url(new TextEncoder().encode(payload));
}
'''
new = '''function portableShareWorkspace(workspace: TripWorkspace): TripWorkspace {
  const normalized = normalizeWorkspace(workspace, workspace.updatedAt);
  return {
    ...normalized,
    version: 1,
    days: normalized.days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date,
      cityId: day.cityId,
      cityName: day.cityName,
      countryName: day.countryName,
      theme: day.theme,
      flexible: day.flexible,
      activities: day.activities,
      notes: day.notes,
    })),
  };
}

export function encodeWorkspaceShare(workspace: TripWorkspace): string {
  const payload = JSON.stringify(portableShareWorkspace(workspace));
  if (payload.length > MAX_SHARE_PAYLOAD) throw new Error("TRIP_SHARE_PAYLOAD_TOO_LARGE");
  return bytesToBase64Url(new TextEncoder().encode(payload));
}
'''
if old not in text:
    raise SystemExit("encodeWorkspaceShare contract changed unexpectedly")
path.write_text(text.replace(old, new, 1))
