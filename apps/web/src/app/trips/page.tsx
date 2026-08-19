import type { Metadata } from "next";
import type { ReactElement } from "react";
import { MyTripsDashboard } from "../../components/MyTripsDashboard";
import { buildAlternates } from "../seo";

export const metadata: Metadata = {
  title: "Advanced itinerary tools",
  description:
    "Existing local and cloud trip workspaces remain available as optional advanced tools.",
  alternates: buildAlternates("/trips", "en", ["en", "zh-hant", "zh-cn"]),
  robots: { index: false, follow: true },
};

export default function TripsLanding(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">Advanced itinerary tools</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            Existing workspaces remain available.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Where Not Rain now focuses on choosing a least-rain destination. Existing itinerary,
            collaboration and execution tools remain available here for people who already use them.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/discover">
              Return to destination finder
            </a>
            <a className="trip-secondary-button" href="/trips/workspace">
              Open existing workspace
            </a>
          </div>
          <a
            className="mt-4 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
            href="/trips/new"
          >
            Import an existing itinerary
          </a>
        </div>
      </section>

      <MyTripsDashboard locale="en" />

      <footer className="page-footer">
        <span>Where Not Rain · Advanced tools for existing trips</span>
        <span>Not part of the primary destination-decision journey</span>
      </footer>
    </main>
  );
}
