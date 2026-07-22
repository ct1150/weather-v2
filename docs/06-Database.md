---
title: Database and Scoring
authority: Database
status: Active
last_updated: 2026-07-17
---

# Database and Scoring

> **Authoritative.** This document is the active source of truth for its domain; SPEC.md is the governance index.

## Geography and editorial records

<!-- requirement
id: DATA-GEOGRAPHY-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DATA_GEOGRAPHY_001
owner: Database
verification: pnpm docs:check
-->

<a id="DATA-GEOGRAPHY-001"></a>

### DATA-GEOGRAPHY-001 — Canonical geography and localized content schema

D1 stores canonical identifiers and stable ASCII slugs separately from localized display content. Coordinates, time zones, status values, locale values, aliases, and numeric ranges are validated before persistence.

```sql
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
```

All timestamps are UTC ISO-8601 strings. Forecast calendar keys separately preserve city-local dates. Storage uses SI/metric values; presentation converts units. Monetary columns always carry a currency when an amount exists. JSON text is accepted only after application-schema validation.

Roadmap: [REL-MVP-DATA_GEOGRAPHY_001](11-Roadmap.md#REL-MVP-DATA_GEOGRAPHY_001).

#### Acceptance Criteria

- Migration tests enforce unique ISO codes, country slugs, article slugs, translation keys, and `(country_id, slug)` city identity.
- Validation rejects latitude outside `-90..90`, longitude outside `-180..180`, invalid time zones/locales, malformed alias JSON, and unsupported status values.
- Metric storage remains unchanged when a caller requests a different display unit.
- Localized names and aliases resolve to canonical geography IDs without creating locale-specific entity duplicates.
- Article links cannot reference missing cities or articles, and their order is deterministic.

## Weather observations

<!-- requirement
id: DATA-WEATHER-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DATA_WEATHER_001
owner: Database
verification: pnpm docs:check
-->

<a id="DATA-WEATHER-001"></a>

### DATA-WEATHER-001 — Snapshot-versioned weather schema

Weather records are immutable by snapshot identity and store both UTC acquisition bounds and city-local forecast keys.

```sql
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
```

The pointer invariant is explicitly phase-scoped. **Pre-bootstrap**, `weather_publication_state.bootstrapped = 0` and the required pointer count is `0`; no weather publication exists. **Post-bootstrap**, the state is irreversibly `1` and the sole repository protocol requires the pointer count to remain `1`. Fixed `CHECK` keys and primary/partial unique indexes give the schema an **at-most-one** pointer and at-most-one active status. The repository bootstrap/activation transaction is the only supported write path and its protocol guarantees post-bootstrap exactly-one. This contract does not claim that arbitrary SQL outside the repository can enforce every cross-table end-of-transaction assertion.

The state row cannot be deleted or changed from `1` back to `0`. After bootstrap, the pointer cannot be deleted; later activation updates its fixed row in place. Before changing `bootstrapped` to `1`, the state trigger requires one pointer joined to one active snapshot. Pointer insert/update triggers require the referenced snapshot to be active at that statement. These are delete protection and local integrity checks, while the repository final assertions remain the cross-table protocol guarantee.

The sole repository uses `BEGIN IMMEDIATE`. Bootstrap executes: require state `0` and pointer count `0`; require the same unexpired `weather-publication` holder and captured fencing token; revalidate candidate and frozen coverage; change the candidate from `pending` to `active`; insert the fixed pointer with `(snapshot_id, ranking_version, model_version, publication_fencing_token, published_at)`; set state to `1`; assert state `1`, one active status, one pointer, one active-pointer inner join, and pointer token equal to the captured token; commit. Replacement executes: require state `1` and one valid old pointer; perform the same lock/token/candidate checks; change the old active row to `superseded`; change the candidate to `active`; update the fixed pointer row in place; run the same final assertions; commit. Temporary mismatches are transaction-local and invisible. Any failed statement, expired lease, changed token, or assertion rolls back.

An uncached read obtains authoritative identity from the pointer joined to the active snapshot and reads the current `weather-publication` fencing-token high-water mark. KV is eligible only when all pointer identity fields match and `publication_fencing_token` also equals that high-water mark. Weather values used by Theme Park or Mountain suitability must have been fetched no more than two hours before evaluation.

```sql
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
```

Roadmap: [REL-MVP-DATA_WEATHER_001](11-Roadmap.md#REL-MVP-DATA_WEATHER_001).

#### Acceptance Criteria

- Composite primary keys prevent duplicate daily or hourly rows for a city and snapshot time key.
- Runtime validation rejects impossible probabilities, humidity, negative precipitation, malformed timestamps, and unsupported quality/status values.
- Pre-bootstrap fixtures require state `0` and zero pointer rows; successful bootstrap irreversibly reaches state `1`, after which the repository protocol preserves exactly one fixed pointer.
- Constraint tests prove schema-level at-most-one pointer/active status; trigger tests prove state irreversibility, state/pointer delete protection, and active-target checks without claiming arbitrary-SQL cross-table enforcement.
- Repository transaction tests reject stale/expired captured fencing tokens and any final status/pointer/identity mismatch, and readers cannot combine weather rows from different snapshots.
- City-local dates remain stable when the server time zone changes and cover daylight-saving transitions.
- Activity-score calculation refuses weather inputs older than two hours.

## Scores and rankings

<!-- requirement
id: DATA-SCORE-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DATA_SCORE_001
owner: Database
verification: pnpm docs:check
-->

<a id="DATA-SCORE-001"></a>

### DATA-SCORE-001 — Deterministic versioned Travel Score

Every raw factor is normalized to `0..100`. Missing values remain absent rather than defaulting to the best value. Given identical raw inputs and `model_version`, calculation returns the same integer score and stable reason codes.

The normalization primitives are `clamp(x, lo, hi) = min(hi, max(lo, x))` and `line(x; x0,y0; x1,y1) = y0 + (x-x0)*(y1-y0)/(x1-x0)`. Inputs outside their runtime-valid domain are missing, not clamped: probability, relative humidity, cloud cover, and UV require finite values in `0..100`, `0..100`, `0..100`, and `>= 0`; precipitation, wind, gust, and visibility require finite values `>= 0`; temperature and apparent temperature require finite Celsius values. Every listed piece boundary is inclusive on the side shown, adjacent pieces return the same value at a shared boundary, and every raw-to-factor function returns `clamp(selectedPieceResult, 0, 100)`.

```text
rainFactor(probabilityPct, precipitationMm) =
  min(100 - probabilityPct, rainAmountFactor(precipitationMm))

rainAmountFactor(m) =
  100                              when m <= 0
  line(m; 0,100; 2,80)             when 0 < m <= 2
  line(m; 2,80; 10,40)             when 2 < m <= 10
  line(m; 10,40; 30,0)             when 10 < m < 30
  0                                when m >= 30

temperatureFactor(t) =
  0                                when t <= 0
  line(t; 0,0; 10,50)              when 0 < t < 10
  line(t; 10,50; 18,100)           when 10 <= t < 18
  100                              when 18 <= t <= 26
  line(t; 26,100; 32,60)           when 26 < t <= 32
  line(t; 32,60; 40,0)             when 32 < t < 40
  0                                when t >= 40

comfortFactor(apparentT) = temperatureFactor(apparentT)

humidityFactor(h) =
  0                                when h <= 20
  line(h; 20,0; 30,100)            when 20 < h < 30
  100                              when 30 <= h <= 60
  line(h; 60,100; 80,40)           when 60 < h <= 80
  line(h; 80,40; 100,0)            when 80 < h < 100
  0                                when h >= 100

windSpeedFactor(s) =
  100                              when s <= 10
  line(s; 10,100; 25,60)           when 10 < s <= 25
  line(s; 25,60; 40,0)             when 25 < s < 40
  0                                when s >= 40

windGustFactor(g) =
  100                              when g <= 20
  line(g; 20,100; 50,0)            when 20 < g < 50
  0                                when g >= 50

windFactor(speedKph, gustKph) = min(windSpeedFactor(speedKph), windGustFactor(gustKph))

uvFactor(u) =
  100                              when u <= 2
  line(u; 2,100; 5,80)             when 2 < u <= 5
  line(u; 5,80; 8,40)              when 5 < u <= 8
  line(u; 8,40; 11,0)              when 8 < u < 11
  0                                when u >= 11

cloudFactor(c) =
  100                              when c <= 20
  line(c; 20,100; 60,60)           when 20 < c <= 60
  line(c; 60,60; 100,0)            when 60 < c < 100
  0                                when c >= 100

visibilityFactor(vMetres) =
  0                                when vMetres <= 1000
  line(vMetres; 1000,0; 5000,50)   when 1000 < vMetres <= 5000
  line(vMetres; 5000,50; 10000,100) when 5000 < vMetres < 10000
  100                              when vMetres >= 10000
```

For an hourly score, raw values are the same row's precipitation probability, precipitation millimetres, temperature, apparent temperature, humidity, wind speed, gust, UV, cloud cover, and visibility. For a daily score, raw temperature and apparent temperature are respectively `(min + max) / 2` and `(apparent_min + apparent_max) / 2`; the other raw values are the daily columns. `weather_daily.visibility_mean_m` is the arithmetic mean of all runtime-valid `weather_hourly.visibility_m` observations assigned to that city-local date, with `N >= 1`; no valid observation makes daily visibility missing. Both raw hourly and derived daily visibility are persisted.

For each city-local date, nighttime observations are hourly rows whose local timestamps are in `[sunset_local, 24:00)` or `[00:00, sunrise_local)`. `nightVisibilityFactor` applies `visibilityFactor` to their arithmetic-mean `visibility_m`, and `nightCloudFactor` applies `cloudFactor` to their arithmetic-mean cloud cover. Every expected nighttime row in those intervals must exist and pass validation; otherwise both nighttime factors are missing. Daylight-saving dates use the actual timezone offset and therefore their real row count.

The general score is:

```text
base =
  rain        * 0.30 +
  temperature * 0.20 +
  comfort     * 0.15 +
  humidity    * 0.10 +
  wind        * 0.10 +
  uv          * 0.075 +
  cloud       * 0.075

travelScore = round(clamp(base - hazardPenalty, 0, 100))
```

For the general model, `availableWeight = sum(weight for each available listed factor)`, `base = sum(factor * weight) / availableWeight`, and `confidence = availableWeight / 1.0`. When `availableWeight = 0`, both score and confidence are unavailable. General confidence below `0.7` hides the score from the homepage top ranking and emits `LIMITED_DATA`; equality at `0.7` is eligible. The general `hazardPenalty` is the exact maximum-value schedule in [DATA-ACTIVITY-001](#DATA-ACTIVITY-001).

The persisted schema is:

```sql
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
```

Theme percentage weights are exact:

| Theme       | Rain | Temp | Comfort/Humidity | Wind |  UV | Cloud/Visibility | Other |
| ----------- | ---: | ---: | ---------------: | ---: | --: | ---------------: | ----- |
| Outdoor     |   30 |   20 |               20 |   15 |  10 |                5 | 0     |
| Beach       |   20 |   25 |               10 |   15 |  15 |               10 | 5     |
| Walking     |   30 |   25 |               25 |   10 |   5 |                5 | 0     |
| Hiking      |   30 |   20 |               15 |   20 |   5 |               10 | 0     |
| Camping     |   35 |   20 |               15 |   20 |   5 |                5 | 0     |
| Family      |   35 |   20 |               25 |   10 |   5 |                5 | 0     |
| Photography |   20 |   10 |               10 |   10 |   5 |               35 | 10    |
| Night View  |   25 |   10 |               10 |   15 |   0 |               30 | 10    |
| Food Trip   |   15 |   15 |               20 |    5 |   0 |                0 | 45    |
| Shopping    |   10 |   10 |               15 |    5 |   0 |                0 | 60    |

`Comfort/Humidity` is `(comfortFactor + humidityFactor) / 2` for every theme. Both factors are required for that component. `Cloud/Visibility` is selected by this complete mapping:

| Theme                    | Exact Cloud/Visibility value                                      |
| ------------------------ | ----------------------------------------------------------------- |
| Outdoor, Walking, Family | `cloudFactor`                                                     |
| Beach, Hiking, Camping   | `(cloudFactor + visibilityFactor) / 2`                            |
| Photography              | `cloudFactor * 0.40 + visibilityFactor * 0.60`                    |
| Night View               | `nightCloudFactor * 0.40 + nightVisibilityFactor * 0.60`          |
| Food Trip, Shopping      | `0`; the column weight is zero and it is not a required component |

Every nonzero combined component is available only when every factor named by its formula is available. The `Other` input has this complete one-to-one mapping:

| Theme                                     | Exact Other value                                  |
| ----------------------------------------- | -------------------------------------------------- |
| Outdoor, Walking, Hiking, Camping, Family | `0`; the column weight is zero                     |
| Beach                                     | `(beachWaterAttribute + beachSeasonAttribute) / 2` |
| Photography                               | `visibilityFactor`                                 |
| Night View                                | `nightVisibilityFactor`                            |
| Food Trip                                 | `foodTripAttribute`                                |
| Shopping                                  | `shoppingAttribute`                                |

`beachWaterAttribute`, `beachSeasonAttribute`, `foodTripAttribute`, and `shoppingAttribute` are exactly the `value` fields from the `beach_water`, `beach_season`, `food_trip`, and `shopping` `city_theme_attributes` rows. A row is verified only when its value is in `0..100`, its source is an official destination, government/tourism board, or contracted provider, and `verified_at` is no more than 90 days before the score's `asOf`. Beach requires both verified rows. Food Trip and Shopping require their named verified row. A missing, invalid, unqualified, or stale critical non-weather row hides that theme score and excludes it from rankings; it is never replaced or renormalized. Photography and Night View Other are weather inputs and follow the weather-availability rule.

For each theme, `totalWeatherWeight` is the sum of its positive Rain, Temp, Comfort/Humidity, Wind, UV, and Cloud/Visibility percentages; `availableWeatherWeight` sums the positive components available for the selected row. `themeWeatherConfidence = availableWeatherWeight / totalWeatherWeight`. A value below `0.7` hides the theme score; equality passes. For an eligible theme, `weatherBlock = sum(availableWeatherComponent * configuredPercentage) / availableWeatherWeight`, then:

```text
otherWeight = configured Other percentage
rawThemeScore = (weatherBlock * totalWeatherWeight + otherValue * otherWeight) / 100
themeScore = round(clamp(rawThemeScore - hazardPenalty, 0, 100))
```

For a zero-weight Other row, `otherValue * otherWeight` is exactly zero. The hazard penalty is the maximum-value schedule in [DATA-ACTIVITY-001](#DATA-ACTIVITY-001).
All windows are evaluated in the destination city's IANA time zone against one snapshot and one `asOf` instant:

- **Today** is the city-local calendar date containing `asOf`.
- **Tomorrow** is Today plus one local calendar day.
- **Weekend** is the first Saturday on or after Today and the immediately following Sunday. If Today is Saturday, it is the current Saturday/Sunday; if Today is Sunday, it begins the following Saturday. Both dates are required, and the response displays them.
- **Next Week** is Monday through Sunday of the ISO week immediately following the city-local ISO week containing Today. It uses every score-eligible date available in that seven-day interval, requires at least one, and displays the exact included dates.
- Any other approved **multi-day** window declares an inclusive start/end date, uses every score-eligible date in that interval, and exposes the exact included dates; an empty set is unavailable.

For each selected local date `d`, use hourly calculation only when all 15 distinct local hourly records at `08:00, 09:00, ..., 22:00` exist for the same snapshot and every input required to calculate that hour passes validation. In that case, calculate 15 unrounded hourly scores with the applicable formula and set `dailyScore(d)` to their arithmetic mean. If any one of those records or required inputs is absent, use exactly one unrounded score calculated from the same snapshot's daily record; never mix a partial hourly set with daily data. If the daily fallback is also not calculable, the date is not score-eligible.

Today and Tomorrow return `round(clamp(dailyScore(d), 0, 100))` and apply no volatility penalty. Weekend, Next Week, and every other multi-day window use the following exact population standard deviation; daily scores remain unrounded until the final window result:

```text
mean = sum(dailyScores) / N
populationStdDev(dailyScores) = sqrt(sum((score - mean)^2) / N)
volatilityPenalty = min(20, populationStdDev(dailyScores) * 0.5)
windowScore = round(clamp(mean - volatilityPenalty, 0, 100))
```

For `N = 1`, `populationStdDev` and `volatilityPenalty` are `0`. Stable persisted reason codes are `LOW_RAIN_CHANCE`, `COMFORTABLE_TEMPERATURE`, `LOW_HUMIDITY`, `CALM_WIND`, `HIGH_UV_CAUTION`, `HEAVY_RAIN_RISK`, `STORM_RISK`, `CLEAR_NIGHT_SKY`, `GOOD_GOLDEN_HOUR`, `LIMITED_DATA`, and `STALE_DATA`; natural-language reasons are not stored.

Every `city_scores` row is a reproducibility record, not only a result. `anchor_local_date` is Today in the city's time zone at `as_of`; `included_dates_json` is the validated chronological unique array actually aggregated. `source_kind` is `hourly` when every included date used complete hourly sets, `daily` when every date used daily fallback, and `mixed` otherwise. Canonical `source_row_keys_json` lists each included date's source kind and every `(table, snapshot_id, city_id, local_time|local_date)` key. `source_start` and `source_end` are the minimum inclusive and maximum exclusive UTC instants covered by those rows. The row freezes `score_model_version`, `hazard_model_version`, and the exact normalized `alert_snapshot_id`; recomputation may not substitute later weather, alerts, dates, or model parameters.

Roadmap: [REL-MVP-DATA_SCORE_001](11-Roadmap.md#REL-MVP-DATA_SCORE_001).

#### Acceptance Criteria

- Property tests prove the complete-factor result equals the exact formula and is always an integer in `0..100`.
- Every subset of available factors produces the independently calculated weighted mean and proportional confidence; no missing value becomes `100` by default.
- General confidence below `0.7` cannot enter the homepage top ranking and carries `LIMITED_DATA`.
- Fixtures verify every normalization segment at all endpoints and immediate neighbors; every theme row sums to 100; each Comfort/Humidity, Cloud/Visibility, and Other mapping is exact; required verified attributes hide rather than improve a score when absent.
- Repeated calculations from persisted anchor, `as_of`, included dates, source row/range provenance, score/hazard model versions, and alert snapshot reproduce identical scores, ranks, reasons, and map values.
- Window tests cover Today/Tomorrow local dates, Saturday and Sunday `asOf` behavior, the next ISO week, partial Next Week availability, daylight-saving transitions, all 15 required `08:00..22:00` records, daily fallback on one missing hour, `N = 1`, population standard deviation, and the capped volatility penalty.
- Provenance validation rejects noncanonical included-date/source-row JSON, source ranges inconsistent with named rows, or an alert snapshot not bound to the same weather snapshot.

<!-- requirement
id: DATA-ACTIVITY-001
status: Active
kind: Hard
roadmap_ref: REL-V1-DATA_ACTIVITY_001
owner: Database
verification: pnpm docs:check
-->

<a id="DATA-ACTIVITY-001"></a>

### DATA-ACTIVITY-001 — Theme Park and Mountain suitability

Theme Park and Mountain use versioned weather-and-destination suitability and are persisted only when every eligibility rule passes.

```sql
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
```

Normalize all weather factors to `0..100`. A required weather factor is available only when it is present, runtime-valid, normalized, and no more than two hours old. For each activity, `totalRequiredWeatherWeight` is the sum of all listed weights and equals `1.0`; `availableRequiredWeatherWeight` is the sum of listed weights whose factors are available.

```text
weatherConfidence = availableRequiredWeatherWeight / totalRequiredWeatherWeight
weatherSuitability =
  sum(availableFactorValue * configuredWeight) /
  availableRequiredWeatherWeight
```

Do not calculate when `weatherConfidence < 0.8`; equality at `0.8` is eligible. The configured weights are:

```text
Theme Park weatherSuitability weights =
  rain * 0.35 +
  temperature * 0.25 +
  comfort * 0.20 +
  wind * 0.10 +
  uv * 0.10

Mountain weatherSuitability weights =
  rain * 0.30 +
  temperature * 0.15 +
  comfort * 0.10 +
  wind * 0.25 +
  uv * 0.05 +
  visibility * 0.15
```

Destination factors and completeness map exactly as follows:

- `availabilityFactor`: `available = 100`, `limited = 60`, and `unavailable` or `unknown` means not calculable.
- `availabilityCompleteness = 1` only when `availability_status`, `source_url`, and `verified_at` are present, the source is qualified, and verification age is at most 90 days; otherwise it is `0`.
- `seasonCompleteness = 1` only when the verification is fresh and either the destination is explicitly year-round/non-seasonal or both valid seasonal boundaries are present; otherwise it is `0`.
- `destinationConfidence = availabilityCompleteness * 0.70 + seasonCompleteness * 0.30`.
- `destinationSuitability = availabilityFactor * 0.70 + seasonFactor * 0.30`.
- Qualified sources are official destinations, government/tourism boards, or contracted providers only.

`seasonFactor` is evaluated before destination blending and uses the city-local date with this precedence:

1. An explicit year-round or `is_seasonal = 0` record returns `100`.
2. A normal inclusive interval with `season_start <= season_end` contains dates from start through end. A cross-year inclusive interval with `season_start > season_end` contains dates in `[season_start, December 31]` or `[January 1, season_end]`.
3. A date outside that inclusive interval returns `0`, even when it is within 14 calendar days outside a boundary.
4. For a date inside the interval, measure whole calendar days along the included interval to each boundary. If the minimum distance is `<= 14`, including either boundary at distance `0`, return `70`.
5. Any other inside date returns `100`.

The outside check therefore precedes the near-boundary check. Cross-year distance follows the year wrap, and leap-day arithmetic uses the actual city-local calendar year.

`hazardPenalty` is the maximum applicable value, never the sum. Alert intervals are normalized UTC half-open intervals `[effective_at, expires_at)` with `effective_at < expires_at`. A score interval `[scoreStart, scoreEnd)` overlaps an active storm/typhoon alert exactly when `effective_at < scoreEnd AND expires_at > scoreStart`; equality at either touching boundary is not overlap. Cancelled alerts never apply.

For an hourly row, `[scoreStart, scoreEnd)` is the real instant represented by `local_time` through exactly one hour later. Its penalty candidates are: overlapping alert `100`; the same city-local date's `weather_daily.precipitation_mm >= 50` or that hourly row's gust `>= 75km/h`, `60`; that row's temperature `>= 40°C` or `<= -15°C`, `40`; otherwise `0`. For a daily row, the interval is city-local midnight through the next city-local midnight converted to UTC, so DST days use their actual length. Its candidates are: any overlapping alert `100`; that daily row's precipitation `>= 50mm` or gust `>= 75km/h`, `60`; its maximum temperature `>= 40°C` or minimum temperature `<= -15°C`, `40`; otherwise `0`. Each hourly/daily penalty is the maximum candidate. A multi-date result uses only penalties already bound to its persisted included dates and source rows. Every score in one row uses the same immutable alert snapshot and hazard model version.

The complete confidence gate and deterministic result are:

```text
combinedConfidence = weatherConfidence * 0.70 + destinationConfidence * 0.30

score = round(
  clamp(
    weatherSuitability * 0.70 +
    destinationSuitability * 0.30 -
    hazardPenalty,
    0,
    100
  )
)
```

Both `weatherConfidence >= 0.8` and `combinedConfidence >= 0.8` are required; equality passes. Weather may be at most two hours old; destination verification may be at most 90 days old. Real-time opening status may be displayed only from an authorized source updated within 24 hours. Missing required fields, an unqualified or stale source, a non-calculable status, weather confidence below `0.8`, or combined confidence below `0.8` hides the score and excludes it from rankings. A parameter change requires a new `model_version` and an Accepted ADR; previous versions remain reproducible.

Every `activity_scores` row freezes provenance for the exact window represented by that row. `anchor_local_date` is Today in the destination city's IANA time zone at `as_of`; the row selects Today, Tomorrow, Weekend, Next Week, or another approved multi-day window using the exact calendar and availability rules in [DATA-SCORE-001](#DATA-SCORE-001). `included_dates_json` is the canonical chronological unique array actually aggregated, never the requested interval with unavailable dates silently retained. Today and Tomorrow contain their one selected date; Weekend contains both required dates; Next Week and another approved multi-day window contain every score-eligible date actually used and require at least one.

For each included date, weather source selection uses the complete `08:00..22:00` hourly set or the single daily fallback defined in DATA-SCORE-001; partial hourly sets are never mixed into a date. `source_kind` is `hourly` when every included date used complete hourly sets, `daily` when every date used daily fallback, and `mixed` otherwise. Canonical `source_row_keys_json` lists each included date's source kind and every `(table, snapshot_id, city_id, local_time|local_date)` weather key used by suitability or a numeric hazard candidate, including the same-date daily row when an hourly hazard evaluates daily precipitation. `source_start` and `source_end` are respectively the minimum inclusive and maximum exclusive UTC instants covered by those named weather rows; city-local day boundaries are converted with the actual IANA offset, including DST transitions.

`alert_snapshot_id` is the exact normalized alert snapshot used for every included source interval and must reference the same `snapshot_id`; alert overlap is recomputed only from that snapshot. `model_version` freezes all activity suitability, confidence, season, window-aggregation, and rounding parameters, while `hazard_model_version` freezes alert-overlap and numeric-penalty parameters. `as_of` is captured once and selects the anchor, freshness, destination verification age, and season inputs; `evaluated_at` records completion and never changes input selection. A referenced `activity_destinations` row becomes immutable once used by a score; a destination-source change creates a new destination ID. Recalculation may not substitute later weather rows, alerts, included dates, destination rows, or model parameters.

Roadmap: [REL-V1-DATA_ACTIVITY_001](11-Roadmap.md#REL-V1-DATA_ACTIVITY_001).

#### Acceptance Criteria

- Reference fixtures independently reproduce both renormalized weather formulas, all three confidence equations, destination mapping, final `70/30` blend, rounding, and `0..100` clamp.
- Hazard fixtures prove simultaneous hazards use only the maximum of `100`, `60`, `40`, or `0`; hourly and DST-aware daily alert intervals overlap only by the strict half-open predicate, with boundary-touch and cancelled-alert cases excluded.
- Boundary tests cover exactly 2 hours, 90 days, 24 hours, `weatherConfidence = 0.8`, and `combinedConfidence = 0.8`, plus values immediately beyond each boundary.
- Missing required fields, unqualified/stale source, unavailable/unknown status, weather confidence below `0.8`, or combined confidence below `0.8` persists no visible score and no ranking entry.
- Season fixtures cover year-round, both inclusive endpoints, 14 and 15 days inside each boundary, dates just outside each boundary, normal ranges, cross-year ranges across December/January, and leap-day arithmetic.
- Activity-window fixtures prove `anchor_local_date` and `as_of` select the exact Today, Tomorrow, Weekend, Next Week, and partial multi-day included-date arrays, with complete hourly selection, daily fallback, mixed-source windows, and DST-aware UTC coverage.
- Activity-score provenance validation rejects noncanonical included-date/source-row JSON, omitted suitability or hazard source rows, UTC ranges inconsistent with the named rows, an alert snapshot bound to another weather snapshot, or a mutable/replaced destination row.
- Recalculation from persisted activity destination identity, anchor, `as_of`, included dates, source row keys and UTC range, alert snapshot, `model_version`, and `hazard_model_version` reproduces the same score, all three confidences, reason codes, and ranking eligibility without reading newer inputs.
- A model-parameter change fails version checks unless it changes `model_version` and cites an Accepted ADR; a hazard-parameter change also requires a new `hazard_model_version`.

## Relationships and operational records

<!-- requirement
id: DATA-RELATIONSHIP-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DATA_RELATIONSHIP_001
owner: Database
verification: pnpm docs:check
-->

<a id="DATA-RELATIONSHIP-001"></a>

### DATA-RELATIONSHIP-001 — Bounded destination and commercial relationships

```sql
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
```

`relation_type` is one of `nearby`, `similar`, `better_weather`, or `cheaper`; a city cannot relate to itself, and rank is positive and deterministic within a relation type. Offer rows contain only authorized source data. When `amount` is present, `currency` and freshness metadata are mandatory. Database constraints and repository validation ensure a target host matches the referenced provider whitelist before storage.

Roadmap: [REL-MVP-DATA_RELATIONSHIP_001](11-Roadmap.md#REL-MVP-DATA_RELATIONSHIP_001).

#### Acceptance Criteria

- Constraints reject self-relations, duplicate relation triples, unsupported relation types, and non-positive ranks.
- Relationship query results are stable and bounded by rank for each type.
- Offers cannot reference missing providers/cities or store an amount without currency and freshness metadata.
- Repository tests reject target URLs whose normalized host does not equal the provider whitelist host.
- Disabling or deleting optional relationship data does not delete canonical city or weather records.

<!-- requirement
id: DATA-OPERATIONS-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DATA_OPERATIONS_001
owner: Database
verification: pnpm docs:check
-->

<a id="DATA-OPERATIONS-001"></a>

### DATA-OPERATIONS-001 — Operational, analytics, flag, and SEO registry schema

```sql
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
```

The run-start transaction inserts one `sync_run_city_scope` row for every city with `cities.status = 'active'`, copies `is_featured`, and stores matching counts before provider I/O. For city `c`, `valid_7day = 1` only when the candidate has seven consecutive runtime-valid `weather_daily` rows from the local date containing `sync_runs.started_at` through local date plus six, and each row can derive all eight raw weather factors defined by [DATA-SCORE-001](#DATA-SCORE-001). Define `E` as all run scope rows, `F` as rows with `is_featured_at_start = 1`, and `V` as rows with `valid_7day = 1`. Activation requires `|E| > 0`, `100 * |V| >= 95 * |E|`, and `F subset-of V`; later city edits cannot alter E or F.

Lock acquisition runs under `BEGIN IMMEDIATE`: ensure the persistent key row exists at token `0`, conditionally update it only when unheld or expired, set the new holder/times, increment `fencing_token = fencing_token + 1`, and require one `RETURNING fencing_token` row. Thus each successful acquisition is strictly monotonic and never reuses a token. Release updates holder/times to null only with the same `(key, holder, fencing_token)` and never deletes the row or resets the token. The publication activation/maintenance transaction must re-read and require the captured token, holder, and unexpired lease before changing active publication identity.

These tables persist operational state only; their owning architecture, SEO, analytics, and security contracts determine meaning. `sync_failures.detail` is sanitized and excludes credentials and raw provider bodies. Daily analytics rows are aggregate counters and cannot store IP addresses, raw free-text searches, precise location, cookies, or reversible user identifiers.

Roadmap: [REL-MVP-DATA_OPERATIONS_001](11-Roadmap.md#REL-MVP-DATA_OPERATIONS_001).

#### Acceptance Criteria

- Constraints and repository validation accept only documented sync statuses, nonnegative counters/durations, valid timestamps, booleans, and schema-valid JSON.
- A sync failure record stores a stable code and sanitized detail with no credential or raw provider response.
- Lock tests prove acquisition is conditional on unheld/expired state, every reacquisition returns a strictly greater fencing token, release checks holder and token, and neither release nor expiry resets the high-water mark.
- Publication transaction tests reject a captured token after expiry, release, or any newer acquisition.
- Unknown feature keys evaluate disabled at the repository boundary.
- SEO registry `lastmod` changes only when its content hash meaningfully changes.
- Analytics rows are aggregate, nonnegative, and reject prohibited raw identifiers and free text.

## Indexes and migration

<!-- requirement
id: DATA-MIGRATION-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-DATA_MIGRATION_001
owner: Database
verification: pnpm docs:check
-->

<a id="DATA-MIGRATION-001"></a>

### DATA-MIGRATION-001 — Ordered forward migrations, hot-path indexes, and retention

Every schema change is an ordered, reviewable, forward migration. Production startup never performs destructive automatic migration. A migration is applied in preview first, its compatibility and query plans are verified, and production deployment records the migration version before application traffic changes. Destructive cleanup is a later explicit migration only after compatibility and rollback windows expire.

Required indexes are:

```sql
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
```

Alias search uses a derived, normalized, accent-folded index rather than interpolating `aliases_json`. Hot city, ranking, search, compare, sitemap, activity, and active-snapshot queries are checked with `EXPLAIN QUERY PLAN`.

Canonical geography and stable URL identity use soft disable rather than destructive deletion. Weather snapshots, failed sync details, aggregate analytics, offers, and generated rankings have documented bounded retention implemented by maintenance jobs; cleanup never removes the active or required last-known-good snapshot.

Roadmap: [REL-MVP-DATA_MIGRATION_001](11-Roadmap.md#REL-MVP-DATA_MIGRATION_001).

#### Acceptance Criteria

- A fresh database and an upgrade fixture both apply all ordered migrations successfully and produce the same schema version.
- Production startup contains no destructive migration path, and deployment fails before traffic switch when an explicit migration fails.
- `EXPLAIN QUERY PLAN` fixtures show indexed access for city, forecast, ranking, search, compare, activity, sitemap, and active-snapshot hot paths.
- A backward-compatible application version can operate during the migration rollback window.
- Retention cleanup preserves canonical identities, the active snapshot, and the required last-known-good snapshot while bounding disposable operational/history data.
- A destructive cleanup requires a separate reviewed migration after the compatibility window rather than being folded into an additive change.
