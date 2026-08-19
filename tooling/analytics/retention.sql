SELECT
  index1 AS retention_event,
  blob3 AS origin_id,
  SUM(_sample_interval) AS events
FROM wnr_product_events_v1
WHERE julianday(timestamp) >= julianday('now', '-30 days')
  AND index1 IN (
    'search_saved',
    'saved_search_opened',
    'saved_search_removed',
    'share_link_copied',
    'calendar_reminder_downloaded'
  )
GROUP BY index1, blob3
ORDER BY events DESC;
