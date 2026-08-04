import { describe, it, expect, vi, afterEach } from "vitest";
import {
  FakeWeatherProvider,
  createWeatherProvider,
  ProviderRequestError,
  type WeatherProvider,
  type ForecastRequest,
} from "./provider.js";
import { OpenMeteoProvider } from "./open-meteo.js";

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
      if (h.precipitationProbability != null)
        expect(h.precipitationProbability).toBeGreaterThanOrEqual(0);
      if (h.precipitationProbability != null)
        expect(h.precipitationProbability).toBeLessThanOrEqual(100);
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
    await expect(provider.fetchForecast({ ...REQUEST, latitude: 100 })).rejects.toBeInstanceOf(
      ProviderRequestError,
    );
    await expect(provider.fetchForecast({ ...REQUEST, longitude: 200 })).rejects.toBeInstanceOf(
      ProviderRequestError,
    );
    await expect(provider.fetchForecast({ ...REQUEST, days: -1 })).rejects.toBeInstanceOf(
      ProviderRequestError,
    );
    await expect(provider.fetchForecast({ ...REQUEST, cityId: "" })).rejects.toBeInstanceOf(
      ProviderRequestError,
    );
    await expect(
      provider.fetchForecast({ ...REQUEST, startDate: "2026/07/20" }),
    ).rejects.toBeInstanceOf(ProviderRequestError);
  });
});

// ---------------------------------------------------------------------------
// Open-Meteo adapter (real, key-free) — T01
// ---------------------------------------------------------------------------

/** Minimal Open-Meteo JSON fixture: 2 days, 48 hourly rows, deterministic values. */
function openMeteoFixture(): Record<string, unknown> {
  const dailyTime = ["2026-07-20", "2026-07-21"];
  const hourlyTime: string[] = [];
  const hourlyWeather: number[] = [];
  const hourlyTemp: number[] = [];
  const hourlyApp: number[] = [];
  const hourlyPrec: number[] = [];
  const hourlyPrecProb: number[] = [];
  const hourlyHum: number[] = [];
  const hourlyWind: number[] = [];
  const hourlyGust: number[] = [];
  const hourlyUv: number[] = [];
  const hourlyCloud: number[] = [];
  const hourlyVis: number[] = [];
  for (let d = 0; d < dailyTime.length; d++) {
    for (let h = 0; h < 24; h++) {
      hourlyTime.push(`${dailyTime[d]}T${String(h).padStart(2, "0")}:00`);
      hourlyWeather.push(3);
      hourlyTemp.push(20.1 + h * 0.1);
      hourlyApp.push(19.0);
      hourlyPrec.push(0.0);
      hourlyPrecProb.push(10);
      hourlyHum.push(70);
      hourlyWind.push(15.5);
      hourlyGust.push(22.1);
      hourlyUv.push(h >= 6 && h <= 18 ? 5 : 0);
      hourlyCloud.push(40);
      hourlyVis.push(18000);
    }
  }
  return {
    daily: {
      time: dailyTime,
      weather_code: [3, 1],
      temperature_2m_max: [29.4, 30.1],
      temperature_2m_min: [18.2, 19.0],
      apparent_temperature_max: [30.0, 31.0],
      apparent_temperature_min: [18.5, 19.2],
      precipitation_sum: [0.0, 1.2],
      precipitation_probability_max: [10, 30],
      relative_humidity_2m_mean: [70, 65],
      wind_speed_10m_max: [22.1, 20.0],
      wind_gusts_10m_max: [35.0, 33.0],
      uv_index_max: [8, 7],
      cloud_cover_mean: [40, 30],
      visibility_mean: [18000, 19000],
      sunrise: ["2026-07-20T06:12", "2026-07-21T06:13"],
      sunset: ["2026-07-20T20:45", "2026-07-21T20:44"],
    },
    hourly: {
      time: hourlyTime,
      weather_code: hourlyWeather,
      temperature_2m: hourlyTemp,
      apparent_temperature: hourlyApp,
      precipitation: hourlyPrec,
      precipitation_probability: hourlyPrecProb,
      relative_humidity_2m: hourlyHum,
      wind_speed_10m: hourlyWind,
      wind_gusts_10m: hourlyGust,
      uv_index: hourlyUv,
      cloud_cover: hourlyCloud,
      visibility: hourlyVis,
    },
  };
}

function mockFetchOnce(body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("OpenMeteoProvider — real, key-free adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const REQ: ForecastRequest = {
    cityId: "lisbon",
    latitude: 38.72,
    longitude: -9.14,
    timezone: "Europe/Lisbon",
    days: 2,
    startDate: "2026-07-20",
  };

  it("exposes id 'open-meteo' and is selected by the factory", () => {
    expect(new OpenMeteoProvider().id).toBe("open-meteo");
    expect(createWeatherProvider("open-meteo").id).toBe("open-meteo");
  });

  it("createWeatherProvider() still defaults to the fake provider (backward compat)", () => {
    expect(createWeatherProvider().id).toBe("fake");
    expect(createWeatherProvider("fake").id).toBe("fake");
  });

  it("createWeatherProvider('weatherapi') is reserved and disabled (throws)", () => {
    expect(() => createWeatherProvider("weatherapi")).toThrow(ProviderRequestError);
  });

  it("normalizes the Open-Meteo response 1:1 into NormalizedDaily/Hourly", async () => {
    const fetchFn = mockFetchOnce(openMeteoFixture());
    const [forecast] = await new OpenMeteoProvider().fetchForecast(REQ);

    expect(forecast.cityId).toBe("lisbon");
    expect(forecast.days).toHaveLength(2);

    const d0 = forecast.days[0];
    expect(d0.localDate).toBe("2026-07-20");
    expect(d0.weatherCode).toBe(3);
    expect(d0.tempMaxC).toBe(29.4);
    expect(d0.tempMinC).toBe(18.2);
    expect(d0.apparentMaxC).toBe(30.0);
    expect(d0.precipitationMm).toBe(0.0);
    expect(d0.precipitationProbabilityMax).toBe(10);
    expect(d0.humidityMean).toBe(70);
    expect(d0.windSpeedMaxKph).toBe(22.1);
    expect(d0.windGustMaxKph).toBe(35.0);
    expect(d0.uvIndexMax).toBe(8);
    expect(d0.cloudCoverMean).toBe(40);
    expect(d0.visibilityMeanM).toBe(18000);
    expect(d0.sunriseLocal).toBe("06:12");
    expect(d0.sunsetLocal).toBe("20:45");

    expect(d0.hourly).toHaveLength(24);
    const h0 = d0.hourly[0];
    expect(h0.localTime).toBe("2026-07-20T00:00");
    expect(h0.weatherCode).toBe(3);
    expect(h0.temperatureC).toBeCloseTo(20.1, 5);
    expect(h0.humidity).toBe(70);
    expect(h0.windGustKph).toBe(22.1);
    // Day 2 hourly is grouped under its own date.
    expect(forecast.days[1]?.hourly[0]?.localTime).toBe("2026-07-21T00:00");

    // The request must be key-free and target Open-Meteo.
    const calledUrl = (fetchFn.mock.calls[0] as ReadonlyArray<unknown>)[0] as string;
    expect(calledUrl).toContain("api.open-meteo.com/v1/forecast");
    expect(calledUrl).not.toMatch(/[?&](api_?key|token|secret)=/i);
    expect(calledUrl).toContain("latitude=38.72");
    expect(calledUrl).toContain("timezone=Europe%2FLisbon");
    expect(calledUrl).toContain("start_date=2026-07-20");
    expect(calledUrl).toContain("end_date=2026-07-21");
    // Open-Meteo rejects forecast_days when explicit start/end dates are present.
    expect(calledUrl).not.toContain("forecast_days=");
  });

  it("returns an empty list and never hits the network for zero days", async () => {
    const fetchFn = mockFetchOnce(openMeteoFixture());
    const result = await new OpenMeteoProvider().fetchForecast({ ...REQ, days: 0 });
    expect(result).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("retries on network failure and succeeds within maxRetries", async () => {
    let calls = 0;
    const fetchFn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error("ECONNRESET");
      return new Response(JSON.stringify(openMeteoFixture()), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchFn);
    const [forecast] = await new OpenMeteoProvider().fetchForecast(REQ);
    expect(forecast.days).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("throws ProviderRequestError after exhausting retries", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("boom");
    });
    vi.stubGlobal("fetch", fetchFn);
    await expect(new OpenMeteoProvider().fetchForecast(REQ)).rejects.toBeInstanceOf(
      ProviderRequestError,
    );
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("aborts on timeout, retries, then surfaces failure (no hang)", async () => {
    const fetchFn = vi.fn((_url: string, opts?: { signal?: AbortSignal }) => {
      return new Promise<never>((_resolve, reject) => {
        opts?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    vi.stubGlobal("fetch", fetchFn);
    const provider = new OpenMeteoProvider({ timeoutMs: 20, maxRetries: 2, baseBackoffMs: 5 });
    await expect(provider.fetchForecast(REQ)).rejects.toBeInstanceOf(ProviderRequestError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("healthCheck reports ok when the endpoint responds", async () => {
    mockFetchOnce(openMeteoFixture());
    const health = await new OpenMeteoProvider().healthCheck();
    expect(health.ok).toBe(true);
    expect(health.providerId).toBe("open-meteo");
  });

  it("healthCheck reports not-ok without throwing on failure", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("down");
    });
    vi.stubGlobal("fetch", fetchFn);
    const health = await new OpenMeteoProvider().healthCheck();
    expect(health.ok).toBe(false);
    expect(health.providerId).toBe("open-meteo");
  });
});

// ---------------------------------------------------------------------------
// Open-Meteo adapter — boundary resilience (QA second-layer verification).
// These assert behaviors called out by the increment PRD/design that the
// engineer's baseline suite did not yet pin down.
// ---------------------------------------------------------------------------

describe("OpenMeteoProvider — boundary resilience (QA)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const REQ: ForecastRequest = {
    cityId: "lisbon",
    latitude: 38.72,
    longitude: -9.14,
    timezone: "Europe/Lisbon",
    days: 2,
    startDate: "2026-07-20",
  };

  it("retries on HTTP 5xx and succeeds on a later attempt", async () => {
    let calls = 0;
    const fetchFn = vi.fn(async () => {
      calls += 1;
      if (calls < 2) {
        return new Response(JSON.stringify({ error: "boom" }), { status: 503 });
      }
      return new Response(JSON.stringify(openMeteoFixture()), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchFn);
    const [forecast] = await new OpenMeteoProvider().fetchForecast(REQ);
    expect(forecast.days).toHaveLength(2);
    // First attempt 5xx, second attempt 200 -> single retry, two calls total.
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("aborts the in-flight fetch via AbortController when the response is slow (no hang)", async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchFn = vi.fn((_url: string, opts?: { signal?: AbortSignal }) => {
      capturedSignal = opts?.signal;
      return new Promise<never>((_resolve, reject) => {
        opts?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    vi.stubGlobal("fetch", fetchFn);
    const provider = new OpenMeteoProvider({ timeoutMs: 20, maxRetries: 2, baseBackoffMs: 5 });
    await expect(provider.fetchForecast(REQ)).rejects.toBeInstanceOf(ProviderRequestError);
    // 1 initial + 2 retries, then give up.
    expect(fetchFn).toHaveBeenCalledTimes(3);
    // The slow request was actually aborted (wired to AbortController), not left hanging.
    expect(capturedSignal?.aborted).toBe(true);
  });
});
