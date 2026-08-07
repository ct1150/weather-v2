"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { clearCloudMetadata } from "../trips/cloud-sync";
import {
  TRIP_SHARE_HASH_KEY,
  TRIP_WORKSPACE_STORAGE_KEY,
  assessWorkspaceDay,
  createBlankWorkspace,
  createWorkspaceFromTemplate,
  decodeWorkspaceShare,
  encodeWorkspaceShare,
  forecastKey,
  getTripWorkspaceTemplates,
  normalizeWorkspace,
  workspaceToMarkdown,
  type TripCityOption,
  type TripDayTheme,
  type TripForecastDay,
  type TripPartyProfile,
  type TripWorkspace,
  type TripWorkspaceDay,
  type TripWorkspaceTemplateId,
  type WorkspaceDayDecision,
  type WorkspaceRiskLevel,
} from "../trips/workspace";
import {
  toTraditionalCity,
  toTraditionalDecision,
  toTraditionalForecast,
  toTraditionalTemplate,
  toTraditionalText,
  toTraditionalWorkspace,
} from "../trips/traditional";
import { CloudTripControls } from "./CloudTripControls";

export type TripProductLocale = "en" | "zh-hant";

const API_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");
const WEATHER_STORAGE_PREFIX = "wnr:trip-weather:v1:";

type WeatherState = "idle" | "loading" | "ready" | "error";

interface TripCitiesResponse {
  readonly data?: { readonly items?: ReadonlyArray<TripCityOption> };
}

interface TripForecastResponse {
  readonly data?: {
    readonly freshness?: { readonly dataUpdatedAt?: string; readonly stale?: boolean };
    readonly items?: ReadonlyArray<TripForecastDay>;
  };
}

interface StoredWeather {
  readonly dataUpdatedAt: string;
  readonly stale: boolean;
  readonly items: ReadonlyArray<TripForecastDay>;
}

interface LocalizedTripWorkspaceProps {
  readonly locale: TripProductLocale;
}

const COPY = {
  en: {
    loading: "Opening your trip workspace…",
    eyebrow: "Live trip workspace",
    title: "Build the plan. Let weather change only what should move.",
    intro:
      "Designed for Japan, Korea and Southeast Asia trips. Your itinerary stays in this browser; only city IDs and dates are sent to the read-only weather service.",
    refresh: "Refresh trip weather",
    refreshing: "Refreshing…",
    share: "Copy share link",
    export: "Download Markdown",
    tripTitle: "Trip title",
    party: "Travel party",
    storageLabel: "Local-first storage",
    storageTitle: "Saved automatically in this browser",
    storageNote: "No account required. Use a share link to move a copy to another device.",
    tripLength: "Trip length",
    forecastCoverage: "Forecast coverage",
    average: "Average suitability",
    highRisk: "High-risk days",
    days: "days",
    dataUpdated: "Weather data updated",
    stale: "Stale snapshot — refresh before making decisions",
    current: "Current snapshot",
    addDay: "Add another day",
    print: "Print itinerary",
    blank: "Start a blank trip",
    editDay: "Edit day details",
    tripSettings: "Trip settings",
    templatesLabel: "Start from a template",
    moreActions: "More trip actions",
    replaceConfirm: "Loading a template will replace your current itinerary. Continue?",
    blankConfirm: "Starting a blank trip will replace your current itinerary. Continue?",
    blankTitle: "My weather-aware trip",
    blankReady: "A new blank itinerary is ready.",
    templateReady: "Template loaded. Check the dates and refresh weather when ready.",
    cityUnavailable: "The live city directory is unavailable. Your local itinerary is still safe.",
    weatherNotConfigured: "Live weather is not configured. Editing, sharing and export still work.",
    chooseCityFirst: "Choose at least one forecast city first.",
    outsideWindow:
      "These dates are not inside the available forecast window yet. Your itinerary is saved.",
    updatedPrefix: "Updated",
    updatedSuffix: "city-day forecasts.",
    refreshFailed: "Weather refresh failed. The last saved forecast remains available.",
    shareCopied: "Share link copied. The recipient gets an editable copy in their browser.",
    shareTooLarge: "The share link is too large. Shorten some day notes and try again.",
    exported: "Markdown itinerary downloaded.",
    day: "Day",
    decision: "decision",
    planB: "Plan B",
    good: "Good to go",
    watch: "Watch conditions",
    change: "Change the plan",
    awaiting: "Awaiting forecast",
    removeDay: "Remove day",
    date: "Date",
    forecastCity: "Forecast city",
    chooseCity: "Choose a city",
    dayType: "Day type",
    flexible: "This day can move with the weather",
    activities: "Activities — one per line",
    activitiesPlaceholder: "09:00 Senso-ji\n14:00 Tokyo National Museum",
    notes: "Fixed constraints and notes",
    notesPlaceholder: "Example: 18:30 timed ticket; train cannot be changed",
    chooseDestination: "Choose this day’s destination",
    rain: "Rain",
    wind: "Wind",
    adults: "Adults",
    family: "Family with children",
    senior: "Travelling with older adults",
    city: "City sightseeing",
    beach: "Beach / island",
    outdoor: "Outdoor sights",
    indoor: "Mostly indoor",
    sharePath: "/trips/workspace",
    apiLocale: "en",
  },
  "zh-hant": {
    loading: "正在開啟你的行程工作台…",
    eyebrow: "即時行程工作台",
    title: "先排好行程，讓天氣只改動真正需要調整的部分。",
    intro:
      "適合日本、南韓與東南亞自由行。行程內容只保存在目前瀏覽器，天氣服務僅接收城市代碼與日期。",
    refresh: "更新行程天氣",
    refreshing: "更新中…",
    share: "複製分享連結",
    export: "下載 Markdown",
    tripTitle: "行程名稱",
    party: "同行成員",
    storageLabel: "本機優先儲存",
    storageTitle: "已自動儲存在此瀏覽器",
    storageNote: "不需要註冊帳號；可用分享連結把行程副本帶到其他裝置。",
    tripLength: "行程天數",
    forecastCoverage: "天氣涵蓋",
    average: "平均適合度",
    highRisk: "高風險日",
    days: "天",
    dataUpdated: "天氣資料更新於",
    stale: "資料可能已過期，做決定前請重新更新",
    current: "目前資料",
    addDay: "新增一天",
    print: "列印行程",
    blank: "建立空白行程",
    editDay: "編輯當天安排",
    tripSettings: "行程設定",
    templatesLabel: "從範本重新開始",
    moreActions: "更多行程操作",
    replaceConfirm: "載入範本會取代目前行程，是否繼續？",
    blankConfirm: "建立空白行程會取代目前行程，是否繼續？",
    blankTitle: "我的天氣行程",
    blankReady: "新的空白行程已建立。",
    templateReady: "範本已載入，確認日期後即可更新天氣。",
    cityUnavailable: "即時城市清單暫時無法使用，本機行程仍安全保留。",
    weatherNotConfigured: "即時天氣尚未設定，但編輯、分享與匯出仍可使用。",
    chooseCityFirst: "請先為至少一天選擇天氣城市。",
    outsideWindow: "行程日期尚未進入可用預報範圍，系統已保留你的行程。",
    updatedPrefix: "已更新",
    updatedSuffix: "筆城市日期天氣。",
    refreshFailed: "天氣更新失敗，系統會繼續使用上一次儲存的結果。",
    shareCopied: "分享連結已複製，接收者可在瀏覽器中繼續編輯副本。",
    shareTooLarge: "分享內容過長，請縮短部分每日備註後再試。",
    exported: "Markdown 行程已下載。",
    day: "第",
    decision: "天決策",
    planB: "備用方案",
    good: "可照原計畫",
    watch: "留意天氣",
    change: "建議調整",
    awaiting: "等待預報",
    removeDay: "移除此日",
    date: "日期",
    forecastCity: "天氣城市",
    chooseCity: "選擇城市",
    dayType: "行程類型",
    flexible: "這一天可依天氣調整",
    activities: "行程安排——每行一項",
    activitiesPlaceholder: "09:00 淺草寺\n14:00 東京國立博物館",
    notes: "固定限制與備註",
    notesPlaceholder: "例如：18:30 定時門票；列車不可更改",
    chooseDestination: "選擇這一天的目的地",
    rain: "降雨",
    wind: "風速",
    adults: "成人",
    family: "親子家庭",
    senior: "有年長者同行",
    city: "城市觀光",
    beach: "海灘／海島",
    outdoor: "戶外景點",
    indoor: "以室內為主",
    sharePath: "/zh-hant/trips/workspace",
    apiLocale: "zh-cn",
  },
} as const;

function riskClass(level: WorkspaceRiskLevel): string {
  if (level === "low") return "trip-risk-low";
  if (level === "medium") return "trip-risk-medium";
  if (level === "high") return "trip-risk-high";
  return "trip-risk-unknown";
}

function addOneDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function weatherStorageKey(workspaceId: string): string {
  return `${WEATHER_STORAGE_PREFIX}${workspaceId}`;
}

function parseStoredWeather(value: string | null): StoredWeather | null {
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredWeather>;
    return Array.isArray(parsed.items) && typeof parsed.dataUpdatedAt === "string"
      ? {
          dataUpdatedAt: parsed.dataUpdatedAt,
          stale: parsed.stale === true,
          items: parsed.items,
        }
      : null;
  } catch {
    return null;
  }
}

function isTemplateId(value: string | null): value is TripWorkspaceTemplateId {
  return value === "japan-family" || value === "thailand-islands" || value === "korea-city";
}

function localizeWorkspace(workspace: TripWorkspace, locale: TripProductLocale): TripWorkspace {
  return locale === "zh-hant" ? toTraditionalWorkspace(workspace) : workspace;
}

function localizeForecasts(
  items: ReadonlyArray<TripForecastDay>,
  locale: TripProductLocale,
): ReadonlyArray<TripForecastDay> {
  return locale === "zh-hant" ? items.map(toTraditionalForecast) : items;
}

function loadInitialWorkspace(locale: TripProductLocale): TripWorkspace {
  const copy = COPY[locale];
  const search = new URLSearchParams(window.location.search);
  if (search.get("new") === "1") {
    clearCloudMetadata();
    window.localStorage.removeItem(TRIP_WORKSPACE_STORAGE_KEY);
    return createBlankWorkspace({ title: copy.blankTitle });
  }
  const hash = new URLSearchParams(window.location.hash.replace(/^#/u, ""));
  const shared = hash.get(TRIP_SHARE_HASH_KEY);
  if (shared !== null) {
    const decoded = decodeWorkspaceShare(shared);
    if (decoded !== null) {
      clearCloudMetadata();
      return localizeWorkspace(decoded, locale);
    }
  }

  const templateId = search.get("template");
  if (isTemplateId(templateId)) {
    clearCloudMetadata();
    return localizeWorkspace(
      createWorkspaceFromTemplate(templateId, locale === "en" ? "en" : "zh-cn"),
      locale,
    );
  }

  const stored = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (stored !== null) {
    try {
      return localizeWorkspace(normalizeWorkspace(JSON.parse(stored) as unknown), locale);
    } catch {
      window.localStorage.removeItem(TRIP_WORKSPACE_STORAGE_KEY);
    }
  }
  return createBlankWorkspace({ title: copy.blankTitle });
}

function partyCopy(profile: TripPartyProfile, locale: TripProductLocale): string {
  const copy = COPY[locale];
  if (profile === "family") return copy.family;
  if (profile === "senior") return copy.senior;
  return copy.adults;
}

function themeCopy(theme: TripDayTheme, locale: TripProductLocale): string {
  const copy = COPY[locale];
  if (theme === "beach") return copy.beach;
  if (theme === "outdoor") return copy.outdoor;
  if (theme === "indoor") return copy.indoor;
  return copy.city;
}

function riskCopy(level: WorkspaceRiskLevel, locale: TripProductLocale): string {
  const copy = COPY[locale];
  if (level === "low") return copy.good;
  if (level === "medium") return copy.watch;
  if (level === "high") return copy.change;
  return copy.awaiting;
}

function DecisionCard({
  locale,
  day,
  forecast,
  decision,
}: {
  readonly locale: TripProductLocale;
  readonly day: TripWorkspaceDay;
  readonly forecast: TripForecastDay | null;
  readonly decision: WorkspaceDayDecision;
}): ReactElement {
  const copy = COPY[locale];
  return (
    <section className={`trip-workspace-decision ${riskClass(decision.riskLevel)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">
            {locale === "en"
              ? `${copy.day} ${day.dayNumber} ${copy.decision}`
              : `${copy.day}${day.dayNumber}${copy.decision}`}
          </p>
          <h3 className="mt-2 text-lg font-bold">{decision.summary}</h3>
        </div>
        <span className={`trip-risk-badge ${riskClass(decision.riskLevel)}`}>
          {decision.score === null ? "—" : decision.score} · {riskCopy(decision.riskLevel, locale)}
        </span>
      </div>

      {forecast !== null ? (
        <div className="trip-workspace-weather-grid mt-4">
          <span>{forecast.condition}</span>
          <span>
            {forecast.temperatureMinC ?? "—"}°–{forecast.temperatureMaxC ?? "—"}°C
          </span>
          <span>
            {copy.rain} {forecast.rainProbability ?? "—"}%
          </span>
          <span>
            {copy.wind} {forecast.windSpeedKph ?? "—"} km/h
          </span>
        </div>
      ) : null}

      <ul className="mt-4 grid gap-2 text-xs leading-5">
        {decision.reasons.map((reason) => (
          <li key={reason} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl bg-white/70 p-3 text-xs leading-5 text-foreground">
        <strong>{copy.planB}：</strong> {decision.planB}
      </div>
    </section>
  );
}

function DayEditor({
  locale,
  day,
  cities,
  forecast,
  decision,
  canRemove,
  onChange,
  onRemove,
}: {
  readonly locale: TripProductLocale;
  readonly day: TripWorkspaceDay;
  readonly cities: ReadonlyArray<TripCityOption>;
  readonly forecast: TripForecastDay | null;
  readonly decision: WorkspaceDayDecision;
  readonly canRemove: boolean;
  readonly onChange: (patch: Partial<TripWorkspaceDay>) => void;
  readonly onRemove: () => void;
}): ReactElement {
  const copy = COPY[locale];
  const selectedCity = cities.find((city) => city.cityId === day.cityId);
  const handleCity = (event: ChangeEvent<HTMLSelectElement>): void => {
    const city = cities.find((item) => item.cityId === event.target.value);
    onChange({
      cityId: city?.cityId ?? "",
      cityName: city?.cityName ?? "",
      countryName: city?.countryName ?? "",
    });
  };

  return (
    <article className="trip-workspace-day">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {locale === "en" ? `Day ${day.dayNumber}` : `第 ${day.dayNumber} 天`}
          </p>
          <h2 className="mt-2 text-xl font-bold text-foreground">
            {selectedCity === undefined
              ? day.cityName || copy.chooseDestination
              : `${selectedCity.countryName} · ${selectedCity.cityName}`}
          </h2>
        </div>
        <button
          type="button"
          className="trip-workspace-remove"
          disabled={!canRemove}
          onClick={onRemove}
        >
          {copy.removeDay}
        </button>
      </header>

      <div className="mt-5">
        <DecisionCard locale={locale} day={day} forecast={forecast} decision={decision} />
      </div>

      <details className="trip-day-editor mt-5">
        <summary>{copy.editDay}</summary>
        <div className="trip-day-editor-body">
          <div className="trip-workspace-fields">
            <label>
              <span>{copy.date}</span>
              <input
                type="date"
                value={day.date}
                onChange={(event) => onChange({ date: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.forecastCity}</span>
              <select value={day.cityId} onChange={handleCity}>
                <option value="">{copy.chooseCity}</option>
                {cities.map((city) => (
                  <option key={city.cityId} value={city.cityId}>
                    {city.countryName} · {city.cityName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{copy.dayType}</span>
              <select
                value={day.theme}
                onChange={(event) => onChange({ theme: event.target.value as TripDayTheme })}
              >
                {(["city", "beach", "outdoor", "indoor"] as const).map((theme) => (
                  <option key={theme} value={theme}>
                    {themeCopy(theme, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="trip-workspace-checkbox">
              <input
                type="checkbox"
                checked={day.flexible}
                onChange={(event) => onChange({ flexible: event.target.checked })}
              />
              <span>{copy.flexible}</span>
            </label>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="trip-workspace-textarea">
              <span>{copy.activities}</span>
              <textarea
                value={day.activities.join("\n")}
                placeholder={copy.activitiesPlaceholder}
                onChange={(event) =>
                  onChange({
                    activities: event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .slice(0, 12),
                  })
                }
              />
            </label>
            <label className="trip-workspace-textarea">
              <span>{copy.notes}</span>
              <textarea
                value={day.notes}
                placeholder={copy.notesPlaceholder}
                onChange={(event) => onChange({ notes: event.target.value.slice(0, 500) })}
              />
            </label>
          </div>
        </div>
      </details>
    </article>
  );
}

export function LocalizedTripWorkspace({ locale }: LocalizedTripWorkspaceProps): ReactElement {
  const copy = COPY[locale];
  const workspaceLocale = locale === "en" ? "en" : "zh-cn";
  const templates = useMemo(
    () =>
      getTripWorkspaceTemplates(workspaceLocale).map((template) =>
        locale === "zh-hant" ? toTraditionalTemplate(template) : template,
      ),
    [locale, workspaceLocale],
  );
  const [workspace, setWorkspace] = useState<TripWorkspace | null>(null);
  const [cities, setCities] = useState<ReadonlyArray<TripCityOption>>([]);
  const [forecasts, setForecasts] = useState<ReadonlyMap<string, TripForecastDay>>(new Map());
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState("");
  const [weatherStale, setWeatherStale] = useState(false);
  const [weatherState, setWeatherState] = useState<WeatherState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const initial = loadInitialWorkspace(locale);
    setWorkspace(initial);
    const storedWeather = parseStoredWeather(
      window.localStorage.getItem(weatherStorageKey(initial.id)),
    );
    if (storedWeather !== null) {
      const items = localizeForecasts(storedWeather.items, locale);
      setForecasts(new Map(items.map((item) => [forecastKey(item.cityId, item.date), item])));
      setWeatherUpdatedAt(storedWeather.dataUpdatedAt);
      setWeatherStale(storedWeather.stale);
      setWeatherState("ready");
    }
  }, [locale]);

  useEffect(() => {
    if (workspace === null) return;
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  useEffect(() => {
    if (API_BASE.length === 0) return;
    let active = true;
    void fetch(`${API_BASE}/api/v1/trip-cities?locale=${copy.apiLocale}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`CITY_API_${response.status}`);
        return (await response.json()) as TripCitiesResponse;
      })
      .then((payload) => {
        const items = payload.data?.items ?? [];
        if (active) setCities(locale === "zh-hant" ? items.map(toTraditionalCity) : items);
      })
      .catch(() => {
        if (active) setMessage(copy.cityUnavailable);
      });
    return () => {
      active = false;
    };
  }, [copy.apiLocale, copy.cityUnavailable, locale]);

  const updateWorkspace = useCallback(
    (transform: (current: TripWorkspace) => TripWorkspace): void => {
      setWorkspace((current) => {
        if (current === null) return current;
        return normalizeWorkspace({ ...transform(current), updatedAt: new Date().toISOString() });
      });
    },
    [],
  );

  const updateDay = useCallback(
    (index: number, patch: Partial<TripWorkspaceDay>): void => {
      updateWorkspace((current) => ({
        ...current,
        days: current.days.map((day, dayIndex) =>
          dayIndex === index ? { ...day, ...patch } : day,
        ),
      }));
    },
    [updateWorkspace],
  );

  const resetWeather = useCallback((): void => {
    setForecasts(new Map());
    setWeatherUpdatedAt("");
    setWeatherStale(false);
    setWeatherState("idle");
  }, []);

  const addDay = useCallback((): void => {
    updateWorkspace((current) => {
      const last = current.days.at(-1);
      const dayNumber = current.days.length + 1;
      const date =
        last === undefined ? new Date().toISOString().slice(0, 10) : addOneDay(last.date);
      return {
        ...current,
        days: [
          ...current.days,
          {
            id: `day-${Date.now().toString(36)}`,
            dayNumber,
            date,
            cityId: last?.cityId ?? "",
            cityName: last?.cityName ?? "",
            countryName: last?.countryName ?? "",
            theme: "city",
            flexible: true,
            activities: [],
            notes: "",
          },
        ],
      };
    });
  }, [updateWorkspace]);

  const removeDay = useCallback(
    (index: number): void => {
      updateWorkspace((current) => ({
        ...current,
        days: current.days
          .filter((_, dayIndex) => dayIndex !== index)
          .map((day, dayIndex) => ({ ...day, dayNumber: dayIndex + 1 })),
      }));
    },
    [updateWorkspace],
  );

  const applyTemplate = useCallback(
    (templateId: TripWorkspaceTemplateId): void => {
      if (!window.confirm(copy.replaceConfirm)) return;
      const next = localizeWorkspace(
        createWorkspaceFromTemplate(templateId, workspaceLocale),
        locale,
      );
      clearCloudMetadata();
      setWorkspace(next);
      resetWeather();
      window.history.replaceState({}, "", copy.sharePath);
      setMessage(copy.templateReady);
    },
    [
      copy.replaceConfirm,
      copy.sharePath,
      copy.templateReady,
      locale,
      resetWeather,
      workspaceLocale,
    ],
  );

  const startBlank = useCallback((): void => {
    if (!window.confirm(copy.blankConfirm)) return;
    const next = createBlankWorkspace({ title: copy.blankTitle });
    clearCloudMetadata();
    setWorkspace(next);
    resetWeather();
    window.history.replaceState({}, "", copy.sharePath);
    setMessage(copy.blankReady);
  }, [copy.blankConfirm, copy.blankReady, copy.blankTitle, copy.sharePath, resetWeather]);

  const refreshWeather = useCallback(async (): Promise<void> => {
    if (workspace === null) return;
    if (API_BASE.length === 0) {
      setMessage(copy.weatherNotConfigured);
      setWeatherState("error");
      return;
    }
    const cityIds = [...new Set(workspace.days.map((day) => day.cityId).filter(Boolean))];
    if (cityIds.length === 0) {
      setMessage(copy.chooseCityFirst);
      return;
    }
    const dates = workspace.days
      .map((day) => day.date)
      .filter(Boolean)
      .sort();
    const from = dates[0];
    const to = dates.at(-1);
    if (from === undefined || to === undefined) return;

    setWeatherState("loading");
    setMessage("");
    try {
      const params = new URLSearchParams({
        cityIds: cityIds.join(","),
        from,
        to,
        locale: copy.apiLocale,
      });
      const response = await fetch(`${API_BASE}/api/v1/trip-forecast?${params.toString()}`);
      if (!response.ok) throw new Error(`FORECAST_API_${response.status}`);
      const payload = (await response.json()) as TripForecastResponse;
      const rawItems = payload.data?.items ?? [];
      const items = localizeForecasts(rawItems, locale);
      const updatedAt = payload.data?.freshness?.dataUpdatedAt ?? new Date().toISOString();
      const stale = payload.data?.freshness?.stale === true;
      setForecasts(new Map(items.map((item) => [forecastKey(item.cityId, item.date), item])));
      setWeatherUpdatedAt(updatedAt);
      setWeatherStale(stale);
      setWeatherState("ready");
      window.localStorage.setItem(
        weatherStorageKey(workspace.id),
        JSON.stringify({ dataUpdatedAt: updatedAt, stale, items } satisfies StoredWeather),
      );
      setMessage(
        items.length === 0
          ? copy.outsideWindow
          : `${copy.updatedPrefix} ${items.length} ${copy.updatedSuffix}`,
      );
    } catch {
      setWeatherState("error");
      setMessage(copy.refreshFailed);
    }
  }, [copy, locale, workspace]);

  const copyShareLink = useCallback(async (): Promise<void> => {
    if (workspace === null) return;
    try {
      const payload = encodeWorkspaceShare(workspace);
      const url = new URL(window.location.href);
      url.pathname = copy.sharePath;
      url.search = "";
      url.hash = new URLSearchParams({ [TRIP_SHARE_HASH_KEY]: payload }).toString();
      await navigator.clipboard.writeText(url.toString());
      setMessage(copy.shareCopied);
    } catch {
      setMessage(copy.shareTooLarge);
    }
  }, [copy.shareCopied, copy.sharePath, copy.shareTooLarge, workspace]);

  const exportMarkdown = useCallback((): void => {
    if (workspace === null) return;
    const raw = workspaceToMarkdown(workspace, workspaceLocale);
    const markdown = locale === "zh-hant" ? toTraditionalText(raw) : raw;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.title.replace(/[^\p{L}\p{N}-]+/gu, "-") || "trip"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(copy.exported);
  }, [copy.exported, locale, workspace, workspaceLocale]);

  const decisions = useMemo(() => {
    if (workspace === null) return [];
    return workspace.days.map((day) => {
      const forecast = forecasts.get(forecastKey(day.cityId, day.date)) ?? null;
      const raw = assessWorkspaceDay(day, forecast, workspace.partyProfile, workspaceLocale);
      return {
        forecast,
        decision: locale === "zh-hant" ? toTraditionalDecision(raw) : raw,
      };
    });
  }, [forecasts, locale, workspace, workspaceLocale]);

  const summary = useMemo(() => {
    const values = decisions.map((item) => item.decision);
    const covered = values.filter((item) => item.score !== null);
    return {
      covered: covered.length,
      highRisk: values.filter((item) => item.riskLevel === "high").length,
      average:
        covered.length === 0
          ? null
          : Math.round(covered.reduce((sum, item) => sum + (item.score ?? 0), 0) / covered.length),
    };
  }, [decisions]);

  if (workspace === null) return <p className="info-panel">{copy.loading}</p>;

  return (
    <div className="trip-workspace">
      <section className="trip-workspace-toolbar">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted sm:text-base">{copy.intro}</p>
        </div>
        <div className="trip-workspace-actions">
          <button
            type="button"
            className="trip-primary-button"
            disabled={weatherState === "loading"}
            onClick={() => void refreshWeather()}
          >
            {weatherState === "loading" ? copy.refreshing : copy.refresh}
          </button>
          <button
            type="button"
            className="trip-secondary-button"
            onClick={() => void copyShareLink()}
          >
            {copy.share}
          </button>
          <button type="button" className="trip-secondary-button" onClick={exportMarkdown}>
            {copy.export}
          </button>
        </div>
      </section>

      <CloudTripControls
        locale={locale}
        workspace={workspace}
        onRemoteWorkspace={(remote) => setWorkspace(localizeWorkspace(remote, locale))}
      />

      <section className="trip-summary-grid" aria-label={copy.average}>
        <div>
          <span>{copy.tripLength}</span>
          <strong>
            {workspace.days.length} {copy.days}
          </strong>
        </div>
        <div>
          <span>{copy.forecastCoverage}</span>
          <strong>
            {summary.covered}/{workspace.days.length} {copy.days}
          </strong>
        </div>
        <div>
          <span>{copy.average}</span>
          <strong>{summary.average === null ? "—" : `${summary.average}/100`}</strong>
        </div>
        <div>
          <span>{copy.highRisk}</span>
          <strong>{summary.highRisk}</strong>
        </div>
      </section>

      <details className="trip-workspace-disclosure">
        <summary>{copy.tripSettings}</summary>
        <div className="trip-workspace-disclosure-body">
          <section className="trip-workspace-settings">
            <label>
              <span>{copy.tripTitle}</span>
              <input
                value={workspace.title}
                maxLength={120}
                onChange={(event) =>
                  updateWorkspace((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{copy.party}</span>
              <select
                value={workspace.partyProfile}
                onChange={(event) =>
                  updateWorkspace((current) => ({
                    ...current,
                    partyProfile: event.target.value as TripPartyProfile,
                  }))
                }
              >
                {(["adults", "family", "senior"] as const).map((profile) => (
                  <option key={profile} value={profile}>
                    {partyCopy(profile, locale)}
                  </option>
                ))}
              </select>
            </label>
            <div className="trip-workspace-save-state">
              <span>{copy.storageLabel}</span>
              <strong>{copy.storageTitle}</strong>
              <small>{copy.storageNote}</small>
            </div>
          </section>
        </div>
      </details>

      <details className="trip-workspace-disclosure">
        <summary>{copy.templatesLabel}</summary>
        <div className="trip-workspace-disclosure-body">
          <section className="grid gap-3 md:grid-cols-3">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="trip-process-card text-left"
                onClick={() => applyTemplate(template.id)}
              >
                <span>{template.duration}</span>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
                <strong className="mt-4 block text-xs text-primary">{template.route} →</strong>
              </button>
            ))}
          </section>
        </div>
      </details>

      {weatherUpdatedAt.length > 0 ? (
        <p className="text-xs text-muted">
          {copy.dataUpdated}{" "}
          {new Date(weatherUpdatedAt).toLocaleString(locale === "en" ? "en" : "zh-Hant")} ·{" "}
          {weatherStale ? copy.stale : copy.current}
        </p>
      ) : null}

      {message.length > 0 ? (
        <p className="trip-workspace-message" role="status">
          {message}
        </p>
      ) : null}

      <div className="grid gap-5">
        {workspace.days.map((day, index) => {
          const item = decisions[index];
          const fallback = assessWorkspaceDay(day, null, workspace.partyProfile, workspaceLocale);
          return (
            <DayEditor
              key={day.id}
              locale={locale}
              day={day}
              cities={cities}
              forecast={item?.forecast ?? null}
              decision={
                item?.decision ??
                (locale === "zh-hant" ? toTraditionalDecision(fallback) : fallback)
              }
              canRemove={workspace.days.length > 1}
              onChange={(patch) => updateDay(index, patch)}
              onRemove={() => removeDay(index)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <button type="button" className="trip-primary-button" onClick={addDay}>
          {copy.addDay}
        </button>
        <details className="trip-workspace-disclosure min-w-56">
          <summary>{copy.moreActions}</summary>
          <div className="trip-workspace-disclosure-body flex flex-wrap gap-3">
            <button type="button" className="trip-secondary-button" onClick={() => window.print()}>
              {copy.print}
            </button>
            <button type="button" className="trip-secondary-button" onClick={startBlank}>
              {copy.blank}
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
