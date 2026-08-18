import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../components/JsonLd";
import { MyTripsDashboard } from "../../components/MyTripsDashboard";
import { buildAlternates, localeUrl } from "../seo";

export const metadata: Metadata = {
  title: "Shared weather-aware trip planning after choosing a destination",
  description:
    "Continue from a weather-informed destination choice into one shared trip with activities, comments, decisions and revisions.",
  alternates: buildAlternates("/trips", "en", ["en", "zh-hant", "zh-cn"]),
  robots: { index: true, follow: true },
};

export default function TripsLanding(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Where Not Rain shared trip planning",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    description:
      "Lightweight group trip planning after travellers choose a destination with the weather.",
    url: localeUrl("en", "/trips"),
    inLanguage: "en",
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />

      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">After the destination decision</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            Destination chosen?
            <br className="hidden sm:block" />
            Plan it together.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Keep days, activity ideas, comments and explicit decisions in one shared trip, with the
            daily weather visible as the plan takes shape. Start from destination discovery when the
            group has not chosen where to go.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/discover">
              Choose a destination first
            </a>
            <a className="trip-secondary-button" href="/trips/workspace">
              Open shared workspace
            </a>
          </div>
          <a
            className="mt-4 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline focus-ring"
            href="/trips/new"
          >
            Advanced: import an existing itinerary
          </a>
        </div>
      </section>

      <MyTripsDashboard locale="en" />

      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="Shared planning flow">
        {[
          [
            "01",
            "Start from one destination",
            "Carry the selected destination and dates into a shared trip.",
          ],
          [
            "02",
            "Build the activity shortlist",
            "Add ideas, discuss trade-offs and record explicit decisions separately from chat.",
          ],
          [
            "03",
            "Place activities by weather",
            "Use each day’s outlook to decide when indoor and outdoor plans fit best.",
          ],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 grid gap-5 rounded-[2rem] border border-border/80 bg-white p-6 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Collaboration with a clear purpose</p>
          <h2 className="section-title mt-3">Keep the group decision visible</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            This is not another open-ended AI itinerary generator. The shared workspace keeps the
            destination, dates, activity ideas and weather context together so the group can make
            and revisit explicit choices.
          </p>
        </div>
        <ul className="grid gap-3 text-sm leading-6 text-body">
          <li className="trip-side-card">Discuss the whole trip or one specific day.</li>
          <li className="trip-side-card">Record decisions separately from general comments.</li>
          <li className="trip-side-card">Review revisions when the shared itinerary changes.</li>
          <li className="trip-side-card">
            Keep local-first editing and opt into cloud collaboration only when useful.
          </li>
        </ul>
      </section>

      <footer className="page-footer">
        <span>Where Not Rain · Weather-first group planning</span>
        <span>
          Choose together first · plan together second · advanced execution remains optional
        </span>
      </footer>
    </main>
  );
}
