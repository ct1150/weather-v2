from pathlib import Path

# Discovery: commerce appears only after the user has actually created a single-destination trip.
discovery_path = Path("apps/web/src/components/WeatherDiscoveryPlannerV2.tsx")
discovery = discovery_path.read_text()
import_anchor = 'import { ExplorerMap } from "./ExplorerMap";\n'
if import_anchor not in discovery:
    raise SystemExit("Discovery import anchor changed")
discovery = discovery.replace(
    import_anchor,
    'import { ContextualAffiliateSurface } from "./ContextualAffiliateSurface";\n' + import_anchor,
    1,
)
trip_anchor = '''          <section className="info-panel mt-6" aria-labelledby="discovery-trip">
            <p className="eyebrow">{copy.trip}</p>
            <h2 id="discovery-trip" className="section-title mt-2">
              {copy.trip}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{copy.tripIntro}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="trip-primary-button"
                disabled={selectedResults.length === 0}
                onClick={() => createTrip(false)}
              >
                {copy.create}
              </button>
              <button
                type="button"
                className="trip-secondary-button"
                disabled={selectedResults.length === 0}
                onClick={() => createTrip(true)}
              >
                {copy.append}
              </button>
              {tripReady ? (
                <a className="trip-secondary-button" href={workspacePath(locale)}>
                  {copy.openTrip} →
                </a>
              ) : null}
            </div>
          </section>
'''
if trip_anchor not in discovery:
    raise SystemExit("Discovery trip section anchor changed")
discovery_commerce = trip_anchor + '''
          {tripReady && selectedResults.length === 1 && selectedResults[0] !== undefined ? (
            <div className="mt-4" data-commerce-after-decision="discovery-trip-created">
              <ContextualAffiliateSurface
                locale={locale}
                context={{
                  stage: "discovery_decided",
                  destinationId: selectedResults[0].city.cityId,
                  hasDestinationDecision: true,
                  hasTrip: true,
                  hasStructuredActivities: false,
                  carDependent: false,
                  weatherAction: "none",
                  indoorFallbackAvailable: false,
                  tripStartsWithinDays: null,
                }}
              />
            </div>
          ) : null}
'''
discovery = discovery.replace(trip_anchor, discovery_commerce, 1)
discovery_path.write_text(discovery)

# Replan: commerce appears only when the deterministic proposal contains a concrete replacement.
replan_path = Path("apps/web/src/components/TripReplanPanel.tsx")
replan = replan_path.read_text()
replan_import_anchor = 'import { normalizeWorkspace, type TripWorkspace } from "../trips/workspace";\n'
if replan_import_anchor not in replan:
    raise SystemExit("Replan import anchor changed")
replan = replan.replace(
    replan_import_anchor,
    replan_import_anchor + 'import { ContextualAffiliateSurface } from "./ContextualAffiliateSurface";\n',
    1,
)
selected_anchor = '''  const selectedDay = eligibleDays.find((day) => day.id === dayId) ?? eligibleDays[0] ?? null;
'''
if selected_anchor not in replan:
    raise SystemExit("Replan selected day anchor changed")
replan = replan.replace(
    selected_anchor,
    selected_anchor + '''  const hasIndoorFallbackProposal =
    proposal?.changes.some((change) => change.kind === "replace_activity") ?? false;
''',
    1,
)
message_anchor = '''      {message.length > 0 ? <p className="mt-3 text-xs text-muted">{message}</p> : null}
'''
if message_anchor not in replan:
    raise SystemExit("Replan message anchor changed")
commerce_block = '''      {proposal !== null && selectedDay !== null && hasIndoorFallbackProposal ? (
        <div className="mt-4" data-commerce-after-decision="weather-indoor-fallback">
          <ContextualAffiliateSurface
            locale={locale}
            context={{
              stage: "weather_replan",
              destinationId: selectedDay.cityId,
              hasDestinationDecision: true,
              hasTrip: true,
              hasStructuredActivities: true,
              carDependent: false,
              weatherAction: "indoor_fallback",
              indoorFallbackAvailable: true,
              tripStartsWithinDays: null,
            }}
          />
        </div>
      ) : null}

'''
replan = replan.replace(message_anchor, commerce_block + message_anchor, 1)
replan_path.write_text(replan)
