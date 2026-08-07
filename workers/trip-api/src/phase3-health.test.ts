import { describe, expect, it } from "vitest";
import { handleRequest, type WorkerEnv } from "./index";

describe("phase 3 health capabilities", () => {
  it("advertises collaboration and revision history", async () => {
    const env = { DB: {} as D1Database } satisfies WorkerEnv;
    const response = await handleRequest(new Request("https://trip.example.test/health"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      cloudTrip: true,
      cloudSharing: true,
      cloudCollaboration: true,
      revisionHistory: true,
    });
  });
});
