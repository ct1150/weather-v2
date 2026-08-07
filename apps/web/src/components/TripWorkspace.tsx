"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import {
  TRIP_SHARE_HASH_KEY,
  TRIP_WORKSPACE_STORAGE_KEY,
  assessWorkspaceDay,
  createBlankWorkspace,
  decodeWorkspaceShare,
  encodeWorkspaceShare,
  forecastKey,
  normalizeWorkspace,
  workspaceToMarkdown,
  type TripCityOption,
  type TripDayTheme,
  type TripForecastDay,
  type TripPartyProfile,
  type TripWorkspace,
  type TripWorkspaceDay,
  type WorkspaceDayDecision,
  type WorkspaceRiskLevel,
} from "../trips/workspace";
import { CloudTripControls } from "./CloudTripControls";

const API_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");
const WEATHER_STORAGE_PREFIX = "wnr:trip-weather:v1:";

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

type WeatherState = "idle" | "loading" | "ready" | "error";

function riskCopy(level: WorkspaceRiskLevel): string {
  if (level === "low") return "适合执行";
  if (level === "medium") return "需要留意";
  if (level === "high") return "建议调整";
  return "等待天气";
}

function riskClass(level: WorkspaceRiskLevel): string {
  if (level === "low") return "trip-risk-low";
  if (level === "medium") return "trip-risk-medium";
  if (level === "high") return "trip-risk-high";
  return "trip-risk-unknown";
}

function partyCopy(profile: TripPartyProfile): string {
  if (profile === "family") return "亲子家庭";
  if (profile === "senior") return "含老人同行";
  return "成人出行";
}

function themeCopy(theme: TripDayTheme): string {
  if (theme === "beach") return "海岛/沙滩";
  if (theme === "outdoor") return "户外观景";
  if (theme === "indoor") return "室内为主";
  return "城市游览";
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

function loadInitialWorkspace(): TripWorkspace {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/u, ""));
  const shared = hash.get(TRIP_SHARE_HASH_KEY);
  if (shared !== null) {
    const decoded = decodeWorkspaceShare(shared);
    if (decoded !== null) return decoded;
  }

  const stored = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (stored !== null) {
    try {
      return normalizeWorkspace(JSON.parse(stored) as unknown);
    } catch {
      window.localStorage.removeItem(TRIP_WORKSPACE_STORAGE_KEY);
    }
  }
  return createBlankWorkspace();
}

function DecisionCard({
  day,
  forecast,
  decision,
}: {
  readonly day: TripWorkspaceDay;
  readonly forecast: TripForecastDay | null;
  readonly decision: WorkspaceDayDecision;
}): ReactElement {
  return (
    <section className={`trip-workspace-decision ${riskClass(decision.riskLevel)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">
            D{day.dayNumber} 天气决策
          </p>
          <h3 className="mt-2 text-lg font-bold">{decision.summary}</h3>
        </div>
        <span className={`trip-risk-badge ${riskClass(decision.riskLevel)}`}>
          {decision.score === null ? "—" : decision.score} · {riskCopy(decision.riskLevel)}
        </span>
      </div>

      {forecast !== null ? (
        <div className="trip-workspace-weather-grid mt-4">
          <span>{forecast.condition}</span>
          <span>
            {forecast.temperatureMinC ?? "—"}°–{forecast.temperatureMaxC ?? "—"}°
          </span>
          <span>降雨 {forecast.rainProbability ?? "—"}%</span>
          <span>风速 {forecast.windSpeedKph ?? "—"} km/h</span>
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
        <strong>Plan B：</strong> {decision.planB}
      </div>
    </section>
  );
}

function DayEditor({
  day,
  cities,
  forecast,
  decision,
  canRemove,
  onChange,
  onRemove,
}: {
  readonly day: TripWorkspaceDay;
  readonly cities: ReadonlyArray<TripCityOption>;
  readonly forecast: TripForecastDay | null;
  readonly decision: WorkspaceDayDecision;
  readonly canRemove: boolean;
  readonly onChange: (patch: Partial<TripWorkspaceDay>) => void;
  readonly onRemove: () => void;
}): ReactElement {
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
          <p className="eyebrow">D{day.dayNumber}</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">
            {selectedCity === undefined
              ? "选择当天目的地"
              : `${selectedCity.countryName} · ${selectedCity.cityName}`}
          </h2>
        </div>
        <button
          type="button"
          className="trip-workspace-remove"
          disabled={!canRemove}
          onClick={onRemove}
        >
          删除当天
        </button>
      </header>

      <div className="mt-5">
        <DecisionCard day={day} forecast={forecast} decision={decision} />
      </div>

      <details className="trip-day-editor mt-5">
        <summary>编辑当天安排</summary>
        <div className="trip-day-editor-body">
          <div className="trip-workspace-fields">
            <label>
              <span>日期</span>
              <input
                type="date"
                value={day.date}
                onChange={(event) => onChange({ date: event.target.value })}
              />
            </label>
            <label>
              <span>天气城市</span>
              <select value={day.cityId} onChange={handleCity}>
                <option value="">请选择城市</option>
                {cities.map((city) => (
                  <option key={city.cityId} value={city.cityId}>
                    {city.countryName} · {city.cityName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>当天类型</span>
              <select
                value={day.theme}
                onChange={(event) => onChange({ theme: event.target.value as TripDayTheme })}
              >
                {(["city", "beach", "outdoor", "indoor"] as const).map((theme) => (
                  <option key={theme} value={theme}>
                    {themeCopy(theme)}
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
              <span>当天可根据天气调整</span>
            </label>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="trip-workspace-textarea">
              <span>行程安排（每行一项）</span>
              <textarea
                value={day.activities.join("\n")}
                placeholder="09:00 浅草寺\n14:00 东京国立博物馆"
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
              <span>固定约束和备注</span>
              <textarea
                value={day.notes}
                placeholder="例如：18:00前必须回酒店；门票不可改期"
                onChange={(event) => onChange({ notes: event.target.value.slice(0, 500) })}
              />
            </label>
          </div>
        </div>
      </details>
    </article>
  );
}

export function TripWorkspace(): ReactElement {
  const [workspace, setWorkspace] = useState<TripWorkspace | null>(null);
  const [cities, setCities] = useState<ReadonlyArray<TripCityOption>>([]);
  const [forecasts, setForecasts] = useState<ReadonlyMap<string, TripForecastDay>>(new Map());
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState("");
  const [weatherStale, setWeatherStale] = useState(false);
  const [weatherState, setWeatherState] = useState<WeatherState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const initial = loadInitialWorkspace();
    setWorkspace(initial);
    const storedWeather = parseStoredWeather(
      window.localStorage.getItem(weatherStorageKey(initial.id)),
    );
    if (storedWeather !== null) {
      setForecasts(
        new Map(storedWeather.items.map((item) => [forecastKey(item.cityId, item.date), item])),
      );
      setWeatherUpdatedAt(storedWeather.dataUpdatedAt);
      setWeatherStale(storedWeather.stale);
      setWeatherState("ready");
    }
  }, []);

  useEffect(() => {
    if (workspace === null) return;
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  useEffect(() => {
    if (API_BASE.length === 0) return;
    let active = true;
    void fetch(`${API_BASE}/api/v1/trip-cities?locale=zh-cn`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`CITY_API_${response.status}`);
        return (await response.json()) as TripCitiesResponse;
      })
      .then((payload) => {
        if (active) setCities(payload.data?.items ?? []);
      })
      .catch(() => {
        if (active) setMessage("城市天气目录暂时不可用，已保留本地行程编辑能力。");
      });
    return () => {
      active = false;
    };
  }, []);

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

  const refreshWeather = useCallback(async (): Promise<void> => {
    if (workspace === null) return;
    if (API_BASE.length === 0) {
      setMessage("生产环境尚未配置天气读取地址，当前仍可编辑、保存、分享和导出行程。");
      setWeatherState("error");
      return;
    }
    const cityIds = [...new Set(workspace.days.map((day) => day.cityId).filter(Boolean))];
    if (cityIds.length === 0) {
      setMessage("请至少为一天选择天气城市。");
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
        locale: "zh-cn",
      });
      const response = await fetch(`${API_BASE}/api/v1/trip-forecast?${params.toString()}`);
      if (!response.ok) throw new Error(`FORECAST_API_${response.status}`);
      const payload = (await response.json()) as TripForecastResponse;
      const items = payload.data?.items ?? [];
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
          ? "当前行程日期尚未进入可用预报窗口，系统会保留行程并等待后续更新。"
          : `已更新 ${items.length} 条城市天气。`,
      );
    } catch {
      setWeatherState("error");
      setMessage("天气更新失败，已继续使用本地保存的上一次结果。");
    }
  }, [workspace]);

  const copyShareLink = useCallback(async (): Promise<void> => {
    if (workspace === null) return;
    try {
      const payload = encodeWorkspaceShare(workspace);
      const url = new URL(window.location.href);
      url.pathname = "/zh-cn/trips/workspace";
      url.search = "";
      url.hash = new URLSearchParams({ [TRIP_SHARE_HASH_KEY]: payload }).toString();
      await navigator.clipboard.writeText(url.toString());
      setMessage("分享链接已复制。接收者打开后会得到一份可继续编辑的行程副本。");
    } catch {
      setMessage("分享链接生成失败，请减少每天的行程文字后重试。");
    }
  }, [workspace]);

  const exportMarkdown = useCallback((): void => {
    if (workspace === null) return;
    const blob = new Blob([workspaceToMarkdown(workspace)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.title.replace(/[^\p{L}\p{N}-]+/gu, "-") || "trip"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Markdown 行程已导出。");
  }, [workspace]);

  const decisions = useMemo(() => {
    if (workspace === null) return [];
    return workspace.days.map((day) => {
      const forecast = forecasts.get(forecastKey(day.cityId, day.date)) ?? null;
      return {
        forecast,
        decision: assessWorkspaceDay(day, forecast, workspace.partyProfile),
      };
    });
  }, [forecasts, workspace]);

  const summary = useMemo(() => {
    const values = decisions.map((item) => item.decision);
    return {
      covered: values.filter((item) => item.score !== null).length,
      highRisk: values.filter((item) => item.riskLevel === "high").length,
      average:
        values.filter((item) => item.score !== null).length === 0
          ? null
          : Math.round(
              values.reduce((sum, item) => sum + (item.score ?? 0), 0) /
                values.filter((item) => item.score !== null).length,
            ),
    };
  }, [decisions]);

  if (workspace === null) {
    return <p className="info-panel">正在打开你的旅行工作台…</p>;
  }

  return (
    <div className="trip-workspace">
      <section className="trip-workspace-toolbar">
        <div>
          <p className="eyebrow">Trip Execution Workspace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">
            把天气预报变成每天怎么走
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
            选择每天所在城市和行程类型，系统会根据降雨、风、高温、紫外线以及老人儿童同行情况，生成可执行建议和Plan
            B。数据默认保存在当前设备，不需要注册。
          </p>
        </div>
        <div className="trip-workspace-actions">
          <button
            type="button"
            className="trip-primary-button"
            onClick={() => void refreshWeather()}
          >
            {weatherState === "loading" ? "天气更新中…" : "更新天气决策"}
          </button>
          <button
            type="button"
            className="trip-secondary-button"
            onClick={() => void copyShareLink()}
          >
            复制分享链接
          </button>
          <button type="button" className="trip-secondary-button" onClick={exportMarkdown}>
            导出 Markdown
          </button>
        </div>
      </section>

      <CloudTripControls locale="zh-cn" workspace={workspace} onRemoteWorkspace={setWorkspace} />

      <CloudTripControls locale="zh-cn" workspace={workspace} onRemoteWorkspace={setWorkspace} />

      <CloudTripControls locale="zh-cn" workspace={workspace} onRemoteWorkspace={setWorkspace} />

      <CloudTripControls locale="zh-cn" workspace={workspace} onRemoteWorkspace={setWorkspace} />

      <section className="trip-summary-grid mt-5" aria-label="行程工作台摘要">
        <div>
          <span>行程天数</span>
          <strong>{workspace.days.length} 天</strong>
        </div>
        <div>
          <span>天气覆盖</span>
          <strong>
            {summary.covered}/{workspace.days.length} 天
          </strong>
        </div>
        <div>
          <span>平均适宜度</span>
          <strong>{summary.average === null ? "待更新" : `${summary.average} 分`}</strong>
        </div>
        <div>
          <span>高风险日期</span>
          <strong>{summary.highRisk} 天</strong>
        </div>
      </section>

      <details className="trip-workspace-disclosure mt-5">
        <summary>行程设置</summary>
        <div className="trip-workspace-disclosure-body">
          <section className="trip-workspace-settings">
            <label>
              <span>旅行名称</span>
              <input
                value={workspace.title}
                maxLength={120}
                onChange={(event) =>
                  updateWorkspace((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              <span>同行人群</span>
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
                    {partyCopy(profile)}
                  </option>
                ))}
              </select>
            </label>
            <div className="trip-workspace-save-state">
              <span>保存状态</span>
              <strong>已自动保存在此设备</strong>
              <small>
                {weatherUpdatedAt.length === 0
                  ? "天气尚未更新"
                  : `天气更新于 ${new Date(weatherUpdatedAt).toLocaleString("zh-CN")}${weatherStale ? " · 数据可能过期" : ""}`}
              </small>
            </div>
          </section>
        </div>
      </details>

      {message.length > 0 ? (
        <p className="trip-workspace-message mt-4" role="status">
          {message}
        </p>
      ) : null}

      <section className="mt-6 grid gap-5">
        {workspace.days.map((day, index) => (
          <DayEditor
            key={day.id}
            day={day}
            cities={cities}
            forecast={decisions[index]?.forecast ?? null}
            decision={
              decisions[index]?.decision ?? assessWorkspaceDay(day, null, workspace.partyProfile)
            }
            canRemove={workspace.days.length > 1}
            onChange={(patch) => updateDay(index, patch)}
            onRemove={() => removeDay(index)}
          />
        ))}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5">
        <div>
          <strong className="text-sm text-foreground">继续增加城市或停留日期</strong>
          <p className="mt-1 text-xs text-muted">单个分享行程最多支持16天，避免链接过长。</p>
        </div>
        <button
          type="button"
          className="trip-primary-button"
          disabled={workspace.days.length >= 16}
          onClick={addDay}
        >
          ＋ 增加一天
        </button>
      </div>
    </div>
  );
}
