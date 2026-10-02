-- Weather data-source health: recent sync runs and per-city failures.
--
-- The weather-sync worker records every ingestion cycle in `sync_runs`
-- (status: running / failed / partial / succeeded) and per-city failures in
-- `sync_failures`, but nothing reads them yet. Run these queries against the
-- wnr-weather D1 database to spot a sick provider before users do, e.g.:
--
--   wrangler d1 execute wnr-weather --remote --file tooling/analytics/sync-health.sql
--
-- A healthy pipeline shows a recent `succeeded` run with cities_failed = 0.
-- Investigate when the latest run is older than the sync cron interval,
-- when status is `failed`/`partial`, or when cities_failed keeps climbing.

-- Latest sync runs (newest first).
SELECT
  id,
  started_at,
  finished_at,
  status,
  provider,
  cities_ok,
  cities_failed,
  duration_ms
FROM sync_runs
ORDER BY started_at DESC
LIMIT 10;

-- Per-city failures from the most recent runs.
SELECT
  f.created_at,
  f.run_id,
  f.city_id,
  f.error_code,
  f.detail
FROM sync_failures f
JOIN sync_runs r ON r.id = f.run_id
WHERE r.started_at >= datetime('now', '-7 days')
ORDER BY f.created_at DESC
LIMIT 50;
