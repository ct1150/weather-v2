SELECT
  blob3 AS origin_id,
  blob4 AS transport_mode,
  double1 AS max_travel_minutes,
  SUM(_sample_interval) AS submitted_queries
FROM wnr_product_events_v1
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND index1 = 'discovery_query_submitted'
GROUP BY origin_id, transport_mode, max_travel_minutes
ORDER BY submitted_queries DESC;
