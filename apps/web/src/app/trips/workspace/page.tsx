import type { Metadata } from "next";
import type { ReactElement } from "react";
import { InternationalTripWorkspace } from "../../../components/InternationalTripWorkspace";
import { TripDecisionCommercialSurface } from "../../../components/TripDecisionCommercialSurface";
import { buildAlternates } from "../../seo";

export const metadata: Metadata = {
  title: "Weather-aware trip workspace",
  description:
    "Build a Japan, Korea or Southeast Asia itinerary, refresh trip weather and get day-by-day fallback decisions.",
  alternates: buildAlternates("/trips/workspace", "en", ["en", "zh-hant", "zh-cn"]),
  robots: { index: false, follow: true },
};

export default function InternationalTripWorkspacePage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <a href="/trips">Trip planner</a>
          </li>
          <li>Workspace</li>
        </ol>
      </nav>
      <div className="mt-5 flex justify-end">
        <a className="trip-primary-button" href="/trips/execution">
          Open execution mode →
        </a>
      </div>
      <TripDecisionCommercialSurface locale="en" />
      <div className="mt-6">
        <InternationalTripWorkspace />
      </div>
    </main>
  );
}
