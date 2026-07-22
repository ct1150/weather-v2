// @wnr/weather — WeatherProvider port + Open-Meteo/WeatherAPI adapters.
// SYNC-ONLY: this package is importable only by workers/weather-sync, never by
// apps/web (Requirement 9.2). Provider DTOs stay private to their adapters.
export * from "./provider.js";
export * from "./open-meteo.js";
