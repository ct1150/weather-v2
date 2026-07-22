// apps/web/src/app/[countrySlug]/[citySlug]/page.tsx
//
// City destination page (PRD-FR-004, DATA-WEATHER-001, UX-STATE-001). App Router
// page (T03): bakes the dataset, resolves country+city from `params`, and projects
// the `CityPageViewModel`. Statically exported via `generateStaticParams`.

import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import type {
  CityPageViewModel,
  DestinationLinkViewModel,
  ScoreViewModel,
  WeatherSummaryViewModel,
} from "../../view-models";
import { getBakedDataset, buildConfig, projectCity } from "../../../build/bake";

export interface CityPageProps {
  readonly viewModel: CityPageViewModel;
}

function renderScoreValue(score: ScoreViewModel): string {
  if (score.value === null) {
    if (score.state === "unavailable") return "Unavailable";
    if (score.state === "limited_data") return "Limited data";
    return "—";
  }
  return String(score.value);
}

function WeatherSummary({
  weather,
  unit,
}: {
  weather: WeatherSummaryViewModel;
  unit: "metric" | "imperial";
}) {
  const degree = unit === "metric" ? "°C" : "°F";
  return (
    <div>
      <p className="text-body">{weather.conditionLabel}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-body-small">
        <div>
          <dt className="text-caption text-muted">Temperature</dt>
          <dd className="font-medium">
            {weather.temperatureMin !== null ? `${weather.temperatureMin}${degree}` : "–"} /{" "}
            {weather.temperatureMax !== null ? `${weather.temperatureMax}${degree}` : "–"}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted">Rain chance</dt>
          <dd className="font-medium">
            {weather.rainProbability !== null ? `${weather.rainProbability}%` : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-caption text-muted">Observed at {weather.observedAt}</p>
    </div>
  );
}

export function CityPage({ viewModel }: CityPageProps) {
  const {
    city,
    weather,
    weatherState,
    score,
    forecastState,
    localDates,
    unit,
    relatedLinks,
    commercial,
  } = viewModel;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-foreground">
        {city.cityName}, {city.countryName}
      </h1>
      <p className="mt-2 text-caption text-muted">
        {city.timezone} · {city.latitude.toFixed(2)}, {city.longitude.toFixed(2)}
      </p>

      {/* Current weather (DATA-WEATHER-001) */}
      <section aria-label="Current weather" className="mt-8">
        <h2 className="text-heading-3 font-semibold text-foreground">Weather now</h2>
        {weatherState === "loading" ? (
          <p role="status" className="mt-2 text-body text-muted">
            Loading weather…
          </p>
        ) : null}
        {weatherState === "error" ? (
          <p role="alert" className="mt-2 text-body text-danger">
            We couldn’t load the current weather.
          </p>
        ) : null}
        {weatherState === "empty" ? (
          <p className="mt-2 text-body text-muted">No current weather available.</p>
        ) : null}
        {weatherState === "ready" && weather !== null ? (
          <div className="mt-2">
            <WeatherSummary weather={weather} unit={unit} />
          </div>
        ) : null}
      </section>

      {/* Travel Score */}
      <section aria-label="Travel Score" className="mt-8">
        <h2 className="text-heading-3 font-semibold text-foreground">Travel Score</h2>
        <p className="mt-2 text-body">
          <span className="font-medium">{renderScoreValue(score)}</span>
          {score.reasonCodes.length > 0 ? (
            <span className="ml-2 text-caption text-muted">{score.reasonCodes.join(", ")}</span>
          ) : null}
        </p>
      </section>

      {/* Forecast window */}
      <section aria-label="Forecast" className="mt-8">
        <h2 className="text-heading-3 font-semibold text-foreground">Forecast</h2>
        {forecastState === "loading" ? (
          <p role="status" className="mt-2 text-body text-muted">
            Loading forecast…
          </p>
        ) : null}
        {forecastState === "error" ? (
          <p role="alert" className="mt-2 text-body text-danger">
            We couldn’t load the forecast.
          </p>
        ) : null}
        {forecastState === "empty" ? (
          <p className="mt-2 text-body text-muted">No forecast available.</p>
        ) : null}
        {forecastState === "ready" && localDates.length > 0 ? (
          <p className="mt-2 text-body text-muted">Covering {localDates.join(", ")}</p>
        ) : null}
      </section>

      {/* Commercial / affiliate links — clearly disclosed (no effect on ranking). */}
      {commercial.length > 0 ? (
        <section aria-label="Travel services" className="mt-8">
          <h2 className="text-heading-3 font-semibold text-foreground">Travel services</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {commercial.map((item, index) => (
              <li
                key={index}
                className="rounded-pill border border-border px-3 py-1 text-caption text-muted"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-caption text-muted">
            These are affiliate links; they do not affect our recommendations.
          </p>
        </section>
      ) : null}

      {/* Related destinations */}
      {relatedLinks.length > 0 ? (
        <section aria-label="Related destinations" className="mt-8">
          <h2 className="text-heading-3 font-semibold text-foreground">Related destinations</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {relatedLinks.map((dest: DestinationLinkViewModel) => (
              <li key={dest.cityId}>
                <a
                  href={dest.path}
                  className="block rounded-lg border border-border bg-surface p-3 text-primary hover:bg-surface-elevated focus-ring"
                >
                  <span className="font-medium">{dest.cityName}</span>
                  <span className="ml-2 text-body-small text-muted">{dest.countryName}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-border pt-6 text-caption text-muted">
        Weather and Travel Score use the latest activated data; stale results remain usable but are
        labeled.
      </footer>
    </main>
  );
}

export async function generateStaticParams(): Promise<
  ReadonlyArray<{ countrySlug: string; citySlug: string }>
> {
  const dataset = await getBakedDataset();
  return dataset.cities.map((b) => ({ countrySlug: b.country.slug, citySlug: b.city.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}): Promise<{ title: string }> {
  const dataset = await getBakedDataset();
  const baked = dataset.cities.find(
    (b) => b.city.slug === params.citySlug && b.country.slug === params.countrySlug,
  );
  return {
    title: baked
      ? `${baked.city.name.en}, ${baked.country.name.en} — Where Not Rain`
      : "Where Not Rain",
  };
}

export default async function Page({
  params,
}: {
  params: { countrySlug: string; citySlug: string };
}): Promise<ReactElement> {
  const dataset = await getBakedDataset();
  const baked = dataset.cities.find(
    (b) => b.city.slug === params.citySlug && b.country.slug === params.countrySlug,
  );
  if (baked === undefined) notFound();
  const config = buildConfig();
  const viewModel = projectCity(dataset, params.countrySlug, params.citySlug, config.defaultLocale);
  return <CityPage viewModel={viewModel} />;
}
