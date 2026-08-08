from pathlib import Path

path = Path("apps/web/src/trips/workspace.ts")
text = path.read_text()

old_template = '''    days: copy.days.map((day, index) => ({
      ...day,
      id: `day-${index + 1}`,
      dayNumber: index + 1,
      date: addDays(startDate, index),
    })),
'''
new_template = '''    days: copy.days.map((day, index) => {
      const id = `day-${index + 1}`;
      const activityItems = normalizeActivityItems(undefined, day.activities, {
        dayId: id,
        cityId: day.cityId,
        dayTheme: day.theme,
        dayFlexible: day.flexible,
        dayNotes: day.notes,
      });
      return {
        ...day,
        id,
        dayNumber: index + 1,
        date: addDays(startDate, index),
        activities: activityItemsToLegacy(activityItems),
        activityItems,
      };
    }),
'''
if old_template not in text:
    raise SystemExit("template creator contract changed unexpectedly")
text = text.replace(old_template, new_template, 1)

old_parsed = '''  const days = parsed.days.slice(0, MAX_DAYS).map((day, index) => ({
    id: `day-${day.dayNumber}`,
    dayNumber: index + 1,
    date: parseHeadingDate(day.heading, year) ?? addDays(fallbackDate, index),
    cityId: "",
    cityName: "",
    countryName: "",
    theme: "city" as const,
    flexible: true,
    activities: day.scheduleRows
      .slice(0, MAX_ACTIVITIES_PER_DAY)
      .map((row) => `${row.time} ${row.activity}`.trim()),
    notes: "",
  }));
'''
new_parsed = '''  const days = parsed.days.slice(0, MAX_DAYS).map((day, index) => {
    const id = `day-${day.dayNumber}`;
    const activities = day.scheduleRows
      .slice(0, MAX_ACTIVITIES_PER_DAY)
      .map((row) => `${row.time} ${row.activity}`.trim());
    const activityItems = normalizeActivityItems(undefined, activities, {
      dayId: id,
      cityId: "",
      dayTheme: "city",
      dayFlexible: true,
      dayNotes: "",
    });
    return {
      id,
      dayNumber: index + 1,
      date: parseHeadingDate(day.heading, year) ?? addDays(fallbackDate, index),
      cityId: "",
      cityName: "",
      countryName: "",
      theme: "city" as const,
      flexible: true,
      activities: activityItemsToLegacy(activityItems),
      activityItems,
      notes: "",
    };
  });
'''
if old_parsed not in text:
    raise SystemExit("Markdown creator contract changed unexpectedly")
text = text.replace(old_parsed, new_parsed, 1)

old_share = '''export function encodeWorkspaceShare(workspace: TripWorkspace): string {
  const payload = JSON.stringify(normalizeWorkspace(workspace, workspace.updatedAt));
  if (payload.length > MAX_SHARE_PAYLOAD) throw new Error("TRIP_SHARE_PAYLOAD_TOO_LARGE");
  return bytesToBase64Url(new TextEncoder().encode(payload));
}
'''
new_share = '''function portableShareWorkspace(workspace: TripWorkspace): TripWorkspace {
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
if old_share in text:
    text = text.replace(old_share, new_share, 1)
elif "function portableShareWorkspace" not in text:
    raise SystemExit("share contract changed unexpectedly")

path.write_text(text)
