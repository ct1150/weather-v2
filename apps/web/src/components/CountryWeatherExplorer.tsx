"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from "react";
import type { CountryHeaderViewModel, CountryWeatherCityViewModel } from "../app/view-models";
import {
  InstantCountryWeatherExplorer,
  type CountryWeatherExplorerProps as InstantCountryWeatherExplorerProps,
} from "./InstantCountryWeatherExplorer";

export interface CountryWeatherDataset {
  readonly path: string;
  readonly country: CountryHeaderViewModel;
  readonly cities: ReadonlyArray<CountryWeatherCityViewModel>;
  readonly updatedLabel: string;
}

export interface CountryWeatherExplorerProps extends InstantCountryWeatherExplorerProps {
  readonly countryDatasets?: ReadonlyArray<CountryWeatherDataset> | undefined;
}

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
  const datasets = props.countryDatasets ?? [];
  const navigationLinkRef = useRef<HTMLAnchorElement | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [activeDataset, setActiveDataset] = useState<CountryWeatherDataset>({
    path:
      props.countries.find((item) => item.slug === props.country.slug.split("/").at(-1))?.path ??
      `/${props.country.slug}`,
    country: props.country,
    cities: props.cities,
    updatedLabel: props.updatedLabel,
  });

  const datasetByPath = useMemo(
    () => new Map(datasets.map((dataset) => [dataset.path, dataset] as const)),
    [datasets],
  );

  useEffect(() => {
    const currentPath =
      props.countries.find((item) => item.slug === props.country.slug.split("/").at(-1))?.path ??
      `/${props.country.slug}`;
    setActiveDataset({
      path: currentPath,
      country: props.country,
      cities: props.cities,
      updatedLabel: props.updatedLabel,
    });
  }, [props.cities, props.countries, props.country, props.updatedLabel]);

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

    const path = target.value;
    const dataset = datasetByPath.get(path);
    if (dataset !== undefined) setActiveDataset(dataset);
    setPendingHref(destinationHref(path));
  }

  return (
    <div onChangeCapture={switchCountry} data-country-switch-mode="optimistic-background-route">
      <InstantCountryWeatherExplorer
        country={activeDataset.country}
        countries={props.countries}
        cities={activeDataset.cities}
        updatedLabel={activeDataset.updatedLabel}
        locale={props.locale ?? "en"}
      />

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
