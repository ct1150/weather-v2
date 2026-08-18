export const DISCOVERY_SHORTLIST_STORAGE_KEY = "wnr:discovery-shortlist:v1";
export const MAX_DISCOVERY_SHORTLIST = 4;

export function normalizeDiscoveryShortlist(
  value: unknown,
  maxItems = MAX_DISCOVERY_SHORTLIST,
): ReadonlyArray<string> {
  if (!Array.isArray(value)) return [];
  const limit = Number.isInteger(maxItems) && maxItems > 0 ? maxItems : MAX_DISCOVERY_SHORTLIST;
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    output.push(id);
    if (output.length >= limit) break;
  }

  return output;
}

export function parseStoredDiscoveryShortlist(raw: string | null): ReadonlyArray<string> {
  if (raw === null) return [];
  try {
    return normalizeDiscoveryShortlist(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function serializeDiscoveryShortlist(values: ReadonlyArray<string>): string {
  return JSON.stringify(normalizeDiscoveryShortlist(values));
}

export function discoveryShortlistFromSearch(
  search: URLSearchParams,
): ReadonlyArray<string> {
  return normalizeDiscoveryShortlist((search.get("cities") ?? "").split(","));
}

export function withDiscoveryShortlist(
  search: URLSearchParams,
  values: ReadonlyArray<string>,
): URLSearchParams {
  const next = new URLSearchParams(search);
  const normalized = normalizeDiscoveryShortlist(values);
  if (normalized.length === 0) next.delete("cities");
  else next.set("cities", normalized.join(","));
  return next;
}
