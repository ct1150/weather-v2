import { normalizeActivityItems } from "./activity-intelligence";
import type { TripForecastDay, TripPartyProfile, TripWorkspace } from "./workspace";

export interface PackingItem {
  readonly id: string;
  readonly label: string;
  readonly reason: string;
  readonly category: "weather" | "comfort" | "documents";
}

function icsEscape(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/;/gu, "\\;").replace(/,/gu, "\\,").replace(/\r?\n/gu, "\\n");
}

function compactDate(date: string): string {
  return date.replace(/-/gu, "");
}

function compactDateTime(date: string, time: string): string {
  return `${compactDate(date)}T${time.replace(":", "")}00`;
}

function addMinutes(time: string, minutes: number): string {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText ?? 0);
  const minute = Number(minuteText ?? 0);
  const total = Math.max(0, Math.min(24 * 60 - 1, hour * 60 + minute + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function workspaceToIcs(workspace: TripWorkspace): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Where Not Rain//Trip Execution//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(workspace.title)}`,
  ];

  workspace.days.forEach((day) => {
    const activities = normalizeActivityItems(day.activityItems, day.activities, {
      dayId: day.id,
      cityId: day.cityId,
      dayTheme: day.theme,
      dayFlexible: day.flexible,
      dayNotes: day.notes,
    });
    activities.forEach((activity) => {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${icsEscape(`${workspace.id}-${day.id}-${activity.id}@868656.xyz`)}`);
      lines.push(`SUMMARY:${icsEscape(activity.title)}`);
      lines.push(`DESCRIPTION:${icsEscape(activity.notes)}`);
      if (activity.startTime === null) {
        lines.push(`DTSTART;VALUE=DATE:${compactDate(day.date)}`);
      } else {
        const duration = activity.durationMinutes ?? 60;
        lines.push(`DTSTART:${compactDateTime(day.date, activity.startTime)}`);
        lines.push(`DTEND:${compactDateTime(day.date, activity.endTime ?? addMinutes(activity.startTime, duration))}`);
      }
      if (activity.latitude !== null && activity.longitude !== null) {
        lines.push(`GEO:${activity.latitude};${activity.longitude}`);
      }
      lines.push(`CATEGORIES:${icsEscape(activity.category)}`);
      lines.push("END:VEVENT");
    });
  });

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function pushUnique(target: PackingItem[], item: PackingItem): void {
  if (!target.some((current) => current.id === item.id)) target.push(item);
}

export function buildWeatherPackingList(
  forecasts: ReadonlyArray<TripForecastDay>,
  partyProfile: TripPartyProfile,
): ReadonlyArray<PackingItem> {
  const items: PackingItem[] = [
    { id: "documents", label: "证件 / tickets / booking confirmations", reason: "旅行基础资料", category: "documents" },
    { id: "power", label: "充电器与移动电源", reason: "地图与天气执行模式需要手机续航", category: "comfort" },
  ];

  const maxRain = Math.max(0, ...forecasts.map((item) => item.rainProbability ?? 0));
  const maxUv = Math.max(0, ...forecasts.map((item) => item.uvIndex ?? 0));
  const maxTemp = Math.max(-99, ...forecasts.map((item) => item.temperatureMaxC ?? -99));
  const minTemp = Math.min(99, ...forecasts.map((item) => item.temperatureMinC ?? 99));
  const maxWind = Math.max(0, ...forecasts.map((item) => item.windGustKph ?? item.windSpeedKph ?? 0));

  if (maxRain >= 35) {
    pushUnique(items, { id: "rain-shell", label: "轻量雨衣 / 折叠伞", reason: `最高降雨概率 ${maxRain}%`, category: "weather" });
    pushUnique(items, { id: "waterproof-bag", label: "防水袋 / 防水手机袋", reason: "保护证件和电子设备", category: "weather" });
  }
  if (maxUv >= 7) {
    pushUnique(items, { id: "sun-protection", label: "防晒霜、遮阳帽、太阳镜", reason: `最高 UV ${maxUv}`, category: "weather" });
  }
  if (maxTemp >= 32) {
    pushUnique(items, { id: "heat", label: "水壶 / 电解质补充 / 速干衣", reason: `最高温约 ${maxTemp}°C`, category: "weather" });
  }
  if (minTemp <= 12) {
    pushUnique(items, { id: "warm-layer", label: "轻薄保暖层 / 防风外套", reason: `最低温约 ${minTemp}°C`, category: "weather" });
  }
  if (maxWind >= 35) {
    pushUnique(items, { id: "wind", label: "防风外套与固定帽带", reason: `最大阵风约 ${maxWind} km/h`, category: "weather" });
  }
  if (partyProfile === "family") {
    pushUnique(items, { id: "family", label: "儿童备用衣物、零食与常用药", reason: "亲子出行增加冗余", category: "comfort" });
  }
  if (partyProfile === "senior") {
    pushUnique(items, { id: "senior", label: "老人常用药、保温水杯、便携坐垫", reason: "老人同行优先舒适与用药连续性", category: "comfort" });
  }
  return items;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/\"/gu, "&quot;")
    .replace(/'/gu, "&#039;");
}

export function workspaceToPrintableHtml(
  workspace: TripWorkspace,
  forecasts: ReadonlyArray<TripForecastDay>,
): string {
  const forecastByKey = new Map(forecasts.map((item) => [`${item.cityId}:${item.date}`, item] as const));
  const dayHtml = workspace.days
    .map((day) => {
      const forecast = forecastByKey.get(`${day.cityId}:${day.date}`);
      const activities = normalizeActivityItems(day.activityItems, day.activities, {
        dayId: day.id,
        cityId: day.cityId,
        dayTheme: day.theme,
        dayFlexible: day.flexible,
        dayNotes: day.notes,
      });
      const weather = forecast
        ? `${htmlEscape(forecast.condition)} · ${forecast.temperatureMinC ?? "—"}°–${forecast.temperatureMaxC ?? "—"}° · Rain ${forecast.rainProbability ?? "—"}%`
        : "Weather unavailable";
      const activityHtml = activities
        .map((activity) => `<li><strong>${htmlEscape(activity.startTime ?? "—")}</strong> ${htmlEscape(activity.title)}${activity.flexibility === "fixed" || activity.reservation === "required" ? " 🔒" : ""}</li>`)
        .join("");
      return `<section><h2>D${day.dayNumber} · ${htmlEscape(day.date)} · ${htmlEscape(day.cityName || day.countryName)}</h2><p>${weather}</p><ol>${activityHtml}</ol>${day.notes ? `<p><em>${htmlEscape(day.notes)}</em></p>` : ""}</section>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(workspace.title)}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#111827}h1{font-size:32px}section{page-break-inside:avoid;border-top:1px solid #ddd;padding:18px 0}h2{font-size:20px}li{margin:8px 0;line-height:1.5}p{line-height:1.6;color:#4b5563}@media print{body{margin:0;max-width:none}}</style></head><body><h1>${htmlEscape(workspace.title)}</h1><p>Generated by Where Not Rain · Weather-first Trip Execution</p>${dayHtml}</body></html>`;
}
