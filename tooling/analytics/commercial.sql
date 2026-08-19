SELECT
  index1 AS commercial_event,
  blob10 AS category,
  blob11 AS placement,
  blob12 AS provider_id,
  SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-30 days')
  AND index1 IN ('affiliate_impression', 'affiliate_click')
GROUP BY index1, blob10, blob11, blob12
ORDER BY events DESC;
