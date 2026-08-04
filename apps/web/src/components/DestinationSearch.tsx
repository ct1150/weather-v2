"use client";

import { useId, useMemo, useState, type FormEvent, type ReactElement } from "react";
import { searchDestinations, type SearchCandidate } from "../search/search-destinations";

export interface DestinationSearchProps {
  readonly candidates: ReadonlyArray<SearchCandidate>;
}

export function DestinationSearch({ candidates }: DestinationSearchProps): ReactElement {
  const [query, setQuery] = useState("");
  const listId = useId();
  const normalized = query.trim();
  const results = useMemo(
    () => searchDestinations(normalized, candidates, { maxResults: 6 }),
    [candidates, normalized],
  );
  const showResults = normalized.length >= 2;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const first = results[0];
    if (first !== undefined) window.location.assign(first.path);
  }

  return (
    <div className="relative mt-7 max-w-2xl">
      <form role="search" aria-label="Find a destination" onSubmit={submit}>
        <label htmlFor="destination-search" className="sr-only">
          Search by city or country
        </label>
        <div className="search-shell">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 shrink-0 text-muted"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            id="destination-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Search Tokyo, Thailand, Seoul…"
            autoComplete="off"
            maxLength={80}
            aria-controls={listId}
            aria-expanded={showResults}
            className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted sm:text-base"
          />
          <button
            type="submit"
            disabled={results.length === 0}
            className="min-h-11 shrink-0 rounded-full bg-foreground px-4 text-sm font-bold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
          >
            View weather
          </button>
        </div>
      </form>

      {showResults ? (
        <div id={listId} className="search-results" role="region" aria-label="Search results">
          {results.length > 0 ? (
            <ul className="py-2">
              {results.map((result) => (
                <li key={result.cityId}>
                  <a href={result.path} className="search-result focus-ring">
                    <span>
                      <span className="block font-bold text-foreground">{result.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">{result.countryName}</span>
                    </span>
                    <span className="text-sm font-bold text-primary" aria-hidden="true">
                      View →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <p className="text-sm font-bold text-foreground">No destination found</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Try a nearby city or browse every destination on the map.
              </p>
              <a
                href="/explore"
                className="mt-3 inline-flex text-sm font-bold text-primary focus-ring"
              >
                Browse all destinations →
              </a>
            </div>
          )}
        </div>
      ) : null}
      <p className="mt-2 px-1 text-xs text-muted">
        Private by design — searches stay in your browser.
      </p>
    </div>
  );
}
