"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from "react";
import {
  InstantCountryWeatherExplorer,
  type CountryWeatherExplorerProps as InstantCountryWeatherExplorerProps,
} from "./InstantCountryWeatherExplorer";

export type CountryWeatherExplorerProps = InstantCountryWeatherExplorerProps;

const PRESERVED_COUNTRY_QUERY_KEYS = ["range", "from", "to"] as const;

function destinationHref(path: string): string {
  const destination = new URL(path, window.location.origin);
  const current = new URLSearchParams(window.location.search);
  for (const key of PRESERVED_COUNTRY_QUERY_KEYS) {
    const value = current.get(key);
    if (value !== null) destination.searchParams.set(key, value);
  }
  return `${destination.pathname}${destination.search}`;
}

export function CountryWeatherExplorer(props: CountryWeatherExplorerProps): ReactElement {
  const navigationLinkRef = useRef<HTMLAnchorElement | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (pendingHref === null || navigationLinkRef.current === null) return;
    navigationLinkRef.current.click();
    setPendingHref(null);
  }, [pendingHref]);

  function switchCountry(event: ChangeEvent<HTMLDivElement>): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.classList.contains("country-select")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setPendingHref(destinationHref(target.value));
  }

  return (
    <div onChangeCapture={switchCountry}>
      <InstantCountryWeatherExplorer {...props} />

      {pendingHref !== null ? (
        <Link
          ref={navigationLinkRef}
          href={pendingHref}
          prefetch
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        >
          Open selected country
        </Link>
      ) : null}

      <nav aria-hidden="true" className="sr-only" data-testid="country-prefetch-links">
        {props.countries.map((country) => (
          <Link key={country.path} href={country.path} prefetch tabIndex={-1}>
            {country.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}
