SELECT
  blob3 AS origin_id,
  blob4 AS transport_mode,
  blob6 AS no_result_reason,
  SUM(_sample_interval) AS no_result_queries
FROM wnr_product_events_v1
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND index1 = 'discovery_no_results'
GROUP BY origin_id, transport_mode, no_result_reason
ORDER BY no_result_queries DESC;
