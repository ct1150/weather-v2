from pathlib import Path

root = Path(__file__).resolve().parents[2]
target = root / "apps/web/src/discovery/reachability.ts"
text = target.read_text(encoding="utf-8")
old = '''export function parseReachabilityPreferences(search: URLSearchParams): ReachabilityPreferences {
  const originId = isOrigin(search.get("origin"))
    ? search.get("origin")!
    : DEFAULT_REACHABILITY_PREFERENCES.originId;
  const requestedMode = isMode(search.get("mode"))
    ? search.get("mode")!
    : DEFAULT_REACHABILITY_PREFERENCES.mode;
'''
new = '''export function parseReachabilityPreferences(search: URLSearchParams): ReachabilityPreferences {
  const rawOrigin = search.get("origin");
  const originId: ReachabilityOriginId = isOrigin(rawOrigin)
    ? rawOrigin
    : DEFAULT_REACHABILITY_PREFERENCES.originId;
  const rawMode = search.get("mode");
  const requestedMode: ReachabilityModeFilter = isMode(rawMode)
    ? rawMode
    : DEFAULT_REACHABILITY_PREFERENCES.mode;
'''
if text.count(old) != 1:
    raise RuntimeError("reachability parser block was not found exactly once")
target.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Reachability parser typing corrected")
