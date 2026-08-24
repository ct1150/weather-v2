export const COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY = "wnr:country-map-saved-views:v1";
export const MAX_COUNTRY_MAP_SAVED_VIEWS = 5;

export interface SavedCountryMapView {
  readonly id: string;
  readonly url: string;
  readonly label: string;
  readonly savedAt: string;
}

function isRelativeSiteUrl(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

function normalizeView(value: unknown): SavedCountryMapView | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<SavedCountryMapView>;
  if (
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    typeof candidate.url !== "string" ||
    !isRelativeSiteUrl(candidate.url) ||
    typeof candidate.label !== "string" ||
    candidate.label.trim().length === 0 ||
    typeof candidate.savedAt !== "string" ||
    Number.isNaN(Date.parse(candidate.savedAt))
  ) {
    return null;
  }
  return {
    id: candidate.id,
    url: candidate.url,
    label: candidate.label.trim(),
    savedAt: candidate.savedAt,
  };
}

export function parseSavedCountryMapViews(raw: string | null): ReadonlyArray<SavedCountryMapView> {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const output: SavedCountryMapView[] = [];
    for (const value of parsed) {
      const view = normalizeView(value);
      if (view === null || seen.has(view.id)) continue;
      seen.add(view.id);
      output.push(view);
      if (output.length >= MAX_COUNTRY_MAP_SAVED_VIEWS) break;
    }
    return output;
  } catch {
    return [];
  }
}

export function serializeSavedCountryMapViews(
  views: ReadonlyArray<SavedCountryMapView>,
): string {
  return JSON.stringify(views.slice(0, MAX_COUNTRY_MAP_SAVED_VIEWS));
}

export function buildSavedCountryMapView(input: {
  readonly pathname: string;
  readonly search: string;
  readonly countryName: string;
  readonly comparedNames: ReadonlyArray<string>;
  readonly now?: Date;
}): SavedCountryMapView {
  const search = input.search.startsWith("?") || input.search.length === 0 ? input.search : `?${input.search}`;
  const url = `${input.pathname}${search}`;
  const compared = input.comparedNames.slice(0, 3);
  const label =
    compared.length > 0
      ? `${input.countryName} · ${compared.join(" / ")}`
      : `${input.countryName} · ${input.pathname}`;
  return {
    id: url,
    url,
    label,
    savedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function upsertSavedCountryMapView(
  existing: ReadonlyArray<SavedCountryMapView>,
  next: SavedCountryMapView,
): ReadonlyArray<SavedCountryMapView> {
  return [next, ...existing.filter((item) => item.id !== next.id)].slice(
    0,
    MAX_COUNTRY_MAP_SAVED_VIEWS,
  );
}
