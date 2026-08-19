SELECT
  blob3 AS origin_id,
  blob4 AS transport_mode,
  blob6 AS no_result_reason,
  SUM(_sample_interval) AS no_result_queries
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-30 days')
  AND index1 = 'discovery_no_results'
GROUP BY blob3, blob4, blob6
ORDER BY no_result_queries DESC;
