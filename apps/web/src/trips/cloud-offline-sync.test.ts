import { describe, expect, it } from "vitest";
import { CloudTripError } from "./cloud-sync";
import { shouldQueueCloudWrite } from "./cloud-offline-sync";

describe("Cloud Trip offline queue policy", () => {
  it("queues network and transient server failures", () => {
    expect(shouldQueueCloudWrite(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldQueueCloudWrite(new CloudTripError("RATE_LIMITED", 429))).toBe(true);
    expect(shouldQueueCloudWrite(new CloudTripError("UPSTREAM_FAILURE", 503))).toBe(true);
  });

  it("does not turn authorization or optimistic-lock failures into blind retries", () => {
    expect(shouldQueueCloudWrite(new CloudTripError("UNAUTHORIZED", 401))).toBe(false);
    expect(shouldQueueCloudWrite(new CloudTripError("FORBIDDEN", 403))).toBe(false);
    expect(shouldQueueCloudWrite(new CloudTripError("VERSION_CONFLICT", 409, 7))).toBe(false);
  });
});
