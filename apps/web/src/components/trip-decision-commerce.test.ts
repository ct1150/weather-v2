import { describe, expect, it } from "vitest";
import { createBlankWorkspace } from "../trips/workspace";
import { tripDecisionConversionContext } from "./TripDecisionCommercialSurface";

describe("tripDecisionConversionContext", () => {
  it("does not create commercial context before a destination is chosen", () => {
    const workspace = createBlankWorkspace({ now: "2026-08-24T00:00:00.000Z" });
    expect(tripDecisionConversionContext(workspace)).toBeNull();
  });

  it("creates a bounded discovery-decided context after destination choice", () => {
    const blank = createBlankWorkspace({ now: "2026-08-24T00:00:00.000Z" });
    const first = blank.days[0];
    expect(first).toBeDefined();
    const workspace = {
      ...blank,
      days: [
        {
          ...first!,
          date: "2026-08-24",
          cityId: "tokyo",
          cityName: "Tokyo",
          countryName: "Japan",
          activities: ["Senso-ji"],
        },
      ],
    };

    expect(tripDecisionConversionContext(workspace)).toEqual({
      stage: "discovery_decided",
      destinationId: "tokyo",
      hasDestinationDecision: true,
      hasTrip: true,
      hasStructuredActivities: true,
      carDependent: false,
      indoorFallbackAvailable: false,
    });
  });
});
