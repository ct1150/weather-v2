import type { ReactElement } from "react";
import type { CityForecastDayViewModel } from "../app/view-models";
import {
  buildCityDirectAnswerCopy,
  buildCityDirectAnswerData,
  type CityDirectAnswerLocale,
} from "./city-direct-answer";

export function CityDirectAnswer({
  cityName,
  forecastDays,
  locale,
}: {
  readonly cityName: string;
  readonly forecastDays: ReadonlyArray<CityForecastDayViewModel>;
  readonly locale: CityDirectAnswerLocale;
}): ReactElement | null {
  const data = buildCityDirectAnswerData(forecastDays);
  if (data === null) return null;
  const copy = buildCityDirectAnswerCopy(cityName, data, locale);

  return (
    <section
      className="info-panel mt-5"
      aria-labelledby="city-weather-direct-answer"
      data-geo-direct-answer
    >
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2 id="city-weather-direct-answer" className="section-title mt-3">
        {copy.heading}
      </h2>
      <p className="mt-4 max-w-3xl text-lg font-bold leading-7 text-foreground">{copy.summary}</p>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{copy.dateGuidance}</p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="metric-block">
          <dt className="text-xs text-muted">{copy.periodLabel}</dt>
          <dd className="mt-1 font-bold text-foreground">{copy.periodValue}</dd>
        </div>
        <div className="metric-block">
          <dt className="text-xs text-muted">{copy.rainLabel}</dt>
          <dd className="mt-1 font-bold text-foreground">{copy.rainValue}</dd>
        </div>
      </dl>

      <p className="mt-4 max-w-3xl text-xs leading-5 text-muted">{copy.method}</p>
      <p className="mt-2 text-xs text-muted">
        {copy.updated !== null ? <>{copy.updated} · </> : null}
        {copy.source}: <a href="https://open-meteo.com/">Open-Meteo</a>
      </p>
    </section>
  );
}
