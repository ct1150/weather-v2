# Direct Discovery-to-Trip UX Increment

Date: 2026-08-07
Status: Production verification

## Problem

The current Weather Radar journey still requires users to open a city detail page before they can add a weather-qualified destination to the Trip Planner. This adds an unnecessary step at the exact moment the user has already made a destination decision.

## Goal

Make weather discovery results directly actionable:

**Choose dates -> compare cities -> add the chosen city and selected dates to the itinerary -> continue comparing or open the workspace.**

## Changes

- Add a direct localized `Add to trip` action to country weather comparison results.
- Add the action both to the selected-city inspector and each ranked city card.
- Keep `7-day forecast` as the secondary information path.
- Adding a selected date range creates itinerary days for the full range, not only the first date.
- Preserve existing itinerary data and avoid duplicate `same city + same date` days.
- Do not force navigation after adding; show an `Added` state plus `View trip` so users can continue comparing or add another destination.
- Keep the existing city-detail bridge as a fallback/secondary entry point, with the same full-range semantics.

## Acceptance criteria

- A user can go from a country weather comparison to a populated itinerary without manually selecting the city in Trip Planner.
- Selecting a 2-day Tokyo range and adding it creates two Tokyo itinerary days.
- Repeating the same add action does not duplicate those days.
- Existing itinerary content is not replaced.
- EN / zh-CN / zh-Hant country weather routes expose the direct action.
- CI, production deploy and product smoke pass.

## Verification progress

- Implementation merge commit: `2a035895326682830f11b8699667fde8cdcaf463`.
- Full PR Deploy validation run: `31154693667` — success.
- Initial production deploy run: `31154970804` — success.
- Initial localized smoke exposed only a raw-HTML Unicode serialization assertion issue; the product code and English direct action were deployed successfully.
- Localized smoke assertions now verify the unique localized workspace paths instead of raw Chinese client-component text.
- Final production deploy + corrected product smoke: running from this verification commit.
