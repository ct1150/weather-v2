-- Privacy-safe aggregate affiliate conversion/revenue import.
-- No click id, user id, order id, email, device id, raw URL or other user-level field is stored.
CREATE TABLE IF NOT EXISTS affiliate_revenue_daily_v1 (
  event_date TEXT NOT NULL CHECK (event_date GLOB '????-??-??'),
  provider_id TEXT NOT NULL CHECK (length(provider_id) BETWEEN 2 AND 128),
  category TEXT NOT NULL CHECK (category IN ('hotel','activities','flights','sim','insurance','car_rental')),
  destination_id TEXT NOT NULL CHECK (length(destination_id) BETWEEN 2 AND 96),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
  conversions INTEGER NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  revenue_minor INTEGER NOT NULL DEFAULT 0 CHECK (revenue_minor >= 0),
  source TEXT NOT NULL DEFAULT 'provider_report' CHECK (source IN ('provider_report','manual_verified')),
  imported_at TEXT NOT NULL,
  PRIMARY KEY (event_date, provider_id, category, destination_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_revenue_daily_provider_date
  ON affiliate_revenue_daily_v1(provider_id, event_date);

CREATE INDEX IF NOT EXISTS idx_affiliate_revenue_daily_destination_date
  ON affiliate_revenue_daily_v1(destination_id, event_date);
