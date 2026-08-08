PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trip_weather_observations (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  day_id TEXT NOT NULL,
  city_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  weather_snapshot_id TEXT NOT NULL,
  forecast_json TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  UNIQUE (trip_id, day_id, weather_snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_weather_observations_latest
  ON trip_weather_observations(trip_id, day_id, observed_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS trip_weather_insights (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  day_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  city_id TEXT NOT NULL,
  city_name TEXT NOT NULL,
  local_date TEXT NOT NULL,
  previous_weather_snapshot_id TEXT NOT NULL,
  weather_snapshot_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('watch', 'action')),
  recommendation_kind TEXT NOT NULL CHECK (recommendation_kind IN ('adjust_timing', 'activate_plan_b')),
  impact_score INTEGER NOT NULL CHECK (impact_score >= 0 AND impact_score <= 100),
  reason_codes_json TEXT NOT NULL,
  previous_forecast_json TEXT NOT NULL,
  current_forecast_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'converted')),
  decision_id TEXT,
  created_at TEXT NOT NULL,
  converted_at TEXT,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (decision_id) REFERENCES trip_decisions(id) ON DELETE SET NULL,
  UNIQUE (trip_id, day_id, weather_snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_weather_insights_trip_created
  ON trip_weather_insights(trip_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_trip_weather_insights_open
  ON trip_weather_insights(trip_id, status, severity, created_at DESC);
