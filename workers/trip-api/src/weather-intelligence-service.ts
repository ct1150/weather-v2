import { normalizeInviteEmail, resolveTripAccess, type TripAccessRole } from "./collaboration";
import {
  assessWeatherChange,
  type TripDayTheme,
  type TripPartyProfile,
  type TripWeatherObservation,
  type WeatherInsightReasonCode,
  type WeatherInsightSeverity,
  type WeatherRecommendationKind,
} from "./weather-intelligence";

const MAX_WEATHER_CITIES = 12;
const MAX_MONITORED_TRIPS_PER_RUN = 100;
const MONITOR_HORIZON_DAYS = 15;

export interface WeatherReadBinding {
  fetch(request: Request): Promise<Response>;
}

interface TripDayDocument {
  readonly id: string;
  readonly dayNumber: number;
  readonly date: string;
  readonly cityId: string;
  readonly cityName: string;
  readonly theme: TripDayTheme;
}

interface MonitorTrip {
  readonly id: string;
  readonly locale: "en" | "zh-cn" | "zh-hant";
  readonly partyProfile: TripPartyProfile;
  readonly days: ReadonlyArray<TripDayDocument>;
}

interface ForecastItem {
  readonly cityId: string;
  readonly date: string;
  readonly temperatureMinC: number | null;
  readonly temperatureMaxC: number | null;
  readonly precipitationMm: number | null;
  readonly rainProbability: number | null;
  readonly windSpeedKph: number | null;
  readonly windGustKph: number | null;
  readonly uvIndex: number | null;
}

interface WeatherForecastEnvelope {
  readonly data?: {
    readonly snapshotId?: string;
    readonly freshness?: { readonly dataUpdatedAt?: string };
    readonly items?: ReadonlyArray<ForecastItem>;
  };
}

interface ObservationRow {
  readonly weather_snapshot_id: string;
  readonly forecast_json: string;
  readonly observed_at: string;
}

interface InsightRow {
  readonly id: string;
  readonly day_id: string;
  readonly day_number: number;
  readonly city_id: string;
  readonly city_name: string;
  readonly local_date: string;
  readonly previous_weather_snapshot_id: string;
  readonly weather_snapshot_id: string;
  readonly severity: Exclude<WeatherInsightSeverity, "none">;
  readonly recommendation_kind: Exclude<WeatherRecommendationKind, "keep_plan">;
  readonly impact_score: number;
  readonly reason_codes_json: string;
  readonly previous_forecast_json: string;
  readonly current_forecast_json: string;
  readonly status: "open" | "converted";
  readonly decision_id: string | null;
  readonly created_at: string;
  readonly converted_at: string | null;
}

interface TripRow {
  readonly id: string;
  readonly locale: "en" | "zh-cn" | "zh-hant";
  readonly document_json: string;
}

export interface TripWeatherInsight {
  readonly id: string;
  readonly dayId: string;
  readonly dayNumber: number;
  readonly cityId: string;
  readonly cityName: string;
  readonly date: string;
  readonly previousSnapshotId: string;
  readonly snapshotId: string;
  readonly severity: Exclude<WeatherInsightSeverity, "none">;
  readonly recommendation: Exclude<WeatherRecommendationKind, "keep_plan">;
  readonly impactScore: number;
  readonly reasonCodes: ReadonlyArray<WeatherInsightReasonCode>;
  readonly previous: TripWeatherObservation;
  readonly current: TripWeatherObservation;
  readonly status: "open" | "converted";
  readonly decisionId: string | null;
  readonly createdAt: string;
  readonly convertedAt: string | null;
}

export interface WeatherRefreshReport {
  readonly tripId: string;
  readonly snapshotId: string | null;
  readonly baselinesCreated: number;
  readonly observationsCreated: number;
  readonly insightsCreated: number;
  readonly actionableInsightsCreated: number;
}

export interface WeatherMonitorReport {
  readonly tripsConsidered: number;
  readonly tripsRefreshed: number;
  readonly tripsFailed: number;
  readonly insightsCreated: number;
  readonly actionableInsightsCreated: number;
}

export type WeatherRefreshAccessResult =
  | { readonly kind: "ok"; readonly report: WeatherRefreshReport }
  | { readonly kind: "forbidden" }
  | { readonly kind: "missing" };

export type WeatherDecisionResult =
  | { readonly kind: "ok"; readonly decisionId: string; readonly existing: boolean }
  | { readonly kind: "forbidden" }
  | { readonly kind: "missing" };

function canWrite(role: TripAccessRole | null): boolean {
  return role === "owner" || role === "editor";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTheme(value: unknown): value is TripDayTheme {
  return value === "city" || value === "beach" || value === "outdoor" || value === "indoor";
}

function isParty(value: unknown): value is TripPartyProfile {
  return value === "adults" || value === "family" || value === "senior";
}

function parseTrip(row: TripRow): MonitorTrip | null {
  try {
    const raw = JSON.parse(row.document_json) as unknown;
    if (!isObject(raw) || !isParty(raw.partyProfile) || !Array.isArray(raw.days)) return null;
    const days: TripDayDocument[] = [];
    for (const candidate of raw.days) {
      if (!isObject(candidate)) continue;
      if (
        typeof candidate.id !== "string" ||
        typeof candidate.dayNumber !== "number" ||
        !Number.isInteger(candidate.dayNumber) ||
        typeof candidate.date !== "string" ||
        typeof candidate.cityId !== "string" ||
        candidate.cityId.length === 0 ||
        typeof candidate.cityName !== "string" ||
        !isTheme(candidate.theme)
      ) {
        continue;
      }
      days.push({
        id: candidate.id,
        dayNumber: candidate.dayNumber,
        date: candidate.date,
        cityId: candidate.cityId,
        cityName: candidate.cityName,
        theme: candidate.theme,
      });
    }
    return { id: row.id, locale: row.locale, partyProfile: raw.partyProfile, days };
  } catch {
    return null;
  }
}

function parseObservation(value: string): TripWeatherObservation | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isObject(parsed)) return null;
    return parsed as unknown as TripWeatherObservation;
  } catch {
    return null;
  }
}

function parseReasonCodes(value: string): ReadonlyArray<WeatherInsightReasonCode> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? (parsed as ReadonlyArray<WeatherInsightReasonCode>)
      : [];
  } catch {
    return [];
  }
}

function mapInsight(row: InsightRow): TripWeatherInsight | null {
  const previous = parseObservation(row.previous_forecast_json);
  const current = parseObservation(row.current_forecast_json);
  if (previous === null || current === null) return null;
  return {
    id: row.id,
    dayId: row.day_id,
    dayNumber: row.day_number,
    cityId: row.city_id,
    cityName: row.city_name,
    date: row.local_date,
    previousSnapshotId: row.previous_weather_snapshot_id,
    snapshotId: row.weather_snapshot_id,
    severity: row.severity,
    recommendation: row.recommendation_kind,
    impactScore: row.impact_score,
    reasonCodes: parseReasonCodes(row.reason_codes_json),
    previous,
    current,
    status: row.status,
    decisionId: row.decision_id,
    createdAt: row.created_at,
    convertedAt: row.converted_at,
  };
}

function chunk<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function forecastKey(cityId: string, date: string): string {
  return `${cityId}|${date}`;
}

function observationFromForecast(
  snapshotId: string,
  observedAt: string,
  item: ForecastItem,
): TripWeatherObservation {
  return {
    snapshotId,
    cityId: item.cityId,
    date: item.date,
    observedAt,
    rainProbability: item.rainProbability,
    precipitationMm: item.precipitationMm,
    temperatureMinC: item.temperatureMinC,
    temperatureMaxC: item.temperatureMaxC,
    windSpeedKph: item.windSpeedKph,
    windGustKph: item.windGustKph,
    uvIndex: item.uvIndex,
  };
}

async function readTripForMonitor(db: D1Database, tripId: string): Promise<MonitorTrip | null> {
  const row = await db
    .prepare(
      "SELECT id, locale, document_json FROM trips WHERE id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tripId)
    .first<TripRow>();
  return row === null ? null : parseTrip(row);
}

async function fetchForecasts(
  weatherRead: WeatherReadBinding,
  trip: MonitorTrip,
): Promise<{
  readonly snapshotId: string;
  readonly observedAt: string;
  readonly items: ReadonlyMap<string, ForecastItem>;
}> {
  if (trip.days.length === 0) throw new Error("NO_MONITORABLE_DAYS");
  const dates = trip.days.map((day) => day.date).sort();
  const from = dates[0]!;
  const to = dates.at(-1)!;
  const cities = [...new Set(trip.days.map((day) => day.cityId))].sort();
  const items = new Map<string, ForecastItem>();
  let snapshotId: string | null = null;
  let observedAt: string | null = null;

  for (const cityChunk of chunk(cities, MAX_WEATHER_CITIES)) {
    const query = new URLSearchParams({
      cityIds: cityChunk.join(","),
      from,
      to,
      locale: "en",
    });
    const response = await weatherRead.fetch(
      new Request(`https://weather-read.internal/api/v1/trip-forecast?${query.toString()}`),
    );
    if (!response.ok) throw new Error(`WEATHER_READ_${response.status}`);
    const payload = (await response.json()) as WeatherForecastEnvelope;
    const nextSnapshot = payload.data?.snapshotId;
    const nextObservedAt = payload.data?.freshness?.dataUpdatedAt;
    const nextItems = payload.data?.items;
    if (
      typeof nextSnapshot !== "string" ||
      typeof nextObservedAt !== "string" ||
      !Array.isArray(nextItems)
    ) {
      throw new Error("WEATHER_READ_INVALID_RESPONSE");
    }
    if (snapshotId !== null && snapshotId !== nextSnapshot) throw new Error("WEATHER_SNAPSHOT_CHANGED");
    snapshotId = nextSnapshot;
    observedAt = nextObservedAt;
    for (const item of nextItems) items.set(forecastKey(item.cityId, item.date), item);
  }

  if (snapshotId === null || observedAt === null) throw new Error("WEATHER_READ_EMPTY");
  return { snapshotId, observedAt, items };
}

async function latestObservation(
  db: D1Database,
  tripId: string,
  dayId: string,
): Promise<TripWeatherObservation | null> {
  const row = await db
    .prepare(
      "SELECT weather_snapshot_id, forecast_json, observed_at FROM trip_weather_observations " +
        "WHERE trip_id = ? AND day_id = ? ORDER BY observed_at DESC, id DESC LIMIT 1",
    )
    .bind(tripId, dayId)
    .first<ObservationRow>();
  if (row === null) return null;
  const parsed = parseObservation(row.forecast_json);
  return parsed === null ? null : { ...parsed, snapshotId: row.weather_snapshot_id, observedAt: row.observed_at };
}

async function persistObservation(
  db: D1Database,
  tripId: string,
  dayId: string,
  observation: TripWeatherObservation,
  createdAt: string,
): Promise<boolean> {
  const id = `weather_obs_${crypto.randomUUID().replaceAll("-", "")}`;
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO trip_weather_observations " +
        "(id, trip_id, day_id, city_id, local_date, weather_snapshot_id, forecast_json, observed_at, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      tripId,
      dayId,
      observation.cityId,
      observation.date,
      observation.snapshotId,
      JSON.stringify(observation),
      observation.observedAt,
      createdAt,
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

async function persistInsight(
  db: D1Database,
  trip: MonitorTrip,
  day: TripDayDocument,
  previous: TripWeatherObservation,
  current: TripWeatherObservation,
  assessment: ReturnType<typeof assessWeatherChange>,
  createdAt: string,
): Promise<boolean> {
  if (assessment.severity === "none" || assessment.recommendation === "keep_plan") return false;
  const id = `weather_insight_${crypto.randomUUID().replaceAll("-", "")}`;
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO trip_weather_insights " +
        "(id, trip_id, day_id, day_number, city_id, city_name, local_date, previous_weather_snapshot_id, weather_snapshot_id, " +
        "severity, recommendation_kind, impact_score, reason_codes_json, previous_forecast_json, current_forecast_json, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      trip.id,
      day.id,
      day.dayNumber,
      day.cityId,
      day.cityName,
      day.date,
      previous.snapshotId,
      current.snapshotId,
      assessment.severity,
      assessment.recommendation,
      assessment.impactScore,
      JSON.stringify(assessment.reasonCodes),
      JSON.stringify(previous),
      JSON.stringify(current),
      createdAt,
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function refreshTripWeatherInternal(
  db: D1Database,
  weatherRead: WeatherReadBinding,
  tripId: string,
  now = new Date(),
): Promise<WeatherRefreshReport> {
  const trip = await readTripForMonitor(db, tripId);
  if (trip === null) throw new Error("TRIP_NOT_MONITORABLE");
  const weather = await fetchForecasts(weatherRead, trip);
  let baselinesCreated = 0;
  let observationsCreated = 0;
  let insightsCreated = 0;
  let actionableInsightsCreated = 0;
  const createdAt = now.toISOString();

  for (const day of trip.days) {
    const item = weather.items.get(forecastKey(day.cityId, day.date));
    if (item === undefined) continue;
    const current = observationFromForecast(weather.snapshotId, weather.observedAt, item);
    const previous = await latestObservation(db, trip.id, day.id);
    const inserted = await persistObservation(db, trip.id, day.id, current, createdAt);
    if (!inserted) continue;
    observationsCreated += 1;
    if (previous === null) {
      baselinesCreated += 1;
      continue;
    }
    if (previous.snapshotId === current.snapshotId) continue;
    const assessment = assessWeatherChange({
      previous,
      current,
      theme: day.theme,
      partyProfile: trip.partyProfile,
    });
    if (await persistInsight(db, trip, day, previous, current, assessment, createdAt)) {
      insightsCreated += 1;
      if (assessment.severity === "action") actionableInsightsCreated += 1;
    }
  }

  return {
    tripId,
    snapshotId: weather.snapshotId,
    baselinesCreated,
    observationsCreated,
    insightsCreated,
    actionableInsightsCreated,
  };
}

export async function refreshTripWeather(
  db: D1Database,
  weatherRead: WeatherReadBinding,
  userId: string,
  tripId: string,
  now = new Date(),
): Promise<WeatherRefreshAccessResult> {
  const access = await resolveTripAccess(db, userId, tripId);
  if (access === null) return { kind: "missing" };
  if (!canWrite(access)) return { kind: "forbidden" };
  return { kind: "ok", report: await refreshTripWeatherInternal(db, weatherRead, tripId, now) };
}

export async function listTripWeatherInsights(
  db: D1Database,
  userId: string,
  tripId: string,
  limit = 50,
): Promise<ReadonlyArray<TripWeatherInsight> | null> {
  if ((await resolveTripAccess(db, userId, tripId)) === null) return null;
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const result = await db
    .prepare(
      "SELECT id, day_id, day_number, city_id, city_name, local_date, previous_weather_snapshot_id, weather_snapshot_id, " +
        "severity, recommendation_kind, impact_score, reason_codes_json, previous_forecast_json, current_forecast_json, " +
        "status, decision_id, created_at, converted_at FROM trip_weather_insights " +
        "WHERE trip_id = ? ORDER BY CASE severity WHEN 'action' THEN 0 ELSE 1 END, created_at DESC, id DESC LIMIT ?",
    )
    .bind(tripId, safeLimit)
    .all<InsightRow>();
  return result.results.map(mapInsight).filter((item): item is TripWeatherInsight => item !== null);
}

function decisionCopy(
  locale: MonitorTrip["locale"],
  insight: InsightRow,
  reasons: ReadonlyArray<WeatherInsightReasonCode>,
): { readonly title: string; readonly detail: string } {
  const reasonText = reasons.join(", ");
  if (locale === "zh-cn") {
    return {
      title: `天气调整：D${insight.day_number} ${insight.city_name}`,
      detail: `天气预报出现显著恶化（影响分 ${insight.impact_score}）。原因：${reasonText}。建议：${
        insight.recommendation_kind === "activate_plan_b" ? "启用 Plan B" : "调整游玩时段"
      }。`,
    };
  }
  if (locale === "zh-hant") {
    return {
      title: `天氣調整：D${insight.day_number} ${insight.city_name}`,
      detail: `天氣預報出現顯著惡化（影響分 ${insight.impact_score}）。原因：${reasonText}。建議：${
        insight.recommendation_kind === "activate_plan_b" ? "啟用 Plan B" : "調整遊玩時段"
      }。`,
    };
  }
  return {
    title: `Weather adjustment: D${insight.day_number} ${insight.city_name}`,
    detail: `The forecast deteriorated materially (impact ${insight.impact_score}). Reasons: ${reasonText}. Recommendation: ${
      insight.recommendation_kind === "activate_plan_b" ? "activate Plan B" : "adjust timing"
    }.`,
  };
}

export async function convertWeatherInsightToDecision(
  db: D1Database,
  userId: string,
  email: string,
  tripId: string,
  insightId: string,
  now = new Date().toISOString(),
): Promise<WeatherDecisionResult> {
  const access = await resolveTripAccess(db, userId, tripId);
  if (access === null) return { kind: "missing" };
  if (!canWrite(access)) return { kind: "forbidden" };
  const row = await db
    .prepare(
      "SELECT i.id, i.day_id, i.day_number, i.city_id, i.city_name, i.local_date, i.previous_weather_snapshot_id, " +
        "i.weather_snapshot_id, i.severity, i.recommendation_kind, i.impact_score, i.reason_codes_json, " +
        "i.previous_forecast_json, i.current_forecast_json, i.status, i.decision_id, i.created_at, i.converted_at, t.locale " +
        "FROM trip_weather_insights i JOIN trips t ON t.id = i.trip_id " +
        "WHERE i.id = ? AND i.trip_id = ? LIMIT 1",
    )
    .bind(insightId, tripId)
    .first<InsightRow & { readonly locale: MonitorTrip["locale"] }>();
  if (row === null) return { kind: "missing" };
  if (row.status === "converted" && row.decision_id !== null) {
    return { kind: "ok", decisionId: row.decision_id, existing: true };
  }

  const decisionId = `decision_weather_${insightId.replace(/^weather_insight_/u, "")}`;
  const activityId = `act_weather_${insightId.replace(/^weather_insight_/u, "")}`;
  const normalizedEmail = normalizeInviteEmail(email);
  const copy = decisionCopy(row.locale, row, parseReasonCodes(row.reason_codes_json));
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO trip_decisions " +
          "(id, trip_id, created_by_user_id, created_by_email_normalized, title, detail, day_id, status, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
      )
      .bind(decisionId, tripId, userId, normalizedEmail, copy.title, copy.detail, row.day_id, now, now),
    db
      .prepare(
        "UPDATE trip_weather_insights SET status = 'converted', decision_id = ?, converted_at = ? " +
          "WHERE id = ? AND trip_id = ? AND status = 'open'",
      )
      .bind(decisionId, now, insightId, tripId),
    db
      .prepare(
        "INSERT OR IGNORE INTO trip_activity " +
          "(id, trip_id, actor_user_id, actor_email_normalized, kind, payload_json, created_at) " +
          "VALUES (?, ?, ?, ?, 'decision_created', ?, ?)",
      )
      .bind(
        activityId,
        tripId,
        userId,
        normalizedEmail,
        JSON.stringify({ decisionId, title: copy.title, dayId: row.day_id, source: "weather_insight", insightId }),
        now,
      ),
  ]);
  return { kind: "ok", decisionId, existing: false };
}

export async function runScheduledWeatherMonitor(
  db: D1Database,
  weatherRead: WeatherReadBinding,
  now = new Date(),
): Promise<WeatherMonitorReport> {
  const today = utcDate(now);
  const horizonEnd = addDays(today, MONITOR_HORIZON_DAYS);
  const result = await db
    .prepare(
      "SELECT id FROM trips WHERE status = 'active' AND deleted_at IS NULL " +
        "AND end_date >= ? AND start_date <= ? ORDER BY start_date ASC, updated_at DESC LIMIT ?",
    )
    .bind(today, horizonEnd, MAX_MONITORED_TRIPS_PER_RUN)
    .all<{ readonly id: string }>();
  let tripsRefreshed = 0;
  let tripsFailed = 0;
  let insightsCreated = 0;
  let actionableInsightsCreated = 0;

  for (const trip of result.results) {
    try {
      const report = await refreshTripWeatherInternal(db, weatherRead, trip.id, now);
      tripsRefreshed += 1;
      insightsCreated += report.insightsCreated;
      actionableInsightsCreated += report.actionableInsightsCreated;
    } catch (error) {
      tripsFailed += 1;
      console.error(
        JSON.stringify({
          service: "trip-api",
          event: "weather_monitor_trip_failed",
          tripId: trip.id,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }

  return {
    tripsConsidered: result.results.length,
    tripsRefreshed,
    tripsFailed,
    insightsCreated,
    actionableInsightsCreated,
  };
}
