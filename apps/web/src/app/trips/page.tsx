import type { Metadata } from "next";
import type { ReactElement } from "react";
import { buildAlternates } from "../seo";

export const metadata: Metadata = {
  title: "Weather-aware trip planner",
  description:
    "Turn forecasts, bookings and activity constraints into an executable trip with fallback plans.",
  alternates: buildAlternates("/trips", "en", ["en", "zh-cn"]),
};

export default function TripsLanding(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <section className="trip-hero">
        <div className="relative z-10 max-w-3xl">
          <p className="eyebrow">Weather-aware Trip Planner</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            A forecast that can change the plan
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted">
            The first MVP connects hourly weather, fixed transport, activity deadlines and fallback
            plans. The complete Qinghai–Gansu demo is currently available in Simplified Chinese.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/zh-cn/trips/qinggan-family-2026">
              Open the Qinghai–Gansu demo
            </a>
            <a className="trip-secondary-button" href="/trips/new">
              Try Markdown import
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
