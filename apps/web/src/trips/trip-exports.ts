import { normalizeActivityItems } from "./activity-intelligence";
import type { TripForecastDay, TripPartyProfile, TripWorkspace } from "./workspace";

export type TripExportLocale = "en" | "zh-cn" | "zh-hant";

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

function packingBase(locale: TripExportLocale): PackingItem[] {
  if (locale === "en") {
    return [
      { id: "documents", label: "Passport / tickets / booking confirmations", reason: "Core travel documents", category: "documents" },
      { id: "power", label: "Chargers and power bank", reason: "Maps and weather execution depend on phone battery", category: "comfort" },
    ];
  }
  if (locale === "zh-hant") {
    return [
      { id: "documents", label: "證件 / 車票 / 預約確認", reason: "旅行基礎資料", category: "documents" },
      { id: "power", label: "充電器與行動電源", reason: "地圖與天氣執行模式需要手機續航", category: "comfort" },
    ];
  }
  return [
    { id: "documents", label: "证件 / 车票 / 预约确认", reason: "旅行基础资料", category: "documents" },
    { id: "power", label: "充电器与移动电源", reason: "地图与天气执行模式需要手机续航", category: "comfort" },
  ];
}

function localizedItem(
  locale: TripExportLocale,
  id: string,
  value: number | null = null,
): PackingItem {
  const numeric = value ?? 0;
  if (locale === "en") {
    const map: Record<string, PackingItem> = {
      "rain-shell": { id, label: "Light rain shell / compact umbrella", reason: `Peak rain probability ${numeric}%`, category: "weather" },
      "waterproof-bag": { id, label: "Waterproof pouch / phone bag", reason: "Protect documents and electronics", category: "weather" },
      "sun-protection": { id, label: "Sunscreen, hat and sunglasses", reason: `Peak UV ${numeric}`, category: "weather" },
      heat: { id, label: "Water bottle, electrolytes and quick-dry clothing", reason: `High around ${numeric}°C`, category: "weather" },
      "warm-layer": { id, label: "Light warm layer / wind shell", reason: `Low around ${numeric}°C`, category: "weather" },
      wind: { id, label: "Wind shell and secure hat strap", reason: `Peak gust around ${numeric} km/h`, category: "weather" },
      family: { id, label: "Children's spare clothing, snacks and usual medicines", reason: "Extra redundancy for family travel", category: "comfort" },
      senior: { id, label: "Regular medicines, insulated bottle and portable seat pad", reason: "Prioritize comfort and medication continuity", category: "comfort" },
    };
    return map[id]!;
  }
  if (locale === "zh-hant") {
    const map: Record<string, PackingItem> = {
      "rain-shell": { id, label: "輕量雨衣 / 折疊傘", reason: `最高降雨機率 ${numeric}%`, category: "weather" },
      "waterproof-bag": { id, label: "防水袋 / 防水手機袋", reason: "保護證件和電子設備", category: "weather" },
      "sun-protection": { id, label: "防曬霜、遮陽帽、太陽眼鏡", reason: `最高 UV ${numeric}`, category: "weather" },
      heat: { id, label: "水壺 / 電解質補充 / 快乾衣", reason: `最高溫約 ${numeric}°C`, category: "weather" },
      "warm-layer": { id, label: "輕薄保暖層 / 防風外套", reason: `最低溫約 ${numeric}°C`, category: "weather" },
      wind: { id, label: "防風外套與固定帽帶", reason: `最大陣風約 ${numeric} km/h`, category: "weather" },
      family: { id, label: "兒童備用衣物、零食與常用藥", reason: "親子出行增加備援", category: "comfort" },
      senior: { id, label: "長者常用藥、保溫水杯、便攜坐墊", reason: "長者同行優先舒適與用藥連續性", category: "comfort" },
    };
    return map[id]!;
  }
  const map: Record<string, PackingItem> = {
    "rain-shell": { id, label: "轻量雨衣 / 折叠伞", reason: `最高降雨概率 ${numeric}%`, category: "weather" },
    "waterproof-bag": { id, label: "防水袋 / 防水手机袋", reason: "保护证件和电子设备", category: "weather" },
    "sun-protection": { id, label: "防晒霜、遮阳帽、太阳镜", reason: `最高 UV ${numeric}`, category: "weather" },
    heat: { id, label: "水壶 / 电解质补充 / 速干衣", reason: `最高温约 ${numeric}°C`, category: "weather" },
    "warm-layer": { id, label: "轻薄保暖层 / 防风外套", reason: `最低温约 ${numeric}°C`, category: "weather" },
    wind: { id, label: "防风外套与固定帽带", reason: `最大阵风约 ${numeric} km/h`, category: "weather" },
    family: { id, label: "儿童备用衣物、零食与常用药", reason: "亲子出行增加冗余", category: "comfort" },
    senior: { id, label: "老人常用药、保温水杯、便携坐垫", reason: "老人同行优先舒适与用药连续性", category: "comfort" },
  };
  return map[id]!;
}

export function buildWeatherPackingList(
  forecasts: ReadonlyArray<TripForecastDay>,
  partyProfile: TripPartyProfile,
  locale: TripExportLocale = "zh-cn",
): ReadonlyArray<PackingItem> {
  const items = packingBase(locale);
  const maxRain = Math.max(0, ...forecasts.map((item) => item.rainProbability ?? 0));
  const maxUv = Math.max(0, ...forecasts.map((item) => item.uvIndex ?? 0));
  const maxTemp = Math.max(-99, ...forecasts.map((item) => item.temperatureMaxC ?? -99));
  const minTemp = Math.min(99, ...forecasts.map((item) => item.temperatureMinC ?? 99));
  const maxWind = Math.max(0, ...forecasts.map((item) => item.windGustKph ?? item.windSpeedKph ?? 0));

  if (maxRain >= 35) {
    pushUnique(items, localizedItem(locale, "rain-shell", maxRain));
    pushUnique(items, localizedItem(locale, "waterproof-bag"));
  }
  if (maxUv >= 7) pushUnique(items, localizedItem(locale, "sun-protection", maxUv));
  if (maxTemp >= 32) pushUnique(items, localizedItem(locale, "heat", maxTemp));
  if (minTemp <= 12) pushUnique(items, localizedItem(locale, "warm-layer", minTemp));
  if (maxWind >= 35) pushUnique(items, localizedItem(locale, "wind", maxWind));
  if (partyProfile === "family") pushUnique(items, localizedItem(locale, "family"));
  if (partyProfile === "senior") pushUnique(items, localizedItem(locale, "senior"));
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
