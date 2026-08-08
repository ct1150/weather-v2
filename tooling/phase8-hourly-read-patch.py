from pathlib import Path

path = Path("workers/weather-read/src/index.ts")
text = path.read_text()

text = text.replace(
    'const MAX_TRIP_CITIES = 12;\nconst MAX_TRIP_RANGE_DAYS = 16;',
    'const MAX_TRIP_CITIES = 12;\nconst MAX_TRIP_HOURLY_CITIES = 4;\nconst MAX_TRIP_RANGE_DAYS = 16;',
    1,
)

forecast_interface = '''interface TripForecastRow {
  readonly city_id: string;
  readonly local_date: string;
  readonly weather_code: number | null;
  readonly temp_min_c: number | null;
  readonly temp_max_c: number | null;
  readonly precipitation_mm: number | null;
  readonly precipitation_probability_max: number | null;
  readonly wind_speed_max_kph: number | null;
  readonly wind_gust_max_kph: number | null;
  readonly uv_index_max: number | null;
  readonly cloud_cover_mean: number | null;
  readonly visibility_mean_m: number | null;
  readonly sunrise_local: string | null;
  readonly sunset_local: string | null;
  readonly data_quality: string;
}
'''
hourly_interface = forecast_interface + '''
interface TripHourlyRow {
  readonly city_id: string;
  readonly local_time: string;
  readonly weather_code: number | null;
  readonly temperature_c: number | null;
  readonly apparent_temperature_c: number | null;
  readonly precipitation_mm: number | null;
  readonly precipitation_probability: number | null;
  readonly humidity: number | null;
  readonly wind_speed_kph: number | null;
  readonly wind_gust_kph: number | null;
  readonly uv_index: number | null;
  readonly cloud_cover: number | null;
  readonly visibility_m: number | null;
  readonly data_quality: string;
}
'''
if forecast_interface not in text:
    raise SystemExit("TripForecastRow anchor changed unexpectedly")
text = text.replace(forecast_interface, hourly_interface, 1)

text = text.replace(
    'function parseCityIds(url: URL): ReadonlyArray<string> | null {',
    'function parseCityIds(\n  url: URL,\n  maxCities = MAX_TRIP_CITIES,\n): ReadonlyArray<string> | null {',
    1,
)
text = text.replace('values.length > MAX_TRIP_CITIES ||', 'values.length > maxCities ||', 1)

range_anchor = '''function rangeDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}
'''
range_insert = range_anchor + '''
function parseHour(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^\\d{1,2}$/u.test(value)) return null;
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function localHour(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:00`;
}
'''
if range_anchor not in text:
    raise SystemExit("rangeDays anchor changed unexpectedly")
text = text.replace(range_anchor, range_insert, 1)

forecast_reader_end = '''  return result.results;
}

async function handleRanking'''
hourly_reader = '''  return result.results;
}

async function readTripHourly(
  db: D1DatabaseLike,
  publication: ActivePublicationRow,
  cityIds: ReadonlyArray<string>,
  date: string,
  startHour: number,
  endHour: number,
): Promise<ReadonlyArray<TripHourlyRow>> {
  const placeholders = cityIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      "SELECT h.city_id, h.local_time, h.weather_code, h.temperature_c, " +
        "h.apparent_temperature_c, h.precipitation_mm, h.precipitation_probability, " +
        "h.humidity, h.wind_speed_kph, h.wind_gust_kph, h.uv_index, h.cloud_cover, " +
        "h.visibility_m, h.data_quality FROM weather_hourly h " +
        `WHERE h.snapshot_id = ? AND h.city_id IN (${placeholders}) ` +
        "AND h.local_time >= ? AND h.local_time <= ? " +
        "ORDER BY h.local_time ASC, h.city_id ASC",
    )
    .bind(
      publication.snapshot_id,
      ...cityIds,
      localHour(date, startHour),
      localHour(date, endHour),
    )
    .all<TripHourlyRow>();
  return result.results;
}

async function handleRanking'''
if forecast_reader_end not in text:
    raise SystemExit("readTripForecast ending anchor changed unexpectedly")
text = text.replace(forecast_reader_end, hourly_reader, 1)

handler_anchor = '''async function handleTripForecast(url: URL, env: WorkerEnv, now: Date): Promise<Response> {'''
hourly_handler = '''async function handleTripHourly(url: URL, env: WorkerEnv, now: Date): Promise<Response> {
  const locale = parseLocale(url);
  if (locale === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "locale" } }, 400, env);
  const cityIds = parseCityIds(url, MAX_TRIP_HOURLY_CITIES);
  if (cityIds === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "cityIds" } }, 400, env);
  const date = url.searchParams.get("date") ?? "";
  if (!isIsoDate(date))
    return json({ error: { code: "INVALID_PARAMETER", field: "date" } }, 400, env);
  const startHour = parseHour(url.searchParams.get("startHour"), 0);
  const endHour = parseHour(url.searchParams.get("endHour"), 23);
  if (startHour === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "startHour" } }, 400, env);
  if (endHour === null)
    return json({ error: { code: "INVALID_PARAMETER", field: "endHour" } }, 400, env);
  if (endHour < startHour)
    return json({ error: { code: "INVALID_PARAMETER", field: "hourWindow" } }, 400, env);

  const publication = await readActivePublication(env.DB);
  if (publication === null) return json({ error: { code: "DATA_UNAVAILABLE" } }, 503, env);
  const hourly = await readTripHourly(env.DB, publication, cityIds, date, startHour, endHour);
  const availableSet = new Set(hourly.map((item) => item.city_id));
  const availableCityIds = cityIds.filter((cityId) => availableSet.has(cityId));
  const unavailableCityIds = cityIds.filter((cityId) => !availableSet.has(cityId));
  const stale = isStale(publication.published_at, now);

  return json(
    {
      data: {
        snapshotId: publication.snapshot_id,
        locale,
        date,
        startHour,
        endHour,
        requestedCityIds: cityIds,
        freshness: { dataUpdatedAt: publication.published_at, stale },
        coverage: { availableCityIds, unavailableCityIds },
        items: hourly.map((item) => ({
          cityId: item.city_id,
          localTime: item.local_time,
          weatherCode: item.weather_code,
          condition: weatherCondition(item.weather_code, locale),
          temperatureC: item.temperature_c,
          apparentTemperatureC: item.apparent_temperature_c,
          precipitationMm: item.precipitation_mm,
          rainProbability: item.precipitation_probability,
          humidity: item.humidity,
          windSpeedKph: item.wind_speed_kph,
          windGustKph: item.wind_gust_kph,
          uvIndex: item.uv_index,
          cloudCover: item.cloud_cover,
          visibilityM: item.visibility_m,
          dataQuality: item.data_quality,
        })),
      },
      meta: { generatedAt: now.toISOString(), dataUpdatedAt: publication.published_at, stale },
    },
    200,
    env,
  );
}

async function handleTripForecast(url: URL, env: WorkerEnv, now: Date): Promise<Response> {'''
if handler_anchor not in text:
    raise SystemExit("handleTripForecast anchor changed unexpectedly")
text = text.replace(handler_anchor, hourly_handler, 1)

route_anchor = '''  if (url.pathname === "/api/v1/trip-cities") return handleTripCities(url, env, now);
  if (url.pathname === "/api/v1/trip-forecast") return handleTripForecast(url, env, now);'''
route_new = '''  if (url.pathname === "/api/v1/trip-cities") return handleTripCities(url, env, now);
  if (url.pathname === "/api/v1/trip-hourly") return handleTripHourly(url, env, now);
  if (url.pathname === "/api/v1/trip-forecast") return handleTripForecast(url, env, now);'''
if route_anchor not in text:
    raise SystemExit("weather-read route anchor changed unexpectedly")
text = text.replace(route_anchor, route_new, 1)

path.write_text(text)
