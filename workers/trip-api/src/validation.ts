const MAX_DOCUMENT_BYTES = 96_000;
const MAX_DAYS = 16;
const MAX_ACTIVITIES = 12;

export type TripLocale = "en" | "zh-cn" | "zh-hant";

export interface ValidTripDocument {
  readonly document: Record<string, unknown>;
  readonly title: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function boundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return (
    typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0)
  );
}

function validDay(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  if (!boundedString(value.id, 128)) return false;
  if (typeof value.dayNumber !== "number" || !Number.isInteger(value.dayNumber)) return false;
  if (!isIsoDate(value.date)) return false;
  if (!boundedString(value.cityId, 96, true)) return false;
  if (!boundedString(value.cityName, 120, true)) return false;
  if (!boundedString(value.countryName, 120, true)) return false;
  if (!["city", "beach", "outdoor", "indoor"].includes(String(value.theme))) return false;
  if (typeof value.flexible !== "boolean") return false;
  if (!Array.isArray(value.activities) || value.activities.length > MAX_ACTIVITIES) return false;
  if (!value.activities.every((item) => boundedString(item, 300))) return false;
  if (!boundedString(value.notes, 500, true)) return false;
  return true;
}

export function parseLocale(value: unknown): TripLocale | null {
  return value === "en" || value === "zh-cn" || value === "zh-hant" ? value : null;
}

export function validateTripDocument(value: unknown): ValidTripDocument | null {
  if (!isObject(value)) return null;
  const encoded = JSON.stringify(value);
  if (new TextEncoder().encode(encoded).byteLength > MAX_DOCUMENT_BYTES) return null;
  if (value.version !== 1) return null;
  if (!boundedString(value.id, 128)) return null;
  if (!boundedString(value.title, 120)) return null;
  if (!["adults", "family", "senior"].includes(String(value.partyProfile))) return null;
  if (!boundedString(value.createdAt, 64) || !boundedString(value.updatedAt, 64)) return null;
  if (!Array.isArray(value.days) || value.days.length < 1 || value.days.length > MAX_DAYS)
    return null;
  if (!value.days.every(validDay)) return null;

  const dates = value.days
    .map((day) => (day as Record<string, unknown>).date)
    .filter(isIsoDate)
    .sort();
  return {
    document: value,
    title: value.title,
    startDate: dates[0] ?? null,
    endDate: dates.at(-1) ?? null,
  };
}

export async function readJsonBody(request: Request): Promise<unknown | null> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES + 16_000) return null;
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}
