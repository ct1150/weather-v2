import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripImportForm } from "../../../components/TripImportForm";
import { buildAlternates } from "../../seo";

export const metadata: Metadata = {
  title: "Import a trip itinerary",
  description:
    "Paste a Markdown itinerary and turn it into an editable weather-aware trip workspace.",
  alternates: buildAlternates("/trips/new", "en", ["en", "zh-hant", "zh-cn"]),
  robots: { index: false, follow: true },
};

export default function NewTripEnglishPage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="country-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <a href="/trips">Trip planner</a>
          </li>
          <li>Import itinerary</li>
        </ol>
      </nav>
      <section className="mt-6 max-w-3xl">
        <p className="eyebrow">Itinerary importer</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">
          Turn an existing plan into a weather-aware workspace
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Paste D1 or Day1 headings and Markdown schedule tables. The importer creates an editable
          trip where you can select forecast cities, protect fixed bookings and generate day-by-day
          fallback decisions.
        </p>
      </section>
      <div className="mt-8">
        <TripImportForm locale="en" />
      </div>
    </main>
  );
}
