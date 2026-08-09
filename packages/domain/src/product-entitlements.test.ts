import { describe, expect, it } from "vitest";
import {
  CANDIDATE_PRODUCT_ENTITLEMENTS,
  assessEntitlementUsage,
  resolveProductEntitlements,
} from "./product-entitlements";

describe("candidate product entitlement contract", () => {
  it("keeps the free baseline useful and preserves core adaptive replanning", () => {
    expect(resolveProductEntitlements("free")).toEqual({
      activeMonitoredTripsLimit: 1,
      proactiveNotifications: false,
      revisionHistoryVersionLimit: 10,
      multiCityCompareLimit: 2,
      adaptiveReplanning: true,
      collaborationMemberLimit: 2,
    });
  });

  it("uses premium for scale and proactive retention rather than removing free replanning", () => {
    const free = resolveProductEntitlements("free");
    const premium = resolveProductEntitlements("premium");

    expect(premium.activeMonitoredTripsLimit).toBeGreaterThan(free.activeMonitoredTripsLimit);
    expect(premium.revisionHistoryVersionLimit).toBeGreaterThan(free.revisionHistoryVersionLimit);
    expect(premium.multiCityCompareLimit).toBeGreaterThan(free.multiCityCompareLimit);
    expect(premium.collaborationMemberLimit).toBeGreaterThan(free.collaborationMemberLimit);
    expect(free.adaptiveReplanning).toBe(true);
    expect(premium.adaptiveReplanning).toBe(true);
    expect(free.proactiveNotifications).toBe(false);
    expect(premium.proactiveNotifications).toBe(true);
  });

  it("evaluates future usage limits deterministically without changing state", () => {
    const usage = Object.freeze({
      activeMonitoredTrips: 2,
      revisionHistoryVersionsRequested: 20,
      compareCityCount: 3,
      collaborationMembers: 3,
    });
    const before = JSON.stringify(usage);

    expect(assessEntitlementUsage("free", usage)).toEqual({
      activeMonitoredTripsAllowed: false,
      revisionHistoryAllowed: false,
      multiCityCompareAllowed: false,
      collaborationAllowed: false,
    });
    expect(assessEntitlementUsage("premium", usage)).toEqual({
      activeMonitoredTripsAllowed: true,
      revisionHistoryAllowed: true,
      multiCityCompareAllowed: true,
      collaborationAllowed: true,
    });
    expect(JSON.stringify(usage)).toBe(before);
  });

  it("fails closed on invalid usage counts", () => {
    for (const usage of [
      {
        activeMonitoredTrips: -1,
        revisionHistoryVersionsRequested: 1,
        compareCityCount: 1,
        collaborationMembers: 1,
      },
      {
        activeMonitoredTrips: 1,
        revisionHistoryVersionsRequested: 1.5,
        compareCityCount: 1,
        collaborationMembers: 1,
      },
    ]) {
      expect(assessEntitlementUsage("free", usage)).toBeNull();
    }
  });

  it("contains no billing, payment, price, customer or subscription provider fields", () => {
    const serialized = JSON.stringify(CANDIDATE_PRODUCT_ENTITLEMENTS);
    for (const forbidden of [
      "stripe",
      "billing",
      "payment",
      "price",
      "customer",
      "subscription",
      "checkout",
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
  });
});
