import type { ParsedTripMarkdown } from "./markdown-parser";

export const TRIP_WORKSPACE_STORAGE_KEY = "wnr:trip-workspace:v1";
export const TRIP_SHARE_HASH_KEY = "trip";

const MAX_DAYS = 16;
const MAX_ACTIVITIES_PER_DAY = 12;
const MAX_SHARE_PAYLOAD = 24_000;

export type TripWorkspaceLocale = "en" | "zh-cn";
export type TripPartyProfile = "adults" | "family" | "senior";
export type TripDayTheme = "city" | "beach" | "outdoor" | "indoor";
export type WorkspaceRiskLevel = "low" | "medium" | "high" | "unknown";
export type TripWorkspaceTemplateId = "japan-family" | "thailand-islands" | "korea-city";

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

export interface TripWorkspaceTemplateSummary {
  readonly id: TripWorkspaceTemplateId;
  readonly title: string;
  readonly description: string;
  readonly duration: string;
  readonly route: string;
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
  readonly title?: string;
}

interface TemplateDay {
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly theme: TripDayTheme;
  readonly flexible: boolean;
  readonly activities: ReadonlyArray<string>;
  readonly notes: string;
}

interface TemplateDefinition {
  readonly partyProfile: TripPartyProfile;
  readonly en: {
    readonly title: string;
    readonly description: string;
    readonly duration: string;
    readonly route: string;
    readonly days: ReadonlyArray<TemplateDay>;
  };
  readonly "zh-cn": {
    readonly title: string;
    readonly description: string;
    readonly duration: string;
    readonly route: string;
    readonly days: ReadonlyArray<TemplateDay>;
  };
}

const TEMPLATE_DEFINITIONS: Record<TripWorkspaceTemplateId, TemplateDefinition> = {
  "japan-family": {
    partyProfile: "family",
    en: {
      title: "Japan family city loop",
      description: "A weather-aware Tokyo, Kyoto and Osaka itinerary with indoor fallbacks.",
      duration: "7 days",
      route: "Tokyo → Kyoto → Osaka",
      days: [
        {
          cityId: "jp-tokyo",
          cityName: "Tokyo",
          countryName: "Japan",
          theme: "city",
          flexible: true,
          activities: ["09:00 Asakusa and Senso-ji", "14:00 Ueno Park", "18:30 Tokyo Skytree"],
          notes: "Skytree ticket is fixed at 18:30.",
        },
        {
          cityId: "jp-tokyo",
          cityName: "Tokyo",
          countryName: "Japan",
          theme: "outdoor",
          flexible: true,
          activities: ["09:00 Meiji Shrine", "11:30 Harajuku", "16:00 Shibuya Sky"],
          notes: "Move Shibuya Sky only if the ticket allows changes.",
        },
        {
          cityId: "jp-tokyo",
          cityName: "Tokyo",
          countryName: "Japan",
          theme: "indoor",
          flexible: false,
          activities: ["10:00 teamLab Planets", "14:00 Odaiba", "17:30 Train to Kyoto"],
          notes: "Train departure is a fixed constraint.",
        },
        {
          cityId: "jp-kyoto",
          cityName: "Kyoto",
          countryName: "Japan",
          theme: "outdoor",
          flexible: true,
          activities: ["07:30 Fushimi Inari", "11:00 Nishiki Market", "16:00 Gion walk"],
          notes: "Start early to reduce heat and crowds.",
        },
        {
          cityId: "jp-kyoto",
          cityName: "Kyoto",
          countryName: "Japan",
          theme: "outdoor",
          flexible: true,
          activities: ["08:00 Arashiyama", "11:00 Tenryu-ji", "15:00 Railway Museum fallback"],
          notes: "Use the railway museum during heavy rain or heat.",
        },
        {
          cityId: "jp-osaka",
          cityName: "Osaka",
          countryName: "Japan",
          theme: "outdoor",
          flexible: false,
          activities: ["08:30 Universal Studios Japan", "19:30 Dotonbori"],
          notes: "Park ticket is fixed; prepare rain protection and heat breaks.",
        },
        {
          cityId: "jp-osaka",
          cityName: "Osaka",
          countryName: "Japan",
          theme: "city",
          flexible: true,
          activities: ["09:30 Osaka Castle", "13:30 Aquarium", "18:00 Umeda"],
          notes: "Aquarium is the main poor-weather anchor.",
        },
      ],
    },
    "zh-cn": {
      title: "日本亲子城市环线",
      description: "东京、京都和大阪7日家庭行程，内置雨天与高温备选。",
      duration: "7天",
      route: "东京 → 京都 → 大阪",
      days: [
        {
          cityId: "jp-tokyo",
          cityName: "东京",
          countryName: "日本",
          theme: "city",
          flexible: true,
          activities: ["09:00 浅草寺", "14:00 上野公园", "18:30 东京晴空塔"],
          notes: "晴空塔18:30门票为固定约束。",
        },
        {
          cityId: "jp-tokyo",
          cityName: "东京",
          countryName: "日本",
          theme: "outdoor",
          flexible: true,
          activities: ["09:00 明治神宫", "11:30 原宿", "16:00 涩谷Sky"],
          notes: "仅在门票允许改期时调整涩谷Sky。",
        },
        {
          cityId: "jp-tokyo",
          cityName: "东京",
          countryName: "日本",
          theme: "indoor",
          flexible: false,
          activities: ["10:00 teamLab", "14:00 台场", "17:30 新干线前往京都"],
          notes: "新干线时间为固定约束。",
        },
        {
          cityId: "jp-kyoto",
          cityName: "京都",
          countryName: "日本",
          theme: "outdoor",
          flexible: true,
          activities: ["07:30 伏见稻荷", "11:00 锦市场", "16:00 祇园散步"],
          notes: "早出发可避开高温与人流。",
        },
        {
          cityId: "jp-kyoto",
          cityName: "京都",
          countryName: "日本",
          theme: "outdoor",
          flexible: true,
          activities: ["08:00 岚山", "11:00 天龙寺", "15:00 京都铁道博物馆备选"],
          notes: "大雨或高温时切换铁道博物馆。",
        },
        {
          cityId: "jp-osaka",
          cityName: "大阪",
          countryName: "日本",
          theme: "outdoor",
          flexible: false,
          activities: ["08:30 日本环球影城", "19:30 道顿堀"],
          notes: "乐园门票固定，准备雨衣并安排高温休息。",
        },
        {
          cityId: "jp-osaka",
          cityName: "大阪",
          countryName: "日本",
          theme: "city",
          flexible: true,
          activities: ["09:30 大阪城", "13:30 海游馆", "18:00 梅田"],
          notes: "海游馆是主要恶劣天气锚点。",
        },
      ],
    },
  },
  "thailand-islands": {
    partyProfile: "adults",
    en: {
      title: "Bangkok and Phuket weather escape",
      description: "A city-and-island plan that reacts to rain, wind and boat conditions.",
      duration: "6 days",
      route: "Bangkok → Phuket",
      days: [
        {
          cityId: "th-bangkok",
          cityName: "Bangkok",
          countryName: "Thailand",
          theme: "city",
          flexible: true,
          activities: ["09:00 Grand Palace", "14:00 ICONSIAM", "19:00 Chinatown"],
          notes: "Move indoor shopping to the wettest hours.",
        },
        {
          cityId: "th-bangkok",
          cityName: "Bangkok",
          countryName: "Thailand",
          theme: "outdoor",
          flexible: true,
          activities: ["08:00 Wat Arun", "11:00 Canal tour", "16:00 Rooftop sunset"],
          notes: "Boat and rooftop activities depend on wind and storms.",
        },
        {
          cityId: "th-phuket",
          cityName: "Phuket",
          countryName: "Thailand",
          theme: "beach",
          flexible: true,
          activities: ["10:00 Kata Beach", "16:30 Promthep Cape"],
          notes: "Keep Old Town and the aquarium as rain alternatives.",
        },
        {
          cityId: "th-phuket",
          cityName: "Phuket",
          countryName: "Thailand",
          theme: "beach",
          flexible: false,
          activities: ["07:00 Phi Phi boat tour", "17:00 Return to hotel"],
          notes: "Operator safety decision overrides the itinerary.",
        },
        {
          cityId: "th-phuket",
          cityName: "Phuket",
          countryName: "Thailand",
          theme: "city",
          flexible: true,
          activities: ["10:00 Phuket Old Town", "15:00 Thai cooking class"],
          notes: "Use this day as the main storm fallback.",
        },
        {
          cityId: "th-phuket",
          cityName: "Phuket",
          countryName: "Thailand",
          theme: "beach",
          flexible: true,
          activities: ["09:00 Free beach window", "14:00 Spa", "18:00 Sunset dinner"],
          notes: "Choose the driest half-day after refreshing the forecast.",
        },
      ],
    },
    "zh-cn": {
      title: "曼谷与普吉岛天气行程",
      description: "根据降雨、风力和出海条件动态切换城市与海岛活动。",
      duration: "6天",
      route: "曼谷 → 普吉岛",
      days: [
        {
          cityId: "th-bangkok",
          cityName: "曼谷",
          countryName: "泰国",
          theme: "city",
          flexible: true,
          activities: ["09:00 大皇宫", "14:00 ICONSIAM", "19:00 唐人街"],
          notes: "把室内购物安排到降雨最强时段。",
        },
        {
          cityId: "th-bangkok",
          cityName: "曼谷",
          countryName: "泰国",
          theme: "outdoor",
          flexible: true,
          activities: ["08:00 郑王庙", "11:00 运河船游", "16:00 高空日落"],
          notes: "游船和高空活动受风雨影响。",
        },
        {
          cityId: "th-phuket",
          cityName: "普吉岛",
          countryName: "泰国",
          theme: "beach",
          flexible: true,
          activities: ["10:00 卡塔海滩", "16:30 神仙半岛"],
          notes: "雨天备选为普吉老城和水族馆。",
        },
        {
          cityId: "th-phuket",
          cityName: "普吉岛",
          countryName: "泰国",
          theme: "beach",
          flexible: false,
          activities: ["07:00 皮皮岛出海", "17:00 返回酒店"],
          notes: "以运营商安全决定为最高优先级。",
        },
        {
          cityId: "th-phuket",
          cityName: "普吉岛",
          countryName: "泰国",
          theme: "city",
          flexible: true,
          activities: ["10:00 普吉老城", "15:00 泰餐课程"],
          notes: "作为主要暴雨备选日。",
        },
        {
          cityId: "th-phuket",
          cityName: "普吉岛",
          countryName: "泰国",
          theme: "beach",
          flexible: true,
          activities: ["09:00 自由海滩时段", "14:00 SPA", "18:00 日落晚餐"],
          notes: "更新天气后选择更干燥的半天执行。",
        },
      ],
    },
  },
  "korea-city": {
    partyProfile: "adults",
    en: {
      title: "Seoul and Busan city break",
      description: "A five-day Korea plan balancing outdoor views with reliable indoor anchors.",
      duration: "5 days",
      route: "Seoul → Busan",
      days: [
        {
          cityId: "kr-seoul",
          cityName: "Seoul",
          countryName: "South Korea",
          theme: "city",
          flexible: true,
          activities: ["09:00 Gyeongbokgung", "14:00 Bukchon", "19:00 Myeongdong"],
          notes: "Move museums and shopping into rainy hours.",
        },
        {
          cityId: "kr-seoul",
          cityName: "Seoul",
          countryName: "South Korea",
          theme: "outdoor",
          flexible: true,
          activities: ["10:00 Seoul Forest", "16:00 N Seoul Tower", "19:30 Han River"],
          notes: "Wind and visibility matter for tower and river views.",
        },
        {
          cityId: "kr-seoul",
          cityName: "Seoul",
          countryName: "South Korea",
          theme: "indoor",
          flexible: false,
          activities: ["10:00 National Museum", "15:00 KTX to Busan"],
          notes: "KTX departure is fixed.",
        },
        {
          cityId: "kr-busan",
          cityName: "Busan",
          countryName: "South Korea",
          theme: "outdoor",
          flexible: true,
          activities: ["08:30 Gamcheon Village", "14:00 Songdo", "18:30 Jagalchi"],
          notes: "Use indoor markets during rain or strong wind.",
        },
        {
          cityId: "kr-busan",
          cityName: "Busan",
          countryName: "South Korea",
          theme: "beach",
          flexible: true,
          activities: ["09:00 Haeundae", "14:00 Busan X the Sky", "18:00 Gwangalli"],
          notes: "Reorder beach and tower by visibility and wind.",
        },
      ],
    },
    "zh-cn": {
      title: "首尔与釜山城市假期",
      description: "用稳定的室内锚点平衡城市户外景观与海边天气风险。",
      duration: "5天",
      route: "首尔 → 釜山",
      days: [
        {
          cityId: "kr-seoul",
          cityName: "首尔",
          countryName: "韩国",
          theme: "city",
          flexible: true,
          activities: ["09:00 景福宫", "14:00 北村", "19:00 明洞"],
          notes: "把博物馆和购物安排到降雨时段。",
        },
        {
          cityId: "kr-seoul",
          cityName: "首尔",
          countryName: "韩国",
          theme: "outdoor",
          flexible: true,
          activities: ["10:00 首尔林", "16:00 N首尔塔", "19:30 汉江"],
          notes: "塔台和江景需要关注风力与能见度。",
        },
        {
          cityId: "kr-seoul",
          cityName: "首尔",
          countryName: "韩国",
          theme: "indoor",
          flexible: false,
          activities: ["10:00 国立中央博物馆", "15:00 KTX前往釜山"],
          notes: "KTX车次为固定约束。",
        },
        {
          cityId: "kr-busan",
          cityName: "釜山",
          countryName: "韩国",
          theme: "outdoor",
          flexible: true,
          activities: ["08:30 甘川文化村", "14:00 松岛", "18:30 札嘎其"],
          notes: "降雨或大风时优先室内市场。",
        },
        {
          cityId: "kr-busan",
          cityName: "釜山",
          countryName: "韩国",
          theme: "beach",
          flexible: true,
          activities: ["09:00 海云台", "14:00 釜山X the Sky", "18:00 广安里"],
          notes: "根据能见度和风力调整海滩与观景台顺序。",
        },
      ],
    },
  },
};

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

export function getTripWorkspaceTemplates(
  locale: TripWorkspaceLocale,
): ReadonlyArray<TripWorkspaceTemplateSummary> {
  return (Object.keys(TEMPLATE_DEFINITIONS) as ReadonlyArray<TripWorkspaceTemplateId>).map((id) => {
    const copy = TEMPLATE_DEFINITIONS[id][locale];
    return {
      id,
      title: copy.title,
      description: copy.description,
      duration: copy.duration,
      route: copy.route,
    };
  });
}

export function createBlankWorkspace(options: WorkspaceOptions = {}): TripWorkspace {
  const now = options.now ?? new Date().toISOString();
  return {
    version: 1,
    id: options.id ?? workspaceId(),
    title: options.title ?? "我的天气旅行",
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

export function createWorkspaceFromTemplate(
  templateId: TripWorkspaceTemplateId,
  locale: TripWorkspaceLocale,
  options: WorkspaceOptions = {},
): TripWorkspace {
  const now = options.now ?? new Date().toISOString();
  const definition = TEMPLATE_DEFINITIONS[templateId];
  const copy = definition[locale];
  const startDate = addDays(todayIso(now), 7);
  return {
    version: 1,
    id: options.id ?? workspaceId(),
    title: copy.title,
    partyProfile: definition.partyProfile,
    createdAt: now,
    updatedAt: now,
    days: copy.days.map((day, index) => ({
      ...day,
      id: `day-${index + 1}`,
      dayNumber: index + 1,
      date: addDays(startDate, index),
    })),
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
    title: cleanText(parsed.title, 120) || options.title || "我的天气旅行",
    partyProfile: "adults",
    createdAt: now,
    updatedAt: now,
    days: days.length > 0 ? days : createBlankWorkspace({ now, title: options.title }).days,
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
    row.theme === "beach" || row.theme === "outdoor" || row.theme === "indoor"
      ? row.theme
      : "city";

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
    row.partyProfile === "family" || row.partyProfile === "senior"
      ? row.partyProfile
      : "adults";
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

function missingDecision(locale: TripWorkspaceLocale): WorkspaceDayDecision {
  if (locale === "en") {
    return {
      score: null,
      riskLevel: "unknown",
      summary: "No usable forecast is available for this day yet",
      reasons: ["Choose a city and refresh weather to generate a decision"],
      planB: "Keep a museum, indoor attraction or cancellable activity ready as a fallback.",
    };
  }
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
  locale: TripWorkspaceLocale = "zh-cn",
): WorkspaceDayDecision {
  if (day.cityId.length === 0 || forecast === null) return missingDecision(locale);

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

  if (locale === "en") {
    if (rain >= 60) reasons.push("High rain risk can disrupt outdoor time and local transport");
    else if (rain >= 35) reasons.push("Showers are possible; carry light rain gear and keep buffer time");
    else reasons.push("Rain risk is low and the original plan is broadly workable");
    if (wind >= 25 || gust >= 40)
      reasons.push("Strong wind may affect beaches, viewpoints, boats and rooftop venues");
    if (max >= 34) reasons.push("Heat is significant; avoid midday exposure and schedule breaks");
    if (min <= 10) reasons.push("Morning and evening temperatures require a warm layer");
    if (uv >= 8 && day.theme !== "indoor")
      reasons.push("High UV requires shade, sunscreen and frequent hydration");
  } else {
    if (rain >= 60) reasons.push("降雨概率较高，户外体验和交通稳定性会下降");
    else if (rain >= 35) reasons.push("可能出现阵雨，建议携带轻便雨具并保留机动时间");
    else reasons.push("降雨风险较低，原计划可执行性较好");
    if (wind >= 25 || gust >= 40) reasons.push("风力偏强，海边、高空和夜景活动需要复核开放状态");
    if (max >= 34) reasons.push("高温明显，老人儿童应避开正午并增加休息");
    if (min <= 10) reasons.push("早晚偏凉，需要准备保暖层");
    if (uv >= 8 && day.theme !== "indoor") reasons.push("紫外线较强，需要遮阳、防晒和补水");
  }

  const normalized = clamp(score);
  const level = riskLevel(normalized);
  if (locale === "en") {
    const summary =
      level === "low"
        ? "Good weather window — keep the original plan"
        : level === "medium"
          ? "The day is workable, but shorten exposure and keep a fallback ready"
          : "Weather risk is high — change the timing or use Plan B";
    const planB =
      day.theme === "indoor"
        ? "Keep the indoor plan and allow extra travel time."
        : day.theme === "beach"
          ? "Switch to an aquarium, indoor family venue, spa, food route or sheltered waterfront stop."
          : day.theme === "city"
            ? "Move museums, malls and food stops into the wettest or hottest hours."
            : "Shorten the outdoor section and switch to a museum, gallery, hot spring or indoor experience.";
    return { score: normalized, riskLevel: level, summary, reasons, planB };
  }

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

export function workspaceToMarkdown(
  workspace: TripWorkspace,
  locale: TripWorkspaceLocale = "zh-cn",
): string {
  const party =
    locale === "en"
      ? workspace.partyProfile === "family"
        ? "Family with children"
        : workspace.partyProfile === "senior"
          ? "Travelling with older adults"
          : "Adults"
      : workspace.partyProfile;
  const lines =
    locale === "en"
      ? [`# ${workspace.title}`, "", `**Travel party:** ${party}`, ""]
      : [`# ${workspace.title}`, "", `**出行人群：** ${party}`, ""];

  for (const day of workspace.days) {
    const city =
      day.cityName.length > 0
        ? `${day.countryName} · ${day.cityName}`
        : locale === "en"
          ? "City not selected"
          : "城市待选择";
    lines.push(`# D${day.dayNumber} (${day.date})`, "");
    lines.push(locale === "en" ? `**Destination:** ${city}` : `**目的地：** ${city}`, "");
    lines.push(
      locale === "en" ? "| Time / item | Plan |" : "| 时间/安排 | 行程 |",
      "|---|---|",
    );
    if (day.activities.length === 0) {
      lines.push(
        locale === "en"
          ? "| To be planned | Add activities for this day |"
          : "| 待安排 | 请补充当天活动 |",
      );
    }
    for (const activity of day.activities) lines.push(`| ${activity} | ${day.notes || "—"} |`);
    lines.push("");
  }
  return lines.join("\n");
}
