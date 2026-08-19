SELECT
  blob3 AS origin_id,
  blob4 AS transport_mode,
  double1 AS max_travel_minutes,
  SUM(_sample_interval) AS submitted_queries
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-30 days')
  AND index1 = 'discovery_query_submitted'
GROUP BY blob3, blob4, double1
ORDER BY submitted_queries DESC;
