import type { CommercialCategory } from "./affiliate-adapter";

export type ConversionStage =
  "discovery_decided" | "trip_planning" | "trip_transport" | "weather_replan" | "trip_preparation";

export type WeatherCommercialAction = "none" | "move_time" | "indoor_fallback";

export type ConversionSurface =
  "discovery_decision" | "trip_day" | "trip_transport" | "weather_replan" | "trip_preparation";

export type ConversionReasonCode =
  | "DESTINATION_STAY_DECIDED"
  | "DESTINATION_TRANSPORT_DECIDED"
  | "STRUCTURED_ACTIVITY_PLANNED"
  | "CAR_DEPENDENCY_CONFIRMED"
  | "INDOOR_FALLBACK_AVAILABLE"
  | "NEAR_TERM_TRIP_PREPARATION";

export interface ConversionContext {
  readonly stage: ConversionStage;
  readonly destinationId?: string | null;
  readonly hasDestinationDecision: boolean;
  readonly hasTrip: boolean;
  readonly hasStructuredActivities: boolean;
  readonly carDependent: boolean;
  readonly weatherAction?: WeatherCommercialAction;
  readonly indoorFallbackAvailable: boolean;
  readonly tripStartsWithinDays?: number | null;
}

export interface ContextualCommercialOpportunity {
  readonly category: CommercialCategory;
  readonly surface: ConversionSurface;
  /** Runtime-config affiliate slot. Provider selection remains outside this resolver. */
  readonly slot: string;
  readonly destinationId: string;
  readonly reasonCode: ConversionReasonCode;
  /** Higher values are displayed first; ties use stable category ordering. */
  readonly priority: number;
}

const MAX_OPPORTUNITIES = 2;
const DESTINATION_ID_RE = /^[a-z0-9][a-z0-9_-]{1,95}$/u;

function destination(context: ConversionContext): string | null {
  const value = context.destinationId;
  return typeof value === "string" && DESTINATION_ID_RE.test(value) ? value : null;
}

function opportunity(
  category: CommercialCategory,
  surface: ConversionSurface,
  slot: string,
  destinationId: string,
  reasonCode: ConversionReasonCode,
  priority: number,
): ContextualCommercialOpportunity {
  return Object.freeze({ category, surface, slot, destinationId, reasonCode, priority });
}

const CATEGORY_ORDER: ReadonlyArray<CommercialCategory> = [
  "hotel",
  "flights",
  "activities",
  "car_rental",
  "sim",
  "insurance",
];

function stableSort(
  items: ReadonlyArray<ContextualCommercialOpportunity>,
): ReadonlyArray<ContextualCommercialOpportunity> {
  return [...items]
    .sort((left, right) => {
      const priority = right.priority - left.priority;
      if (priority !== 0) return priority;
      return CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
    })
    .slice(0, MAX_OPPORTUNITIES);
}

/**
 * Resolve commercial eligibility from an already-established product decision context.
 *
 * This function deliberately has no provider URL/config, commission/bid, weather score,
 * discovery rank or replan-score input. It chooses only a bounded contextual category/surface;
 * the existing Affiliate adapter remains authoritative for kill switches, provider allowlists,
 * disclosure and outbound-link safety.
 */
export function resolveContextualCommercialOpportunities(
  context: ConversionContext,
): ReadonlyArray<ContextualCommercialOpportunity> {
  const destinationId = destination(context);
  if (destinationId === null) return [];

  const items: ContextualCommercialOpportunity[] = [];

  switch (context.stage) {
    case "discovery_decided":
      if (!context.hasDestinationDecision) return [];
      items.push(
        opportunity(
          "hotel",
          "discovery_decision",
          "discovery.hotel",
          destinationId,
          "DESTINATION_STAY_DECIDED",
          100,
        ),
        opportunity(
          "flights",
          "discovery_decision",
          "discovery.flights",
          destinationId,
          "DESTINATION_TRANSPORT_DECIDED",
          80,
        ),
      );
      break;

    case "trip_planning":
      if (!context.hasTrip || !context.hasStructuredActivities) return [];
      items.push(
        opportunity(
          "activities",
          "trip_day",
          "trip.activities",
          destinationId,
          "STRUCTURED_ACTIVITY_PLANNED",
          100,
        ),
      );
      break;

    case "trip_transport":
      if (!context.hasTrip || !context.carDependent) return [];
      items.push(
        opportunity(
          "car_rental",
          "trip_transport",
          "trip.car_rental",
          destinationId,
          "CAR_DEPENDENCY_CONFIRMED",
          100,
        ),
      );
      break;

    case "weather_replan":
      if (
        !context.hasTrip ||
        context.weatherAction !== "indoor_fallback" ||
        !context.indoorFallbackAvailable
      ) {
        return [];
      }
      items.push(
        opportunity(
          "activities",
          "weather_replan",
          "weather.indoor_activity",
          destinationId,
          "INDOOR_FALLBACK_AVAILABLE",
          100,
        ),
      );
      break;

    case "trip_preparation": {
      if (!context.hasTrip) return [];
      const days = context.tripStartsWithinDays;
      if (typeof days !== "number" || !Number.isInteger(days) || days < 0 || days > 30) return [];
      items.push(
        opportunity(
          "sim",
          "trip_preparation",
          "trip.sim",
          destinationId,
          "NEAR_TERM_TRIP_PREPARATION",
          100,
        ),
      );
      break;
    }
  }

  return Object.freeze(stableSort(items));
}
