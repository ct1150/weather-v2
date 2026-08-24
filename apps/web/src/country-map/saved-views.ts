export const COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY = "wnr:country-map-saved-views:v1";
export const MAX_COUNTRY_MAP_SAVED_VIEWS = 5;

export type SavedDecisionRangePreset = "3d" | "7d" | "weekend" | "custom";

export interface SavedDecisionFilters {
  readonly rainMax: number | null;
  readonly windMax: number | null;
  readonly tempMin: number | null;
  readonly tempMax: number | null;
}

export interface SavedCountryMapView {
  readonly id: string;
  readonly url: string;
  readonly label: string;
  readonly savedAt: string;
  readonly countryName: string;
  readonly rangePreset: SavedDecisionRangePreset | null;
  readonly customFrom: number | null;
  readonly customTo: number | null;
  readonly filters: SavedDecisionFilters;
  readonly comparedNames: ReadonlyArray<string>;
  readonly schemaVersion: 2;
}

const EMPTY_FILTERS: SavedDecisionFilters = {
  rainMax: null,
  windMax: null,
  tempMin: null,
  tempMax: null,
};

function isRelativeSiteUrl(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSearch(search: string): {
  rangePreset: SavedDecisionRangePreset | null;
  customFrom: number | null;
  customTo: number | null;
  filters: SavedDecisionFilters;
} {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  const from = Number(params.get("from"));
  const to = Number(params.get("to"));
  const hasCustom =
    params.has("from") &&
    params.has("to") &&
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 0 &&
    to >= from;
  const requested = params.get("range");
  const rangePreset: SavedDecisionRangePreset | null = hasCustom
    ? "custom"
    : requested === "3d" || requested === "7d" || requested === "weekend"
      ? requested
      : null;

  const queryNumber = (name: string): number | null => {
    const raw = params.get(name);
    if (raw === null || raw.trim() === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    rangePreset,
    customFrom: hasCustom ? from : null,
    customTo: hasCustom ? to : null,
    filters: {
      rainMax: queryNumber("rainMax"),
      windMax: queryNumber("windMax"),
      tempMin: queryNumber("tempMin"),
      tempMax: queryNumber("tempMax"),
    },
  };
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

  const url = new URL(candidate.url, "https://local.invalid");
  const parsed = parseSearch(url.search);
  const filtersCandidate =
    typeof candidate.filters === "object" && candidate.filters !== null
      ? (candidate.filters as Partial<SavedDecisionFilters>)
      : null;
  const comparedNames = Array.isArray(candidate.comparedNames)
    ? candidate.comparedNames
        .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
        .map((name) => name.trim())
        .slice(0, 3)
    : [];

  return {
    id: candidate.id,
    url: candidate.url,
    label: candidate.label.trim(),
    savedAt: candidate.savedAt,
    countryName:
      typeof candidate.countryName === "string" && candidate.countryName.trim().length > 0
        ? candidate.countryName.trim()
        : candidate.label.split(" · ")[0]?.trim() || candidate.label.trim(),
    rangePreset:
      candidate.rangePreset === "3d" ||
      candidate.rangePreset === "7d" ||
      candidate.rangePreset === "weekend" ||
      candidate.rangePreset === "custom"
        ? candidate.rangePreset
        : parsed.rangePreset,
    customFrom: finiteNumber(candidate.customFrom) ?? parsed.customFrom,
    customTo: finiteNumber(candidate.customTo) ?? parsed.customTo,
    filters: filtersCandidate
      ? {
          rainMax: finiteNumber(filtersCandidate.rainMax),
          windMax: finiteNumber(filtersCandidate.windMax),
          tempMin: finiteNumber(filtersCandidate.tempMin),
          tempMax: finiteNumber(filtersCandidate.tempMax),
        }
      : parsed.filters,
    comparedNames,
    schemaVersion: 2,
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

export function serializeSavedCountryMapViews(views: ReadonlyArray<SavedCountryMapView>): string {
  return JSON.stringify(views.slice(0, MAX_COUNTRY_MAP_SAVED_VIEWS));
}

export function buildSavedCountryMapView(input: {
  readonly pathname: string;
  readonly search: string;
  readonly countryName: string;
  readonly comparedNames: ReadonlyArray<string>;
  readonly now?: Date;
}): SavedCountryMapView {
  const search =
    input.search.startsWith("?") || input.search.length === 0 ? input.search : `?${input.search}`;
  const url = `${input.pathname}${search}`;
  const comparedNames = input.comparedNames
    .filter((name) => name.trim().length > 0)
    .map((name) => name.trim())
    .slice(0, 3);
  const parsed = parseSearch(search);
  return {
    id: url,
    url,
    label:
      comparedNames.length > 0
        ? `${input.countryName} · ${comparedNames.join(" / ")}`
        : input.countryName,
    savedAt: (input.now ?? new Date()).toISOString(),
    countryName: input.countryName,
    rangePreset: parsed.rangePreset,
    customFrom: parsed.customFrom,
    customTo: parsed.customTo,
    filters: parsed.filters,
    comparedNames,
    schemaVersion: 2,
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
