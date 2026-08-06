import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripImportForm } from "../../../components/TripImportForm";

export const metadata: Metadata = {
  title: "Import a trip",
  robots: { index: false, follow: true },
};

export default function NewTripEnglishPage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Trip importer MVP</p>
      <h1 className="mt-4 text-4xl font-bold text-foreground">Paste a Markdown itinerary</h1>
      <p className="mt-3 text-muted">
        The parser accepts Chinese or English D1/Day1 headings. The preview UI currently uses
        Chinese sample content.
      </p>
      <div className="mt-8">
        <TripImportForm />
      </div>
    </main>
  );
}
