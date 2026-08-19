SELECT
  index1 AS event,
  SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-14 days')
  AND index1 IN (
    'weather_discovery_view',
    'discovery_query_submitted',
    'discovery_results_returned',
    'discovery_no_results',
    'search_result_clicked',
    'destination_shortlisted',
    'destination_selected',
    'search_saved',
    'saved_search_opened',
    'share_link_copied',
    'calendar_reminder_downloaded',
    'affiliate_click'
  )
GROUP BY index1
ORDER BY events DESC;
