import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripExecutionWorkspace } from "../../../components/TripExecutionWorkspace";

export const metadata: Metadata = {
  title: { absolute: "Trip execution mode - Where Not Rain" },
  description: "Route-aware trip execution with fixed constraints, hotel anchors and weather replanning.",
  robots: { index: false, follow: true },
};

export default function TripExecutionPage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/trips">Trips</a></li>
          <li><a href="/trips/workspace">Trip workspace</a></li>
          <li>Execution mode</li>
        </ol>
      </nav>
      <div className="mt-6"><TripExecutionWorkspace /></div>
    </main>
  );
}
