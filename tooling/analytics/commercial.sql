WITH affiliate_events AS (
  SELECT
    date(timestamp) AS event_date,
    index1 AS commercial_event,
    blob7 AS destination_id,
    blob10 AS category,
    blob11 AS placement,
    blob12 AS provider_id,
    SUM(_sample_interval) AS events
  FROM wnr_product_events_v1
  WHERE julianday(timestamp) >= julianday('now', '-30 days')
    AND index1 IN ('affiliate_impression', 'affiliate_click')
  GROUP BY event_date, index1, blob7, blob10, blob11, blob12
),
rollup AS (
  SELECT
    event_date,
    destination_id,
    category,
    placement,
    provider_id,
    SUM(CASE WHEN commercial_event = 'affiliate_impression' THEN events ELSE 0 END) AS impressions,
    SUM(CASE WHEN commercial_event = 'affiliate_click' THEN events ELSE 0 END) AS clicks
  FROM affiliate_events
  GROUP BY event_date, destination_id, category, placement, provider_id
)
SELECT
  r.event_date,
  r.provider_id,
  r.category,
  r.placement,
  r.destination_id,
  r.impressions,
  r.clicks,
  CASE
    WHEN r.impressions > 0 THEN ROUND(100.0 * r.clicks / r.impressions, 2)
    ELSE 0
  END AS click_through_rate_pct,
  COALESCE(a.conversions, 0) AS conversions,
  COALESCE(a.revenue_minor, 0) AS revenue_minor,
  COALESCE(a.currency, '') AS currency
FROM rollup r
LEFT JOIN affiliate_revenue_daily_v1 a
  ON a.event_date = r.event_date
 AND a.provider_id = r.provider_id
 AND a.category = r.category
 AND a.destination_id = r.destination_id
ORDER BY r.event_date DESC, r.clicks DESC, r.impressions DESC;
