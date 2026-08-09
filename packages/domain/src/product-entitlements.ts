export type ProductPlan = "free" | "premium";

export interface ProductEntitlements {
  /** Number of trips that may be actively monitored for future proactive weather changes. */
  readonly activeMonitoredTripsLimit: number;
  /** Readiness for proactive notification delivery once a delivery channel exists. */
  readonly proactiveNotifications: boolean;
  /** Number of immutable Cloud Trip versions exposed by the product surface. */
  readonly revisionHistoryVersionLimit: number;
  /** Number of destinations that may participate in one advanced comparison context. */
  readonly multiCityCompareLimit: number;
  /** Core adaptive replanning remains available on every plan. */
  readonly adaptiveReplanning: boolean;
  /** Maximum collaboration members beyond the owner for one trip. */
  readonly collaborationMemberLimit: number;
}

export interface EntitlementUsage {
  readonly activeMonitoredTrips: number;
  readonly revisionHistoryVersionsRequested: number;
  readonly compareCityCount: number;
  readonly collaborationMembers: number;
}

export interface EntitlementUsageAssessment {
  readonly activeMonitoredTripsAllowed: boolean;
  readonly revisionHistoryAllowed: boolean;
  readonly multiCityCompareAllowed: boolean;
  readonly collaborationAllowed: boolean;
}

/**
 * Candidate product-policy boundary only. It is intentionally billing-provider neutral and is not
 * automatically enforced by Phase 9. Existing free product behavior remains available unless a
 * later, separately approved rollout explicitly wires one of these limits into a product surface.
 */
export const CANDIDATE_PRODUCT_ENTITLEMENTS: Readonly<Record<ProductPlan, ProductEntitlements>> =
  Object.freeze({
    free: Object.freeze({
      activeMonitoredTripsLimit: 1,
      proactiveNotifications: false,
      revisionHistoryVersionLimit: 10,
      multiCityCompareLimit: 2,
      adaptiveReplanning: true,
      collaborationMemberLimit: 2,
    }),
    premium: Object.freeze({
      activeMonitoredTripsLimit: 10,
      proactiveNotifications: true,
      revisionHistoryVersionLimit: 100,
      multiCityCompareLimit: 4,
      adaptiveReplanning: true,
      collaborationMemberLimit: 10,
    }),
  });

export function resolveProductEntitlements(plan: ProductPlan): ProductEntitlements {
  return CANDIDATE_PRODUCT_ENTITLEMENTS[plan];
}

function validUsage(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Pure planning helper for future rollout work. It evaluates bounded usage only; it neither
 * charges a user nor changes a subscription/account state.
 */
export function assessEntitlementUsage(
  plan: ProductPlan,
  usage: EntitlementUsage,
): EntitlementUsageAssessment | null {
  if (
    !validUsage(usage.activeMonitoredTrips) ||
    !validUsage(usage.revisionHistoryVersionsRequested) ||
    !validUsage(usage.compareCityCount) ||
    !validUsage(usage.collaborationMembers)
  ) {
    return null;
  }
  const entitlement = resolveProductEntitlements(plan);
  return {
    activeMonitoredTripsAllowed:
      usage.activeMonitoredTrips <= entitlement.activeMonitoredTripsLimit,
    revisionHistoryAllowed:
      usage.revisionHistoryVersionsRequested <= entitlement.revisionHistoryVersionLimit,
    multiCityCompareAllowed: usage.compareCityCount <= entitlement.multiCityCompareLimit,
    collaborationAllowed: usage.collaborationMembers <= entitlement.collaborationMemberLimit,
  };
}
