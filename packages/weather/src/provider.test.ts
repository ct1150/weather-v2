import { describe, it, expect } from "vitest";
import {
  FakeWeatherProvider,
  createWeatherProvider,
  ProviderRequestError,
  type WeatherProvider,
  type ForecastRequest,
} from "./provider.js";

const REQUEST: ForecastRequest = {
  cityId: "lisbon",
  latitude: 38.72,
  longitude: -9.14,
  timezone: "Europe/Lisbon",
  days: 3,
  startDate: "2026-07-20",
};

describe("FakeWeatherProvider — sync-only port contract", () => {
  it("exposes a stable id and implements the WeatherProvider port", () => {
    const provider: WeatherProvider = new FakeWeatherProvider();
    expect(provider.id).toBe("fake");
  });

  it("healthCheck reports healthy with zero latency (no network)", async () => {
    const provider = new FakeWeatherProvider();
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.providerId).toBe("fake");
    expect(health.latencyMs).toBe(0);
  });

  it("returns one normalized forecast per city with the requested day count", async () => {
    const provider = createWeatherProvider();
    const result = await provider.fetchForecast(REQUEST);
    expect(result).toHaveLength(1);
    expect(result[0]?.cityId).toBe("lisbon");
    expect(result[0]?.days).toHaveLength(REQUEST.days);
  });

  it("returns 24 normalized hourly rows per day within plausible metric ranges", async () => {
    const provider = new FakeWeatherProvider();
    const [forecast] = await provider.fetchForecast(REQUEST);
    const day = forecast.days[0];
    expect(day.hourly).toHaveLength(24);
    for (const h of day.hourly) {
      expect(h.localTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/);
      if (h.temperatureC != null) expect(h.temperatureC).toBeGreaterThanOrEqual(-40);
      if (h.temperatureC != null) expect(h.temperatureC).toBeLessThanOrEqual(50);
      if (h.humidity != null) expect(h.humidity).toBeGreaterThanOrEqual(0);
      if (h.humidity != null) expect(h.humidity).toBeLessThanOrEqual(100);
      if (h.precipitationProbability != null) expect(h.precipitationProbability).toBeGreaterThanOrEqual(0);
      if (h.precipitationProbability != null) expect(h.precipitationProbability).toBeLessThanOrEqual(100);
      if (h.precipitationMm != null) expect(h.precipitationMm).toBeGreaterThanOrEqual(0);
      if (h.visibilityM != null) expect(h.visibilityM).toBeGreaterThanOrEqual(500);
    }
    // Daily aggregates derive from the hourly set.
    expect(day.humidityMean).not.toBeNull();
    expect(day.windSpeedMaxKph).not.toBeNull();
    expect(day.tempMaxC).not.toBeNull();
    expect(day.tempMinC).not.toBeNull();
  });

  it("is deterministic for identical requests (no external variation)", async () => {
    const provider = new FakeWeatherProvider();
    const a = await provider.fetchForecast(REQUEST);
    const b = await provider.fetchForecast(REQUEST);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("returns an empty list for zero days", async () => {
    const provider = new FakeWeatherProvider();
    const result = await provider.fetchForecast({ ...REQUEST, days: 0 });
    expect(result).toEqual([]);
  });

  it("validateRequest rejects out-of-range coordinates, bad day counts, and bad dates", async () => {
    const provider = new FakeWeatherProvider();
    await expect(provider.fetchForecast({ ...REQUEST, latitude: 100 })).rejects.toBeInstanceOf(ProviderRequestError);
    await expect(provider.fetchForecast({ ...REQUEST, longitude: 200 })).rejects.toBeInstanceOf(ProviderRequestError);
    await expect(provider.fetchForecast({ ...REQUEST, days: -1 })).rejects.toBeInstanceOf(ProviderRequestError);
    await expect(provider.fetchForecast({ ...REQUEST, cityId: "" })).rejects.toBeInstanceOf(ProviderRequestError);
    await expect(provider.fetchForecast({ ...REQUEST, startDate: "2026/07/20" })).rejects.toBeInstanceOf(ProviderRequestError);
  });
});
