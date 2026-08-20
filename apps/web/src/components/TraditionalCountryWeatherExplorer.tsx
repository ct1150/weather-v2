"use client";

import type { ReactElement } from "react";
import type {
  CountryHeaderViewModel,
  CountryOptionViewModel,
  CountryWeatherCityViewModel,
} from "../app/view-models";
import { CountryWeatherExplorer } from "./CountryWeatherExplorer";

export interface TraditionalCountryWeatherExplorerProps {
  readonly country: CountryHeaderViewModel;
  readonly countries: ReadonlyArray<CountryOptionViewModel>;
  readonly cities: ReadonlyArray<CountryWeatherCityViewModel>;
  readonly updatedLabel: string;
}

/**
 * Compatibility wrapper. The country-map implementation is intentionally shared
 * across locales so map behaviour, filters and weather semantics cannot drift.
 */
export function TraditionalCountryWeatherExplorer(
  props: TraditionalCountryWeatherExplorerProps,
): ReactElement {
  return <CountryWeatherExplorer {...props} locale="zh-hant" />;
}
