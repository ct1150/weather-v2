import { describe, expect, it } from "vitest";
import { handleRequest, type WorkerEnv } from "./index";

describe("phase 3 health capabilities", () => {
  it("advertises collaboration and revision history", async () => {
    const env = { DB: {} as D1Database } satisfies WorkerEnv;
    const response = await handleRequest(new Request("https://trip.example.test/health"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      cloudTrip: true,
      cloudSharing: true,
      cloudCollaboration: true,
      revisionHistory: true,
    });
  });

  it("allows collaboration headers and mutation methods through CORS preflight", async () => {
    const env = {
      DB: {} as D1Database,
      WEB_ORIGIN: "https://868656.xyz",
    } satisfies WorkerEnv;
    const response = await handleRequest(
      new Request("https://trip.example.test/api/v1/trip-invites/current", {
        method: "OPTIONS",
        headers: { origin: "https://868656.xyz" },
      }),
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("x-wnr-invite-token");
    expect(response.headers.get("access-control-allow-methods")).toContain("PATCH");
    expect(response.headers.get("access-control-allow-methods")).toContain("DELETE");
  });
});
