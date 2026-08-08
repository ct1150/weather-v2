PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trip_activity (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_email_normalized TEXT,
  kind TEXT NOT NULL CHECK (kind IN (
    'revision',
    'comment_created',
    'comment_deleted',
    'decision_created',
    'decision_resolved',
    'decision_reopened',
    'decision_deleted'
  )),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_activity_trip_created
  ON trip_activity(trip_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trip_comments (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_email_normalized TEXT NOT NULL,
  body TEXT NOT NULL,
  day_id TEXT,
  revision_version INTEGER,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_comments_trip_created
  ON trip_comments(trip_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trip_decisions (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_by_email_normalized TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  day_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')) DEFAULT 'open',
  resolved_by_user_id TEXT,
  resolved_by_email_normalized TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_decisions_trip_status_updated
  ON trip_decisions(trip_id, status, updated_at DESC);

INSERT OR IGNORE INTO trip_activity (
  id,
  trip_id,
  actor_user_id,
  actor_email_normalized,
  kind,
  payload_json,
  created_at
)
SELECT
  'act_seed_' || trip_id || '_' || version,
  trip_id,
  actor_user_id,
  NULL,
  'revision',
  json_object('version', version, 'operation', operation),
  created_at
FROM trip_revisions;
