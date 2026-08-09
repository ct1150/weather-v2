from pathlib import Path

# -----------------------------------------------------------------------------
# @wnr/analytics event contract
# -----------------------------------------------------------------------------
events_path = Path("packages/analytics/src/events.ts")
text = events_path.read_text()

anchor = 'export type SearchResultType = "city" | "country" | "article";\n'
addition = '''export type TripCreationSource = "weather_discovery" | "workspace";

'''
if anchor not in text:
    raise SystemExit("events type anchor changed")
text = text.replace(anchor, anchor + "\n" + addition, 1)

ranking_anchor = '''export interface RankingCityClickedEvent {
  readonly event: "ranking_city_clicked";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly theme: AnalyticsTheme;
  readonly window: AnalyticsWindow;
  readonly city_id: string;
  readonly rank: number;
}
'''
new_interfaces = ranking_anchor + '''
export interface WeatherDiscoveryViewEvent {
  readonly event: "weather_discovery_view";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
}

export interface DestinationShortlistedEvent {
  readonly event: "destination_shortlisted";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly destination_id: string;
}

export interface TripCreatedEvent {
  readonly event: "trip_created";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly destination_count: number;
  readonly source: TripCreationSource;
}

export interface WeatherInsightOpenedEvent {
  readonly event: "weather_insight_opened";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
}

export interface ReplanProposedEvent {
  readonly event: "replan_proposed";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly change_count: number;
  readonly fallback_included: boolean;
}

export interface ReplanAcceptedEvent {
  readonly event: "replan_accepted";
  readonly event_version: 1;
  readonly occurred_at: string;
  readonly route_template: string;
  readonly locale: AnalyticsLocale;
  readonly change_count: number;
}
'''
if ranking_anchor not in text:
    raise SystemExit("ranking interface anchor changed")
text = text.replace(ranking_anchor, new_interfaces, 1)

union_anchor = '''  | RankingViewedEvent
  | RankingCityClickedEvent
  | (AffiliateImpressionTelemetry & AffiliateTelemetryCommon)
'''
union_new = '''  | RankingViewedEvent
  | RankingCityClickedEvent
  | WeatherDiscoveryViewEvent
  | DestinationShortlistedEvent
  | TripCreatedEvent
  | WeatherInsightOpenedEvent
  | ReplanProposedEvent
  | ReplanAcceptedEvent
  | (AffiliateImpressionTelemetry & AffiliateTelemetryCommon)
'''
if union_anchor not in text:
    raise SystemExit("analytics union anchor changed")
text = text.replace(union_anchor, union_new, 1)

route_anchor = '''  "/article/[slug]",
]);
'''
route_new = '''  "/article/[slug]",
  "/discover",
  "/trips/workspace",
]);
'''
if route_anchor not in text:
    raise SystemExit("route allowlist anchor changed")
text = text.replace(route_anchor, route_new, 1)

event_names_anchor = '''  "ranking_viewed",
  "ranking_city_clicked",
  "affiliate_impression",
'''
event_names_new = '''  "ranking_viewed",
  "ranking_city_clicked",
  "weather_discovery_view",
  "destination_shortlisted",
  "trip_created",
  "weather_insight_opened",
  "replan_proposed",
  "replan_accepted",
  "affiliate_impression",
'''
if event_names_anchor not in text:
    raise SystemExit("event names anchor changed")
text = text.replace(event_names_anchor, event_names_new, 1)

privacy_anchor = '''const PRIVACY_RE =
  /(^|_)(ip|ip_address|location|lat|lng|latitude|longitude|email|user_agent|cookie|authorization|api_key|secret|password|credential|user_id|session_id|device_id|phone|name|address)(_|$)/iu;
'''
privacy_new = privacy_anchor + '''const ITINERARY_CONTENT_RE =
  /(activity_title|activity_name|trip_title|itinerary|notes?|poi_name|hotel_name|reservation_code)/iu;
'''
if privacy_anchor not in text:
    raise SystemExit("privacy anchor changed")
text = text.replace(privacy_anchor, privacy_new, 1)

validation_anchor = '''  for (const key of Object.keys(obj)) {
    if (PRIVACY_RE.test(key)) return failV("privacy_field_present");
  }
'''
validation_new = '''  for (const key of Object.keys(obj)) {
    if (PRIVACY_RE.test(key) || ITINERARY_CONTENT_RE.test(key)) {
      return failV("privacy_field_present");
    }
  }
'''
if validation_anchor not in text:
    raise SystemExit("privacy validation anchor changed")
text = text.replace(validation_anchor, validation_new, 1)

helper_anchor = '''function asPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}
'''
helper_new = helper_anchor + '''
function asBoundedPositiveInt(v: unknown, max: number): v is number {
  return asPositiveInt(v) && v <= max;
}

function isTripCreationSource(v: unknown): v is TripCreationSource {
  return v === "weather_discovery" || v === "workspace";
}
'''
if helper_anchor not in text:
    raise SystemExit("validator helper anchor changed")
text = text.replace(helper_anchor, helper_new, 1)

build_anchor = '''    case "affiliate_impression":
    case "affiliate_click": {
'''
funnel_cases = '''    case "weather_discovery_view":
      return okV<AnalyticsEvent>({ ...common, event: "weather_discovery_view" });

    case "destination_shortlisted": {
      const id = obj.destination_id;
      if (!asString(id) || !DESTINATION_KEY_RE.test(id)) return failV("invalid_destination_id");
      return okV<AnalyticsEvent>({
        ...common,
        event: "destination_shortlisted",
        destination_id: id,
      });
    }

    case "trip_created": {
      const count = obj.destination_count;
      if (!asBoundedPositiveInt(count, 16)) return failV("invalid_destination_count");
      const source = obj.source;
      if (!isTripCreationSource(source)) return failV("invalid_trip_creation_source");
      return okV<AnalyticsEvent>({
        ...common,
        event: "trip_created",
        destination_count: count,
        source,
      });
    }

    case "weather_insight_opened":
      return okV<AnalyticsEvent>({ ...common, event: "weather_insight_opened" });

    case "replan_proposed": {
      const count = obj.change_count;
      if (!asBoundedPositiveInt(count, 12)) return failV("invalid_change_count");
      const fallback = obj.fallback_included;
      if (typeof fallback !== "boolean") return failV("invalid_fallback_included");
      return okV<AnalyticsEvent>({
        ...common,
        event: "replan_proposed",
        change_count: count,
        fallback_included: fallback,
      });
    }

    case "replan_accepted": {
      const count = obj.change_count;
      if (!asBoundedPositiveInt(count, 12)) return failV("invalid_change_count");
      return okV<AnalyticsEvent>({
        ...common,
        event: "replan_accepted",
        change_count: count,
      });
    }

'''
if build_anchor not in text:
    raise SystemExit("build payload affiliate anchor changed")
text = text.replace(build_anchor, funnel_cases + build_anchor, 1)

bounded_anchor = '''    case "ranking_city_clicked":
      return { theme: e.theme, window: e.window, city_id: e.city_id, rank: e.rank };
    case "affiliate_impression":
'''
bounded_new = '''    case "ranking_city_clicked":
      return { theme: e.theme, window: e.window, city_id: e.city_id, rank: e.rank };
    case "weather_discovery_view":
    case "weather_insight_opened":
      return {};
    case "destination_shortlisted":
      return { destination_id: e.destination_id };
    case "trip_created":
      return { destination_count: e.destination_count, source: e.source };
    case "replan_proposed":
      return { change_count: e.change_count, fallback_included: e.fallback_included };
    case "replan_accepted":
      return { change_count: e.change_count };
    case "affiliate_impression":
'''
if bounded_anchor not in text:
    raise SystemExit("bounded fields anchor changed")
text = text.replace(bounded_anchor, bounded_new, 1)

events_path.write_text(text)

# -----------------------------------------------------------------------------
# Commercial resolver exposes placement for analytics only.
# -----------------------------------------------------------------------------
affiliate_path = Path("apps/web/src/commercial/contextual-affiliate.ts")
affiliate = affiliate_path.read_text()
vm_anchor = '''  readonly category: CommercialCategory;
  readonly surface: ConversionSurface;
  readonly destinationId: string;
'''
vm_new = '''  readonly category: CommercialCategory;
  readonly surface: ConversionSurface;
  readonly placement: Placement;
  readonly destinationId: string;
'''
if vm_anchor not in affiliate:
    raise SystemExit("affiliate view model anchor changed")
affiliate = affiliate.replace(vm_anchor, vm_new, 1)
resolved_anchor = '''        category: offer.category,
        surface: opportunity.surface,
        destinationId: opportunity.destinationId,
'''
resolved_new = '''        category: offer.category,
        surface: opportunity.surface,
        placement: placement(opportunity.surface),
        destinationId: opportunity.destinationId,
'''
if resolved_anchor not in affiliate:
    raise SystemExit("affiliate resolved view model anchor changed")
affiliate = affiliate.replace(resolved_anchor, resolved_new, 1)
affiliate_path.write_text(affiliate)

# -----------------------------------------------------------------------------
# Contextual affiliate impression/click telemetry.
# -----------------------------------------------------------------------------
surface_path = Path("apps/web/src/components/ContextualAffiliateSurface.tsx")
surface = surface_path.read_text()
if not surface.startswith('import type { ConversionContext }'):
    raise SystemExit("commercial component start changed")
surface = '"use client";\n\n' + surface
surface = surface.replace(
    'import type { ConversionContext } from "@wnr/analytics";\nimport type { ReactElement } from "react";\n',
    'import { buildAffiliateClick, buildAffiliateImpression, type ConversionContext } from "@wnr/analytics";\nimport { useEffect, useRef, type ReactElement } from "react";\n',
    1,
)
surface_import_anchor = '''} from "../commercial/contextual-affiliate";
'''
if surface_import_anchor not in surface:
    raise SystemExit("commercial import anchor changed")
surface = surface.replace(
    surface_import_anchor,
    surface_import_anchor + 'import { emitProductAnalytics } from "../analytics/browser-events";\n',
    1,
)
copy_anchor = '''const COPY: Record<CommercialSurfaceLocale, { readonly title: string }> = {
'''
route_helper = '''function analyticsRoute(surface: string): "/discover" | "/trips/workspace" {
  return surface === "discovery_decision" ? "/discover" : "/trips/workspace";
}

'''
if copy_anchor not in surface:
    raise SystemExit("commercial copy anchor changed")
surface = surface.replace(copy_anchor, route_helper + copy_anchor, 1)
items_anchor = '''  const items = resolveContextualAffiliateSurface({
    context,
    locale,
    rawOffers: RAW_OFFERS,
    enabledSlots: ENABLED_SLOTS,
  });
  if (items.length === 0) return null;
'''
items_new = '''  const items = resolveContextualAffiliateSurface({
    context,
    locale,
    rawOffers: RAW_OFFERS,
    enabledSlots: ENABLED_SLOTS,
  });
  const impressed = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const item of items) {
      const key = `${item.id}:${item.href}`;
      if (impressed.current.has(key)) continue;
      impressed.current.add(key);
      emitProductAnalytics({
        locale,
        routeTemplate: analyticsRoute(item.surface),
        fields: buildAffiliateImpression({
          providerId: item.providerId,
          category: item.category,
          placement: item.placement,
          destinationId: item.destinationId,
        }),
      });
    }
  }, [items, locale]);
  if (items.length === 0) return null;
'''
if items_anchor not in surface:
    raise SystemExit("commercial items anchor changed")
surface = surface.replace(items_anchor, items_new, 1)
link_anchor = '''            data-commercial-category={item.category}
            data-commercial-reason={item.reasonCode}
          >
'''
link_new = '''            data-commercial-category={item.category}
            data-commercial-reason={item.reasonCode}
            onClick={() => {
              emitProductAnalytics({
                locale,
                routeTemplate: analyticsRoute(item.surface),
                fields: buildAffiliateClick({
                  providerId: item.providerId,
                  category: item.category,
                  placement: item.placement,
                  destinationId: item.destinationId,
                }),
              });
            }}
          >
'''
if link_anchor not in surface:
    raise SystemExit("commercial link anchor changed")
surface = surface.replace(link_anchor, link_new, 1)
surface_path.write_text(surface)

# -----------------------------------------------------------------------------
# Discovery funnel touchpoints.
# -----------------------------------------------------------------------------
discovery_path = Path("apps/web/src/components/WeatherDiscoveryPlannerV2.tsx")
discovery = discovery_path.read_text()
discovery = discovery.replace(
    '  useMemo,\n  useState,\n',
    '  useMemo,\n  useRef,\n  useState,\n',
    1,
)
cloud_anchor = 'import { clearCloudMetadata } from "../trips/cloud-sync";\n'
if cloud_anchor not in discovery:
    raise SystemExit("Discovery cloud anchor changed")
discovery = discovery.replace(
    cloud_anchor,
    'import { emitProductAnalytics } from "../analytics/browser-events";\n' + cloud_anchor,
    1,
)
state_anchor = '''  const [tripReady, setTripReady] = useState(false);
'''
if state_anchor not in discovery:
    raise SystemExit("Discovery state anchor changed")
discovery = discovery.replace(
    state_anchor,
    state_anchor + '''  const discoveryViewTracked = useRef(false);

  useEffect(() => {
    if (discoveryViewTracked.current) return;
    discoveryViewTracked.current = true;
    emitProductAnalytics({
      locale,
      routeTemplate: "/discover",
      fields: { event: "weather_discovery_view" },
    });
  }, [locale]);
''',
    1,
)
toggle_anchor = '''        if (next === current) setMessage(copy.shortlistFull);
        else setMessage("");
        updateUrl(applied, next);
        return next;
'''
toggle_new = '''        if (next === current) setMessage(copy.shortlistFull);
        else setMessage("");
        if (!current.includes(cityId) && next !== current) {
          emitProductAnalytics({
            locale,
            routeTemplate: "/discover",
            fields: { event: "destination_shortlisted", destination_id: cityId },
          });
        }
        updateUrl(applied, next);
        return next;
'''
if toggle_anchor not in discovery:
    raise SystemExit("Discovery toggle anchor changed")
discovery = discovery.replace(toggle_anchor, toggle_new, 1)
create_anchor = '''      window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
      setTripReady(true);
'''
create_new = '''      window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
      if (!append) {
        emitProductAnalytics({
          locale,
          routeTemplate: "/discover",
          fields: {
            event: "trip_created",
            destination_count: selectedResults.length,
            source: "weather_discovery",
          },
        });
      }
      setTripReady(true);
'''
if create_anchor not in discovery:
    raise SystemExit("Discovery create anchor changed")
discovery = discovery.replace(create_anchor, create_new, 1)
discovery_path.write_text(discovery)

# -----------------------------------------------------------------------------
# Weather Insight open funnel touchpoint.
# -----------------------------------------------------------------------------
weather_panel_path = Path("apps/web/src/components/TripWeatherIntelligencePanel.tsx")
weather_panel = weather_panel_path.read_text()
import_anchor = 'import type { TripAccessRole } from "../trips/cloud-sync";\n'
if import_anchor not in weather_panel:
    raise SystemExit("Weather panel import anchor changed")
weather_panel = weather_panel.replace(
    import_anchor,
    'import { emitProductAnalytics } from "../analytics/browser-events";\n' + import_anchor,
    1,
)
toggle_anchor = '''      const next = !current;
      if (next) void load();
      return next;
'''
toggle_new = '''      const next = !current;
      if (next) {
        emitProductAnalytics({
          locale,
          routeTemplate: "/trips/workspace",
          fields: { event: "weather_insight_opened" },
        });
        void load();
      }
      return next;
'''
if toggle_anchor not in weather_panel:
    raise SystemExit("Weather panel toggle anchor changed")
weather_panel = weather_panel.replace(toggle_anchor, toggle_new, 1)
weather_panel_path.write_text(weather_panel)

# -----------------------------------------------------------------------------
# Replan proposal/accept funnel touchpoints.
# -----------------------------------------------------------------------------
replan_path = Path("apps/web/src/components/TripReplanPanel.tsx")
replan = replan_path.read_text()
activity_anchor = 'import { activityItemsToLegacy, type TripActivity } from "../trips/activity-intelligence";\n'
if activity_anchor not in replan:
    raise SystemExit("Replan activity anchor changed")
replan = replan.replace(
    activity_anchor,
    'import { emitProductAnalytics } from "../analytics/browser-events";\n' + activity_anchor,
    1,
)
proposal_anchor = '''      setProposal(next);
      setSelectedIds(new Set(next.changes.map((change) => change.activityId)));
      setMessage(next.changes.length === 0 ? copy.noChanges : "");
'''
proposal_new = '''      setProposal(next);
      setSelectedIds(new Set(next.changes.map((change) => change.activityId)));
      if (next.changes.length > 0) {
        emitProductAnalytics({
          locale,
          routeTemplate: "/trips/workspace",
          fields: {
            event: "replan_proposed",
            change_count: next.changes.length,
            fallback_included: next.changes.some((change) => change.kind === "replace_activity"),
          },
        });
      }
      setMessage(next.changes.length === 0 ? copy.noChanges : "");
'''
if proposal_anchor not in replan:
    raise SystemExit("Replan proposal anchor changed")
replan = replan.replace(proposal_anchor, proposal_new, 1)
apply_anchor = '''      await onApply(proposedWorkspace, proposal.weatherSnapshotId, selectedChangeIds);
      setProposal(null);
'''
apply_new = '''      await onApply(proposedWorkspace, proposal.weatherSnapshotId, selectedChangeIds);
      emitProductAnalytics({
        locale,
        routeTemplate: "/trips/workspace",
        fields: { event: "replan_accepted", change_count: selectedChangeIds.length },
      });
      setProposal(null);
'''
if apply_anchor not in replan:
    raise SystemExit("Replan apply anchor changed")
replan = replan.replace(apply_anchor, apply_new, 1)
replan_path.write_text(replan)
