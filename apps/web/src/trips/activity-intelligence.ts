export type TripActivityCategory =
  | "attraction"
  | "food"
  | "transport"
  | "hotel"
  | "shopping"
  | "leisure";

export type TripActivityEnvironment = "indoor" | "outdoor" | "mixed";
export type TripWeatherSensitivity = "rain" | "heat" | "cold" | "wind" | "uv";
export type TripActivityFlexibility = "fixed" | "movable" | "flexible";
export type TripActivityReservation = "none" | "recommended" | "required";
export type TripActivityPriority = "must" | "preferred" | "optional";

export interface TripActivity {
  readonly id: string;
  readonly title: string;
  readonly cityId: string;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly durationMinutes: number | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly category: TripActivityCategory;
  readonly environment: TripActivityEnvironment;
  readonly weatherSensitivity: ReadonlyArray<TripWeatherSensitivity>;
  readonly flexibility: TripActivityFlexibility;
  readonly reservation: TripActivityReservation;
  readonly priority: TripActivityPriority;
  readonly poiId: string | null;
  readonly alternatives: ReadonlyArray<string>;
  readonly notes: string;
}

export interface LegacyActivityContext {
  readonly dayId: string;
  readonly cityId: string;
  readonly dayTheme: "city" | "beach" | "outdoor" | "indoor";
  readonly dayFlexible: boolean;
  readonly dayNotes: string;
}

const CATEGORIES: ReadonlyArray<TripActivityCategory> = [
  "attraction",
  "food",
  "transport",
  "hotel",
  "shopping",
  "leisure",
];
const ENVIRONMENTS: ReadonlyArray<TripActivityEnvironment> = ["indoor", "outdoor", "mixed"];
const SENSITIVITIES: ReadonlyArray<TripWeatherSensitivity> = ["rain", "heat", "cold", "wind", "uv"];
const FLEXIBILITIES: ReadonlyArray<TripActivityFlexibility> = ["fixed", "movable", "flexible"];
const RESERVATIONS: ReadonlyArray<TripActivityReservation> = ["none", "recommended", "required"];
const PRIORITIES: ReadonlyArray<TripActivityPriority> = ["must", "preferred", "optional"];

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberOrNull(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function enumValue<T extends string>(value: unknown, values: ReadonlyArray<T>, fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? (value as T) : fallback;
}

function timeOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/u.test(trimmed) ? trimmed : null;
}

function stableActivityId(dayId: string, index: number, title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 28);
  return `activity-${dayId}-${index + 1}${normalized.length > 0 ? `-${normalized}` : ""}`;
}

function inferCategory(title: string): TripActivityCategory {
  if (/train|ktx|flight|airport|station|shinkansen|新干线|高铁|火车|机场|車站|航班/iu.test(title))
    return "transport";
  if (/hotel|check.?in|check.?out|酒店|飯店|住宿/iu.test(title)) return "hotel";
  if (/market|restaurant|dinner|lunch|food|cafe|coffee|市场|市場|晚餐|午餐|美食|咖啡/iu.test(title))
    return "food";
  if (/mall|shopping|department|商场|商場|购物|購物/iu.test(title)) return "shopping";
  if (/spa|onsen|beach|park|walk|cruise|river|海滩|海灘|公园|公園|散步|温泉|溫泉/iu.test(title))
    return "leisure";
  return "attraction";
}

function inferEnvironment(
  title: string,
  theme: LegacyActivityContext["dayTheme"],
): TripActivityEnvironment {
  if (/museum|aquarium|mall|market|teamlab|gallery|indoor|博物馆|博物館|水族馆|水族館|商场|商場|室内|室內/iu.test(title))
    return "indoor";
  if (/beach|park|shrine|temple|garden|forest|tower|view|walk|海滩|海灘|公园|公園|神社|寺|花园|花園|森林|观景|觀景|散步/iu.test(title))
    return "outdoor";
  if (theme === "indoor") return "indoor";
  if (theme === "outdoor" || theme === "beach") return "outdoor";
  return "mixed";
}

function sensitivities(environment: TripActivityEnvironment): ReadonlyArray<TripWeatherSensitivity> {
  if (environment === "indoor") return [];
  if (environment === "mixed") return ["rain", "heat", "wind"];
  return ["rain", "heat", "cold", "wind", "uv"];
}

function fixedByLegacy(title: string, context: LegacyActivityContext): boolean {
  return (
    !context.dayFlexible ||
    /fixed|non.?refundable|ticket|reservation|required|不可改|固定|预约|預約|门票|門票/iu.test(
      `${title} ${context.dayNotes}`,
    ) ||
    inferCategory(title) === "transport"
  );
}

export function legacyActivityToStructured(
  value: string,
  index: number,
  context: LegacyActivityContext,
): TripActivity {
  const trimmed = text(value, 300);
  const match = /^([0-2]\d:[0-5]\d)\s+(.+)$/u.exec(trimmed);
  const startTime = match?.[1] !== undefined && timeOrNull(match[1]) !== null ? match[1] : null;
  const title = text(match?.[2] ?? trimmed, 180) || "Activity";
  const environment = inferEnvironment(title, context.dayTheme);
  const fixed = fixedByLegacy(title, context);
  return {
    id: stableActivityId(context.dayId, index, title),
    title,
    cityId: context.cityId,
    startTime,
    endTime: null,
    durationMinutes: null,
    latitude: null,
    longitude: null,
    category: inferCategory(title),
    environment,
    weatherSensitivity: sensitivities(environment),
    flexibility: fixed ? "fixed" : "movable",
    reservation: fixed ? "required" : "none",
    priority: "preferred",
    poiId: null,
    alternatives: [],
    notes: "",
  };
}

export function normalizeTripActivity(
  value: unknown,
  index: number,
  context: LegacyActivityContext,
): TripActivity | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const title = text(row.title, 180);
  if (title.length === 0) return null;
  const environment = enumValue(row.environment, ENVIRONMENTS, inferEnvironment(title, context.dayTheme));
  const rawSensitivity = Array.isArray(row.weatherSensitivity) ? row.weatherSensitivity : [];
  const weatherSensitivity = rawSensitivity
    .filter((item): item is TripWeatherSensitivity =>
      typeof item === "string" && SENSITIVITIES.includes(item as TripWeatherSensitivity),
    )
    .slice(0, SENSITIVITIES.length);
  const alternatives = Array.isArray(row.alternatives)
    ? row.alternatives.map((item) => text(item, 120)).filter(Boolean).slice(0, 8)
    : [];
  return {
    id: text(row.id, 128) || stableActivityId(context.dayId, index, title),
    title,
    cityId: text(row.cityId, 96) || context.cityId,
    startTime: timeOrNull(row.startTime),
    endTime: timeOrNull(row.endTime),
    durationMinutes: numberOrNull(row.durationMinutes, 10, 1440),
    latitude: numberOrNull(row.latitude, -90, 90),
    longitude: numberOrNull(row.longitude, -180, 180),
    category: enumValue(row.category, CATEGORIES, inferCategory(title)),
    environment,
    weatherSensitivity: weatherSensitivity.length > 0 ? weatherSensitivity : sensitivities(environment),
    flexibility: enumValue(row.flexibility, FLEXIBILITIES, context.dayFlexible ? "movable" : "fixed"),
    reservation: enumValue(row.reservation, RESERVATIONS, "none"),
    priority: enumValue(row.priority, PRIORITIES, "preferred"),
    poiId: text(row.poiId, 128) || null,
    alternatives,
    notes: text(row.notes, 500),
  };
}

export function normalizeActivityItems(
  structured: unknown,
  legacy: ReadonlyArray<string>,
  context: LegacyActivityContext,
): ReadonlyArray<TripActivity> {
  if (Array.isArray(structured)) {
    const normalized = structured
      .slice(0, 12)
      .map((item, index) => normalizeTripActivity(item, index, context))
      .filter((item): item is TripActivity => item !== null);
    if (normalized.length > 0 || legacy.length === 0) return normalized;
  }
  return legacy.slice(0, 12).map((item, index) => legacyActivityToStructured(item, index, context));
}

export function activityToLegacyText(activity: TripActivity): string {
  return `${activity.startTime === null ? "" : `${activity.startTime} `}${activity.title}`.trim();
}

export function activityItemsToLegacy(items: ReadonlyArray<TripActivity>): ReadonlyArray<string> {
  return items.slice(0, 12).map(activityToLegacyText);
}

export function withActivityPatch(
  activity: TripActivity,
  patch: Partial<TripActivity>,
  context: LegacyActivityContext,
): TripActivity {
  return (
    normalizeTripActivity({ ...activity, ...patch }, 0, context) ??
    legacyActivityToStructured(activityToLegacyText(activity), 0, context)
  );
}
