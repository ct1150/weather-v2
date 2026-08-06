import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripPlannerDashboard } from "../../../components/TripPlannerDashboard";
import { getQingganTripViewModel } from "../../../build/trip-weather";
import { buildAlternates } from "../../seo";

export const metadata: Metadata = {
  title: "Qinghai–Gansu family trip weather demo",
  description: "A nine-day weather-aware family itinerary with fixed constraints and fallback plans.",
  alternates: buildAlternates("/trips/qinggan-family-2026", "en", ["en", "zh-cn"]),
};

export default async function QingganTripEnglishPage(): Promise<ReactElement> {
  const trip = await getQingganTripViewModel();
  return <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><p className="eyebrow">End-to-end itinerary demo</p><h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">{trip.title}</h1><p className="mt-4 max-w-3xl text-muted">The itinerary content is currently localized in Simplified Chinese. English localization will follow after the core planner workflow is validated.</p><div className="mt-8"><TripPlannerDashboard trip={trip} /></div></main>;
}
