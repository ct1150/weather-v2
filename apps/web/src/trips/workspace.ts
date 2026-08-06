import type { ParsedTripMarkdown } from "./markdown-parser";

export const TRIP_WORKSPACE_STORAGE_KEY = "wnr:trip-workspace:v1";
export const TRIP_SHARE_HASH_KEY = "trip";

const MAX_DAYS = 16;
const MAX_ACTIVITIES_PER_DAY = 12;
const MAX_SHARE_PAYLOAD = 24_000;

export type TripPartyProfile = "adults" | "family" | "senior";
export type TripDayTheme = "city" | "beach" | "outdoor" | "indoor";
export type WorkspaceRiskLevel = "low" | "medium" | "high" | "unknown";

export interface TripWorkspaceDay {
  readonly id: string;
  readonly dayNumber: number;
  readonly date: string;
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly theme: TripDayTheme;
  readonly flexible: boolean;
  readonly activities: ReadonlyArray<string>;
  readonly notes: string;
}

export interface TripWorkspace {
  readonly version: 1;
  readonly id: string;
  readonly title: string;
  readonly partyProfile: TripPartyProfile;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly days: ReadonlyArray<TripWorkspaceDay>;
}

export interface TripCityOption {
  readonly cityId: string;
  readonly countrySlug: string;
  readonly citySlug: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly featured: boolean;
}

export interface TripForecastDay {
  readonly cityId: string;
  readonly date: string;
  readonly weatherCode: number | null;
  readonly condition: string;
  readonly temperatureMinC: number | null;
  readonly temperatureMaxC: number | null;
  readonly precipitationMm: number | null;
  readonly rainProbability: number | null;
  readonly windSpeedKph: number | null;
  readonly windGustKph: number | null;
  readonly uvIndex: number | null;
  readonly cloudCover: number | null;
  readonly visibilityM: number | null;
  readonly sunrise: string | null;
  readonly sunset: string | null;
  readonly dataQuality: string;
}

export interface WorkspaceDayDecision {
  readonly score: number | null;
  readonly riskLevel: WorkspaceRiskLevel;
  readonly summary: string;
  readonly reasons: ReadonlyArray<string>;
  readonly planB: string;
}

interface WorkspaceOptions {
  readonly now?: string;
  readonly id?: string;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function todayIso(now: string): string {
  return new Date(now).toISOString().slice(0, 10);
}

function addDays(date: string, offset: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function parseYear(title: string, fallbackDate: string): number {
  const year = title.match(/\b(20\d{2})\b/u)?.[1];
  return year === undefined ? Number(fallbackDate.slice(0, 4)) : Number(year);
}

function parseHeadingDate(heading: string, year: number): string | null {
  const chinese = heading.match(/(\d{1,2})月(\d{1,2})日/u);
  if (chinese !== null) {
    const month = Number(chinese[1]);
    const day = Number(chinese[2]);
    const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return isIsoDate(value) ? value : null;
  }

  const iso = heading.match(/(20\d{2}-\d{2}-\d{2})/u)?.[1];
  return iso !== undefined && isIsoDate(iso) ? iso : null;
}

function workspaceId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `trip-${Date.now().toString(36)}`;
}

export function createBlankWorkspace(options: WorkspaceOptions = {}): TripWorkspace {
  const now = options.now ?? new Date().toISOString();
  return {
    version: 1,
    id: options.id ?? workspaceId(),
    title: "我的天气旅行",
    partyProfile: "adults",
    createdAt: now,
    updatedAt: now,
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: todayIso(now),
        cityId: "",
        cityName: "",
        countryName: "",
        theme: "city",
        flexible: true,
        activities: [],
        notes: "",
      },
    ],
  };
}

export function createWorkspaceFromParsed(
  parsed: ParsedTripMarkdown,
  options: WorkspaceOptions = {},
): TripWorkspace {
  const now = options.now ?? new Date().toISOString();
  const fallbackDate = todayIso(now);
  const year = parseYear(parsed.title, fallbackDate);
  const days = parsed.days.slice(0, MAX_DAYS).map((day, index) => ({
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

  return {
    version: 1,
    id: options.id ?? workspaceId(),
    title: cleanText(parsed.title, 120) || "我的天气旅行",
    partyProfile: "adults",
    createdAt: now,
    updatedAt: now,
    days: days.length > 0 ? days : createBlankWorkspace({ now }).days,
  };
}

function normalizeDay(value: unknown, index: number, fallbackDate: string): TripWorkspaceDay {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const activities = Array.isArray(row.activities)
    ? row.activities
        .slice(0, MAX_ACTIVITIES_PER_DAY)
        .map((item) => cleanText(item, 160))
        .filter(Boolean)
    : [];
  const theme: TripDayTheme =
    row.theme === "beach" || row.theme === "outdoor" || row.theme === "indoor" ? row.theme : "city";

  return {
    id: cleanText(row.id, 80) || `day-${index + 1}`,
    dayNumber: index + 1,
    date: isIsoDate(cleanText(row.date, 10))
      ? cleanText(row.date, 10)
      : addDays(fallbackDate, index),
    cityId: cleanText(row.cityId, 64),
    cityName: cleanText(row.cityName, 80),
    countryName: cleanText(row.countryName, 80),
    theme,
    flexible: row.flexible !== false,
    activities,
    notes: cleanText(row.notes, 500),
  };
}

export function normalizeWorkspace(value: unknown, now = new Date().toISOString()): TripWorkspace {
  const fallback = createBlankWorkspace({ now });
  if (typeof value !== "object" || value === null) return fallback;
  const row = value as Record<string, unknown>;
  const partyProfile: TripPartyProfile =
    row.partyProfile === "family" || row.partyProfile === "senior" ? row.partyProfile : "adults";
  const rawDays = Array.isArray(row.days) ? row.days.slice(0, MAX_DAYS) : [];
  const fallbackDate = todayIso(now);
  const days = rawDays.map((day, index) => normalizeDay(day, index, fallbackDate));

  return {
    version: 1,
    id: cleanText(row.id, 80) || workspaceId(),
    title: cleanText(row.title, 120) || fallback.title,
    partyProfile,
    createdAt: cleanText(row.createdAt, 40) || now,
    updatedAt: cleanText(row.updatedAt, 40) || now,
    days: days.length > 0 ? days : fallback.days,
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeWorkspaceShare(workspace: TripWorkspace): string {
  const payload = JSON.stringify(normalizeWorkspace(workspace, workspace.updatedAt));
  if (payload.length > MAX_SHARE_PAYLOAD) throw new Error("TRIP_SHARE_PAYLOAD_TOO_LARGE");
  return bytesToBase64Url(new TextEncoder().encode(payload));
}

export function decodeWorkspaceShare(value: string): TripWorkspace | null {
  try {
    if (value.length === 0 || value.length > MAX_SHARE_PAYLOAD * 2) return null;
    const json = new TextDecoder().decode(base64UrlToBytes(value));
    return normalizeWorkspace(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}

export function forecastKey(cityId: string, date: string): string {
  return `${cityId}:${date}`;
}

function riskLevel(score: number): WorkspaceRiskLevel {
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  return "high";
}

function missingDecision(): WorkspaceDayDecision {
  return {
    score: null,
    riskLevel: "unknown",
    summary: "尚未获得这一天的有效天气数据",
    reasons: ["选择城市并点击“更新天气”后生成决策"],
    planB: "保留室内景点、商场、博物馆或可取消活动作为备选。",
  };
}

export function assessWorkspaceDay(
  day: TripWorkspaceDay,
  forecast: TripForecastDay | null,
  partyProfile: TripPartyProfile,
): WorkspaceDayDecision {
  if (day.cityId.length === 0 || forecast === null) return missingDecision();

  const rain = forecast.rainProbability ?? 35;
  const wind = forecast.windSpeedKph ?? 12;
  const gust = forecast.windGustKph ?? wind * 1.4;
  const max = forecast.temperatureMaxC ?? 26;
  const min = forecast.temperatureMinC ?? 16;
  const uv = forecast.uvIndex ?? 5;
  const reasons: string[] = [];
  let score = 100;

  const rainFactor = day.theme === "indoor" ? 0.08 : day.theme === "beach" ? 0.65 : 0.45;
  score -= rain * rainFactor;
  score -= Math.max(0, wind - (day.theme === "beach" ? 14 : 20)) * 1.1;
  score -= Math.max(0, gust - 35) * 0.45;
  score -= Math.max(0, max - 34) * (partyProfile === "adults" ? 2.2 : 3.2);
  score -= Math.max(0, 8 - min) * (partyProfile === "adults" ? 1.2 : 2.1);
  score -= Math.max(0, uv - 8) * (day.theme === "indoor" ? 0.2 : 1.4);

  if (rain >= 60) reasons.push("降雨概率较高，户外体验和交通稳定性会下降");
  else if (rain >= 35) reasons.push("可能出现阵雨，建议携带轻便雨具并保留机动时间");
  else reasons.push("降雨风险较低，原计划可执行性较好");
  if (wind >= 25 || gust >= 40) reasons.push("风力偏强，海边、高空和夜景活动需要复核开放状态");
  if (max >= 34) reasons.push("高温明显，老人儿童应避开正午并增加休息");
  if (min <= 10) reasons.push("早晚偏凉，需要准备保暖层");
  if (uv >= 8 && day.theme !== "indoor") reasons.push("紫外线较强，需要遮阳、防晒和补水");

  const normalized = clamp(score);
  const level = riskLevel(normalized);
  const summary =
    level === "low"
      ? "天气窗口较好，可以按原计划执行"
      : level === "medium"
        ? "行程可执行，但建议缩短户外暴露并准备备选"
        : "天气风险较高，优先调整时段或启用 Plan B";
  const planB =
    day.theme === "indoor"
      ? "保留当前室内安排，并预留更充足的交通时间。"
      : day.theme === "beach"
        ? "改为水族馆、海景咖啡馆、室内亲子馆或城市美食路线。"
        : day.theme === "city"
          ? "把博物馆、商场、美食街等室内项目移到天气较差时段。"
          : "缩短户外停留，改走博物馆、展馆、温泉或室内体验路线。";

  return { score: normalized, riskLevel: level, summary, reasons, planB };
}

export function workspaceToMarkdown(workspace: TripWorkspace): string {
  const lines = [`# ${workspace.title}`, "", `**出行人群：** ${workspace.partyProfile}`, ""];
  for (const day of workspace.days) {
    const city = day.cityName.length > 0 ? `${day.countryName} · ${day.cityName}` : "城市待选择";
    lines.push(`# D${day.dayNumber}（${day.date}）`, "", `**目的地：** ${city}`, "");
    lines.push("| 时间/安排 | 行程 |", "|---|---|");
    if (day.activities.length === 0) lines.push("| 待安排 | 请补充当天活动 |");
    for (const activity of day.activities) lines.push(`| ${activity} | ${day.notes || "—"} |`);
    lines.push("");
  }
  return lines.join("\n");
}
