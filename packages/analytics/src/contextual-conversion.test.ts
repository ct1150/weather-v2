import { describe, expect, it } from "vitest";
import {
  resolveContextualCommercialOpportunities,
  type ConversionContext,
} from "./contextual-conversion";

function context(overrides: Partial<ConversionContext> = {}): ConversionContext {
  return {
    stage: "discovery_decided",
    destinationId: "jp-tokyo",
    hasDestinationDecision: true,
    hasTrip: false,
    hasStructuredActivities: false,
    carDependent: false,
    weatherAction: "none",
    indoorFallbackAvailable: false,
    tripStartsWithinDays: null,
    ...overrides,
  };
}

describe("contextual conversion resolver", () => {
  it("returns a stable bounded hotel/activity pair only after a destination decision", () => {
    const input = context();
    const first = resolveContextualCommercialOpportunities(input);
    const second = resolveContextualCommercialOpportunities(input);

    expect(first).toEqual(second);
    expect(first).toEqual([
      {
        category: "hotel",
        surface: "discovery_decision",
        slot: "discovery.hotel",
        destinationId: "jp-tokyo",
        reasonCode: "DESTINATION_STAY_DECIDED",
        priority: 100,
      },
      {
        category: "activities",
        surface: "discovery_decision",
        slot: "discovery.activities",
        destinationId: "jp-tokyo",
        reasonCode: "DESTINATION_ACTIVITY_OPTIONS",
        priority: 90,
      },
    ]);
    expect(first).toHaveLength(2);
  });

  it("fails closed for weak or malformed decision context", () => {
    expect(
      resolveContextualCommercialOpportunities(context({ hasDestinationDecision: false })),
    ).toEqual([]);
    expect(
      resolveContextualCommercialOpportunities(context({ destinationId: "https://example.com" })),
    ).toEqual([]);
    expect(resolveContextualCommercialOpportunities(context({ destinationId: null }))).toEqual([]);
  });

  it("requires structured Trip context before suggesting activity tickets", () => {
    expect(
      resolveContextualCommercialOpportunities(
        context({
          stage: "trip_planning",
          hasDestinationDecision: false,
          hasTrip: true,
          hasStructuredActivities: true,
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        category: "activities",
        surface: "trip_day",
        slot: "trip.activities",
        reasonCode: "STRUCTURED_ACTIVITY_PLANNED",
      }),
    ]);

    expect(
      resolveContextualCommercialOpportunities(
        context({ stage: "trip_planning", hasTrip: true, hasStructuredActivities: false }),
      ),
    ).toEqual([]);
  });

  it("requires explicit car dependency before suggesting car rental", () => {
    expect(
      resolveContextualCommercialOpportunities(
        context({ stage: "trip_transport", hasTrip: true, carDependent: false }),
      ),
    ).toEqual([]);

    expect(
      resolveContextualCommercialOpportunities(
        context({ stage: "trip_transport", hasTrip: true, carDependent: true }),
      ),
    ).toEqual([
      expect.objectContaining({
        category: "car_rental",
        surface: "trip_transport",
        reasonCode: "CAR_DEPENDENCY_CONFIRMED",
      }),
    ]);
  });

  it("never turns bad weather alone into an insurance opportunity", () => {
    for (const weatherAction of ["none", "move_time"] as const) {
      const opportunities = resolveContextualCommercialOpportunities(
        context({
          stage: "weather_replan",
          hasTrip: true,
          weatherAction,
          indoorFallbackAvailable: false,
        }),
      );
      expect(opportunities).toEqual([]);
      expect(opportunities.some((item) => item.category === "insurance")).toBe(false);
    }
  });

  it("allows a weather replan activity surface only for a concrete indoor fallback", () => {
    expect(
      resolveContextualCommercialOpportunities(
        context({
          stage: "weather_replan",
          hasTrip: true,
          weatherAction: "indoor_fallback",
          indoorFallbackAvailable: false,
        }),
      ),
    ).toEqual([]);

    expect(
      resolveContextualCommercialOpportunities(
        context({
          stage: "weather_replan",
          hasTrip: true,
          weatherAction: "indoor_fallback",
          indoorFallbackAvailable: true,
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        category: "activities",
        surface: "weather_replan",
        reasonCode: "INDOOR_FALLBACK_AVAILABLE",
      }),
    ]);
  });

  it("only emits SIM preparation context for a near-term trip", () => {
    for (const days of [0, 7, 30]) {
      expect(
        resolveContextualCommercialOpportunities(
          context({ stage: "trip_preparation", hasTrip: true, tripStartsWithinDays: days }),
        ),
      ).toEqual([expect.objectContaining({ category: "sim", surface: "trip_preparation" })]);
    }

    for (const days of [-1, 31, 1.5, null]) {
      expect(
        resolveContextualCommercialOpportunities(
          context({ stage: "trip_preparation", hasTrip: true, tripStartsWithinDays: days }),
        ),
      ).toEqual([]);
    }
  });

  it("does not mutate context and exposes no provider, URL, commission or weather-score fields", () => {
    const input = Object.freeze(context());
    const before = JSON.stringify(input);
    const output = resolveContextualCommercialOpportunities(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(output.length).toBeGreaterThan(0);
    for (const item of output) {
      const keys = Object.keys(item);
      expect(keys).not.toEqual(expect.arrayContaining(["href", "providerId", "commission", "bid"]));
      expect(keys.some((key) => /weather|risk|score/iu.test(key))).toBe(false);
    }
  });
});
