SELECT
  index1 AS commercial_event,
  blob10 AS category,
  blob11 AS placement,
  blob12 AS provider_id,
  SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND index1 IN ('affiliate_impression', 'affiliate_click')
GROUP BY commercial_event, category, placement, provider_id
ORDER BY events DESC;
