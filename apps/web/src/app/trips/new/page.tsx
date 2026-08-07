import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SmartTripImportForm } from "../../../components/SmartTripImportForm";
import { buildAlternates } from "../../seo";

export const metadata: Metadata = {
  title: "Import an existing trip itinerary",
  description:
    "Paste a Markdown, ChatGPT or structured itinerary and turn it into an editable weather-aware trip workspace.",
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
          Turn your existing plan into a weather-aware workspace
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Paste the itinerary you already have. The importer recognizes D1 or Day1 sections, tries
          to match supported cities and day types, and leaves only ambiguous days for you to confirm.
        </p>
      </section>
      <div className="mt-8">
        <SmartTripImportForm locale="en" />
      </div>
    </main>
  );
}
