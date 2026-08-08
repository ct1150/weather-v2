import { addDestinationRangeToWorkspace } from "../trips/add-destination";
import { normalizeWorkspace, type TripCityOption, type TripWorkspace } from "../trips/workspace";

export interface DiscoveryTripAllocation {
  readonly city: TripCityOption;
  readonly dates: ReadonlyArray<string>;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function discoveryDateRange(from: string, to: string): ReadonlyArray<string> {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const dates: string[] = [];
  while (cursor <= end && dates.length < 16) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cursor <= end ? [] : dates;
}

export function allocateDiscoveryDates(
  cities: ReadonlyArray<TripCityOption>,
  dates: ReadonlyArray<string>,
): ReadonlyArray<DiscoveryTripAllocation> {
  const validDates = [...new Set(dates.filter(isIsoDate))].sort();
  if (cities.length === 0 || cities.length > 4 || validDates.length < cities.length) return [];

  const base = Math.floor(validDates.length / cities.length);
  const remainder = validDates.length % cities.length;
  let offset = 0;
  return cities.map((city, index) => {
    const count = base + (index < remainder ? 1 : 0);
    const assigned = validDates.slice(offset, offset + count);
    offset += count;
    return { city, dates: assigned };
  });
}

export function buildDiscoveryWorkspace(
  current: TripWorkspace | null,
  allocations: ReadonlyArray<DiscoveryTripAllocation>,
  options: {
    readonly append: boolean;
    readonly title: string;
    readonly now?: string;
  },
): TripWorkspace | null {
  if (allocations.length === 0) return current;
  let workspace = options.append ? current : null;
  for (const allocation of allocations) {
    workspace = addDestinationRangeToWorkspace(
      workspace,
      {
        cityId: allocation.city.cityId,
        cityName: allocation.city.cityName,
        countryName: allocation.city.countryName,
      },
      allocation.dates,
      { blankTitle: options.title, now: options.now },
    );
  }
  return workspace === null ? null : normalizeWorkspace(workspace, options.now);
}
