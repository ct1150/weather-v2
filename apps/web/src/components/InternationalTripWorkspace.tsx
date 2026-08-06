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

const API_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");
const WEATHER_STORAGE_PREFIX = "wnr:trip-weather:v1:";
const TEMPLATES = getTripWorkspaceTemplates("en");

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
  if (level === "low") return "Good to go";
  if (level === "medium") return "Watch conditions";
  if (level === "high") return "Change the plan";
  return "Awaiting forecast";
}

function riskClass(level: WorkspaceRiskLevel): string {
  if (level === "low") return "trip-risk-low";
  if (level === "medium") return "trip-risk-medium";
  if (level === "high") return "trip-risk-high";
  return "trip-risk-unknown";
}

function partyCopy(profile: TripPartyProfile): string {
  if (profile === "family") return "Family with children";
  if (profile === "senior") return "Travelling with older adults";
  return "Adults";
}

function themeCopy(theme: TripDayTheme): string {
  if (theme === "beach") return "Beach / island";
  if (theme === "outdoor") return "Outdoor sights";
  if (theme === "indoor") return "Mostly indoor";
  return "City sightseeing";
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

function loadInitialWorkspace(): TripWorkspace {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/u, ""));
  const shared = hash.get(TRIP_SHARE_HASH_KEY);
  if (shared !== null) {
    const decoded = decodeWorkspaceShare(shared);
    if (decoded !== null) return decoded;
  }

  const templateId = new URLSearchParams(window.location.search).get("template");
  if (isTemplateId(templateId)) return createWorkspaceFromTemplate(templateId, "en");

  const stored = window.localStorage.getItem(TRIP_WORKSPACE_STORAGE_KEY);
  if (stored !== null) {
    try {
      return normalizeWorkspace(JSON.parse(stored) as unknown);
    } catch {
      window.localStorage.removeItem(TRIP_WORKSPACE_STORAGE_KEY);
    }
  }
  return createBlankWorkspace({ title: "My weather-aware trip" });
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
            Day {day.dayNumber} decision
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
            {forecast.temperatureMinC ?? "—"}°–{forecast.temperatureMaxC ?? "—"}°C
          </span>
          <span>Rain {forecast.rainProbability ?? "—"}%</span>
          <span>Wind {forecast.windSpeedKph ?? "—"} km/h</span>
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
        <strong>Plan B:</strong> {decision.planB}
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
          <p className="eyebrow">Day {day.dayNumber}</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">
            {selectedCity === undefined
              ? day.cityName || "Choose this day’s destination"
              : `${selectedCity.countryName} · ${selectedCity.cityName}`}
          </h2>
        </div>
        <button
          type="button"
          className="trip-workspace-remove"
          disabled={!canRemove}
          onClick={onRemove}
        >
          Remove day
        </button>
      </header>

      <div className="trip-workspace-fields mt-5">
        <label>
          <span>Date</span>
          <input
            type="date"
            value={day.date}
            onChange={(event) => onChange({ date: event.target.value })}
          />
        </label>
        <label>
          <span>Forecast city</span>
          <select value={day.cityId} onChange={handleCity}>
            <option value="">Choose a city</option>
            {cities.map((city) => (
              <option key={city.cityId} value={city.cityId}>
                {city.countryName} · {city.cityName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Day type</span>
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
          <span>This day can move with the weather</span>
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="trip-workspace-textarea">
          <span>Activities — one per line</span>
          <textarea
            value={day.activities.join("\n")}
            placeholder={"09:00 Senso-ji\n14:00 Tokyo National Museum"}
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
          <span>Fixed constraints and notes</span>
          <textarea
            value={day.notes}
            placeholder="Example: 18:30 timed ticket; train cannot be changed"
            onChange={(event) => onChange({ notes: event.target.value.slice(0, 500) })}
          />
        </label>
      </div>

      <div className="mt-5">
        <DecisionCard day={day} forecast={forecast} decision={decision} />
      </div>
    </article>
  );
}

export function InternationalTripWorkspace(): ReactElement {
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
    void fetch(`${API_BASE}/api/v1/trip-cities?locale=en`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`CITY_API_${response.status}`);
        return (await response.json()) as TripCitiesResponse;
      })
      .then((payload) => {
        if (active) setCities(payload.data?.items ?? []);
      })
      .catch(() => {
        if (active)
          setMessage("The live city directory is unavailable. Your local itinerary is still safe.");
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

  const applyTemplate = useCallback((templateId: TripWorkspaceTemplateId): void => {
    const next = createWorkspaceFromTemplate(templateId, "en");
    setWorkspace(next);
    setForecasts(new Map());
    setWeatherUpdatedAt("");
    setWeatherStale(false);
    setWeatherState("idle");
    window.history.replaceState({}, "", "/trips/workspace");
    setMessage("Template loaded. Check the dates and refresh weather when ready.");
  }, []);

  const startBlank = useCallback((): void => {
    const next = createBlankWorkspace({ title: "My weather-aware trip" });
    setWorkspace(next);
    setForecasts(new Map());
    setWeatherUpdatedAt("");
    setWeatherStale(false);
    setWeatherState("idle");
    window.history.replaceState({}, "", "/trips/workspace");
    setMessage("A new blank itinerary is ready.");
  }, []);

  const refreshWeather = useCallback(async (): Promise<void> => {
    if (workspace === null) return;
    if (API_BASE.length === 0) {
      setMessage("Live weather is not configured. Editing, sharing and export still work.");
      setWeatherState("error");
      return;
    }
    const cityIds = [...new Set(workspace.days.map((day) => day.cityId).filter(Boolean))];
    if (cityIds.length === 0) {
      setMessage("Choose at least one forecast city first.");
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
        locale: "en",
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
          ? "These dates are not inside the available forecast window yet. Your itinerary is saved."
          : `Updated ${items.length} city-day forecasts.`,
      );
    } catch {
      setWeatherState("error");
      setMessage("Weather refresh failed. The last saved forecast remains available.");
    }
  }, [workspace]);

  const copyShareLink = useCallback(async (): Promise<void> => {
    if (workspace === null) return;
    try {
      const payload = encodeWorkspaceShare(workspace);
      const url = new URL(window.location.href);
      url.pathname = "/trips/workspace";
      url.search = "";
      url.hash = new URLSearchParams({ [TRIP_SHARE_HASH_KEY]: payload }).toString();
      await navigator.clipboard.writeText(url.toString());
      setMessage("Share link copied. The recipient gets an editable copy in their browser.");
    } catch {
      setMessage("The share link is too large. Shorten some day notes and try again.");
    }
  }, [workspace]);

  const exportMarkdown = useCallback((): void => {
    if (workspace === null) return;
    const blob = new Blob([workspaceToMarkdown(workspace, "en")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.title.replace(/[^\p{L}\p{N}-]+/gu, "-") || "trip"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Markdown itinerary downloaded.");
  }, [workspace]);

  const decisions = useMemo(() => {
    if (workspace === null) return [];
    return workspace.days.map((day) => {
      const forecast = forecasts.get(forecastKey(day.cityId, day.date)) ?? null;
      return {
        forecast,
        decision: assessWorkspaceDay(day, forecast, workspace.partyProfile, "en"),
      };
    });
  }, [forecasts, workspace]);

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

  if (workspace === null) {
    return <p className="info-panel">Opening your trip workspace…</p>;
  }

  return (
    <div className="trip-workspace">
      <section className="trip-workspace-toolbar">
        <div>
          <p className="eyebrow">Live trip workspace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">
            Build the plan. Let weather change only what should move.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            Designed for Japan, Korea and Southeast Asia trips. Your itinerary stays in this
            browser; only city IDs and dates are sent to the read-only weather service.
          </p>
        </div>
        <div className="trip-workspace-actions">
          <button
            type="button"
            className="trip-primary-button"
            disabled={weatherState === "loading"}
            onClick={() => void refreshWeather()}
          >
            {weatherState === "loading" ? "Refreshing…" : "Refresh trip weather"}
          </button>
          <button
            type="button"
            className="trip-secondary-button"
            onClick={() => void copyShareLink()}
          >
            Copy share link
          </button>
          <button type="button" className="trip-secondary-button" onClick={exportMarkdown}>
            Download Markdown
          </button>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border/80 bg-white p-5 md:grid-cols-3">
        {TEMPLATES.map((template) => (
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

      <section className="trip-workspace-settings">
        <label>
          <span>Trip title</span>
          <input
            value={workspace.title}
            maxLength={120}
            onChange={(event) =>
              updateWorkspace((current) => ({ ...current, title: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Travel party</span>
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
          <span>Local-first storage</span>
          <strong>Saved automatically in this browser</strong>
          <small>No account required. Use a share link to move a copy to another device.</small>
        </div>
      </section>

      <section className="trip-summary-grid" aria-label="Trip weather summary">
        <div>
          <span>Trip length</span>
          <strong>{workspace.days.length} days</strong>
        </div>
        <div>
          <span>Forecast coverage</span>
          <strong>
            {summary.covered}/{workspace.days.length} days
          </strong>
        </div>
        <div>
          <span>Average suitability</span>
          <strong>{summary.average === null ? "—" : `${summary.average}/100`}</strong>
        </div>
        <div>
          <span>High-risk days</span>
          <strong>{summary.highRisk}</strong>
        </div>
      </section>

      {weatherUpdatedAt.length > 0 ? (
        <p className="text-xs text-muted">
          Weather data updated {new Date(weatherUpdatedAt).toLocaleString("en")} ·{" "}
          {weatherStale ? "Stale snapshot — refresh before making decisions" : "Current snapshot"}
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
          return (
            <DayEditor
              key={day.id}
              day={day}
              cities={cities}
              forecast={item?.forecast ?? null}
              decision={
                item?.decision ?? assessWorkspaceDay(day, null, workspace.partyProfile, "en")
              }
              canRemove={workspace.days.length > 1}
              onChange={(patch) => updateDay(index, patch)}
              onRemove={() => removeDay(index)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="trip-primary-button" onClick={addDay}>
          Add another day
        </button>
        <button type="button" className="trip-secondary-button" onClick={() => window.print()}>
          Print itinerary
        </button>
        <button type="button" className="trip-secondary-button" onClick={startBlank}>
          Start a blank trip
        </button>
      </div>
    </div>
  );
}
