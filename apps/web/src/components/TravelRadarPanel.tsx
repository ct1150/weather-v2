import type { ReactElement } from "react";
import type { ExplorerMapMarker, TravelRadarViewModel, WindowControl } from "../app/view-models";
import { ExplorerMap } from "./ExplorerMap";

export interface TravelRadarPanelProps {
  readonly viewModel: TravelRadarViewModel;
  readonly windowControls: ReadonlyArray<WindowControl>;
  readonly mapMarkers?: ReadonlyArray<ExplorerMapMarker>;
}

function renderScore(score: TravelRadarViewModel["cards"][number]["score"]): string {
  if (score.value === null) {
    if (score.state === "unavailable") return "Unavailable";
    if (score.state === "limited_data") return "Limited data";
    return "—";
  }
  return String(score.value);
}

export function reasonLabel(reason: string): string {
  return reason
    .toLowerCase()
    .split("_")
    .map((word) => (word === "uv" ? "UV" : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function isCautionReason(reason: string): boolean {
  return /RISK|CAUTION|LIMITED|UNAVAILABLE/i.test(reason);
}

function tripVerdict(rainProbability: number | null): string {
  if (rainProbability === null) return "Check details";
  if (rainProbability <= 20) return "Strong dry-weather pick";
  if (rainProbability <= 45) return "A workable weather window";
  return "Rain is likely — compare before booking";
}

export function WeatherGlyph({ condition }: { condition: string }): ReactElement {
  const rainy = /rain|storm|shower/i.test(condition);
  const cloudy = /cloud|overcast|fog/i.test(condition);
  return (
    <span
      className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-elevated text-primary"
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
        {rainy || cloudy ? (
          <>
            <path
              d="M8.2 21h15.1a4.7 4.7 0 0 0 .1-9.4A7.5 7.5 0 0 0 9.3 14 3.6 3.6 0 0 0 8.2 21Z"
              fill="currentColor"
              opacity=".82"
            />
            {rainy ? (
              <path
                d="m11 24-1.2 2m6.8-2-1.2 2m6.8-2L21 26"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : null}
          </>
        ) : (
          <>
            <circle cx="16" cy="16" r="5.5" fill="currentColor" />
            <path
              d="M16 4v3m0 18v3M4 16h3m18 0h3M7.5 7.5l2.2 2.2m12.6 12.6 2.2 2.2m0-17-2.2 2.2M9.7 22.3l-2.2 2.2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </span>
  );
}

export function TravelRadarPanel({
  viewModel,
  windowControls,
  mapMarkers,
}: TravelRadarPanelProps): ReactElement {
  const { cards, freshness } = viewModel;
  const rankedCards = [...cards].sort(
    (left, right) => (right.score.value ?? -1) - (left.score.value ?? -1),
  );
  const selectedWindow = windowControls.find((control) => control.selected);

  return (
    <>
      <section
        id="recommendations"
        aria-label="Recommended destinations"
        className="mt-14 scroll-mt-24"
      >
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Travel radar</p>
            <h2 className="section-title mt-3">Best available weather, ranked</h2>
          </div>
          <p className="hidden text-sm text-muted sm:block">
            {cards.length} places checked · {freshness.updatedLabel}
          </p>
        </div>
        <div className="window-strip mb-6">
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">
              When are you going?
            </p>
            <p className="hidden text-xs text-muted sm:block">
              Dates use each destination’s local calendar
            </p>
          </div>
          <nav aria-label="Time window" className="flex gap-2 overflow-x-auto pb-1">
            {windowControls.map((control) => (
              <a
                key={control.window}
                href={control.href}
                data-window={control.window}
                aria-current={control.selected ? "true" : undefined}
                className={`min-h-11 shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition focus-ring ${control.selected ? "border-foreground bg-foreground text-white shadow-md shadow-foreground/15" : "border-border bg-surface text-foreground hover:border-primary/30 hover:bg-surface-elevated"}`}
                aria-label={
                  control.exactDates.length > 0
                    ? `${control.label} (${control.exactDates.join(", ")})`
                    : control.label
                }
              >
                <span>{control.label}</span>
                {control.exactDates.length > 0 ? (
                  <span
                    className={`ml-2 text-xs ${control.selected ? "text-white/65" : "text-muted"}`}
                  >
                    {control.exactDates.join(" – ")}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
        </div>
        <p className="mb-4 max-w-2xl text-sm leading-6 text-muted">
          Rankings show the strongest options in the current dataset, even when every destination
          has trade-offs. Review the warnings before booking.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rankedCards.map((card, index) => (
            <li key={card.destination.cityId}>
              <article className="destination-card">
                <div className="flex items-start justify-between gap-4">
                  <WeatherGlyph condition={card.weather.conditionLabel} />
                  <div className="score-orbit">
                    <div>
                      <p className="text-lg font-bold leading-none text-foreground">
                        {renderScore(card.score)}
                      </p>
                      <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">
                        Score
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  #{index + 1} · {card.destination.countryName}
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-[-0.02em]">
                  <a
                    href={card.destination.path}
                    className="before:absolute before:inset-0 text-foreground transition-colors hover:text-primary focus-ring"
                  >
                    {card.destination.cityName}
                  </a>
                </h3>
                <p className="mt-1 text-sm font-medium text-primary">
                  {card.weather.conditionLabel}
                </p>
                <p
                  className={`relative mt-4 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${card.weather.rainProbability !== null && card.weather.rainProbability <= 45 ? "signal-good" : "signal-caution"}`}
                >
                  {tripVerdict(card.weather.rainProbability)}
                </p>
                <dl className="relative mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="metric-block">
                    <dt className="text-xs text-muted">Temperature</dt>
                    <dd className="mt-0.5 font-bold text-foreground">
                      {card.weather.temperatureMin !== null
                        ? `${card.weather.temperatureMin}°`
                        : "–"}{" "}
                      /{" "}
                      {card.weather.temperatureMax !== null
                        ? `${card.weather.temperatureMax}°`
                        : "–"}
                    </dd>
                  </div>
                  <div className="metric-block">
                    <dt className="text-xs text-muted">Peak rain chance</dt>
                    <dd className="mt-0.5 font-bold text-foreground">
                      {card.weather.rainProbability !== null
                        ? `${card.weather.rainProbability}%`
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {card.reasonCodes.length > 0 ? (
                  <ul
                    className="relative mt-4 flex flex-wrap gap-1.5"
                    aria-label="Recommendation reasons"
                  >
                    {card.reasonCodes.map((reason) => (
                      <li
                        key={reason}
                        aria-label={`Reason: ${reason}`}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isCautionReason(reason) ? "signal-caution" : "signal-good"}`}
                      >
                        {reasonLabel(reason)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="relative mt-4 text-xs text-muted">
                  {freshness.updatedLabel}
                  {freshness.stale ? (
                    <span className="ml-2 font-medium text-warning">Stale data</span>
                  ) : null}
                </p>
                <span className="trip-action" aria-hidden="true">
                  See trip weather <span>→</span>
                </span>
              </article>
            </li>
          ))}
        </ul>
      </section>

      {(mapMarkers?.length ?? 0) > 0 ? (
        <ExplorerMap
          markers={mapMarkers ?? []}
          theme="general"
          windowLabel={selectedWindow?.label ?? "This window"}
        />
      ) : null}
    </>
  );
}
