PRAGMA foreign_keys = ON;

-- Low-volume, privacy-safe OPC funnel storage. The column names mirror the
-- existing fixed analytics projection so the aggregate SQL remains compact.
-- No account, cookie, IP, free text, URL, session/device identifier or trip
-- content is accepted by the Worker event contract before this insert path.
CREATE TABLE IF NOT EXISTS wnr_product_events_v1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  index1 TEXT NOT NULL,
  blob1 TEXT NOT NULL DEFAULT '',
  blob2 TEXT NOT NULL DEFAULT '',
  blob3 TEXT NOT NULL DEFAULT '',
  blob4 TEXT NOT NULL DEFAULT '',
  blob5 TEXT NOT NULL DEFAULT '',
  blob6 TEXT NOT NULL DEFAULT '',
  blob7 TEXT NOT NULL DEFAULT '',
  blob8 TEXT NOT NULL DEFAULT '',
  blob9 TEXT NOT NULL DEFAULT '',
  blob10 TEXT NOT NULL DEFAULT '',
  blob11 TEXT NOT NULL DEFAULT '',
  blob12 TEXT NOT NULL DEFAULT '',
  blob13 TEXT NOT NULL DEFAULT '',
  blob14 TEXT NOT NULL DEFAULT '',
  blob15 TEXT NOT NULL DEFAULT '',
  double1 REAL NOT NULL DEFAULT -1,
  double2 REAL NOT NULL DEFAULT -1,
  double3 REAL NOT NULL DEFAULT -1,
  double4 REAL NOT NULL DEFAULT -1,
  double5 REAL NOT NULL DEFAULT -1,
  double6 REAL NOT NULL DEFAULT -1,
  double7 REAL NOT NULL DEFAULT -1,
  double8 REAL NOT NULL DEFAULT -1,
  double9 REAL NOT NULL DEFAULT -1,
  double10 REAL NOT NULL DEFAULT -1,
  double11 REAL NOT NULL DEFAULT -1,
  double12 REAL NOT NULL DEFAULT -1,
  _sample_interval INTEGER NOT NULL DEFAULT 1 CHECK (_sample_interval = 1)
);

CREATE INDEX IF NOT EXISTS idx_wnr_product_events_time_event
  ON wnr_product_events_v1(timestamp DESC, index1);

CREATE INDEX IF NOT EXISTS idx_wnr_product_events_funnel_dimensions
  ON wnr_product_events_v1(index1, blob3, blob4, timestamp DESC);

-- Keep the OPC dataset bounded without adding a scheduled maintenance service.
-- Cleanup runs once per 100 accepted events and retains the most recent 90 days.
CREATE TRIGGER IF NOT EXISTS trg_wnr_product_events_retention
AFTER INSERT ON wnr_product_events_v1
WHEN (NEW.id % 100) = 0
BEGIN
  DELETE FROM wnr_product_events_v1
  WHERE julianday(timestamp) < julianday('now', '-90 days');
END;
