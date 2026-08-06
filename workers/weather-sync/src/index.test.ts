import { describe, expect, it } from "vitest";

import { handleRequest, type WorkerEnv } from "./index";

const env = {
  DB: {},
  WEATHER_SYNC_KV: { put: async () => undefined },
  WEATHER_PRIMARY_PROVIDER: "fake",
  SYNC_TRIGGER_TOKEN: "a".repeat(64),
} as unknown as WorkerEnv;

describe("weather-sync operational HTTP boundary", () => {
  it("exposes a read-only health endpoint", async () => {
    const response = await handleRequest(new Request("https://sync.example/health"), env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "weather-sync",
      manualTriggerProtected: true,
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

  it("returns 404 for unknown public paths", async () => {
    const response = await handleRequest(new Request("https://sync.example/"), env);
    expect(response.status).toBe(404);
  });
});
