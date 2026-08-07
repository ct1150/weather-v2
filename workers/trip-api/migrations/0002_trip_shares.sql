PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trip_shares (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  token_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_shares_one_active
  ON trip_shares(trip_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trip_shares_owner_trip
  ON trip_shares(owner_user_id, trip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_shares_token_active
  ON trip_shares(token_hash)
  WHERE revoked_at IS NULL;
