# Trip Planner MVP Increment

## Goal

Extend Where Not Rain from destination discovery into a weather-aware trip execution product without adding a request-time backend or paid Cloudflare dependencies.

## Delivered routes

- `/trips` and `/zh-cn/trips` — trip workspace landing pages.
- `/trips/new` and `/zh-cn/trips/new` — client-side Markdown itinerary parser preview.
- `/trips/qinggan-family-2026` and `/zh-cn/trips/qinggan-family-2026` — end-to-end Qinghai–Gansu family itinerary demo.

## Delivered capabilities

1. Trip, day, activity, hotel and restaurant data models.
2. Activity constraints: `fixed`, `movable`, `fallback`.
3. Weather profiles: salt lake, lake, sunset, desert, mountain, indoor, city night and transit.
4. Deterministic weather suitability scoring with reason codes and risk levels.
5. Build-time Open-Meteo enrichment when `WEATHER_PRIMARY_PROVIDER=open-meteo`.
6. Embedded 2026-08-06 forecast snapshots when live build-time weather is unavailable.
7. Interactive D1–D9 day switcher, weather decision summary and Plan B toggle.
8. Hard-deadline display for train, return-car and long-drive constraints.
9. Restaurant, hotel and execution-note panels.
10. Client-side Markdown D1/Day1 and time-table extraction.
11. English and Simplified Chinese navigation and sitemap entries.

## Free-tier architecture

The increment preserves the existing Next.js static export. Weather is resolved during `next build`, serialized into the exported HTML and never fetched from the browser. No Pages Functions, D1, KV, R2 or paid runtime service is required for this MVP.

## Weather fallback behavior

- Production builds with `WEATHER_PRIMARY_PROVIDER=open-meteo` attempt to fetch the exact activity date and coordinates.
- Provider errors or out-of-range dates fall back to the embedded forecast snapshot.
- The UI labels each activity as either `实时构建数据` or `预报快照`.
- The trip page states that the forecast must be refreshed again 24–48 hours before execution.

## Validation performed in this workspace

- Pure TypeScript strict check passed for trip models, sample data, scoring and Markdown parsing.
- TypeScript syntax transpilation passed for all new TS/TSX files.
- Runtime smoke checks passed for Markdown extraction and weather score differentiation.
- Full pnpm install/build/test could not run because the execution environment could not reach the npm registry.

## Next increment

1. Persist imported trips in D1 or browser-local draft storage.
2. Resolve free-text POIs to coordinates through a China-compatible map provider.
3. Fetch road duration, road closure and opening-hour constraints.
4. Add editable activities and drag-to-reschedule.
5. Add daily notification jobs and weather-change diffing.
6. Add Markdown/PDF/print export for the full trip, not only the selected day.
