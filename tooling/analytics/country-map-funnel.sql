SELECT
  index1 AS event,
  blob13 AS country_or_destination,
  SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-30 days')
  AND index1 IN (
    'weather_discovery_view',
    'search_result_clicked',
    'country_viewed',
    'city_viewed'
  )
GROUP BY index1, blob13
ORDER BY events DESC;
