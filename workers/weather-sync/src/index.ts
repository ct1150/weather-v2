// workers/weather-sync — hourly Cron ingestion + scoring + read-model writer.
// This is the ONLY code path allowed to import @wnr/weather and contact
// weather providers (Requirement 9.2).
export * from "./sync.js";
