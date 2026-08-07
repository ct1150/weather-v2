PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trip_members (
  trip_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  invited_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (trip_id, user_id),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_members_user
  ON trip_members(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS trip_invites (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_user_id TEXT,
  revoked_at TEXT,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_invites_active_email
  ON trip_invites(trip_id, email_normalized)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trip_invites_token_hash
  ON trip_invites(token_hash);

CREATE INDEX IF NOT EXISTS idx_trip_invites_owner
  ON trip_invites(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trip_revisions (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  operation TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'zh-cn', 'zh-hant')),
  document_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (trip_id, version),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_revisions_trip_version
  ON trip_revisions(trip_id, version DESC);

INSERT OR IGNORE INTO trip_revisions (
  id,
  trip_id,
  actor_user_id,
  version,
  operation,
  locale,
  document_json,
  created_at
)
SELECT
  'rev_seed_' || id || '_' || version,
  id,
  owner_user_id,
  version,
  'baseline',
  locale,
  document_json,
  updated_at
FROM trips
WHERE deleted_at IS NULL;
