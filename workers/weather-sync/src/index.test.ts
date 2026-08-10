import { describe, expect, it } from "vitest";

import {
  handleRequest,
  resolveSyncProviderName,
  WeatherProviderConfigurationError,
  type WorkerEnv,
} from "./index";

const env = {
  DB: {},
  WEATHER_SYNC_KV: { put: async () => undefined },
  WEATHER_PRIMARY_PROVIDER: "fake",
  SYNC_TRIGGER_TOKEN: "a".repeat(64),
} as unknown as WorkerEnv;

describe("weather-sync provider configuration", () => {
  it("accepts only explicitly supported ingestion providers", () => {
    expect(resolveSyncProviderName("open-meteo")).toBe("open-meteo");
    expect(resolveSyncProviderName("fake")).toBe("fake");
    expect(() => resolveSyncProviderName(undefined)).toThrow(
      WeatherProviderConfigurationError,
    );
    expect(() => resolveSyncProviderName("unknown")).toThrow(WeatherProviderConfigurationError);
    expect(() => resolveSyncProviderName("weatherapi")).toThrow(
      WeatherProviderConfigurationError,
    );
  });
});

describe("weather-sync operational HTTP boundary", () => {
  it("exposes a read-only health endpoint with the configured provider", async () => {
    const response = await handleRequest(new Request("https://sync.example/health"), env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "weather-sync",
      manualTriggerProtected: true,
      provider: "fake",
    });
  });

  it("fails health closed when the provider binding is missing", async () => {
    const misconfigured = {
      ...env,
      WEATHER_PRIMARY_PROVIDER: undefined,
    } as unknown as WorkerEnv;
    const response = await handleRequest(
      new Request("https://sync.example/health"),
      misconfigured,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "WEATHER_PROVIDER_MISCONFIGURED",
    });
  });

  it("does not run synchronization through GET", async () => {
    const response = await handleRequest(new Request("https://sync.example/internal/sync"), env);
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({ error: "METHOD_NOT_ALLOWED" });
  });

  it("rejects anonymous and invalid bearer tokens", async () => {
    const anonymous = await handleRequest(
      new Request("https://sync.example/internal/sync", { method: "POST" }),
      env,
    );
    expect(anonymous.status).toBe(401);

    const invalid = await handleRequest(
      new Request("https://sync.example/internal/sync", {
        method: "POST",
        headers: { authorization: `Bearer ${"b".repeat(64)}` },
      }),
      env,
    );
    expect(invalid.status).toBe(401);
  });

  it("rejects anonymous and invalid bearer tokens before provider resolution", async () => {
    const missingProviderEnv = {
      ...env,
      WEATHER_PRIMARY_PROVIDER: undefined,
    } as unknown as WorkerEnv;
    const response = await handleRequest(
      new Request("https://sync.example/internal/sync", { method: "POST" }),
      missingProviderEnv,
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for unknown public paths", async () => {
    const response = await handleRequest(new Request("https://sync.example/"), env);
    expect(response.status).toBe(404);
  });
});
