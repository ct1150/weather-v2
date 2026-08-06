import { createWeatherProvider } from "@wnr/weather";
import type { NormalizedDaily, NormalizedHourly, WeatherProvider } from "@wnr/weather";
import { resolveProviderName } from "@wnr/config";
import { assessActivityWeather } from "../trips/weather-score";
import { qingganFamilyTrip } from "../trips/qinggan-family-2026";
import type {
  ResolvedTripActivity,
  ResolvedTripDay,
  ResolvedTripPlan,
  TripActivity,
  TripPlace,
  TripRiskLevel,
  WeatherWindowSnapshot,
} from "../trips/types";

function hourOf(time: string | undefined, fallback: number): number {
  if (time === undefined) return fallback;
  const hour = Number(time.slice(0, 2));
  return Number.isFinite(hour) ? hour : fallback;
}

function mean(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: ReadonlyArray<number>): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

function min(values: ReadonlyArray<number>): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

function numbers(
  rows: ReadonlyArray<NormalizedHourly>,
  selector: (row: NormalizedHourly) => number | null,
): number[] {
  return rows.map(selector).filter((value): value is number => value !== null);
}

function conditionLabel(code: number | null): string {
  if (code === null) return "天气待确认";
  if (code === 0) return "晴";
  if (code <= 2) return "晴间多云";
  if (code === 3) return "多云";
  if (code <= 48) return "雾";
  if (code <= 57) return "毛毛雨";
  if (code <= 67) return "降雨";
  if (code <= 77) return "降雪";
  if (code <= 82) return "阵雨";
  if (code <= 86) return "阵雪";
  return "雷雨";
}

function windowRows(day: NormalizedDaily, activity: TripActivity): ReadonlyArray<NormalizedHourly> {
  const startHour = hourOf(activity.startTime, 0);
  const endHour = hourOf(activity.endTime, Math.min(23, startHour + 2));
  const rows = day.hourly.filter((row) => {
    const hour = Number(row.localTime.slice(11, 13));
    return Number.isFinite(hour) && hour >= startHour && hour <= endHour;
  });
  return rows.length > 0 ? rows : day.hourly;
}

function liveSnapshot(day: NormalizedDaily, activity: TripActivity): WeatherWindowSnapshot {
  const rows = windowRows(day, activity);
  const temperature = numbers(rows, (row) => row.temperatureC);
  const rain = numbers(rows, (row) => row.precipitationProbability);
  const precipitation = numbers(rows, (row) => row.precipitationMm);
  const wind = numbers(rows, (row) => row.windSpeedKph);
  const gust = numbers(rows, (row) => row.windGustKph);
  const cloud = numbers(rows, (row) => row.cloudCover);
  const visibility = numbers(rows, (row) => row.visibilityM);
  const uv = numbers(rows, (row) => row.uvIndex);
  const weatherCodes = rows
    .map((row) => row.weatherCode)
    .filter((value): value is number => value !== null);

  return {
    source: "open-meteo",
    updatedAt: new Date().toISOString(),
    condition: conditionLabel(max(weatherCodes)),
    temperatureMinC: min(temperature) ?? day.tempMinC,
    temperatureMaxC: max(temperature) ?? day.tempMaxC,
    rainProbability: max(rain) ?? day.precipitationProbabilityMax,
    precipitationMm:
      precipitation.length > 0
        ? Math.round(precipitation.reduce((sum, value) => sum + value, 0) * 10) / 10
        : day.precipitationMm,
    windSpeedKph: max(wind) ?? day.windSpeedMaxKph,
    windGustKph: max(gust) ?? day.windGustMaxKph,
    cloudCover: mean(cloud) ?? day.cloudCoverMean,
    visibilityM: mean(visibility) ?? day.visibilityMeanM,
    uvIndex: max(uv) ?? day.uvIndexMax,
    sunrise: day.sunriseLocal,
    sunset: day.sunsetLocal,
  };
}

async function fetchDay(
  provider: WeatherProvider,
  place: TripPlace,
  date: string,
): Promise<NormalizedDaily | null> {
  try {
    const forecasts = await provider.fetchForecast({
      cityId: `${place.id}-${date}`,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
      days: 1,
      startDate: date,
    });
    return forecasts[0]?.days[0] ?? null;
  } catch {
    return null;
  }
}

function dayRisk(score: number): TripRiskLevel {
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  return "high";
}

let qingganTripPromise: Promise<ResolvedTripPlan> | null = null;

async function buildQingganTripViewModel(): Promise<ResolvedTripPlan> {
  const providerName = resolveProviderName(process.env.WEATHER_PRIMARY_PROVIDER);
  const liveEnabled =
    process.env.NODE_ENV !== "test" && providerName !== "fake" && providerName !== "weatherapi";
  const provider = liveEnabled ? createWeatherProvider("open-meteo") : null;
  const cacheByPlaceDate = new Map<string, Promise<NormalizedDaily | null>>();

  async function resolveActivity(
    date: string,
    activity: TripActivity,
  ): Promise<ResolvedTripActivity> {
    let weather: WeatherWindowSnapshot | null = activity.fallbackSnapshot ?? null;
    if (provider !== null && activity.place !== undefined) {
      const key = `${activity.place.id}:${date}`;
      let dayPromise = cacheByPlaceDate.get(key);
      if (dayPromise === undefined) {
        dayPromise = fetchDay(provider, activity.place, date);
        cacheByPlaceDate.set(key, dayPromise);
      }
      const day = await dayPromise;
      if (day !== null) weather = liveSnapshot(day, activity);
    }
    return {
      ...activity,
      weather,
      assessment: assessActivityWeather(activity.weatherProfile, weather),
    };
  }

  const days: ResolvedTripDay[] = [];
  for (const day of qingganFamilyTrip.days) {
    const activities = await Promise.all(
      day.activities.map(async (activity) => resolveActivity(day.date, activity)),
    );
    const decisionActivities = activities.filter(
      (activity) => activity.weatherProfile !== "indoor",
    );
    const scored = decisionActivities.length > 0 ? decisionActivities : activities;
    const weatherScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, activity) => sum + activity.assessment.score, 0) / scored.length,
          )
        : 55;
    const mostAtRisk = [...activities].sort(
      (left, right) => left.assessment.score - right.assessment.score,
    )[0];
    days.push({
      ...day,
      activities,
      weatherScore,
      riskLevel: dayRisk(weatherScore),
      primaryWeatherSummary:
        mostAtRisk === undefined
          ? "天气数据待确认"
          : `${mostAtRisk.name}：${mostAtRisk.assessment.summary}`,
    });
  }

  const liveCount = days
    .flatMap((day) => day.activities)
    .filter((activity) => activity.weather?.source === "open-meteo").length;

  return {
    ...qingganFamilyTrip,
    days,
    weatherUpdatedAt: new Date().toISOString(),
    liveWeatherEnabled: liveCount > 0,
  };
}

export function getQingganTripViewModel(): Promise<ResolvedTripPlan> {
  if (qingganTripPromise !== null) return qingganTripPromise;
  qingganTripPromise = buildQingganTripViewModel();
  return qingganTripPromise;
}
