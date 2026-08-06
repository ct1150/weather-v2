import type { Metadata } from "next";
import type { ReactElement } from "react";
import { JsonLd } from "../../components/JsonLd";
import { buildAlternates, localeUrl } from "../seo";

export const metadata: Metadata = {
  title: "Weather-aware trip planning for Japan, Korea and Southeast Asia",
  description:
    "Build a multi-city itinerary, connect daily weather and know what to keep, move, shorten or replace when conditions change.",
  alternates: buildAlternates("/trips", "en", ["en", "zh-cn"]),
  robots: { index: true, follow: true },
};

const templates = [
  {
    id: "japan-family",
    label: "7-day family trip",
    title: "Tokyo → Kyoto → Osaka",
    description:
      "Balance temples, city walks, timed tickets and theme-park days with reliable indoor fallbacks.",
  },
  {
    id: "thailand-islands",
    label: "6-day city and island trip",
    title: "Bangkok → Phuket",
    description:
      "Use rain and wind to decide when to keep beach time, move a boat day or switch to the city plan.",
  },
  {
    id: "korea-city",
    label: "5-day city break",
    title: "Seoul → Busan",
    description:
      "Reorder palaces, viewpoints, markets and beaches without moving fixed train reservations.",
  },
] as const;

export default function TripsLanding(): ReactElement {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Where Not Rain Weather-aware Trip Planner",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    description: "Weather-aware itinerary planning for Japan, Korea and Southeast Asia travel.",
    url: localeUrl("en", "/trips"),
    inLanguage: "en",
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <section className="trip-hero">
        <div className="relative z-10 max-w-4xl">
          <p className="eyebrow">Weather-aware travel across Asia</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-6xl">
            Know what to keep, move,
            <br className="hidden sm:block" />
            shorten or replace
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Plan Japan, Korea and Southeast Asia trips around real weather without rebuilding the
            whole itinerary. Fixed trains and tickets stay protected while flexible outdoor days get
            practical fallback decisions.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="trip-primary-button" href="/trips/workspace">
              Build my trip
            </a>
            <a className="trip-secondary-button" href="/trips/new">
              Import a Markdown itinerary
            </a>
            <a className="trip-secondary-button" href="/zh-cn/trips">
              简体中文
            </a>
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-5 text-muted">
            Current weather coverage includes Japan, South Korea, Thailand, Vietnam, Singapore,
            Malaysia, Indonesia, the Philippines and Cambodia. Built for international travellers
            and overseas Chinese users; no account is required.
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="How the product works">
        {[
          [
            "01",
            "Build or import",
            "Add each city, day type, activity and fixed booking constraint.",
          ],
          [
            "02",
            "Refresh trip weather",
            "See rain, wind, heat and family-sensitive risk for every day.",
          ],
          [
            "03",
            "Travel with a fallback",
            "Share the plan, export it and keep the last forecast offline.",
          ],
        ].map(([number, title, description]) => (
          <article key={number} className="trip-process-card">
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="asia-trip-templates">
        <p className="eyebrow">Start with a real Asia itinerary</p>
        <h2 id="asia-trip-templates" className="section-title mt-3">
          Templates that demonstrate a weather decision, not generic AI text
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {templates.map((template) => (
            <article key={template.id} className="trip-process-card flex flex-col">
              <span>{template.label}</span>
              <h3>{template.title}</h3>
              <p className="flex-1">{template.description}</p>
              <a
                className="mt-5 text-sm font-bold text-primary"
                href={`/trips/workspace?template=${template.id}`}
              >
                Open this editable template →
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-5 rounded-[2rem] border border-border/80 bg-white p-6 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Built for the moments weather actually changes</p>
          <h2 className="section-title mt-3">More useful than a rain icon</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            A 60% rain forecast means different things for a museum, a boat trip, a beach day or a
            timed observation deck. The planner applies different rules and considers whether the
            day can move, plus whether children or older adults are travelling.
          </p>
        </div>
        <ul className="grid gap-3 text-sm leading-6 text-body">
          <li className="trip-side-card">Keep fixed flights, trains and timed tickets visible.</li>
          <li className="trip-side-card">Treat beaches, boats and viewpoints as wind-sensitive.</li>
          <li className="trip-side-card">
            Increase heat and cold caution for families and seniors.
          </li>
          <li className="trip-side-card">
            Store the itinerary locally and share an editable copy.
          </li>
        </ul>
      </section>

      <footer className="page-footer">
        <span>Where Not Rain · Weather-aware trip execution</span>
        <span>English-first global product · Asian destinations · local-first privacy</span>
      </footer>
    </main>
  );
}
