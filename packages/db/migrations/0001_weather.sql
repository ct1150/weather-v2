-- Migration 0001 — Where Not Rain initial schema.
--
-- Ordered forward migration: canonical geography, snapshot-versioned weather and the
-- immutable publication contract, scores/rankings, activity suitability, bounded
-- relationships and commercial surfaces, operational/analytics/flag/SEO registries, and
-- the hot-path indexes.
--
-- This is the single authoritative DDL for the MVP. Production startup applies it in
-- preview first; it never performs destructive automatic migration (DATA-MIGRATION-001).
-- All timestamps are UTC ISO-8601 strings; storage uses SI/metric values.

-- ---------------------------------------------------------------------------
-- Canonical geography and localized content (DATA-GEOGRAPHY-001)
-- ---------------------------------------------------------------------------
CREATE TABLE countries (
  id TEXT PRIMARY KEY,
  iso2 TEXT NOT NULL UNIQUE,
  iso3 TEXT NOT NULL UNIQUE,
  default_timezone TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE country_translations (
  country_id TEXT NOT NULL REFERENCES countries(id),
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  PRIMARY KEY (country_id, locale)
);

CREATE TABLE cities (
  id TEXT PRIMARY KEY,
  country_id TEXT NOT NULL REFERENCES countries(id),
  slug TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timezone TEXT NOT NULL,
  population INTEGER,
  elevation_m REAL,
  is_featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  search_weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (country_id, slug)
);

CREATE TABLE city_translations (
  city_id TEXT NOT NULL REFERENCES cities(id),
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  seo_title TEXT,
  seo_description TEXT,
  PRIMARY KEY (city_id, locale)
);

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  author_id TEXT,
  reviewer_id TEXT,
  published_at TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE article_translations (
  article_id TEXT NOT NULL REFERENCES articles(id),
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  PRIMARY KEY (article_id, locale)
);

CREATE TABLE article_city_links (
  article_id TEXT NOT NULL REFERENCES articles(id),
  city_id TEXT NOT NULL REFERENCES cities(id),
  rank INTEGER NOT NULL,
  PRIMARY KEY (article_id, city_id)
);

-- ---------------------------------------------------------------------------
-- Snapshot-versioned weather and immutable publication contract (DATA-WEATHER-001)
-- ---------------------------------------------------------------------------
CREATE TABLE weather_snapshots (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'superseded', 'failed')),
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE weather_publication_state (
  state_key TEXT PRIMARY KEY CHECK (state_key = 'weather'),
  bootstrapped INTEGER NOT NULL DEFAULT 0 CHECK (bootstrapped IN (0, 1)),
  updated_at TEXT NOT NULL
);

INSERT INTO weather_publication_state (state_key, bootstrapped, updated_at)
VALUES ('weather', 0, '1970-01-01T00:00:00Z');

CREATE TABLE active_weather_snapshot (
  pointer_key TEXT PRIMARY KEY CHECK (pointer_key = 'weather'),
  snapshot_id TEXT NOT NULL UNIQUE REFERENCES weather_snapshots(id),
  ranking_version TEXT NOT NULL,
  model_version TEXT NOT NULL,
  publication_fencing_token INTEGER NOT NULL CHECK (publication_fencing_token > 0),
  published_at TEXT NOT NULL,
  activated_at TEXT NOT NULL
);

CREATE TABLE weather_daily (
  snapshot_id TEXT NOT NULL REFERENCES weather_snapshots(id),
  city_id TEXT NOT NULL REFERENCES cities(id),
  local_date TEXT NOT NULL,
  weather_code INTEGER,
  temp_min_c REAL,
  temp_max_c REAL,
  apparent_min_c REAL,
  apparent_max_c REAL,
  precipitation_mm REAL,
  precipitation_probability_max INTEGER,
  humidity_mean INTEGER,
  wind_speed_max_kph REAL,
  wind_gust_max_kph REAL,
  uv_index_max REAL,
  cloud_cover_mean INTEGER,
  visibility_mean_m REAL,
  sunrise_local TEXT,
  sunset_local TEXT,
  data_quality TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, city_id, local_date)
);

CREATE TABLE weather_hourly (
  snapshot_id TEXT NOT NULL REFERENCES weather_snapshots(id),
  city_id TEXT NOT NULL REFERENCES cities(id),
  local_time TEXT NOT NULL,
  weather_code INTEGER,
  temperature_c REAL,
  apparent_temperature_c REAL,
  precipitation_mm REAL,
  precipitation_probability INTEGER,
  humidity INTEGER,
  wind_speed_kph REAL,
  wind_gust_kph REAL,
  uv_index REAL,
  cloud_cover INTEGER,
  visibility_m REAL,
  data_quality TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, city_id, local_time)
);

CREATE TRIGGER trg_weather_publication_state_no_delete
BEFORE DELETE ON weather_publication_state
BEGIN
  SELECT RAISE(ABORT, 'weather publication state is permanent');
END;

CREATE TRIGGER trg_weather_publication_state_irreversible
BEFORE UPDATE OF state_key, bootstrapped ON weather_publication_state
WHEN NEW.state_key <> 'weather'
  OR (OLD.bootstrapped = 1 AND NEW.bootstrapped <> 1)
BEGIN
  SELECT RAISE(ABORT, 'weather bootstrap state is irreversible');
END;

CREATE TRIGGER trg_weather_publication_bootstrap_requires_pointer
BEFORE UPDATE OF bootstrapped ON weather_publication_state
WHEN OLD.bootstrapped = 0
 AND NEW.bootstrapped = 1
 AND (
   SELECT COUNT(*)
   FROM active_weather_snapshot p
   JOIN weather_snapshots s ON s.id = p.snapshot_id AND s.status = 'active'
   WHERE p.pointer_key = 'weather'
 ) <> 1
BEGIN
  SELECT RAISE(ABORT, 'bootstrap requires one active weather pointer');
END;

CREATE TRIGGER trg_active_weather_pointer_insert
BEFORE INSERT ON active_weather_snapshot
WHEN NOT EXISTS (
  SELECT 1 FROM weather_snapshots
  WHERE id = NEW.snapshot_id AND status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'active weather pointer requires active snapshot');
END;

CREATE TRIGGER trg_active_weather_pointer_update
BEFORE UPDATE OF snapshot_id ON active_weather_snapshot
WHEN NOT EXISTS (
  SELECT 1 FROM weather_snapshots
  WHERE id = NEW.snapshot_id AND status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'active weather pointer requires active snapshot');
END;

CREATE TRIGGER trg_active_weather_pointer_no_postbootstrap_delete
BEFORE DELETE ON active_weather_snapshot
WHEN (SELECT bootstrapped FROM weather_publication_state WHERE state_key = 'weather') = 1
BEGIN
  SELECT RAISE(ABORT, 'post-bootstrap weather pointer cannot be deleted');
END;

-- ---------------------------------------------------------------------------
-- Deterministic versioned Travel Score (DATA-SCORE-001)
-- ---------------------------------------------------------------------------
CREATE TABLE city_theme_attributes (
  city_id TEXT NOT NULL REFERENCES cities(id),
  attribute_type TEXT NOT NULL CHECK (
    attribute_type IN ('beach_water', 'beach_season', 'food_trip', 'shopping')
  ),
  value INTEGER NOT NULL CHECK (value BETWEEN 0 AND 100),
  source_url TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (city_id, attribute_type)
);

CREATE TABLE weather_alert_snapshots (
  id TEXT PRIMARY KEY,
  weather_snapshot_id TEXT NOT NULL REFERENCES weather_snapshots(id),
  captured_at TEXT NOT NULL,
  source_range_start TEXT NOT NULL,
  source_range_end TEXT NOT NULL,
  checksum TEXT NOT NULL
);

CREATE TABLE weather_alerts (
  alert_snapshot_id TEXT NOT NULL REFERENCES weather_alert_snapshots(id),
  alert_id TEXT NOT NULL,
  city_id TEXT NOT NULL REFERENCES cities(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('storm', 'typhoon')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
  effective_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  PRIMARY KEY (alert_snapshot_id, alert_id, city_id)
);

CREATE TABLE city_scores (
  snapshot_id TEXT NOT NULL REFERENCES weather_snapshots(id),
  alert_snapshot_id TEXT NOT NULL REFERENCES weather_alert_snapshots(id),
  city_id TEXT NOT NULL REFERENCES cities(id),
  anchor_local_date TEXT NOT NULL,
  window TEXT NOT NULL,
  as_of TEXT NOT NULL,
  included_dates_json TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('hourly', 'daily', 'mixed')),
  source_row_keys_json TEXT NOT NULL,
  source_start TEXT NOT NULL,
  source_end TEXT NOT NULL,
  travel_score INTEGER NOT NULL,
  rain_score INTEGER,
  outdoor_score INTEGER,
  beach_score INTEGER,
  walking_score INTEGER,
  hiking_score INTEGER,
  camping_score INTEGER,
  family_score INTEGER,
  photography_score INTEGER,
  night_view_score INTEGER,
  food_trip_score INTEGER,
  shopping_score INTEGER,
  confidence REAL NOT NULL,
  reason_codes_json TEXT NOT NULL,
  score_model_version TEXT NOT NULL,
  hazard_model_version TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, city_id, anchor_local_date, window)
);

CREATE TABLE ranking_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES weather_snapshots(id),
  ranking_version TEXT NOT NULL,
  theme TEXT NOT NULL,
  time_window TEXT NOT NULL,
  region_key TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  model_version TEXT NOT NULL,
  UNIQUE (snapshot_id, ranking_version, theme, time_window, region_key)
);

CREATE TABLE ranking_entries (
  ranking_id TEXT NOT NULL REFERENCES ranking_snapshots(id),
  city_id TEXT NOT NULL REFERENCES cities(id),
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  reason_codes_json TEXT NOT NULL,
  PRIMARY KEY (ranking_id, city_id)
);

-- ---------------------------------------------------------------------------
-- Theme Park and Mountain suitability (DATA-ACTIVITY-001)
-- ---------------------------------------------------------------------------
CREATE TABLE activity_destinations (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES cities(id),
  activity_type TEXT NOT NULL,
  availability_status TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  season_start TEXT,
  season_end TEXT,
  is_seasonal INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE activity_scores (
  snapshot_id TEXT NOT NULL REFERENCES weather_snapshots(id),
  alert_snapshot_id TEXT NOT NULL REFERENCES weather_alert_snapshots(id),
  activity_destination_id TEXT NOT NULL REFERENCES activity_destinations(id),
  city_id TEXT NOT NULL REFERENCES cities(id),
  anchor_local_date TEXT NOT NULL,
  window TEXT NOT NULL,
  as_of TEXT NOT NULL,
  included_dates_json TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('hourly', 'daily', 'mixed')),
  source_row_keys_json TEXT NOT NULL,
  source_start TEXT NOT NULL,
  source_end TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  score INTEGER NOT NULL,
  weather_confidence REAL NOT NULL,
  destination_confidence REAL NOT NULL,
  combined_confidence REAL NOT NULL,
  reason_codes_json TEXT NOT NULL,
  model_version TEXT NOT NULL,
  hazard_model_version TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  PRIMARY KEY (
    snapshot_id,
    activity_destination_id,
    anchor_local_date,
    window,
    activity_type
  )
);

-- ---------------------------------------------------------------------------
-- Bounded destination and commercial relationships (DATA-RELATIONSHIP-001)
-- ---------------------------------------------------------------------------
CREATE TABLE city_relationships (
  city_id TEXT NOT NULL REFERENCES cities(id),
  related_city_id TEXT NOT NULL REFERENCES cities(id),
  relation_type TEXT NOT NULL,
  rank INTEGER NOT NULL,
  PRIMARY KEY (city_id, related_city_id, relation_type)
);

CREATE TABLE affiliate_providers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  whitelist_host TEXT NOT NULL
);

CREATE TABLE affiliate_offers (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES affiliate_providers(id),
  city_id TEXT REFERENCES cities(id),
  target_url TEXT NOT NULL,
  label TEXT NOT NULL,
  amount REAL,
  currency TEXT,
  fetched_at TEXT,
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Operational, analytics, flag, and SEO registry (DATA-OPERATIONS-001)
-- ---------------------------------------------------------------------------
CREATE TABLE sync_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_switched INTEGER NOT NULL DEFAULT 0,
  switch_reason TEXT,
  enabled_cities_at_start INTEGER NOT NULL,
  featured_cities_at_start INTEGER NOT NULL,
  cities_valid_7day INTEGER NOT NULL DEFAULT 0,
  featured_cities_valid_7day INTEGER NOT NULL DEFAULT 0,
  cities_ok INTEGER NOT NULL DEFAULT 0,
  cities_failed INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER
);

CREATE TABLE sync_run_city_scope (
  run_id TEXT NOT NULL REFERENCES sync_runs(id),
  city_id TEXT NOT NULL REFERENCES cities(id),
  is_featured_at_start INTEGER NOT NULL CHECK (is_featured_at_start IN (0, 1)),
  valid_7day INTEGER NOT NULL DEFAULT 0 CHECK (valid_7day IN (0, 1)),
  PRIMARY KEY (run_id, city_id)
);

CREATE TABLE sync_failures (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES sync_runs(id),
  city_id TEXT REFERENCES cities(id),
  error_code TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE sync_locks (
  key TEXT PRIMARY KEY,
  holder TEXT,
  fencing_token INTEGER NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  acquired_at TEXT,
  expires_at TEXT,
  CHECK (
    (holder IS NULL AND acquired_at IS NULL AND expires_at IS NULL)
    OR (holder IS NOT NULL AND acquired_at IS NOT NULL AND expires_at IS NOT NULL)
  )
);

CREATE TRIGGER trg_sync_locks_no_delete
BEFORE DELETE ON sync_locks
BEGIN
  SELECT RAISE(ABORT, 'lock fencing-token high-water mark is permanent');
END;

CREATE TRIGGER trg_sync_locks_token_no_decrease
BEFORE UPDATE OF fencing_token ON sync_locks
WHEN NEW.fencing_token < OLD.fencing_token
BEGIN
  SELECT RAISE(ABORT, 'lock fencing token cannot decrease');
END;

CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  scope_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE seo_page_registry (
  path TEXT PRIMARY KEY,
  page_type TEXT NOT NULL,
  locale TEXT NOT NULL,
  indexable INTEGER NOT NULL,
  lastmod TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  in_sitemap INTEGER NOT NULL
);

CREATE TABLE analytics_events_daily (
  event_date TEXT NOT NULL,
  event_name TEXT NOT NULL,
  dimension_key TEXT NOT NULL,
  dimension_value TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_date, event_name, dimension_key, dimension_value)
);

-- ---------------------------------------------------------------------------
-- Hot-path indexes (DATA-MIGRATION-001)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX idx_cities_country_slug
  ON cities(country_id, slug);
CREATE INDEX idx_weather_daily_city_snapshot_date
  ON weather_daily(city_id, snapshot_id, local_date);
CREATE INDEX idx_weather_hourly_city_snapshot_time
  ON weather_hourly(city_id, snapshot_id, local_time);
CREATE INDEX idx_weather_alerts_city_snapshot_interval
  ON weather_alerts(city_id, alert_snapshot_id, effective_at, expires_at);
CREATE INDEX idx_weather_snapshots_status
  ON weather_snapshots(status);
CREATE UNIQUE INDEX idx_weather_snapshots_single_active
  ON weather_snapshots(status)
  WHERE status = 'active';
CREATE INDEX idx_city_theme_attributes_type_city
  ON city_theme_attributes(attribute_type, city_id);
CREATE INDEX idx_city_scores_snapshot_window_score
  ON city_scores(snapshot_id, window, travel_score DESC);
CREATE UNIQUE INDEX idx_ranking_snapshot_version_slice
  ON ranking_snapshots(snapshot_id, ranking_version, theme, time_window, region_key);
CREATE INDEX idx_ranking_entries_ranking_rank
  ON ranking_entries(ranking_id, rank);
CREATE INDEX idx_city_translations_locale_name
  ON city_translations(locale, name);
CREATE INDEX idx_city_relationships_city_type_rank
  ON city_relationships(city_id, relation_type, rank);
CREATE INDEX idx_activity_destinations_city_type
  ON activity_destinations(city_id, activity_type);
CREATE INDEX idx_activity_scores_city_type_date
  ON activity_scores(city_id, activity_type, anchor_local_date, window);
CREATE INDEX idx_seo_registry_type_locale_sitemap
  ON seo_page_registry(page_type, locale, in_sitemap);
