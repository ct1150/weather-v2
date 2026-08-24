ALTER TABLE wnr_product_events_v1 ADD COLUMN acquisition_channel TEXT NOT NULL DEFAULT '';
ALTER TABLE wnr_product_events_v1 ADD COLUMN referrer_host TEXT NOT NULL DEFAULT '';
ALTER TABLE wnr_product_events_v1 ADD COLUMN landing_route_template TEXT NOT NULL DEFAULT '';
ALTER TABLE wnr_product_events_v1 ADD COLUMN utm_source TEXT NOT NULL DEFAULT '';
ALTER TABLE wnr_product_events_v1 ADD COLUMN utm_medium TEXT NOT NULL DEFAULT '';
ALTER TABLE wnr_product_events_v1 ADD COLUMN utm_campaign TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_wnr_product_events_acquisition
  ON wnr_product_events_v1(acquisition_channel, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_wnr_product_events_landing
  ON wnr_product_events_v1(landing_route_template, timestamp DESC);
