"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import type { CountryHeaderViewModel, CountryWeatherCityViewModel } from "../app/view-models";
import {
  InstantCountryWeatherExplorer,
  type CountryWeatherExplorerProps as InstantCountryWeatherExplorerProps,
} from "./InstantCountryWeatherExplorer";
import { DestinationDecisionCommercialSurface } from "./DestinationDecisionCommercialSurface";

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

function pageTitle(countryName: string, locale: CountryWeatherExplorerProps["locale"]): string {
  if (locale === "zh-cn") return `${countryName}哪里不下雨 — Where Not Rain`;
  if (locale === "zh-hant") return `${countryName}哪裡不下雨 — Where Not Rain`;
  return `${countryName} travel weather — Where Not Rain`;
}

function updateVisibleCountryChrome(
  dataset: CountryWeatherDataset,
  locale: CountryWeatherExplorerProps["locale"],
): void {
  const title = document.querySelector<HTMLElement>("[data-country-map-title]");
  const description = document.querySelector<HTMLElement>("[data-country-map-description]");
  const breadcrumb = document.querySelector<HTMLElement>("[data-country-map-breadcrumb]");

  if (title !== null) {
    title.textContent =
      locale === "zh-cn"
        ? `一张图看懂${dataset.country.name}哪里天气更好`
        : locale === "zh-hant"
          ? `一張圖看懂${dataset.country.name}哪裡天氣更好`
          : `${dataset.country.name} travel weather at a glance`;
  }

  if (description !== null) {
    description.textContent =
      locale === "zh-cn"
        ? `地图立即显示当前目录全部 ${dataset.cities.length} 个旅行地的天气图标、少雨天数和气温。点击任意地点，再查看逐日预报。`
        : locale === "zh-hant"
          ? `地圖立即顯示目前目錄全部 ${dataset.cities.length} 個旅行地的天氣圖示、少雨天數和氣溫。點擊任意地點，再查看逐日預報。`
          : `See all ${dataset.cities.length} supported travel destinations immediately, with weather icons, lower-rain days and temperatures. Tap any place only when you want the daily detail.`;
  }

  if (breadcrumb !== null) breadcrumb.textContent = dataset.country.name;
  document.title = pageTitle(dataset.country.name, locale);
}

export function CountryWeatherExplorer(props: CountryWeatherExplorerProps): ReactElement {
  const datasets = props.countryDatasets ?? [];
  const initialPath =
    props.countries.find((item) => item.slug === props.country.slug.split("/").at(-1))?.path ??
    `/${props.country.slug}`;
  const [activeDataset, setActiveDataset] = useState<CountryWeatherDataset>({
    path: initialPath,
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
    const restoreFromHistory = (): void => {
      const dataset = datasetByPath.get(window.location.pathname);
      if (dataset === undefined) return;
      setActiveDataset(dataset);
      updateVisibleCountryChrome(dataset, props.locale);
    };

    window.addEventListener("popstate", restoreFromHistory);
    return () => window.removeEventListener("popstate", restoreFromHistory);
  }, [datasetByPath, props.locale]);

  function switchCountry(event: ChangeEvent<HTMLDivElement>): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.classList.contains("country-select")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const path = target.value;
    const dataset = datasetByPath.get(path);
    const href = destinationHref(path);
    if (dataset === undefined) {
      window.location.assign(href);
      return;
    }

    setActiveDataset(dataset);
    updateVisibleCountryChrome(dataset, props.locale);
    window.history.pushState({ countryPath: path }, "", href);
  }

  return (
    <div onChangeCapture={switchCountry} data-country-switch-mode="local-state-history">
      <InstantCountryWeatherExplorer
        country={activeDataset.country}
        countries={props.countries}
        cities={activeDataset.cities}
        updatedLabel={activeDataset.updatedLabel}
        locale={props.locale ?? "en"}
      />
      <DestinationDecisionCommercialSurface
        locale={props.locale ?? "en"}
        routeTemplate="/[country]"
      />
    </div>
  );
}
